import Dexie, { type Table } from 'dexie';

export interface IncomeSource {
  id?: number;
  name: string;
  grossAmount: number;
  cpfEmployeeAmount: number;
  netTakeHome: number;
  updatedAt: Date;
}

export interface Expense {
  id?: number;
  description: string;
  amount: number;
  date: string; 
  category: string; 
  isFixed: boolean;
}

export interface DebtLiability {
  id?: number;
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
    this.version(1).stores({
      income: '++id, name',
      expenses: '++id, date, category, isFixed',
      debts: '++id, name, isFixedInstallment',
    });
  }
}

export const db = new WealthDatabase();