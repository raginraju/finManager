import { create } from 'zustand';
import { db, type MonthMarker } from '../db';
import { findDataFile, downloadDataFile, updateDataFile } from '../gdriveService';
import { type WealthState } from './types';
import * as utils from './helpers';
import { upsertMetadata, loadShardIntoDb, syncMonthShard } from './cloudSync';

const AUTOSYNC_DEBOUNCE_MS = 1200;
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let isFetchingInitialData = false;

function queueAutoSync(syncAction: () => Promise<void>): void {
  // Don't auto-sync while we're fetching initial data
  if (isFetchingInitialData) {
    console.log('[queueAutoSync] Skipping - fetching initial data in progress');
    return;
  }

  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
  }

  autoSyncTimer = setTimeout(() => {
    void syncAction();
    autoSyncTimer = null;
  }, AUTOSYNC_DEBOUNCE_MS);
}

async function readLocalSnapshot() {
  const [income, expenses, debts, markers] = await Promise.all([
    db.income.toArray(),
    db.expenses.toArray(),
    db.debts.toArray(),
    db.monthMarkers.toArray(),
  ]);

  const monthMarkers = markers.map((m) => m.monthYear);
  const availableMonths = utils.recalculateAvailableMonths(income, expenses, debts, monthMarkers);

  return { income, expenses, debts, monthMarkers, availableMonths };
}

async function clearCloudMonthShard(token: string, monthYear: string): Promise<void> {
  const shardId = await findDataFile(token, `ledger_${monthYear}.json`);
  if (shardId) {
    await updateDataFile(token, shardId, { income: [], expenses: [], debts: [] });
  }
}

