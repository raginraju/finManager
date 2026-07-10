import { type IncomeSource, type Expense, type DebtLiability, type InstallmentPlan, type StudyLog } from '../db';

export interface InstallmentPlan {
  id: number;
  parentName: string;
  name: string;
  totalAmount: number;
  totalMonths: number;
  startingMonth: string;
}

export interface WealthState {
  income: IncomeSource[];
  expenses: Expense[];
  debts: DebtLiability[];
  installments: InstallmentPlan[]; 
  
  studyLogs: StudyLog[];
  
  monthMarkers: string[];
  db: any;
  isHydratedFromCloud: boolean;
  isLoading: boolean;
  gdriveToken: string | null;
  selectedMonthYear: string;
  availableMonths: string[];

  syncStatus: 'idle' | 'syncing' | 'loading' | 'saved' | 'error';
  
  lastSyncedAt: number | null;
  isHydrating: boolean;

  fetchInitialData: () => Promise<void>;
  setSelectedMonthYear: (monthYear: string) => void;
  addMonthYear: (monthYear: string, copyFromPrevious?: boolean) => Promise<void>;
  hydrateFromCloud: () => Promise<void>;
  setGDriveToken: (token: string | null) => Promise<void>;
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
  syncWithCloud: (isForce?: boolean) => Promise<void>;
  clearAllData: () => Promise<void>;

  addExpense: (expense: Omit<Expense, 'id'>) => Promise<void>;
  deleteExpense: (id: number) => Promise<void>;
  upsertIncome: (income: Omit<IncomeSource, 'id'> & { id?: number }) => Promise<void>;
  upsertDebt: (debt: Omit<DebtLiability, 'id'> & { id?: number }) => Promise<void>;
  
  upsertInstallment: (installment: Omit<InstallmentPlan, 'id'> & { id?: number }) => Promise<void>;
  deleteInstallment: (id: number) => Promise<void>;
  
  addStudyLog: (log: Omit<StudyLog, 'id'>) => Promise<void>;
  
  pullFromCloud: () => Promise<void>;
}