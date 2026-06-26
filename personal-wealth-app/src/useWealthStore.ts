import { create } from 'zustand';
import { db, type IncomeSource, type Expense, type DebtLiability } from './db';
import { findDataFile, createDataFile, updateDataFile } from './gdriveService';

interface WealthState {
  income: IncomeSource[];
  expenses: Expense[];
  debts: DebtLiability[];
  isLoading: boolean;
  gdriveToken: string | null;
  selectedMonthYear: string; // Current active view index
  availableMonths: string[]; // Descending list of active record blocks
  syncStatus: 'idle' | 'syncing' | 'saved';

  fetchInitialData: () => Promise<void>;
  setSelectedMonthYear: (monthYear: string) => void;
  setGDriveToken: (token: string | null) => void;
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

  const recalculateAvailableMonths = (income: IncomeSource[], expenses: Expense[], debts: DebtLiability[]) => {
    const months = new Set<string>([getNowString()]); // Always guarantee current month block
    income.forEach(i => months.add(i.monthYear));
    expenses.forEach(e => months.add(e.monthYear));
    debts.forEach(d => months.add(d.monthYear));
    return Array.from(months).sort((a, b) => b.localeCompare(a)); // Sort Descending
  };

  return {
    income: [],
    expenses: [],
    debts: [],
    isLoading: true,
    gdriveToken: null,
    selectedMonthYear: getNowString(),
    availableMonths: [getNowString()],
    syncStatus: 'idle',

    fetchInitialData: async () => {
      const [income, expenses, debts] = await Promise.all([
        db.income.toArray(),
        db.expenses.toArray(),
        db.debts.toArray(),
      ]);
      const months = recalculateAvailableMonths(income, expenses, debts);
      set({ income, expenses, debts, availableMonths: months, isLoading: false });
    },

    setSelectedMonthYear: (monthYear) => set({ selectedMonthYear: monthYear }),
    setGDriveToken: (token) => set({ gdriveToken: token }),

    syncWithCloud: async () => {
      const { gdriveToken, income, expenses, debts } = get();
      if (!gdriveToken) return;

      // Trigger the toast to display "Syncing changes..."
      set({ syncStatus: 'syncing' });

      try {
        const fileId = await findDataFile(gdriveToken);
        const localPayload = { income, expenses, debts };

        if (!fileId) {
          await createDataFile(gdriveToken, localPayload);
        } else {
          // If hydrating a fresh state, don't overwrite cloud data
          if (income.length === 0 && expenses.length === 0 && debts.length === 0) {
            const cloudPayload = await downloadDataFile(gdriveToken, fileId);
            if (cloudPayload) {
              await Promise.all([db.income.clear(), db.expenses.clear(), db.debts.clear()]);
              if (cloudPayload.income?.length) await db.income.bulkAdd(cloudPayload.income);
              if (cloudPayload.expenses?.length) await db.expenses.bulkAdd(cloudPayload.expenses);
              if (cloudPayload.debts?.length) await db.debts.bulkAdd(cloudPayload.debts);

              const [freshIncome, freshExpenses, freshDebts] = await Promise.all([
                db.income.toArray(), db.expenses.toArray(), db.debts.toArray()
              ]);

              const months = new Set<string>([new Date().toISOString().slice(0, 7)]);
              freshIncome.forEach(i => months.add(i.monthYear));
              freshExpenses.forEach(e => months.add(e.monthYear));
              freshDebts.forEach(d => months.add(d.monthYear));

              set({
                income: freshIncome,
                expenses: freshExpenses,
                debts: freshDebts,
                availableMonths: Array.from(months).sort((a, b) => b.localeCompare(a)),
                selectedMonthYear: Array.from(months).sort((a, b) => b.localeCompare(a))[0]
              });
            }
          } else {
            await updateDataFile(gdriveToken, fileId, localPayload);
          }
        }

        // Success: Flip status to "Saved"
        set({ syncStatus: 'saved' });

        // Automatically fade out the status notification after 3 seconds back to idle
        setTimeout(() => {
          if (get().syncStatus === 'saved') {
            set({ syncStatus: 'idle' });
          }
        }, 3000);

      } catch (err) {
        console.error('Cloud synchronization failed:', err);
        set({ syncStatus: 'idle' }); // Fallback on failure
      }
    },

    clearAllData: async () => {
      set({ isLoading: true });
      await Promise.all([db.income.clear(), db.expenses.clear(), db.debts.clear()]);
      const freshMonth = getNowString();
      set({ income: [], expenses: [], debts: [], availableMonths: [freshMonth], selectedMonthYear: freshMonth });
      await get().syncWithCloud();
      set({ isLoading: false });
    },

    addExpense: async (expense) => {
      const id = await db.expenses.add(expense);
      const updatedExpenses = await db.expenses.toArray();
      set((state) => ({
        expenses: updatedExpenses,
        availableMonths: recalculateAvailableMonths(state.income, updatedExpenses, state.debts)
      }));
      get().syncWithCloud();
    },

    deleteExpense: async (id) => {
      await db.expenses.delete(id);
      const updatedExpenses = await db.expenses.toArray();
      set((state) => ({
        expenses: updatedExpenses,
        availableMonths: recalculateAvailableMonths(state.income, updatedExpenses, state.debts)
      }));
      get().syncWithCloud();
    },

    upsertIncome: async (payload) => {
      await db.income.put(payload as IncomeSource);
      const income = await db.income.toArray();
      set((state) => ({
        income,
        availableMonths: recalculateAvailableMonths(income, state.expenses, state.debts)
      }));
      get().syncWithCloud();
    },

    upsertDebt: async (payload) => {
      await db.debts.put(payload as DebtLiability);
      const debts = await db.debts.toArray();
      set((state) => ({
        debts,
        availableMonths: recalculateAvailableMonths(state.income, state.expenses, debts)
      }));
      get().syncWithCloud();
    },
  };
});