export const useWealthStore = create<WealthState>((set, get) => ({
  income: [],
  expenses: [],
  debts: [],
  monthMarkers: [],
  lastDeletedSnapshot: null,
  isLoading: true,
  gdriveToken: null,
  selectedMonthYear: utils.getNowString(),
  availableMonths: [utils.getNowString()],
  syncStatus: 'idle',
  lastSyncedAt: null,
  isHydrating: false,

  // ========================================================
  // 💡 INITIALIZATION: Pull Meta Index first, then current Shard
  // ========================================================
  fetchInitialData: async () => {
    // Prevent concurrent fetches
    if (isFetchingInitialData) {
      console.log('[fetchInitialData] Already fetching, skipping');
      return;
    }

    isFetchingInitialData = true;
    console.log('[fetchInitialData] Starting, locked fetch flag');

    try {
      const token = get().gdriveToken;
      console.log('[fetchInitialData] Token status:', !!token);

      // If no token, just load local and stop
      if (!token) {
        console.log('[fetchInitialData] No token, loading local data only');
        const localSnapshot = await readLocalSnapshot();
        const activePeriod = get().selectedMonthYear || utils.getNowString();
        
        set({
          ...localSnapshot,
          selectedMonthYear: activePeriod,
          isLoading: false
        });
        return;
      }

      // Token exists - immediately show loading state (don't show stale data)
      console.log('[fetchInitialData] Token exists, loading from cloud as source of truth');
      set({ isLoading: true, isHydrating: true });

      try {
        // 1. CLEAR all local data first
        await Promise.all([
          db.income.clear(),
          db.expenses.clear(),
          db.debts.clear(),
          db.monthMarkers.clear(),
        ]);
        console.log('[fetchInitialData] Cleared local IndexedDB');

        // 2. Load metadata from cloud
        const cloudMetaId = await findDataFile(token, 'metadata.json');
        console.log('[fetchInitialData] Cloud metadata file ID:', cloudMetaId);
        let cloudMonths: string[] = [];

        if (cloudMetaId) {
          const cloudMeta = await downloadDataFile(token, cloudMetaId);
          console.log('[fetchInitialData] Cloud metadata:', cloudMeta);
          cloudMonths = Array.isArray(cloudMeta?.monthMarkers) ? cloudMeta.monthMarkers : [];
          console.log('[fetchInitialData] Cloud months:', cloudMonths);
          
          if (cloudMonths.length) {
            const markerPayload: MonthMarker[] = cloudMonths.map((monthYear) => ({ monthYear }));
            await db.monthMarkers.bulkPut(markerPayload);
            console.log('[fetchInitialData] Stored month markers in local DB');
          }
        }

        // 3. Load active period shard from cloud
        const activePeriod = get().selectedMonthYear || utils.getNowString();
        const activeShard = cloudMonths.length ? cloudMonths[0] : activePeriod;
        console.log('[fetchInitialData] Loading shard for month:', activeShard);
        const shardLoaded = await loadShardIntoDb(token, activeShard);
        console.log('[fetchInitialData] Shard loaded:', shardLoaded);

        // 4. Refresh UI with cloud data
        const freshSnapshot = await readLocalSnapshot();
        console.log('[fetchInitialData] Fresh snapshot after cloud load:', freshSnapshot);
        set({ 
          ...freshSnapshot, 
          selectedMonthYear: activeShard, 
          isLoading: false,
          isHydrating: false 
        });

      } catch (err) {
        console.error("Failed to load from cloud:", err);
        set({ isLoading: false, isHydrating: false });
      }
    } finally {
      isFetchingInitialData = false;
      console.log('[fetchInitialData] Unlocked fetch flag');
    }
  },

  setGDriveToken: async (token) => {
    console.log('[setGDriveToken] Setting token and fetching data');
    set({ gdriveToken: token });
    if (token) {
      await get().fetchInitialData();
    }
    console.log('[setGDriveToken] Done');
    return Promise.resolve();
  },

  // ========================================================
  // 💡 LAZY LOADING: Load target historical months on demand
  // ========================================================
  setSelectedMonthYear: async (monthYear) => {
    set({ selectedMonthYear: monthYear });
    
    const token = get().gdriveToken;
    if (!token) return;

    set({ isHydrating: true });
    try {
      const loaded = await loadShardIntoDb(token, monthYear);

      if (loaded) {
        const refreshed = await readLocalSnapshot();
        set({ ...refreshed, selectedMonthYear: monthYear });
      }
    } catch (err) {
      console.error(`Failed lazy loading shard for period ${monthYear}:`, err);
    } finally {
      set({ isHydrating: false });
    }
  },

  addMonthYear: async (monthYear, copyFromPrevious = false) => {
    const targetMonth = utils.toMonthDate(monthYear) ? monthYear : utils.getNowString();
    await db.monthMarkers.put({ monthYear: targetMonth });

    if (copyFromPrevious) {
      const previousMonth = utils.getPreviousMonthString(targetMonth);
      if (previousMonth) {
        const state = get();
        const hasTargetData = state.income.some(i => i.monthYear === targetMonth) ||
                              state.expenses.some(e => e.monthYear === targetMonth) ||
                              state.debts.some(d => d.monthYear === targetMonth);

        if (!hasTargetData) {
          const prevInc = state.income.filter(i => i.monthYear === previousMonth);
          const prevExp = state.expenses.filter(e => e.monthYear === previousMonth);
          const prevDebt = state.debts.filter(d => d.monthYear === previousMonth);

          if (prevInc.length) await db.income.bulkAdd(prevInc.map(({ id, ...i }) => ({ ...i, monthYear: targetMonth, updatedAt: new Date() })));
          if (prevExp.length) await db.expenses.bulkAdd(prevExp.map(({ id, ...e }) => ({ ...e, monthYear: targetMonth, date: utils.mapDateToTargetMonth(e.date, targetMonth) })));
          if (prevDebt.length) await db.debts.bulkAdd(prevDebt.map(({ id, ...d }) => ({ ...d, monthYear: targetMonth })));
        }
      }
    }

    const snapshot = await readLocalSnapshot();
    
    set({ 
      ...snapshot,
      selectedMonthYear: targetMonth 
    });

    await get().syncWithCloud();
    const token = get().gdriveToken;
    if (token) {
      await upsertMetadata(token, snapshot.monthMarkers);
    }
  },

  deleteMonthYear: async (monthYear) => {
    try {
      const [marker, incDel, expDel, debtDel] = await Promise.all([
        db.monthMarkers.get(monthYear),
        db.income.where('monthYear').equals(monthYear).toArray(),
        db.expenses.where('monthYear').equals(monthYear).toArray(),
        db.debts.where('monthYear').equals(monthYear).toArray(),
      ]);

      const snapshot = { monthYear, income: incDel, expenses: expDel, debts: debtDel, markerExists: !!marker, expiresAt: Date.now() + 10000 };
      await Promise.all([db.monthMarkers.delete(monthYear), db.income.where('monthYear').equals(monthYear).delete(), db.expenses.where('monthYear').equals(monthYear).delete(), db.debts.where('monthYear').equals(monthYear).delete()]);

      const refreshed = await readLocalSnapshot();

      set({
        ...refreshed,
        selectedMonthYear: refreshed.availableMonths[0] ?? utils.getNowString(),
        lastDeletedSnapshot: snapshot,
      });
      
      const token = get().gdriveToken;
      if (token) {
        await upsertMetadata(token, refreshed.monthMarkers);
        await clearCloudMonthShard(token, monthYear);
        set({ lastSyncedAt: Date.now() });
      }

      setTimeout(() => { if (get().lastDeletedSnapshot?.expiresAt! <= Date.now()) set({ lastDeletedSnapshot: null }); }, 10100);
    } catch (err) { console.error(err); }
  },

  undoDeleteMonthYear: async () => {
    const snapshot = get().lastDeletedSnapshot;
    if (!snapshot) return;
    try {
      if (snapshot.markerExists) await db.monthMarkers.put({ monthYear: snapshot.monthYear });
      if (snapshot.income.length) await db.income.bulkAdd(snapshot.income.map(({ id, ...r }) => r));
      if (snapshot.expenses.length) await db.expenses.bulkAdd(snapshot.expenses.map(({ id, ...r }) => r));
      if (snapshot.debts.length) await db.debts.bulkAdd(snapshot.debts.map(({ id, ...r }) => r));

      const restored = await readLocalSnapshot();
      
      set({ ...restored, selectedMonthYear: snapshot.monthYear, lastDeletedSnapshot: null });
      
      await get().syncWithCloud();
      const token = get().gdriveToken;
      if (token) {
        await upsertMetadata(token, restored.monthMarkers);
      }
    } catch (err) { console.error(err); }
  },

  hydrateFromCloud: async () => {
    await get().fetchInitialData();
  },

  // ========================================================
  // 💡 TARGETED WRITING: Only push active isolated shard file
  // ========================================================
  syncWithCloud: async () => {
    const { gdriveToken, income, expenses, debts, selectedMonthYear } = get();
    if (!gdriveToken) return;
    if (get().syncStatus === 'syncing') return;
    set({ syncStatus: 'syncing' });
    try {
      await syncMonthShard(gdriveToken, selectedMonthYear, income, expenses, debts);

      set({ syncStatus: 'saved', lastSyncedAt: Date.now() });
      setTimeout(() => { if (get().syncStatus === 'saved') set({ syncStatus: 'idle' }); }, 3000);
    } catch (err) {
      console.error(err);
      set({ syncStatus: 'idle' });
    }
  },

  clearAllData: async () => {
    set({ isLoading: true });
    await Promise.all([db.income.clear(), db.expenses.clear(), db.debts.clear(), db.monthMarkers.clear()]);
    const freshMonth = utils.getNowString();
    set({ income: [], expenses: [], debts: [], monthMarkers: [], availableMonths: [freshMonth], selectedMonthYear: freshMonth, lastDeletedSnapshot: null });
    
    const token = get().gdriveToken;
    if (token) {
      await upsertMetadata(token, [freshMonth]);
      await clearCloudMonthShard(token, freshMonth);
      set({ lastSyncedAt: Date.now() });
    }
    set({ isLoading: false });
  },

  addExpense: async (expense) => {
    await db.expenses.add(expense);
    const updated = await db.expenses.toArray();
    set(state => ({ expenses: updated, availableMonths: utils.recalculateAvailableMonths(state.income, updated, state.debts, state.monthMarkers) }));
    queueAutoSync(get().syncWithCloud);
  },

  deleteExpense: async (id) => {
    await db.expenses.delete(id);
    const updated = await db.expenses.toArray();
    set(state => ({ expenses: updated, availableMonths: utils.recalculateAvailableMonths(state.income, updated, state.debts, state.monthMarkers) }));
    queueAutoSync(get().syncWithCloud);
  },

  upsertIncome: async (payload) => {
    await db.income.put(payload as any);
    const updated = await db.income.toArray();
    set(state => ({ income: updated, availableMonths: utils.recalculateAvailableMonths(updated, state.expenses, state.debts, state.monthMarkers) }));
    queueAutoSync(get().syncWithCloud);
  },

  upsertDebt: async (payload) => {
    await db.debts.put(payload as any);
    const updated = await db.debts.toArray();
    set(state => ({ debts: updated, availableMonths: utils.recalculateAvailableMonths(state.income, state.expenses, updated, state.monthMarkers) }));
    queueAutoSync(get().syncWithCloud);
  },
}));