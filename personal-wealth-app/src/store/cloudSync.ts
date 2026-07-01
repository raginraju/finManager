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

  if (!shardId) {
    return false;
  }

  const cloudShard = (await downloadDataFile(token, shardId)) as CloudShardPayload;
  if (!cloudShard) {
    return false;
  }

  await Promise.all([
    db.income.where('monthYear').equals(monthYear).delete(),
    db.expenses.where('monthYear').equals(monthYear).delete(),
    db.debts.where('monthYear').equals(monthYear).delete(),
  ]);

  if (cloudShard.income?.length) await db.income.bulkAdd(cloudShard.income);
  if (cloudShard.expenses?.length) await db.expenses.bulkAdd(cloudShard.expenses);
  if (cloudShard.debts?.length) await db.debts.bulkAdd(cloudShard.debts);

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
    return;
  }

  await updateDataFile(token, fileId, activePayload);
}