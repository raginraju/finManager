import { create } from 'zustand';
import { getSQLiteEngine } from '../db';
import { findDataFile, downloadBinaryFile, uploadBinaryFile } from '../gdriveService';
import { type WealthState } from './types';
import * as utils from './helpers';

// 💡 Internal flags to strictly isolate initial boot orchestration from silent data re-queries
let isFetchingInitialData = false;
let isAppBooted = false;

export const useWealthStore = create<WealthState>((set, get) => ({
  income: [],
  expenses: [],
  debts: [],
  monthMarkers: [],
  lastDeletedSnapshot: null,
  isLoading: true, // Remains true initially to catch first load sequence execution
  gdriveToken: null,
  selectedMonthYear: utils.getNowString(),
  availableMonths: [utils.getNowString()],
  syncStatus: 'idle',
  lastSyncedAt: null,
  isHydrating: false,

  fetchInitialData: async () => {
    if (isFetchingInitialData) return;
    isFetchingInitialData = true;

    // 💡 Lock the blocking layout state ONLY during the application's absolute initial boot
    if (!isAppBooted) {
      set({ isLoading: true, syncStatus: 'loading' });
    }

    try {
      let db = await getSQLiteEngine();
      const token = get().gdriveToken;

      // 💡 Pull from Google Drive strictly on the initial launch sequence, never during quick logging operations
      if (token && !isAppBooted) {
        const cloudFileId = await findDataFile(token, 'wealth.db');
        if (cloudFileId) {
          const buffer = await downloadBinaryFile(token, cloudFileId);
          db = await getSQLiteEngine(buffer);
        }
      }

      // Flip the application state flag immediately after confirming database ingestion
      isAppBooted = true;

      // Query complete month options from data
      const activeMonth = get().selectedMonthYear || utils.getNowString();
      
      const incomeRows = db.exec(`SELECT * FROM income WHERE monthYear = '${activeMonth}'`)[0]?.values || [];
      const expenseRows = db.exec(`SELECT * FROM expenses WHERE monthYear = '${activeMonth}'`)[0]?.values || [];
      const debtRows = db.exec(`SELECT * FROM debts WHERE monthYear = '${activeMonth}'`)[0]?.values || [];
      
      // Compute month selections dynamically from tables
      const distinctMonths = db.exec(`SELECT DISTINCT monthYear FROM expenses UNION SELECT DISTINCT monthYear FROM income`)[0]?.values || [];
      const monthsList = distinctMonths.map(row => String(row[0])).sort((a, b) => b.localeCompare(a));

      set({
        income: incomeRows.map(r => ({ id: Number(r[0]), monthYear: String(r[1]), name: String(r[2]), grossAmount: Number(r[3]), netTakeHome: Number(r[4]), updatedAt: new Date(String(r[5])) })),
        expenses: expenseRows.map(r => ({ id: Number(r[0]), monthYear: String(r[1]), description: String(r[2]), amount: Number(r[3]), date: String(r[4]), category: String(r[5]), isFixed: Boolean(r[6]) })),
        debts: debtRows.map(r => ({ id: Number(r[0]), monthYear: String(r[1]), name: String(r[2]), totalBalance: Number(r[3]), monthlyPayment: Number(r[4]), isFixedInstallment: Boolean(r[5]) })),
        availableMonths: monthsList.length ? monthsList : [activeMonth],
        isLoading: false,
        syncStatus: 'idle'
      });
    } catch (err) {
      console.error(err);
      set({ isLoading: false, syncStatus: 'error' });
    } finally {
      isFetchingInitialData = false;
    }
  },

  setGDriveToken: async (token) => {
    set({ gdriveToken: token });
    if (token) await get().fetchInitialData();
  },

  setSelectedMonthYear: async (monthYear) => {
    set({ selectedMonthYear: monthYear });
    // 💡 Quietly swap current view state datasets without activating the full-screen loader overlay
    await get().fetchInitialData();
  },

  syncWithCloud: async () => {
    const token = get().gdriveToken;
    if (!token) return;

    // Changes state for background status markers without interrupting client focus workflows
    set({ syncStatus: 'syncing' });
    try {
      const db = await getSQLiteEngine();
      const binaryArray = db.export(); // Package database to binary
      
      const fileId = await findDataFile(token, 'wealth.db');
      await uploadBinaryFile(token, 'wealth.db', binaryArray, fileId);

      set({ syncStatus: 'saved', lastSyncedAt: Date.now() });
      setTimeout(() => { if (get().syncStatus === 'saved') set({ syncStatus: 'idle' }); }, 3000);
    } catch (err) {
      console.error(err);
      set({ syncStatus: 'error' });
    }
  },

  // ========================================================
  // 💡 OPTIMIZED MUTATIONS: Instant UI updates + Background Sync
  // ========================================================
  addExpense: async (expense) => {
    const db = await getSQLiteEngine();
    db.run(
      `INSERT INTO expenses (monthYear, description, amount, date, category, isFixed) VALUES (?, ?, ?, ?, ?, ?)`,
      [expense.monthYear, expense.description, expense.amount, expense.date, expense.category, expense.isFixed ? 1 : 0]
    );
    
    // 1. Instant local state updates via a non-blocking re-query pass
    await get().fetchInitialData(); 
    
    // 2. Quiet background file mirroring stream to your Google Drive account sandbox
    void get().syncWithCloud();
  },

  deleteExpense: async (id) => {
    const db = await getSQLiteEngine();
    db.run(`DELETE FROM expenses WHERE id = ?`, [id]);
    
    // 1. Instant local refresh
    await get().fetchInitialData();
    
    // 2. Background sync
    void get().syncWithCloud();
  },

  upsertIncome: async (payload) => {
    const db = await getSQLiteEngine();
    if (payload.id) {
      db.run(`UPDATE income SET name = ?, grossAmount = ?, netTakeHome = ?, updatedAt = ? WHERE id = ?`, [payload.name, payload.grossAmount, payload.netTakeHome, new Date().toISOString(), payload.id]);
    } else {
      db.run(`INSERT INTO income (monthYear, name, grossAmount, netTakeHome, updatedAt) VALUES (?, ?, ?, ?, ?)`, [payload.monthYear, payload.name, payload.grossAmount, payload.netTakeHome, new Date().toISOString()]);
    }
    
    // 1. Instant local refresh
    await get().fetchInitialData();
    
    // 2. Background sync
    void get().syncWithCloud();
  },

  upsertDebt: async (payload) => {
    const db = await getSQLiteEngine();
    if (payload.id) {
      db.run(`UPDATE debts SET name = ?, monthlyPayment = ? WHERE id = ?`, [payload.name, payload.monthlyPayment, payload.id]);
    } else {
      db.run(`INSERT INTO debts (monthYear, name, totalBalance, monthlyPayment, isFixedInstallment) VALUES (?, ?, ?, ?, ?)`, [payload.monthYear, payload.name, payload.totalBalance ?? 0, payload.monthlyPayment, payload.isFixedInstallment ? 1 : 0]);
    }
    
    // 1. Instant local refresh
    await get().fetchInitialData();
    
    // 2. Background sync
    void get().syncWithCloud();
  },

  // Interface Fallbacks placeholders to align types.ts cleanly
  addMonthYear: async (monthYear) => { set({ selectedMonthYear: monthYear }); },
  deleteMonthYear: async () => {},
  undoDeleteMonthYear: async () => {},
  clearAllData: async () => {},
  hydrateFromCloud: async () => { await get().fetchInitialData(); }
}));