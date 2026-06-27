import { create } from 'zustand';
import { db, type IncomeSource, type Expense, type DebtLiability, type MonthMarker } from './db';
import { findDataFile, downloadDataFile, createDataFile, updateDataFile } from './gdriveService';

interface WealthState {
  income: IncomeSource[];
  expenses: Expense[];
  debts: DebtLiability[];
  monthMarkers: string[];
  isLoading: boolean;
  gdriveToken: string | null;
  selectedMonthYear: string; // Current active view index
  availableMonths: string[]; // Descending list of active record blocks
  syncStatus: 'idle' | 'syncing' | 'saved';
  isHydrating: boolean;

  fetchInitialData: () => Promise<void>;
  setSelectedMonthYear: (monthYear: string) => void;
  addMonthYear: (monthYear: string, copyFromPrevious?: boolean) => Promise<void>;
  hydrateFromCloud: () => Promise<void>;
  setGDriveToken: (token: string | null) => void;
  deleteMonthYear: (monthYear: string) => Promise<void>;
  lastDeletedSnapshot: null | {
    monthYear: string;
    income: IncomeSource[];
    expenses: Expense[];
    debts: DebtLiability[];
    markerExists: boolean;
    expiresAt: number;
  };
  undoDeleteMonthYear: () => Promise<void>;
  syncWithCloud: () => Promise<void>;
  clearAllData: () => Promise<void>;

  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  deleteExpense: (id: number) => Promise<void>;
  upsertIncome: (income: Omit<IncomeSource, 'id'> & { id?: number }) => Promise<void>;
  upsertDebt: (debt: Omit<DebtLiability, 'id'> & { id?: number }) => Promise<void>;
}

