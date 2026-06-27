import React, { useState } from 'react';
import { useWealthStore } from '../useWealthStore';
import { PRESSABLE_CLASS } from '../util/pressable';

export function DataEntryForms() {
  const selectedMonthYear = useWealthStore((state) => state.selectedMonthYear);
  const { addExpense, upsertIncome } = useWealthStore();

  const [cashName, setCashName] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [isSpent, setIsSpent] = useState(true);

  const handleCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashName || !cashAmount) return;

    const amount = parseFloat(cashAmount);

    if (isSpent) {
      await addExpense({
        monthYear: selectedMonthYear,
        description: cashName,
        amount,
        date: new Date().toISOString().split('T')[0],
        category: 'Other',
        isFixed: false, // Defaulting back to a standard flat structural value
      });
    } else {
      await upsertIncome({
        monthYear: selectedMonthYear,
        name: cashName,
        grossAmount: amount,
        netTakeHome: amount,
        updatedAt: new Date(),
      });
    }

    setCashName('');
    setCashAmount('');
    setIsSpent(true);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4 shadow-sm w-full">
      <h3 className="text-xs font-semibold tracking-wider text-zinc-200 uppercase">Log Cash</h3>
      <form onSubmit={handleCashSubmit} className="space-y-3">
        <input
          type="text"
          value={cashName}
          onChange={(e) => setCashName(e.target.value)}
          placeholder="What was it for?"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
        />
        <input
          type="number"
          value={cashAmount}
          onChange={(e) => setCashAmount(e.target.value)}
          placeholder="Amount ($)"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
        />
        
        {/* Selection Flag Container */}
        <div className="flex flex-col gap-2 pt-1">
          <label className="flex items-center gap-2 text-[11px] text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isSpent}
              onChange={(e) => setIsSpent(e.target.checked)}
              className="rounded bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-0"
            />
            Spent (uncheck for Earned)
          </label>
        </div>

        <button 
          type="submit" 
          className={`w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-md text-xs font-medium ${PRESSABLE_CLASS} cursor-pointer shadow-sm`}
        >
          Save Cash Log
        </button>
      </form>
    </div>
  );
}