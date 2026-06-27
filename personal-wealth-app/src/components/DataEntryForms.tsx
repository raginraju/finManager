import React, { useState } from 'react';
import { useWealthStore } from '../useWealthStore';
import { PRESSABLE_CLASS } from '../util/pressable';

export function DataEntryForms() {
  const selectedMonthYear = useWealthStore((state) => state.selectedMonthYear);
  const { upsertIncome, addExpense, upsertDebt } = useWealthStore();

  // Income State
  const [incName, setIncName] = useState('');
  const [incAmount, setIncAmount] = useState('');

  // Expense State
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Food');
  const [expIsFixed, setExpIsFixed] = useState(false);

  // Debt State
  const [debtName, setDebtName] = useState('');
  const [debtMonthly, setDebtMonthly] = useState('');

  const handleIncomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incName || !incAmount) return;
    const amount = parseFloat(incAmount);

    await upsertIncome({
      monthYear: selectedMonthYear,
      name: incName,
      grossAmount: amount,
      netTakeHome: amount, // Direct 1:1 matching without tax/withholding structures
      updatedAt: new Date()
    });
    setIncName('');
    setIncAmount('');
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expDesc || !expAmount) return;
    await addExpense({
      monthYear: selectedMonthYear,
      description: expDesc,
      amount: parseFloat(expAmount),
      date: new Date().toISOString().split('T')[0],
      category: expCategory,
      isFixed: expIsFixed
    });
    setExpDesc('');
    setExpAmount('');
  };

  const handleDebtSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtName || !debtMonthly) return;
    await upsertDebt({
      monthYear: selectedMonthYear,
      name: debtName,
      totalBalance: 0,
      monthlyPayment: parseFloat(debtMonthly),
      isFixedInstallment: true
    });
    setDebtName('');
    setDebtMonthly('');
  };

  return (
    <div className="grid gap-6 md:grid-cols-3 w-full">
      {/* Income Log */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4 shadow-sm">
        <h3 className="text-xs font-semibold tracking-wider text-zinc-200 uppercase">Log Cash Inflow</h3>
        <form onSubmit={handleIncomeSubmit} className="space-y-3">
          <input
            type="text"
            value={incName}
            onChange={(e) => setIncName(e.target.value)}
            placeholder="Source (e.g. Inflow Base)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
          />
          <input
            type="number"
            value={incAmount}
            onChange={(e) => setIncAmount(e.target.value)}
            placeholder="Amount ($)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
          />
          <button type="submit" className={`w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-md text-xs font-medium ${PRESSABLE_CLASS} cursor-pointer shadow-sm`}>
            Commit Cash Inflow
          </button>
        </form>
      </div>

      {/* Expense Form */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4 shadow-sm">
        <h3 className="text-xs font-semibold tracking-wider text-zinc-200 uppercase">Log Outflow</h3>
        <form onSubmit={handleExpenseSubmit} className="space-y-3">
          <input
            type="text"
            value={expDesc}
            onChange={(e) => setExpDesc(e.target.value)}
            placeholder="Description (e.g. Dining, Transit)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              placeholder="Amount ($)"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
            />
            <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-400 focus:outline-none focus:border-zinc-700">
              <option value="Food">Food</option>
              <option value="Rent">Rent</option>
              <option value="Utilities">Utilities</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer pt-1">
            <input type="checkbox" checked={expIsFixed} onChange={(e) => setExpIsFixed(e.target.checked)} className="rounded bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-0" />
            Recurring Fixed Outflow
          </label>
          <button type="submit" className={`w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-medium ${PRESSABLE_CLASS} cursor-pointer border border-zinc-700`}>
            Log Transaction
          </button>
        </form>
      </div>

      {/* Debt Form */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4 shadow-sm">
        <h3 className="text-xs font-semibold tracking-wider text-zinc-200 uppercase">Register Installment</h3>
        <form onSubmit={handleDebtSubmit} className="space-y-3">
          <input
            type="text"
            value={debtName}
            onChange={(e) => setDebtName(e.target.value)}
            placeholder="Facility (e.g. Card Plan)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
          />
          <input
            type="number"
            value={debtMonthly}
            onChange={(e) => setDebtMonthly(e.target.value)}
            placeholder="Monthly Payment ($)"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
          />
          <button type="submit" className={`w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-medium ${PRESSABLE_CLASS} cursor-pointer border border-zinc-700`}>
            Commit Installment Line
          </button>
        </form>
      </div>
    </div>
  );
}