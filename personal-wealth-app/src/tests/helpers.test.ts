import { describe, it, expect } from 'vitest';
import { getPreviousMonthString, mapDateToTargetMonth } from '../store/helpers';

describe('Financial Ledger Helper Core Logic', () => {
  
  it('should correctly calculate the previous month string configuration', () => {
    expect(getPreviousMonthString('2026-03')).toBe('2026-02');
    expect(getPreviousMonthString('2026-01')).toBe('2025-12');
  });

  it('should fallback gracefully when converting garbage month frames', () => {
    expect(getPreviousMonthString('invalid-date')).toBeNull();
  });

  it('should safely map an expense date to a newly added month period framework', () => {
    const inputDate = '2026-03-15';
    const targetMonth = '2026-04';
    // Should lock the day (15th) to the target month window safely
    expect(mapDateToTargetMonth(inputDate, targetMonth)).toBe('2026-04-15');
  });

  it('should clamp the day value if the target month has fewer days', () => {
    const inputDate = '2026-03-31'; // March 31st
    const targetMonth = '2026-04';  // April only has 30 days
    expect(mapDateToTargetMonth(inputDate, targetMonth)).toBe('2026-04-30');
  });
});