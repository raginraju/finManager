import initSqlJs, { type Database } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export interface IncomeSource {
  id?: number;
  monthYear: string; 
  name: string;
  grossAmount: number;
  netTakeHome: number; 
  updatedAt: Date | string;
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

export interface MonthMarker {
  monthYear: string;
}

let dbInstance: Database | null = null;

// Initialize an empty relational database structure with standard schemas
const createDatabaseTables = (db: Database) => {
  db.run(`
    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monthYear TEXT NOT NULL,
      name TEXT NOT NULL,
      grossAmount REAL NOT NULL,
      netTakeHome REAL NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monthYear TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      isFixed INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monthYear TEXT NOT NULL,
      name TEXT NOT NULL,
      totalBalance REAL NOT NULL,
      monthlyPayment REAL NOT NULL,
      isFixedInstallment INTEGER NOT NULL
    );

    /* 💡 HIGH-SPEED PERFORMANCE INDEXES */
    /* Prevents full table scans when switching months, running analytics, or building list tabs */
    CREATE INDEX IF NOT EXISTS idx_income_monthYear ON income (monthYear);
    CREATE INDEX IF NOT EXISTS idx_expenses_monthYear ON expenses (monthYear);
    CREATE INDEX IF NOT EXISTS idx_debts_monthYear ON debts (monthYear);
  `);
};

export const getSQLiteEngine = async (binaryBuffer?: ArrayBuffer): Promise<Database> => {
  if (dbInstance && !binaryBuffer) return dbInstance;

  const SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl,
  });

  if (binaryBuffer) {
    dbInstance = new SQL.Database(new Uint8Array(binaryBuffer));
    // 💡 Ensure indexes exist on imported databases seamlessly without altering your data rows
    createDatabaseTables(dbInstance);
  } else {
    dbInstance = new SQL.Database();
    createDatabaseTables(dbInstance);
  }

  return dbInstance;
};