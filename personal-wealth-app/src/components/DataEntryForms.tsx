import React, { useState } from 'react';
import { useWealthStore } from '../useWealthStore';
import { PRESSABLE_CLASS } from '../util/pressable';

// Core category option selection blocks
type LogCategory = 'Earn' | 'Food' | 'Util' | 'Credit' | 'Custom';

export function DataEntryForms() {
  const selectedMonthYear = useWealthStore((state) => state.selectedMonthYear);
  const { expenses, addExpense, upsertIncome } = useWealthStore();

  // Primary Inputs
  const [activeCategory, setActiveCategory] = useState<LogCategory>('Food');
  const [cashAmount, setCashAmount] = useState('');
  
  // Dynamic Option Fields
  const [subOption, setSubOption] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [foodDay, setFoodDay] = useState(''); // Text box to track structural day input

  const handleCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashAmount) return;

    const amount = parseFloat(cashAmount);
    let finalizedKey = '';

    // 1. Resolve structural description titles depending on context
    if (activeCategory === 'Earn') {
      finalizedKey = customKey || 'Salary';
    } else if (activeCategory === 'Credit' || activeCategory === 'Util') {
      finalizedKey = subOption;
    } else if (activeCategory === 'Custom') {
      finalizedKey = customKey;
    } else if (activeCategory === 'Food') {
      const dayInt = parseInt(foodDay) || new Date().getDate();
      
      // Calculate how many food entries match the day input to handle auto-incrementation
      const matchingFoodCount = expenses.filter(exp => {
        const isCurrentPeriod = exp.monthYear === selectedMonthYear;
        const isFoodType = exp.category === 'Food';
        // Check if the current description string starts with the designated structural "day-" prefix
        const startsWithDayPattern = exp.description.startsWith(`${dayInt}-`);
        return isCurrentPeriod && isFoodType && startsWithDayPattern;
      }).length;

      // Suffix generator formatting (e.g., "3-1", "3-2")
      finalizedKey = `${dayInt}-${matchingFoodCount + 1}`;
    }

    if (!finalizedKey) return;

    // 2. State dispatch routing payload executions
    if (activeCategory === 'Earn') {
      await upsertIncome({
        monthYear: selectedMonthYear,
        name: finalizedKey,
        grossAmount: amount,
        netTakeHome: amount,
        updatedAt: new Date(),
      });
    } else {
      await addExpense({
        monthYear: selectedMonthYear,
        description: finalizedKey,
        amount,
        date: new Date().toISOString().split('T')[0],
        category: activeCategory,
        isFixed: false,
      });
    }

    // Clean inputs up cleanly, maintaining segment selection for high-frequency logs
    setCashAmount('');
    setCustomKey('');
    setFoodDay('');
  };

  // Re-synchronize structural default select dropdown strings when toggling options
  const handleCategoryChange = (option: LogCategory) => {
    setActiveCategory(option);
    if (option === 'Credit') setSubOption('Credit Card');
    else if (option === 'Util') setSubOption('Rent');
    else setSubOption('');
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4 shadow-sm w-full">
      <h3 className="text-xs font-semibold tracking-wider text-zinc-200 uppercase">Log Cash</h3>
      <form onSubmit={handleCashSubmit} className="space-y-4">
        
        {/* 💡 STEP 1: Segmented Options Moved On Top */}
        <div className="grid grid-cols-5 gap-1 p-1 bg-zinc-950 border border-zinc-900 rounded-lg">
          {(['Earn', 'Food', 'Util', 'Credit', 'Custom'] as LogCategory[]).map((option) => {
            const isSelected = activeCategory === option;
            let activeStyles = 'bg-zinc-800 text-zinc-100 font-medium border border-zinc-700';
            if (isSelected && option === 'Earn') {
              activeStyles = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium';
            }

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleCategoryChange(option)}
                className={`py-2 text-[10px] rounded transition-all text-center uppercase tracking-wider cursor-pointer border border-transparent ${
                  isSelected ? activeStyles : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {/* 💡 STEP 2: Conditional Sub-Options & Custom Keys Rendering Panels */}
        
        {/* CREDIT Sub-Options Configuration Grid dropdown */}
        {activeCategory === 'Credit' && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase block">Account Source</label>
            <select
              value={subOption}
              onChange={(e) => setSubOption(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
            >
              <option value="Credit Card">Credit Card</option>
              <option value="Cash Line">Cash Line</option>
              <option value="Trust">Trust</option>
              <option value="TFL">TFL</option>
            </select>
          </div>
        )}

        {/* UTILITIES Sub-Options Layout parameters */}
        {activeCategory === 'Util' && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase block">Utility Target</label>
            <select
              value={subOption}
              onChange={(e) => setSubOption(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
            >
              <option value="Rent">Rent</option>
              <option value="Giga">Giga</option>
              <option value="Simba">Simba</option>
              <option value="PUB">PUB</option>
              <option value="Tax">Tax</option>
            </select>
          </div>
        )}

        {/* FOOD Auto-Incrementation Day Textbox Entry input block */}
        {activeCategory === 'Food' && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase block">Day of Month</label>
            <input
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              value={foodDay}
              onChange={(e) => setFoodDay(e.target.value.replace(/\D/g, ''))}
              placeholder={`e.g. 3 (Auto generates ${foodDay ? foodDay : '3'}-1, ${foodDay ? foodDay : '3'}-2)`}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
            />
          </div>
        )}

        {/* CUSTOM / EARN Key Manual Input Fields */}
        {(activeCategory === 'Custom' || activeCategory === 'Earn') && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase block">
              {activeCategory === 'Earn' ? 'Inflow Description (Optional)' : 'Custom Identifier'}
            </label>
            <input
              type="text"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder={activeCategory === 'Earn' ? 'Salary' : 'Enter custom label...'}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
            />
          </div>
        )}

        {/* Standard Numeric Value field parameter wrapper */}
        <div className="space-y-1">
          <label className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase block">Amount ($)</label>
          <input
            type="number"
            step="0.01"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
          />
        </div>

        {/* Form Submission Action Button Trigger */}
        <button 
          type="submit" 
          className={`w-full py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 rounded-md text-xs font-medium ${PRESSABLE_CLASS} cursor-pointer shadow-sm mt-2`}
        >
          Save Transaction
        </button>
      </form>
    </div>
  );
}