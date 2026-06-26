import { create } from 'zustand';
import { db, type IncomeSource, type Expense, type DebtLiability } from './db';

interface WealthState {
  income: IncomeSource[];
  expenses: Expense[];
  debts: DebtLiability[];
  isLoading: boolean;
  fetchInitialData: () => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  deleteExpense: (id: number) => Promise<void>;
  upsertIncome: (income: Omit<IncomeSource, 'id'> & { id?: number }) => Promise<void>;
  upsertDebt: (debt: Omit<DebtLiability, 'id'> & { id?: number }) => Promise<void>;
  deleteDebt: (id: number) => Promise<void>;
}

export const useWealthStore = create<WealthState>((set) => ({
  income: [],
  expenses: [],
  debts: [],
  isLoading: true,

  fetchInitialData: async () => {
    set({ isLoading: true });
    try {
      const [incomeData, expenseData, debtData] = await Promise.all([
        db.income.toArray(),
        db.expenses.toArray(),
        db.debts.toArray(),
      ]);
      set({ income: incomeData, expenses: expenseData, debts: debtData });
    } catch (error) {
      console.error('Failed to load database:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addExpense: async (expense) => {
    const id = await db.expenses.add(expense);
    set((state) => ({ expenses: [...state.expenses, { ...expense, id }] }));
  },

  deleteExpense: async (id) => {
    await db.expenses.delete(id);
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
  },

  upsertIncome: async (incomePayload) => {
    await db.income.put(incomePayload as IncomeSource);
    const updatedIncome = await db.income.toArray();
    set({ income: updatedIncome });
  },

  upsertDebt: async (debtPayload) => {
    await db.debts.put(debtPayload as DebtLiability);
    const updatedDebts = await db.debts.toArray();
    set({ debts: updatedDebts });
  },

  deleteDebt: async (id) => {
    await db.debts.delete(id);
    set((state) => ({ debts: state.debts.filter((d) => d.id !== id) }));
  },
}));