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
  installments: [], 
  studyLogs: [], 
  gymExercises: [], // 💡 Hydrated state catalog layout array
  gymLogs: [],      // 💡 Hydrated workout entry feed array
  monthMarkers: [],
  lastDeletedSnapshot: null,
  db: null,
  isHydratedFromCloud: false,
  isLoading: true, 
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

      if (!token && !isAppBooted) {
        isFetchingInitialData = false;
        set({ isLoading: false });
        return; 
      }

      if (token && !isAppBooted) {
        await get().pullFromCloud(); 
        set({ isHydratedFromCloud: true });
      }

      isAppBooted = true;

      const db = get().db || await getSQLiteEngine();
      
      // 💡 Ensure all structural application tables exist safely before executing read scans
      db.run(`CREATE TABLE IF NOT EXISTS installments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parentName TEXT,
        name TEXT,
        totalAmount REAL,
        totalMonths INTEGER,
        startingMonth TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS study_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        startTime TEXT NOT NULL,
        endTime TEXT NOT NULL,
        durationSeconds INTEGER NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS gym_exercises (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        category TEXT NOT NULL, 
        name TEXT NOT NULL
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS gym_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        date TEXT NOT NULL, 
        category TEXT NOT NULL,
        exerciseName TEXT NOT NULL, 
        weight REAL NOT NULL, 
        sets INTEGER NOT NULL, 
        reps INTEGER NOT NULL, 
        note TEXT
      )`);

      // 💡 Seed starting exercise library lookup catalog rows if freshly initialized empty
      const checkCount = db.exec("SELECT COUNT(*) FROM gym_exercises")[0]?.values[0][0];
      if (Number(checkCount) === 0) {
        db.run(`INSERT INTO gym_exercises (category, name) VALUES 
          ('Push', 'Bench Press'), ('Push', 'Overhead Press'),
          ('Pull', 'Barbell Row'), ('Pull', 'Lat Pulldown'),
          ('Legs', 'Squat'), ('Legs', 'Romanian Deadlift')`);
      }

      const activeMonth = get().selectedMonthYear || utils.getNowString();
      
      const incomeRows = db.exec(`SELECT * FROM income WHERE monthYear = '${activeMonth}'`)[0]?.values || [];
      const expenseRows = db.exec(`SELECT * FROM expenses`)[0]?.values || [];
      const debtRows = db.exec(`SELECT * FROM debts`)[0]?.values || [];
      const instRows = db.exec(`SELECT * FROM installments`)[0]?.values || [];
      const studyRows = db.exec(`SELECT * FROM study_logs ORDER BY id DESC LIMIT 7`)[0]?.values || [];
      
      // 💡 READ NEW GYM DATA ROWS FROM SQLITE
      const exRows = db.exec("SELECT * FROM gym_exercises ORDER BY name ASC")[0]?.values || [];
      const gymLogRows = db.exec("SELECT * FROM gym_logs ORDER BY date DESC, id DESC")[0]?.values || [];
      
      const distinctMonths = db.exec(`SELECT DISTINCT monthYear FROM expenses UNION SELECT DISTINCT monthYear FROM income`)[0]?.values || [];
      const monthsList = distinctMonths
        .map((row: any[]) => String(row[0]))
        .sort((a: string, b: string) => b.localeCompare(a));

      set({
        income: incomeRows.map((r: any[]) => ({
          id: Number(r[0]), monthYear: String(r[1]), name: String(r[2]), grossAmount: Number(r[3]), netTakeHome: Number(r[4]), updatedAt: new Date(String(r[5]))
        })),
        expenses: expenseRows.map((r: any[]) => ({
          id: Number(r[0]), monthYear: String(r[1]), description: String(r[2]), amount: Number(r[3]), date: String(r[4]), category: String(r[5]), isFixed: Boolean(r[6])
        })),
        debts: debtRows.map((r: any[]) => ({
          id: Number(r[0]), monthYear: String(r[1]), name: String(r[2]), totalBalance: Number(r[3]), monthlyPayment: Number(r[4]), isFixedInstallment: Boolean(r[5])
        })),
        installments: instRows.map((r: any[]) => ({
          id: Number(r[0]), parentName: String(r[1]), name: String(r[2]), totalAmount: Number(r[3]), totalMonths: Number(r[4]), startingMonth: String(r[5])
        })),
        studyLogs: studyRows.map((r: any[]) => ({
          id: Number(r[0]), startTime: String(r[1]), endTime: String(r[2]), durationSeconds: Number(r[3])
        })).reverse(),
        
        // 💡 HYDRATE GYM ARRAYS CLEANLY INTO REACT MEMORY MATRIX
        gymExercises: exRows.map((r: any[]) => ({ 
          id: Number(r[0]), category: String(r[1]) as any, name: String(r[2]) 
        })),
        gymLogs: gymLogRows.map((r: any[]) => ({
          id: Number(r[0]), date: String(r[1]), category: String(r[2]) as any, exerciseName: String(r[3]),
          weight: Number(r[4]), sets: Number(r[5]), reps: Number(r[6]), note: r[7] ? String(r[7]) : undefined
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
    await get().fetchInitialData();
  },

  pullFromCloud: async () => {
    const token = get().gdriveToken;
    if (!token) return;

    set({ syncStatus: 'syncing', isHydrating: true });
    try {
      const cloudFileId = await findDataFile(token, 'wealth.db');
      
      if (cloudFileId) {
        const buffer = await downloadBinaryFile(token, cloudFileId);
        await getSQLiteEngine(buffer);
        
        isAppBooted = true; 
        isFetchingInitialData = false; 
        
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

    if (!token || !isHydrated && !isForce) {
      console.warn("Cloud upload blocked: App has not successfully downloaded your data yet.");
      return;
    }

    set({ syncStatus: 'syncing' });
    try {
      const db = get().db || await getSQLiteEngine();
      const binaryArray = db.export(); 
      
      const fileId = await findDataFile(token, 'wealth.db');
      await uploadBinaryFile(token, 'wealth.db', binaryArray, fileId);

      set({ syncStatus: 'saved', lastSyncedAt: Date.now() });
      setTimeout(() => { if (get().syncStatus === 'saved') set({ syncStatus: 'idle' }); }, 3000);
    } catch (err) {
      console.error(err);
      set({ syncStatus: 'error' });
    }
  },

  addExpense: async (expense) => {
    const db = await getSQLiteEngine();
    db.run(
      `INSERT INTO expenses (monthYear, description, amount, date, category, isFixed) VALUES (?, ?, ?, ?, ?, ?)`,
      [expense.monthYear, expense.description, expense.amount, expense.date, expense.category, expense.isFixed ? 1 : 0]
    );
    await get().fetchInitialData(); 
    void get().syncWithCloud();
  },

  deleteExpense: async (id) => {
    const db = await getSQLiteEngine();
    db.run(`DELETE FROM expenses WHERE id = ?`, [id]);
    await get().fetchInitialData();
    void get().syncWithCloud();
  },

  upsertIncome: async (payload) => {
    const db = await getSQLiteEngine();
    if (payload.id) {
      db.run(`UPDATE income SET name = ?, grossAmount = ?, netTakeHome = ?, updatedAt = ? WHERE id = ?`, [payload.name, payload.grossAmount, payload.netTakeHome, new Date().toISOString(), payload.id]);
    } else {
      db.run(`INSERT INTO income (monthYear, name, grossAmount, netTakeHome, updatedAt) VALUES (?, ?, ?, ?, ?)`, [payload.monthYear, payload.name, payload.grossAmount, payload.netTakeHome, new Date().toISOString()]);
    }
    await get().fetchInitialData();
    void get().syncWithCloud();
  },

  upsertDebt: async (payload) => {
    const db = await getSQLiteEngine();
    if (payload.id) {
      db.run(
        `UPDATE debts SET name = ?, totalBalance = ?, monthlyPayment = ? WHERE id = ?`, 
        [payload.name, payload.totalBalance, payload.monthlyPayment, payload.id]
      );
    } else {
      db.run(
        `INSERT INTO debts (monthYear, name, totalBalance, monthlyPayment, isFixedInstallment) VALUES (?, ?, ?, ?, ?)`, 
        [payload.monthYear, payload.name, payload.totalBalance ?? 0, payload.monthlyPayment, payload.isFixedInstallment ? 1 : 0]
      );
    }
    await get().fetchInitialData();
    void get().syncWithCloud();
  },

  upsertInstallment: async (payload) => {
    const db = await getSQLiteEngine();
    if (payload.id) {
      db.run(
        `UPDATE installments SET parentName = ?, name = ?, totalAmount = ?, totalMonths = ?, startingMonth = ? WHERE id = ?`,
        [payload.parentName, payload.name, payload.totalAmount, payload.totalMonths, payload.startingMonth, payload.id]
      );
    } else {
      db.run(
        `INSERT INTO installments (parentName, name, totalAmount, totalMonths, startingMonth) VALUES (?, ?, ?, ?, ?)`,
        [payload.parentName, payload.name, payload.totalAmount, payload.totalMonths, payload.startingMonth]
      );
    }
    await get().fetchInitialData();
    void get().syncWithCloud();
  },

  deleteInstallment: async (id) => {
    const db = await getSQLiteEngine();
    db.run(`DELETE FROM installments WHERE id = ?`, [id]);
    await get().fetchInitialData();
    void get().syncWithCloud();
  },

  addStudyLog: async (log) => {
    const db = await getSQLiteEngine();
    db.run(
      `INSERT INTO study_logs (startTime, endTime, durationSeconds) VALUES (?, ?, ?)`,
      [log.startTime, log.endTime, log.durationSeconds]
    );
    await get().fetchInitialData();
    void get().syncWithCloud();
  },

  // 💡 NEW: GYM TRANSACTION OPERATION MUTATORS
  addGymExercise: async (exercise) => {
    const db = await getSQLiteEngine();
    db.run(`INSERT INTO gym_exercises (category, name) VALUES (?, ?)`, [exercise.category, exercise.name]);
    await get().fetchInitialData();
    void get().syncWithCloud();
  },

  addGymLog: async (log) => {
    const db = await getSQLiteEngine();
    db.run(
      `INSERT INTO gym_logs (date, category, exerciseName, weight, sets, reps, note) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [log.date, log.category, log.exerciseName, log.weight, log.sets, log.reps, log.note || null]
    );
    await get().fetchInitialData();
    void get().syncWithCloud();
  },

  deleteGymLog: async (id) => {
    const db = await getSQLiteEngine();
    db.run(`DELETE FROM gym_logs WHERE id = ?`, [id]);
    await get().fetchInitialData();
    void get().syncWithCloud();
  },

  addMonthYear: async (monthYear, isCopy = false) => {
    const sourceTemplateMonth = get().selectedMonthYear;

    if (sourceTemplateMonth === monthYear) {
      alert(`Cannot ${isCopy ? 'copy data to' : 'add'} the same month you are currently viewing. Aborting operation.`);
      return; 
    }

    set({ selectedMonthYear: monthYear });

    if (isCopy && sourceTemplateMonth) {
      try {
        const db = await getSQLiteEngine();

        await db.run(`DELETE FROM income WHERE monthYear = ?`, [monthYear]);
        await db.run(`DELETE FROM expenses WHERE monthYear = ?`, [monthYear]);

        await db.run(
          `INSERT INTO income (monthYear, name, grossAmount, netTakeHome, updatedAt)
           SELECT ?, name, grossAmount, netTakeHome, ? FROM income WHERE monthYear = ?`,
          [monthYear, new Date().toISOString(), sourceTemplateMonth]
        );

        await db.run(
          `INSERT INTO expenses (monthYear, description, amount, date, category, isFixed)
           SELECT ?, description, amount, ? || SUBSTR(date, 8), category, isFixed 
           FROM expenses 
           WHERE monthYear = ? AND (category IS NULL OR LOWER(category) != 'food')`,
          [monthYear, monthYear, sourceTemplateMonth]
        );

      } catch (err) {
        console.error("Failed to accurately duplicate selected month context configuration:", err);
        alert("A database error occurred while copying the data.");
      }
    }

    await get().fetchInitialData();
    void get().syncWithCloud();
  },

  deleteMonthYear: async (monthYear) => {
    const db = await getSQLiteEngine();
    db.run(`DELETE FROM expenses WHERE monthYear = ?`, [monthYear]);
    db.run(`DELETE FROM income WHERE monthYear = ?`, [monthYear]);

    if (get().selectedMonthYear === monthYear) {
      set({ selectedMonthYear: utils.getNowString() });
    }

    await get().fetchInitialData();
    await get().syncWithCloud(true);
  },
  
  undoDeleteMonthYear: async () => {},
  
  clearAllData: async () => {
    const db = await getSQLiteEngine();
    
    db.run(`DELETE FROM expenses`);
    db.run(`DELETE FROM income`);
    db.run(`DELETE FROM debts`);
    db.run(`DELETE FROM installments`); 
    db.run(`DELETE FROM study_logs`); 
    db.run(`DELETE FROM gym_exercises`); // 💡 NEW: Clean workout catalog metrics logs
    db.run(`DELETE FROM gym_logs`);      // 💡 NEW: Clean recorded training performance rows

    set({
      income: [],
      expenses: [],
      debts: [],
      installments: [], 
      studyLogs: [], 
      gymExercises: [], // 💡 NEW: Reset exercise options array
      gymLogs: [],      // 💡 NEW: Reset data matrix tracking layers
      availableMonths: [utils.getNowString()],
      selectedMonthYear: utils.getNowString()
    });

    await get().syncWithCloud(true);
  },
  
  hydrateFromCloud: async () => { await get().fetchInitialData(); }
}));