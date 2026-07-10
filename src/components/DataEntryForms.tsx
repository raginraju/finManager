import React, { useState } from 'react';
import { useWealthStore } from '../store/useWealthStore';
import { PRESSABLE_CLASS } from '../util/pressable';

type LogCategory = 'Earn' | 'Food' | 'Util' | 'Credit' | 'Custom';
type PaymentMethod = 'Debit' | 'Trust';

export function DataEntryForms() {
  const selectedMonthYear = useWealthStore((state) => state.selectedMonthYear);
  const { expenses, addExpense, upsertIncome } = useWealthStore();

  // Primary Inputs
  const [activeCategory, setActiveCategory] = useState<LogCategory>('Food');
  const [cashAmount, setCashAmount] = useState('');
  
  // Dynamic Option Fields
  const [subOption, setSubOption] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [foodDay, setFoodDay] = useState(''); 
  
  // 💡 GENERALIZED: Now controls payment routing for Food, Util, and Custom!
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Debit'); 

  const handleCashSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashAmount) return;

    const amount = parseFloat(cashAmount);
    let finalizedKey = '';

    // 1. Resolve structural description titles depending on context
    if (activeCategory === 'Earn') {
      finalizedKey = customKey || 'Salary';
    } else if (activeCategory === 'Credit') {
      finalizedKey = subOption;
    } else if (activeCategory === 'Util') {
      // 💡 NEW: Automatically tags utilities with the selected payment method!
      finalizedKey = `${subOption} (${paymentMethod})`;
    } else if (activeCategory === 'Custom') {
      // 💡 NEW: Automatically tags custom entries, with a fallback if left blank
      const safeKey = customKey || 'Custom';
      finalizedKey = `${safeKey} (${paymentMethod})`;
    } else if (activeCategory === 'Food') {
      const dayInt = parseInt(foodDay) || new Date().getDate();
      
      const matchingFoodCount = expenses.filter(exp => {
        const isCurrentPeriod = exp.monthYear === selectedMonthYear;
        const isFoodType = exp.category === 'Food';
        const startsWithDayPattern = exp.description.startsWith(`${dayInt}-`);
        return isCurrentPeriod && isFoodType && startsWithDayPattern;
      }).length;

      finalizedKey = `${dayInt}-${matchingFoodCount + 1} (${paymentMethod})`;
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

    // Clean inputs up cleanly
    setCashAmount('');
    setCustomKey('');
    setFoodDay('');
  };

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
        
        {/* STEP 1: Segmented Options */}
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

        {/* STEP 2: Conditional Sub-Options & Custom Keys Rendering Panels */}
        
        {/* CREDIT */}
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

        {/* UTILITIES - 💡 Now a 2-column grid with Payment Via */}
        {activeCategory === 'Util' && (
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-1">
              <label className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase block">Payment Via</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                <option value="Debit">Debit Card</option>
                <option value="Trust">Trust Card</option>
              </select>
            </div>
          </div>
        )}

        {/* FOOD */}
        {activeCategory === 'Food' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase block">Day of Month</label>
              <input
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                value={foodDay}
                onChange={(e) => setFoodDay(e.target.value.replace(/\D/g, ''))}
                placeholder={`e.g. ${new Date().getDate()}`}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase block">Payment Via</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                <option value="Debit">Debit Card</option>
                <option value="Trust">Trust Card</option>
              </select>
            </div>
          </div>
        )}

        {/* EARN (Separated from Custom to remove the Payment option) */}
        {activeCategory === 'Earn' && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase block">Inflow Description (Optional)</label>
            <input
              type="text"
              value={customKey}
              onChange={(e) => setCustomKey(e.target.value)}
              placeholder="Salary"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
            />
          </div>
        )}

        {/* CUSTOM - 💡 Now a 2-column grid with Payment Via */}
        {activeCategory === 'Custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase block">Custom Identifier</label>
              <input
                type="text"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="Enter label..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase block">Payment Via</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                <option value="Debit">Debit Card</option>
                <option value="Trust">Trust Card</option>
              </select>
            </div>
          </div>
        )}

        {/* Amount Input */}
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