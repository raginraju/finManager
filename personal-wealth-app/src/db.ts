import Dexie, { type Table } from 'dexie';

export interface IncomeSource {
  id?: number;
  monthYear: string; 
  name: string;
  grossAmount: number; // Represents direct take-home/cash inflow
  netTakeHome: number; 
  updatedAt: Date;
}

export interface Expense {
  id?: number;
  monthYear: string; 
  description: string;
  amount: number;
  date: string; 
  category: string;
  isFixed: boolean;
}

export interface DebtLiability {
  id?: number;
  monthYear: string; 
  name: string;
  totalBalance: number;
  monthlyPayment: number;
  isFixedInstallment: boolean;
  remainingMonths?: number;
}

class WealthDatabase extends Dexie {
  income!: Table<IncomeSource>;
  expenses!: Table<Expense>;
  debts!: Table<DebtLiability>;

  constructor() {
    super('WealthDatabase');
    this.version(3).stores({
      income: '++id, monthYear, name',
      expenses: '++id, monthYear, date, category, isFixed',
      debts: '++id, monthYear, name, isFixedInstallment',
    });
  }
}

export const db = new WealthDatabase();