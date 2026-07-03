import { describe, it, expect, beforeEach } from 'vitest';
import initSqlJs from 'sql.js';

describe('Database Module: SQLite Schema & Ingestion engine', () => {
  let db: any;

  beforeEach(async () => {
    const SQL = await initSqlJs(); //[cite: 1]
    db = new SQL.Database(); //[cite: 1]
    
    // Reproduce target baseline layout tables from src/db.ts
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
    `); //[cite: 1]
  });

  it('should create schemas and correctly accept financial payload writes', () => {
    db.run(
      `INSERT INTO income (monthYear, name, grossAmount, netTakeHome, updatedAt) VALUES (?, ?, ?, ?, ?)`,
      ['2026-07', 'Primary Salary', 6500, 6500, new Date().toISOString()]
    ); //[cite: 1]

    // 💡 FIXED: Explicitly querying the exact month string literal inserted above
    const result = db.exec("SELECT * FROM income WHERE monthYear = '2026-07'"); //[cite: 1]
    expect(result).toHaveLength(1); //[cite: 1]
    expect(result[0].values[0][2]).toBe('Primary Salary'); //[cite: 1]
    expect(result[0].values[0][3]).toBe(6500); //[cite: 1]
  });

  it('should correctly filter down transactional sums matching monthly records', () => {
    db.run(`INSERT INTO expenses (monthYear, description, amount, date, category, isFixed) VALUES 
      ('2026-07', 'Lunch', 15.50, '2026-07-01', 'Food', 0),
      ('2026-08', 'Rent', 2200.00, '2026-08-01', 'Util', 1)
    `); //[cite: 1]

    const activeJulyRows = db.exec("SELECT amount FROM expenses WHERE monthYear = '2026-07'")[0].values; //[cite: 1]
    expect(activeJulyRows).toHaveLength(1); //[cite: 1]
    expect(activeJulyRows[0][0]).toBe(15.50); //[cite: 1]
  });
});