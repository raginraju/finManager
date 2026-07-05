import { describe, it, expect } from 'vitest';
import { getPreviousMonthString, mapDateToTargetMonth } from '../store/helpers';

describe('Utility Module: Shard Calculations', () => {
  it('should deduce correct fallback strings on invalid frames', () => {
    expect(getPreviousMonthString('garbage-timeline')).toBeNull();
  });

  it('should properly clamp calendar bounds for shorter target months', () => {
    expect(mapDateToTargetMonth('2026-03-31', '2026-04')).toBe('2026-04-30');
  });

  it('should handle auto-increment mapping variations with single-digit day padding bounds', () => {
    const inputDate = '2026-07-03'; // Padded day
    const targetMonth = '2026-07';

    // Enforce that your mapping helpers handle single digit variations cleanly
    expect(mapDateToTargetMonth(inputDate, targetMonth)).toBe('2026-07-03');
  });
});