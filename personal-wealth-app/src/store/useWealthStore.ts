import { create } from 'zustand';
import { db, type MonthMarker } from '../db';
import { findDataFile, downloadDataFile, createDataFile, updateDataFile } from '../gdriveService';
import { type WealthState } from './types';
import * as utils from './helpers';

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
  isHydrating: false,

  // ========================================================
  // 💡 INITIALIZATION: Pull Meta Index first, then current Shard
  // ========================================================
  fetchInitialData: async () => {
    // 1. Instantly paint whatever is cached locally in IndexedDB for 0ms UI blocking
    const [income, expenses, debts, monthMarkers] = await Promise.all([
      db.income.toArray(), db.expenses.toArray(), db.debts.toArray(), db.monthMarkers.toArray(),
    ]);
    const markerMonths = monthMarkers.map((m) => m.monthYear);
    const months = utils.recalculateAvailableMonths(income, expenses, debts, markerMonths);
    const activePeriod = get().selectedMonthYear || utils.getNowString();
    
    set({
      income, expenses, debts,
      monthMarkers: markerMonths,
      availableMonths: months,
      selectedMonthYear: activePeriod,
      isLoading: false
    });

    const token = get().gdriveToken;
    if (!token) return;

    set({ isHydrating: true });
    try {
      // 2. Load Global Index Meta File
      const metaId = await findDataFile(token, 'metadata.json');
      let currentCloudMarkers: string[] = [];
      
      if (metaId) {
        const cloudMeta = await downloadDataFile(token, metaId);
        if (cloudMeta?.monthMarkers?.length) {
          currentCloudMarkers = cloudMeta.monthMarkers;
          const markerPayload: MonthMarker[] = currentCloudMarkers.map((m) => ({ monthYear: m }));
          await db.monthMarkers.bulkPut(markerPayload);
        }
      } else {
        // If app is fresh, establish metadata.json initialization file anchor
        await createDataFile(token, { monthMarkers: markerMonths }, 'metadata.json');
        currentCloudMarkers = markerMonths;
      }

      // 3. Load Active Shard File Only
      const shardName = `ledger_${activePeriod}.json`;
      const shardId = await findDataFile(token, shardName);

      if (shardId) {
        const cloudShard = await downloadDataFile(token, shardId);
        if (cloudShard) {
          // Clear active target month rows locally to ensure clean overwritten integration
          await Promise.all([
            db.income.where('monthYear').equals(activePeriod).delete(),
            db.expenses.where('monthYear').equals(activePeriod).delete(),
            db.debts.where('monthYear').equals(activePeriod).delete(),
          ]);

          if (cloudShard.income?.length) await db.income.bulkAdd(cloudShard.income);
          if (cloudShard.expenses?.length) await db.expenses.bulkAdd(cloudShard.expenses);
          if (cloudShard.debts?.length) await db.debts.bulkAdd(cloudShard.debts);
        }
      }

      // Re-read storage lines to paint fresh metrics on screen
      const [freshInc, freshExp, freshDebt, freshMarkers] = await Promise.all([
        db.income.toArray(), db.expenses.toArray(), db.debts.toArray(), db.monthMarkers.toArray()
      ]);
      const freshStrings = freshMarkers.map((m) => m.monthYear);

      set({
        income: freshInc, expenses: freshExp, debts: freshDebt, monthMarkers: freshStrings,
        availableMonths: utils.recalculateAvailableMonths(freshInc, freshExp, freshDebt, freshStrings),
      });

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
      const shardName = `ledger_${monthYear}.json`;
      const shardId = await findDataFile(token, shardName);
      
      if (shardId) {
        const cloudShard = await downloadDataFile(token, shardId);
        if (cloudShard) {
          await Promise.all([
            db.income.where('monthYear').equals(monthYear).delete(),
            db.expenses.where('monthYear').equals(monthYear).delete(),
            db.debts.where('monthYear').equals(monthYear).delete(),
          ]);

          if (cloudShard.income?.length) await db.income.bulkAdd(cloudShard.income);
          if (cloudShard.expenses?.length) await db.expenses.bulkAdd(cloudShard.expenses);
          if (cloudShard.debts?.length) await db.debts.bulkAdd(cloudShard.debts);

          const [income, expenses, debts] = await Promise.all([
            db.income.toArray(), db.expenses.toArray(), db.debts.toArray()
          ]);
          set({ income, expenses, debts });
        }
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

    const [income, expenses, debts, markers] = await Promise.all([db.income.toArray(), db.expenses.toArray(), db.debts.toArray(), db.monthMarkers.toArray()]);
    const markerStrings = markers.map(m => m.monthYear);
    
    set({ 
      income, expenses, debts, monthMarkers: markerStrings, 
      availableMonths: utils.recalculateAvailableMonths(income, expenses, debts, markerStrings), 
      selectedMonthYear: targetMonth 
    });

    await get().syncWithCloud();
    const token = get().gdriveToken;
    if (token) {
      const metaId = await findDataFile(token, 'metadata.json');
      if (metaId) await updateDataFile(token, metaId, { monthMarkers: markerStrings });
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

      const [income, expenses, debts, markers] = await Promise.all([db.income.toArray(), db.expenses.toArray(), db.debts.toArray(), db.monthMarkers.toArray()]);
      const markerStrings = markers.map(m => m.monthYear);
      const months = utils.recalculateAvailableMonths(income, expenses, debts, markerStrings);

      set({ income, expenses, debts, monthMarkers: markerStrings, availableMonths: months, selectedMonthYear: months[0] ?? utils.getNowString(), lastDeletedSnapshot: snapshot });
      
      const token = get().gdriveToken;
      if (token) {
        const metaId = await findDataFile(token, 'metadata.json');
        if (metaId) await updateDataFile(token, metaId, { monthMarkers: markerStrings });
        const shardId = await findDataFile(token, `ledger_${monthYear}.json`);
        if (shardId) await updateDataFile(token, shardId, { income: [], expenses: [], debts: [] });
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

      const [income, expenses, debts, markers] = await Promise.all([db.income.toArray(), db.expenses.toArray(), db.debts.toArray(), db.monthMarkers.toArray()]);
      const markerStrings = markers.map(m => m.monthYear);
      
      set({ income, expenses, debts, monthMarkers: markerStrings, availableMonths: utils.recalculateAvailableMonths(income, expenses, debts, markerStrings), selectedMonthYear: snapshot.monthYear, lastDeletedSnapshot: null });
      
      await get().syncWithCloud();
      const token = get().gdriveToken;
      if (token) {
        const metaId = await findDataFile(token, 'metadata.json');
        if (metaId) await updateDataFile(token, metaId, { monthMarkers: markerStrings });
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
    set({ syncStatus: 'syncing' });
    try {
      const shardName = `ledger_${selectedMonthYear}.json`;
      const fileId = await findDataFile(gdriveToken, shardName);
      
      // Isolate current memory arrays down to just the targeted monthly items
      const activePayload = utils.extractShardPayload(income, expenses, debts, selectedMonthYear);

      if (!fileId) {
        await createDataFile(gdriveToken, activePayload, shardName);
      } else {
        await updateDataFile(gdriveToken, fileId, activePayload);
      }

      set({ syncStatus: 'saved' });
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
    set({ income: [], expenses: [], debts: [], monthMarkers: [], availableMonths: [freshMonth], selectedMonthYear: freshMonth });
    
    const token = get().gdriveToken;
    if (token) {
      const metaId = await findDataFile(token, 'metadata.json');
      if (metaId) await updateDataFile(token, metaId, { monthMarkers: [freshMonth] });
      const shardId = await findDataFile(token, `ledger_${freshMonth}.json`);
      if (shardId) await updateDataFile(token, shardId, { income: [], expenses: [], debts: [] });
    }
    set({ isLoading: false });
  },

  addExpense: async (expense) => {
    await db.expenses.add(expense);
    const updated = await db.expenses.toArray();
    set(state => ({ expenses: updated, availableMonths: utils.recalculateAvailableMonths(state.income, updated, state.debts, state.monthMarkers) }));
    get().syncWithCloud();
  },

  deleteExpense: async (id) => {
    await db.expenses.delete(id);
    const updated = await db.expenses.toArray();
    set(state => ({ expenses: updated, availableMonths: utils.recalculateAvailableMonths(state.income, updated, state.debts, state.monthMarkers) }));
    get().syncWithCloud();
  },

  upsertIncome: async (payload) => {
    await db.income.put(payload as any);
    const updated = await db.income.toArray();
    set(state => ({ income: updated, availableMonths: utils.recalculateAvailableMonths(updated, state.expenses, state.debts, state.monthMarkers) }));
    get().syncWithCloud();
  },

  upsertDebt: async (payload) => {
    await db.debts.put(payload as any);
    const updated = await db.debts.toArray();
    set(state => ({ debts: updated, availableMonths: utils.recalculateAvailableMonths(state.income, state.expenses, updated, state.monthMarkers) }));
    get().syncWithCloud();
  },
}));