import { create } from 'zustand';
import { db } from '../db';
import { findDataFile, updateDataFile } from '../gdriveService';
import { type WealthState } from './types';
import * as utils from './helpers';
import { ensureAndReadMetadata, upsertMetadata, loadShardIntoDb, syncMonthShard } from './cloudSync';

const AUTOSYNC_DEBOUNCE_MS = 1200;
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;

function queueAutoSync(syncAction: () => Promise<void>): void {
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
    // 1. Instantly paint whatever is cached locally in IndexedDB for 0ms UI blocking
    const localSnapshot = await readLocalSnapshot();
    const activePeriod = get().selectedMonthYear || utils.getNowString();
    
    set({
      ...localSnapshot,
      selectedMonthYear: activePeriod,
      isLoading: false
    });

    const token = get().gdriveToken;
    if (!token) return;

    set({ isHydrating: true });
    try {
      // 2. Load index metadata and 3. load active monthly shard
      await ensureAndReadMetadata(token, localSnapshot.monthMarkers);
      await loadShardIntoDb(token, activePeriod);

      // Re-read storage lines to paint fresh metrics on screen
      const freshSnapshot = await readLocalSnapshot();
      set(freshSnapshot);

    } catch (err) {
      console.error("Failed to load sharded source of truth:", err);
    } finally {
      set({ isHydrating: false });
    }
  },

  setGDriveToken: async (token) => {
    set({ gdriveToken: token });
    if (token) await get().fetchInitialData();
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