export const useWealthStore = create<WealthState>((set, get) => {
  // Helpers to establish month indices
  const getNowString = () => new Date().toISOString().slice(0, 7);

  const toMonthDate = (monthYear: string) => {
    const [year, month] = monthYear.split('-').map(Number);
    if (!year || !month || month < 1 || month > 12) return null;
    return new Date(year, month - 1, 1);
  };

  const getPreviousMonthString = (monthYear: string) => {
    const date = toMonthDate(monthYear);
    if (!date) return null;
    const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
  };

  const mapDateToTargetMonth = (dateValue: string, targetMonthYear: string) => {
    const sourceDate = new Date(dateValue);
    if (Number.isNaN(sourceDate.getTime())) {
      return `${targetMonthYear}-01`;
    }

    const [year, month] = targetMonthYear.split('-').map(Number);
    if (!year || !month) {
      return dateValue;
    }

    const daysInTargetMonth = new Date(year, month, 0).getDate();
    const day = Math.min(sourceDate.getDate(), daysInTargetMonth);
    const mapped = new Date(year, month - 1, day);
    return mapped.toISOString().split('T')[0];
  };

  const recalculateAvailableMonths = (
    income: IncomeSource[],
    expenses: Expense[],
    debts: DebtLiability[],
    monthMarkers: string[]
  ) => {
    const months = new Set<string>([getNowString()]); // Always guarantee current month block
    monthMarkers.forEach(m => months.add(m));
    income.forEach(i => months.add(i.monthYear));
    expenses.forEach(e => months.add(e.monthYear));
    debts.forEach(d => months.add(d.monthYear));
    return Array.from(months).sort((a, b) => b.localeCompare(a)); // Sort Descending
  };

  return {
    income: [],
    expenses: [],
    debts: [],
    monthMarkers: [],
    lastDeletedSnapshot: null,
    isLoading: true,
    gdriveToken: null,
    selectedMonthYear: getNowString(),
    availableMonths: [getNowString()],
    syncStatus: 'idle',
    isHydrating: false,

    fetchInitialData: async () => {
      const [income, expenses, debts, monthMarkers] = await Promise.all([
        db.income.toArray(),
        db.expenses.toArray(),
        db.debts.toArray(),
        db.monthMarkers.toArray(),
      ]);
      const markerMonths = monthMarkers.map((entry) => entry.monthYear);
      const months = recalculateAvailableMonths(income, expenses, debts, markerMonths);
      set({
        income,
        expenses,
        debts,
        monthMarkers: markerMonths,
        availableMonths: months,
        selectedMonthYear: getNowString(),
        isLoading: false
      });
    },

    setSelectedMonthYear: (monthYear) => set({ selectedMonthYear: monthYear }),

    addMonthYear: async (monthYear, copyFromPrevious = false) => {
      const nowMonth = getNowString();
      const targetMonth = toMonthDate(monthYear) ? monthYear : nowMonth;
      await db.monthMarkers.put({ monthYear: targetMonth });

      if (copyFromPrevious) {
        const previousMonth = getPreviousMonthString(targetMonth);

        if (previousMonth) {
          const state = get();

          const hasTargetData =
            state.income.some((item) => item.monthYear === targetMonth) ||
            state.expenses.some((item) => item.monthYear === targetMonth) ||
            state.debts.some((item) => item.monthYear === targetMonth);

          if (!hasTargetData) {
            const previousIncome = state.income.filter((item) => item.monthYear === previousMonth);
            const previousExpenses = state.expenses.filter((item) => item.monthYear === previousMonth);
            const previousDebts = state.debts.filter((item) => item.monthYear === previousMonth);

            if (previousIncome.length > 0) {
              await db.income.bulkAdd(
                previousIncome.map(({ id: _id, ...item }) => ({
                  ...item,
                  monthYear: targetMonth,
                  updatedAt: new Date()
                }))
              );
            }

            if (previousExpenses.length > 0) {
              await db.expenses.bulkAdd(
                previousExpenses.map(({ id: _id, ...item }) => ({
                  ...item,
                  monthYear: targetMonth,
                  date: mapDateToTargetMonth(item.date, targetMonth)
                }))
              );
            }

            if (previousDebts.length > 0) {
              await db.debts.bulkAdd(
                previousDebts.map(({ id: _id, ...item }) => ({
                  ...item,
                  monthYear: targetMonth
                }))
              );
            }
          }
        }

        const [income, expenses, debts, monthMarkers] = await Promise.all([
          db.income.toArray(),
          db.expenses.toArray(),
          db.debts.toArray(),
          db.monthMarkers.toArray(),
        ]);
        const markerMonths = monthMarkers.map((entry) => entry.monthYear);

        set({
          income,
          expenses,
          debts,
          monthMarkers: markerMonths,
          availableMonths: recalculateAvailableMonths(income, expenses, debts, markerMonths),
          selectedMonthYear: targetMonth,
        });

        get().syncWithCloud();
        return;
      }

      set((state) => ({
        monthMarkers: Array.from(new Set([...state.monthMarkers, targetMonth])).sort((a, b) => b.localeCompare(a)),
        availableMonths: recalculateAvailableMonths(state.income, state.expenses, state.debts, [...state.monthMarkers, targetMonth]),
        selectedMonthYear: targetMonth,
      }));

      get().syncWithCloud();
    },

    deleteMonthYear: async (monthYear) => {
      try {
        const [markerEntry, incomeToDelete, expensesToDelete, debtsToDelete] = await Promise.all([
          db.monthMarkers.get(monthYear),
          db.income.where('monthYear').equals(monthYear).toArray(),
          db.expenses.where('monthYear').equals(monthYear).toArray(),
          db.debts.where('monthYear').equals(monthYear).toArray(),
        ]);

        const snapshot = {
          monthYear,
          income: incomeToDelete,
          expenses: expensesToDelete,
          debts: debtsToDelete,
          markerExists: Boolean(markerEntry),
          expiresAt: Date.now() + 10000,
        };

        await Promise.all([
          db.monthMarkers.delete(monthYear),
          db.income.where('monthYear').equals(monthYear).delete(),
          db.expenses.where('monthYear').equals(monthYear).delete(),
          db.debts.where('monthYear').equals(monthYear).delete(),
        ]);

        const [income, expenses, debts, monthMarkers] = await Promise.all([
          db.income.toArray(),
          db.expenses.toArray(),
          db.debts.toArray(),
          db.monthMarkers.toArray(),
        ]);
        const markerMonths = monthMarkers.map((entry) => entry.monthYear);
        const months = recalculateAvailableMonths(income, expenses, debts, markerMonths);

        set({
          income,
          expenses,
          debts,
          monthMarkers: markerMonths,
          availableMonths: months,
          selectedMonthYear: months[0] ?? getNowString(),
          lastDeletedSnapshot: snapshot,
        });

        setTimeout(() => {
          const currentSnapshot = get().lastDeletedSnapshot;
          if (currentSnapshot && currentSnapshot.expiresAt <= Date.now()) {
            set({ lastDeletedSnapshot: null });
          }
        }, 10100);

        get().syncWithCloud();
      } catch (err) {
        console.error('Failed to delete month:', err);
      }
    },

    undoDeleteMonthYear: async () => {
      const snapshot = get().lastDeletedSnapshot;
      if (!snapshot) return;

      try {
        if (snapshot.markerExists) {
          await db.monthMarkers.put({ monthYear: snapshot.monthYear });
        }

        if (snapshot.income.length) {
          await db.income.bulkAdd(snapshot.income.map(({ id: _id, ...rest }) => rest));
        }
        if (snapshot.expenses.length) {
          await db.expenses.bulkAdd(snapshot.expenses.map(({ id: _id, ...rest }) => rest));
        }
        if (snapshot.debts.length) {
          await db.debts.bulkAdd(snapshot.debts.map(({ id: _id, ...rest }) => rest));
        }

        const [income, expenses, debts, monthMarkers] = await Promise.all([
          db.income.toArray(),
          db.expenses.toArray(),
          db.debts.toArray(),
          db.monthMarkers.toArray(),
        ]);
        const markerMonths = monthMarkers.map((entry) => entry.monthYear);

        set({
          income,
          expenses,
          debts,
          monthMarkers: markerMonths,
          availableMonths: recalculateAvailableMonths(income, expenses, debts, markerMonths),
          selectedMonthYear: snapshot.monthYear,
          lastDeletedSnapshot: null,
        });

        get().syncWithCloud();
      } catch (err) {
        console.error('Failed to undo delete month:', err);
      }
    },

    setGDriveToken: (token) => set({ gdriveToken: token }),

    hydrateFromCloud: async () => {
      set({ isHydrating: true });
      try {
        await get().syncWithCloud();
      } finally {
        set({ isHydrating: false });
      }
    },

    syncWithCloud: async () => {
      const { gdriveToken, income, expenses, debts, monthMarkers } = get();
      if (!gdriveToken) return;

      set({ syncStatus: 'syncing' });

      try {
        const fileId = await findDataFile(gdriveToken);
        const localPayload = { income, expenses, debts, monthMarkers };

        if (!fileId) {
          await createDataFile(gdriveToken, localPayload);
        } else {
          if (income.length === 0 && expenses.length === 0 && debts.length === 0 && monthMarkers.length === 0) {
            const cloudPayload = await downloadDataFile(gdriveToken, fileId);
            if (cloudPayload) {
              await Promise.all([db.income.clear(), db.expenses.clear(), db.debts.clear(), db.monthMarkers.clear()]);
              if (cloudPayload.income?.length) await db.income.bulkAdd(cloudPayload.income);
              if (cloudPayload.expenses?.length) await db.expenses.bulkAdd(cloudPayload.expenses);
              if (cloudPayload.debts?.length) await db.debts.bulkAdd(cloudPayload.debts);
              if (cloudPayload.monthMarkers?.length) {
                const markerPayload: MonthMarker[] = cloudPayload.monthMarkers.map((monthYear: string) => ({ monthYear }));
                await db.monthMarkers.bulkPut(markerPayload);
              }

              const [freshIncome, freshExpenses, freshDebts, freshMonthMarkers] = await Promise.all([
                db.income.toArray(), db.expenses.toArray(), db.debts.toArray(), db.monthMarkers.toArray()
              ]);

              const markerMonths = freshMonthMarkers.map((entry) => entry.monthYear);

              set({
                income: freshIncome,
                expenses: freshExpenses,
                debts: freshDebts,
                monthMarkers: markerMonths,
                availableMonths: recalculateAvailableMonths(freshIncome, freshExpenses, freshDebts, markerMonths),
                selectedMonthYear: getNowString()
              });
            }
          } else {
            await updateDataFile(gdriveToken, fileId, localPayload);
          }
        }

        set({ syncStatus: 'saved' });

        setTimeout(() => {
          if (get().syncStatus === 'saved') {
            set({ syncStatus: 'idle' });
          }
        }, 3000);

      } catch (err) {
        console.error('Cloud synchronization failed:', err);
        set({ syncStatus: 'idle' });
      }
    },

    clearAllData: async () => {
      set({ isLoading: true });
      await Promise.all([db.income.clear(), db.expenses.clear(), db.debts.clear(), db.monthMarkers.clear()]);
      const freshMonth = getNowString();
      set({ income: [], expenses: [], debts: [], monthMarkers: [], availableMonths: [freshMonth], selectedMonthYear: freshMonth });
      await get().syncWithCloud();
      set({ isLoading: false });
    },

    addExpense: async (expense) => {
      await db.expenses.add(expense);
      const updatedExpenses = await db.expenses.toArray();
      set((state) => ({
        expenses: updatedExpenses,
        availableMonths: recalculateAvailableMonths(state.income, updatedExpenses, state.debts, state.monthMarkers)
      }));
      get().syncWithCloud();
    },

    deleteExpense: async (id) => {
      await db.expenses.delete(id);
      const updatedExpenses = await db.expenses.toArray();
      set((state) => ({
        expenses: updatedExpenses,
        availableMonths: recalculateAvailableMonths(state.income, updatedExpenses, state.debts, state.monthMarkers)
      }));
      get().syncWithCloud();
    },

    upsertIncome: async (payload) => {
      await db.income.put(payload as IncomeSource);
      const income = await db.income.toArray();
      set((state) => ({
        income,
        availableMonths: recalculateAvailableMonths(income, state.expenses, state.debts, state.monthMarkers)
      }));
      get().syncWithCloud();
    },

    upsertDebt: async (payload) => {
      await db.debts.put(payload as DebtLiability);
      const debts = await db.debts.toArray();
      set((state) => ({
        debts,
        availableMonths: recalculateAvailableMonths(state.income, state.expenses, debts, state.monthMarkers)
      }));
      get().syncWithCloud();
    },
  };
});