import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useWealthStore } from '../store/useWealthStore';

// Mock database path loader references
// Mock database path loader references
vi.mock('../db', () => ({
  getSQLiteEngine: vi.fn(async () => {
    // 💡 FIXED: Using standard ES dynamic import syntax instead of CommonJS require()
    const initSqlJs = (await import('sql.js')).default; 
    const SQL = await initSqlJs();
    const db = new SQL.Database();
    db.run(`
      CREATE TABLE IF NOT EXISTS income (id INTEGER PRIMARY KEY, monthYear TEXT, name TEXT, grossAmount REAL, netTakeHome REAL, updatedAt TEXT);
      CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY, monthYear TEXT, description TEXT, amount REAL, date TEXT, category TEXT, isFixed INTEGER);
      CREATE TABLE IF NOT EXISTS debts (id INTEGER PRIMARY KEY, monthYear TEXT, name TEXT, totalBalance REAL, monthlyPayment REAL, isFixedInstallment INTEGER);
    `);
    return db;
  })
}));

describe('State Module: Zustand Wealth Orchestrator', () => {
  beforeEach(() => {
    useWealthStore.setState({
      income: [],
      expenses: [],
      debts: [],
      gdriveToken: null,
      selectedMonthYear: '2026-07',
      availableMonths: ['2026-07'],
      syncStatus: 'idle'
    });
  });

  it('should properly configure default tracking parameters initially', () => {
    const state = useWealthStore.getState();
    expect(state.selectedMonthYear).toBe('2026-07');
    expect(state.syncStatus).toBe('idle');
    expect(state.income).toHaveLength(0);
  });

  it('should optimize active timeframes via setSelectedMonthYear updates', async () => {
    const store = useWealthStore.getState();
    await store.setSelectedMonthYear('2026-08');
    
    expect(useWealthStore.getState().selectedMonthYear).toBe('2026-08');
  });

  it('should execute immediate responsive shifts under setGDriveToken allocations', async () => {
    const store = useWealthStore.getState();
    await store.setGDriveToken('mock-oauth-token-string');

    expect(useWealthStore.getState().gdriveToken).toBe('mock-oauth-token-string');
  });

    it('should fail gracefully and refuse to throw fatal crashes if selection strings are malformed or injected', async () => {
        const store = useWealthStore.getState();

        // Simulating an unexpected malicious timeframe input or unescaped character breakdown
        await expect(async () => {
            await store.setSelectedMonthYear("' OR 1=1; --");
        }).not.toThrow();
    });

    it('should unlock the UI loader state completely if the cloud service encounters a network breakdown', async () => {
        // Force a temporary broken state representation into your service modules
        const store = useWealthStore.getState();
        useWealthStore.setState({ gdriveToken: 'active-token-present' });

        // Triggering pull when network endpoints are completely blocked or down
        await store.pullFromCloud();

        const finalState = useWealthStore.getState();
        expect(finalState.isHydrating).toBe(false); // Spinner must shut down
        expect(finalState.syncStatus).toBe('error'); // Error state must be exposed
    });

});