import { create } from 'zustand';
import { db, type MonthMarker } from '../db';
import { findDataFile, downloadDataFile, createDataFile, updateDataFile } from '../gdriveService';
import { type WealthState } from './types';
import * as utils from './helpers';

export const useWealthStore = create<WealthState>((set, get) => ({
  // Core Initial State
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

  // ==========================================
  // CORE LIFECYCLE & ACCOUNTING PERIOD METHODS
  // ==========================================
  fetchInitialData: async () => {
    const [income, expenses, debts, monthMarkers] = await Promise.all([
      db.income.toArray(), db.expenses.toArray(), db.debts.toArray(), db.monthMarkers.toArray(),
    ]);
    const markerMonths = monthMarkers.map(m => m.monthYear);
    
    set({
      income, expenses, debts,
      monthMarkers: markerMonths,
      availableMonths: utils.recalculateAvailableMonths(income, expenses, debts, markerMonths),
      selectedMonthYear: utils.getNowString(),
      isLoading: false
    });

    const token = get().gdriveToken;
    if (!token) return;

    set({ isHydrating: true });
    try {
      const fileId = await findDataFile(token);
      if (fileId) {
        const cloudPayload = await downloadDataFile(token, fileId);
        if (cloudPayload) {
          await Promise.all([db.income.clear(), db.expenses.clear(), db.debts.clear(), db.monthMarkers.clear()]);
          if (cloudPayload.income?.length) await db.income.bulkAdd(cloudPayload.income);
          if (cloudPayload.expenses?.length) await db.expenses.bulkAdd(cloudPayload.expenses);
          if (cloudPayload.debts?.length) await db.debts.bulkAdd(cloudPayload.debts);
          if (cloudPayload.monthMarkers?.length) {
            const markerPayload: MonthMarker[] = cloudPayload.monthMarkers.map((m: string) => ({ monthYear: m }));
            await db.monthMarkers.bulkPut(markerPayload);
          }

          const [freshInc, freshExp, freshDebt, freshMarkers] = await Promise.all([
            db.income.toArray(), db.expenses.toArray(), db.debts.toArray(), db.monthMarkers.toArray()
          ]);
          const freshStrings = freshMarkers.map(m => m.monthYear);

          set({
            income: freshInc, expenses: freshExp, debts: freshDebt, monthMarkers: freshStrings,
            availableMonths: utils.recalculateAvailableMonths(freshInc, freshExp, freshDebt, freshStrings),
          });
        }
      }
    } catch (err) {
      console.error("Failed cloud pull:", err);
    } finally {
      set({ isHydrating: false });
    }
  },

  setGDriveToken: async (token) => {
    set({ gdriveToken: token });
    if (token) await get().fetchInitialData();
    return Promise.resolve();
  },

  setSelectedMonthYear: (monthYear) => set({ selectedMonthYear: monthYear }),

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
      const [income, expenses, debts, markers] = await Promise.all([db.income.toArray(), db.expenses.toArray(), db.debts.toArray(), db.monthMarkers.toArray()]);
      const markerStrings = markers.map(m => m.monthYear);
      set({ income, expenses, debts, monthMarkers: markerStrings, availableMonths: utils.recalculateAvailableMonths(income, expenses, debts, markerStrings), selectedMonthYear: targetMonth });
      get().syncWithCloud();
      return;
    }

    set(state => {
      const updatedMarkers = Array.from(new Set([...state.monthMarkers, targetMonth])).sort((a, b) => b.localeCompare(a));
      return {
        monthMarkers: updatedMarkers,
        availableMonths: utils.recalculateAvailableMonths(state.income, state.expenses, state.debts, updatedMarkers),
        selectedMonthYear: targetMonth,
      };
    });
    get().syncWithCloud();
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
      setTimeout(() => { if (get().lastDeletedSnapshot?.expiresAt! <= Date.now()) set({ lastDeletedSnapshot: null }); }, 10100);
      get().syncWithCloud();
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
      get().syncWithCloud();
    } catch (err) { console.error(err); }
  },

  // ==========================================
  // SYNC & DATA OPERATION ACTIONS
  // ==========================================
  hydrateFromCloud: async () => {
    set({ isHydrating: true });
    try { await get().syncWithCloud(); } finally { set({ isHydrating: false }); }
  },

  syncWithCloud: async () => {
    const { gdriveToken, income, expenses, debts, monthMarkers } = get();
    if (!gdriveToken) return;
    set({ syncStatus: 'syncing' });
    try {
      const fileId = await findDataFile(gdriveToken);
      const localPayload = { income, expenses, debts, monthMarkers };
      if (!fileId) await createDataFile(gdriveToken, localPayload);
      else await updateDataFile(gdriveToken, fileId, localPayload);
      set({ syncStatus: 'saved' });
      setTimeout(() => { if (get().syncStatus === 'saved') set({ syncStatus: 'idle' }); }, 3000);
    } catch (err) {
      console.error(err);
      set({ syncStatus: 'idle' });
    }
  },

  clearAllData: async () => {
    set({ isLoading: true });
    
    try {
      // 1. Completely drop all local IndexedDB tables instantly
      await Promise.all([
        db.income.clear(), 
        db.expenses.clear(), 
        db.debts.clear(), 
        db.monthMarkers.clear()
      ]);
      
      const freshMonth = utils.getNowString();
      const emptyPayload = { income: [], expenses: [], debts: [], monthMarkers: [] };

      // 2. Clear out the live runtime memory state of your app right away
      set({ 
        income: [], 
        expenses: [], 
        debts: [], 
        monthMarkers: [], 
        availableMonths: [freshMonth], 
        selectedMonthYear: freshMonth 
      });

      // 3. 💡 CRITICAL: Force-overwrite Google Drive with the completely empty payload
      const token = get().gdriveToken;
      if (token) {
        set({ syncStatus: 'syncing' });
        const fileId = await findDataFile(token);
        
        if (fileId) {
          // Forcefully overwrite the existing cloud file with empty array blocks
          await updateDataFile(token, fileId, emptyPayload);
        } else {
          // If no cloud file existed yet, construct a fresh blank backup file anchor
          await createDataFile(token, emptyPayload);
        }
        set({ syncStatus: 'saved' });
        setTimeout(() => { if (get().syncStatus === 'saved') set({ syncStatus: 'idle' }); }, 1500);
      }

    } catch (err) {
      console.error("Critical failure during destructive system purge control operations:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  // ==========================================
  // CRUD MUTATORS
  // ==========================================
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