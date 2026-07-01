import { db, type MonthMarker, type IncomeSource, type Expense, type DebtLiability } from '../db';
import { findDataFile, downloadDataFile, createDataFile, updateDataFile } from '../gdriveService';
import { extractShardPayload } from './helpers';

export interface CloudMetaPayload {
  monthMarkers?: string[];
}

export interface CloudShardPayload {
  income?: IncomeSource[];
  expenses?: Expense[];
  debts?: DebtLiability[];
}

export async function ensureAndReadMetadata(token: string, fallbackMonthMarkers: string[]): Promise<string[]> {
  const metaId = await findDataFile(token, 'metadata.json');

  if (!metaId) {
    await createDataFile(token, { monthMarkers: fallbackMonthMarkers }, 'metadata.json');
    return fallbackMonthMarkers;
  }

  const cloudMeta = (await downloadDataFile(token, metaId)) as CloudMetaPayload;
  const markers = Array.isArray(cloudMeta?.monthMarkers) ? cloudMeta.monthMarkers : [];

  if (markers.length) {
    const markerPayload: MonthMarker[] = markers.map((monthYear) => ({ monthYear }));
    await db.monthMarkers.bulkPut(markerPayload);
  }

  return markers;
}

export async function upsertMetadata(token: string, monthMarkers: string[]): Promise<void> {
  const metaId = await findDataFile(token, 'metadata.json');

  if (!metaId) {
    await createDataFile(token, { monthMarkers }, 'metadata.json');
    return;
  }

  await updateDataFile(token, metaId, { monthMarkers });
}

export async function loadShardIntoDb(token: string, monthYear: string): Promise<boolean> {
  const shardName = `ledger_${monthYear}.json`;
  const shardId = await findDataFile(token, shardName);
  console.log(`[loadShardIntoDb] Looking for shard: ${shardName}, found ID:`, shardId);

  if (!shardId) {
    console.log(`[loadShardIntoDb] No shard found for ${monthYear}`);
    return false;
  }

  const cloudShard = (await downloadDataFile(token, shardId)) as CloudShardPayload;
  console.log(`[loadShardIntoDb] Downloaded shard:`, cloudShard);
  
  if (!cloudShard) {
    console.log(`[loadShardIntoDb] Cloud shard is null/undefined`);
    return false;
  }

  console.log(`[loadShardIntoDb] Clearing data for month ${monthYear}`);
  await Promise.all([
    db.income.where('monthYear').equals(monthYear).delete(),
    db.expenses.where('monthYear').equals(monthYear).delete(),
    db.debts.where('monthYear').equals(monthYear).delete(),
  ]);

  if (cloudShard.income?.length) {
    console.log(`[loadShardIntoDb] Adding ${cloudShard.income.length} income entries`);
    await db.income.bulkAdd(cloudShard.income);
  }
  if (cloudShard.expenses?.length) {
    console.log(`[loadShardIntoDb] Adding ${cloudShard.expenses.length} expense entries`);
    await db.expenses.bulkAdd(cloudShard.expenses);
  }
  if (cloudShard.debts?.length) {
    console.log(`[loadShardIntoDb] Adding ${cloudShard.debts.length} debt entries`);
    await db.debts.bulkAdd(cloudShard.debts);
  }

  console.log(`[loadShardIntoDb] Finished loading shard for ${monthYear}`);
  return true;
}

export async function syncMonthShard(
  token: string,
  selectedMonthYear: string,
  income: IncomeSource[],
  expenses: Expense[],
  debts: DebtLiability[],
): Promise<void> {
  const shardName = `ledger_${selectedMonthYear}.json`;
  const fileId = await findDataFile(token, shardName);
  const activePayload = extractShardPayload(income, expenses, debts, selectedMonthYear);

  if (!fileId) {
    await createDataFile(token, activePayload, shardName);
  } else {
    await updateDataFile(token, fileId, activePayload);
  }

  // After syncing shard, ensure metadata has this month listed
  const metaId = await findDataFile(token, 'metadata.json');
  if (metaId) {
    const cloudMeta = (await downloadDataFile(token, metaId)) as { monthMarkers?: string[] };
    const monthMarkers = Array.isArray(cloudMeta?.monthMarkers) ? cloudMeta.monthMarkers : [];
    
    // Add month if not already in list
    if (!monthMarkers.includes(selectedMonthYear)) {
      monthMarkers.push(selectedMonthYear);
      monthMarkers.sort((a, b) => b.localeCompare(a));
      await updateDataFile(token, metaId, { monthMarkers });
      console.log(`[syncMonthShard] Updated metadata with month: ${selectedMonthYear}`);
    }
  }
}