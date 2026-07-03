import { describe, it, expect } from 'vitest';
import { getPreviousMonthString, mapDateToTargetMonth, extractShardPayload } from '../store/helpers';

describe('Utility Module: Shard Calculations', () => {
  it('should deduce correct fallback strings on invalid frames', () => {
    expect(getPreviousMonthString('garbage-timeline')).toBeNull();
  });

  it('should properly clamp calendar bounds for shorter target months', () => {
    expect(mapDateToTargetMonth('2026-03-31', '2026-04')).toBe('2026-04-30');
  });

  it('should slice data arrays using extractShardPayload filters safely', () => {
    const mockExpenses = [
      { id: 1, monthYear: '2026-07', description: 'Target Item', amount: 50, date: '2026-07-02', category: 'Food', isFixed: false },
      { id: 2, monthYear: '2026-08', description: 'Next Month Item', amount: 90, date: '2026-08-01', category: 'Util', isFixed: true }
    ];
    
    const payload = extractShardPayload([], mockExpenses, [], '2026-07');
    expect(payload.expenses).toHaveLength(1);
    expect(payload.expenses[0].description).toBe('Target Item');
  });

  it('should handle auto-increment mapping variations with single-digit day padding bounds', () => {
    const inputDate = '2026-07-03'; // Padded day
    const targetMonth = '2026-07';

    // Enforce that your mapping helpers handle single digit variations cleanly
    expect(mapDateToTargetMonth(inputDate, targetMonth)).toBe('2026-07-03');
  });
});