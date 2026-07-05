import { type IncomeSource, type Expense, type DebtLiability } from '../db';

export const getNowString = (): string => new Date().toISOString().slice(0, 7);

export const toMonthDate = (monthYear: string): Date | null => {
  const [year, month] = monthYear.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
};

export const getPreviousMonthString = (monthYear: string): string | null => {
  const date = toMonthDate(monthYear);
  if (!date) return null;
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
};

export const mapDateToTargetMonth = (dateValue: string, targetMonthYear: string): string => {
  const sourceDate = new Date(dateValue);
  if (Number.isNaN(sourceDate.getTime())) return `${targetMonthYear}-01`;

  const [year, month] = targetMonthYear.split('-').map(Number);
  if (!year || !month) return dateValue;

  const daysInTargetMonth = new Date(year, month, 0).getDate();
  const dayMatch = dateValue.match(/-(\d{2})$/);
  const sourceDay = dayMatch ? parseInt(dayMatch[1], 10) : sourceDate.getDate();
  const day = Math.min(sourceDay, daysInTargetMonth);
  const paddedMonth = String(month).padStart(2, '0');
  const paddedDay = String(day).padStart(2, '0');

  return `${year}-${paddedMonth}-${paddedDay}`;
};

export const recalculateAvailableMonths = (
  income: IncomeSource[],
  expenses: Expense[],
  debts: DebtLiability[],
  monthMarkers: string[]
): string[] => {
  const months = new Set<string>([getNowString()]);
  monthMarkers.forEach(m => months.add(m));
  income.forEach(i => months.add(i.monthYear));
  expenses.forEach(e => months.add(e.monthYear));
  debts.forEach(d => months.add(d.monthYear));
  return Array.from(months).sort((a, b) => b.localeCompare(a));
};

/* ==========================================================================
   TRUST BANK BILLING CYCLE CALCULATION ENGINE
   ========================================================================== */

/**
 * Calculates the variable Trust Bank billing cycle based on the month.
 * The statement always closes 4 days prior to the last calendar day of the month.
 * @param selectedMonthYear The target ledger month (e.g., "2026-05")
 */
export function calculateTrustBillingCycle(selectedMonthYear: string) {
  const [year, month] = selectedMonthYear.split('-').map(Number);
  
  // 1. Establish Cycle End: 4 days before the last day of the current month
  // (Passing 0 as the day returns the last day of the previous month context, so 'month' gives the last day of this month)
  const cycleEnd = new Date(year, month, 0); 
  cycleEnd.setDate(cycleEnd.getDate() - 4);

  // 2. Establish Cycle Start: 4 days before the last day of the PREVIOUS month + 1 day
  const cycleStart = new Date(year, month - 1, 0);
  cycleStart.setDate(cycleStart.getDate() - 4 + 1);

  return {
    cycleStart,
    cycleEnd
  };
}