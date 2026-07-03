import { type IncomeSource, type Expense, type DebtLiability } from '../db';

export interface MonthShardPayload {
  income: IncomeSource[];
  expenses: Expense[];
  debts: DebtLiability[];
}

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

/**
 * 💡 ADDED FOR SHARDING: Filters global array lists down to a targeted monthly snapshot payload
 */
export const extractShardPayload = (
  income: IncomeSource[],
  expenses: Expense[],
  debts: DebtLiability[],
  targetMonthYear: string
): MonthShardPayload => {
  return {
    income: income.filter((i) => i.monthYear === targetMonthYear),
    expenses: expenses.filter((e) => e.category === 'Food' 
      ? e.monthYear === targetMonthYear 
      : e.monthYear === targetMonthYear
    ),
    debts: debts.filter((d) => d.monthYear === targetMonthYear),
  };
};