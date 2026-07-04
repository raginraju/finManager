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
  db: null,
  isHydratedFromCloud: false,
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

    if (!isAppBooted) {
      set({ isLoading: true, syncStatus: 'loading' });
    }

    try {
      const token = get().gdriveToken;

      // 1. If there's no token yet on initial load/reload, exit early.
      // Do not lock isAppBooted. Let the App.tsx useEffect try again when the token arrives.
      if (!token && !isAppBooted) {
        isFetchingInitialData = false;
        set({ isLoading: false });
        return; 
      }

      // 2. REUSE YOUR PULL METHOD: If we have a token and haven't booted yet,
      // trigger your core pullFromCloud mechanism to download and ingest wealth.db
      if (token && !isAppBooted) {
        await get().pullFromCloud(); 
        set({ isHydratedFromCloud: true });
      }

      // 3. Mark the app as successfully booted
      isAppBooted = true;

      // 4. Fetch the newly populated database engine reference from the store
      const db = get().db || await getSQLiteEngine();
      const activeMonth = get().selectedMonthYear || utils.getNowString();
      
      // 5. Query data from the freshly pulled cloud data rows
      const incomeRows = db.exec(`SELECT * FROM income WHERE monthYear = '${activeMonth}'`)[0]?.values || [];
      const expenseRows = db.exec(`SELECT * FROM expenses WHERE monthYear = '${activeMonth}'`)[0]?.values || [];
      const debtRows = db.exec(`SELECT * FROM debts WHERE monthYear = '${activeMonth}'`)[0]?.values || [];
      
      const distinctMonths = db.exec(`SELECT DISTINCT monthYear FROM expenses UNION SELECT DISTINCT monthYear FROM income`)[0]?.values || [];
      const monthsList = distinctMonths
        .map((row: any[]) => String(row[0]))
        .sort((a: string, b: string) => b.localeCompare(a));

      set({
        income: incomeRows.map((r: any[]) => ({
          id: Number(r[0]),
          monthYear: String(r[1]),
          name: String(r[2]),
          grossAmount: Number(r[3]),
          netTakeHome: Number(r[4]),
          updatedAt: new Date(String(r[5]))
        })),
        expenses: expenseRows.map((r: any[]) => ({
          id: Number(r[0]),
          monthYear: String(r[1]),
          description: String(r[2]),
          amount: Number(r[3]),
          date: String(r[4]),
          category: String(r[5]),
          isFixed: Boolean(r[6])
        })),
        debts: debtRows.map((r: any[]) => ({
          id: Number(r[0]),
          monthYear: String(r[1]),
          name: String(r[2]),
          totalBalance: Number(r[3]),
          monthlyPayment: Number(r[4]),
          isFixedInstallment: Boolean(r[5])
        })),
        availableMonths: monthsList.length ? monthsList : [activeMonth],
        isLoading: false,
        syncStatus: 'idle'
      });
    } catch (err) {
      console.error("Initialization / Reload process failed:", err);
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

  // Mannual pull from cloud sequence to ensure the latest data is reflected in the local SQLite memory
  pullFromCloud: async () => {
    const token = get().gdriveToken;
    if (!token) return;

    set({ syncStatus: 'syncing', isHydrating: true });
    try {
      // 1. Force find the cloud file ID to ensure we point to the absolute latest version
      const cloudFileId = await findDataFile(token, 'wealth.db');
      
      if (cloudFileId) {
        // 2. Clear old state instances by streaming the fresh array buffer down
        const buffer = await downloadBinaryFile(token, cloudFileId);
        
        // 3. Force re-instantiation of the SQLite memory structure using the fresh binary
        await getSQLiteEngine(buffer);
        
        // 4. Force query execution for the active month window to snap elements into view
        isAppBooted = true; // Ensure state remains booted
        isFetchingInitialData = false; // Release lock flags
        
        set({ isHydrating: false });
        await get().fetchInitialData();
        
        set({ syncStatus: 'saved', lastSyncedAt: Date.now() });
      } else {
        console.warn('No active cloud db found to pull from.');
        set({ syncStatus: 'idle', isHydrating: false });
      }
      
      setTimeout(() => { if (get().syncStatus === 'saved') set({ syncStatus: 'idle' }); }, 3000);
    } catch (err) {
      console.error('Failed executing cloud pull sequence:', err);
      set({ syncStatus: 'error', isHydrating: false });
    }
  },

  syncWithCloud: async (isForce = false) => {
    const token = get().gdriveToken;
    const isHydrated = get().isHydratedFromCloud;

    // ❌ CRITICAL GUARD: If the token is missing OR the app hasn't completed 
    // downloading your data from the cloud yet, STOP immediately. Do not overwrite!
    if (!token || !isHydrated && !isForce) {
      console.warn("Cloud upload blocked: App has not successfully downloaded your data yet.");
      return;
    }

    // Changes state for background status markers without interrupting client focus workflows
    set({ syncStatus: 'syncing' });
    try {
      // Get the live active database instance instead of re-fetching a clean engine reference
      const db = get().db || await getSQLiteEngine();
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
  deleteMonthYear: async (monthYear) => {
    const db = await getSQLiteEngine();
    
    // 1. Clear out all data lines assigned to this month tag
    db.run(`DELETE FROM expenses WHERE monthYear = ?`, [monthYear]);
    db.run(`DELETE FROM income WHERE monthYear = ?`, [monthYear]);
    db.run(`DELETE FROM debts WHERE monthYear = ?`, [monthYear]);

    // 2. Adjust active viewport context fallback selection if you delete the month you are looking at
    if (get().selectedMonthYear === monthYear) {
      set({ selectedMonthYear: utils.getNowString() });
    }

    // 3. Update active layout metrics
    await get().fetchInitialData();

    // 4. Force synchronization right away to drop data on Drive immediately
    await get().syncWithCloud(true);
  },
  undoDeleteMonthYear: async () => {},
  clearAllData: async () => {
    const db = await getSQLiteEngine();
    
    // 1. Wipe out every row across your accounting ledger tables entirely
    db.run(`DELETE FROM expenses`);
    db.run(`DELETE FROM income`);
    db.run(`DELETE FROM debts`);

    // 2. Clear out state states
    set({
      income: [],
      expenses: [],
      debts: [],
      availableMonths: [utils.getNowString()],
      selectedMonthYear: utils.getNowString()
    });

    // 3. Force push the completely blank database schema update out to Google Drive
    await get().syncWithCloud(true);
  },
  hydrateFromCloud: async () => { await get().fetchInitialData(); }
}));