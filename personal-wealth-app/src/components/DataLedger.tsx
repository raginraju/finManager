import { useState } from 'react';
import { useWealthStore } from '../useWealthStore';
import { db } from '../db';
import { PRESSABLE_SOFT_CLASS } from '../util/pressable';

export function DataLedger() {
  const { income, expenses, debts, selectedMonthYear, fetchInitialData, syncWithCloud } = useWealthStore();
  
  // Local state switch to toggle the nested food item sub-rows visibility
  const [isFoodExpanded, setIsFoodExpanded] = useState(false);

  // Filter items strictly tied to the active timeframe
  const currentIncome = income.filter((i) => i.monthYear === selectedMonthYear);
  const currentExpenses = expenses.filter((e) => e.monthYear === selectedMonthYear);
  const currentDebts = debts.filter((d) => d.monthYear === selectedMonthYear);

  // 💡 Group Food expenses away from other miscellaneous expense outflows
  const foodExpenses = currentExpenses.filter((e) => e.category === 'Food');
  const nonFoodExpenses = currentExpenses.filter((e) => e.category !== 'Food');

  // Compute total aggregate food outlays
  const totalFoodSum = foodExpenses.reduce((sum, e) => sum + e.amount, 0);

  const handleDelete = async (table: 'income' | 'expenses' | 'debts', id: number | undefined) => {
    if (!id) return;

    await db[table].delete(id);
    await fetchInitialData();
    await syncWithCloud();
  };

  const hasData = currentIncome.length > 0 || currentExpenses.length > 0 || currentDebts.length > 0;

  if (!hasData) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 shadow-sm overflow-hidden w-full">
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/40">
        <h3 className="text-xs font-semibold tracking-wider text-zinc-200 uppercase">Itemized Statement Ledger</h3>
      </div>
      
      <div className="divide-y divide-zinc-800 font-sans text-xs">
        {/* Income Items */}
        {currentIncome.map((item) => (
          <div key={`inc-${item.id}`} className="flex items-center justify-between p-3 hover:bg-zinc-900/40 transition-colors">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">INCOME</span>
              <span className="text-zinc-200 font-medium">{item.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-emerald-400 font-medium">+${item.grossAmount.toFixed(2)}</span>
              <button 
                onClick={() => handleDelete('income', item.id)}
                className={`text-zinc-500 hover:text-red-400 p-1 cursor-pointer ${PRESSABLE_SOFT_CLASS}`}
                title="Remove Item"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {/* Debt Liability Items */}
        {currentDebts.map((item) => (
          <div key={`debt-${item.id}`} className="flex items-center justify-between p-3 hover:bg-zinc-900/40 transition-colors">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">LIABILITY</span>
              <span className="text-zinc-200 font-medium">{item.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-red-400 font-medium">-${item.monthlyPayment.toFixed(2)}</span>
              <button 
                onClick={() => handleDelete('debts', item.id)}
                className={`text-zinc-500 hover:text-red-400 p-1 cursor-pointer ${PRESSABLE_SOFT_CLASS}`}
                title="Remove Item"
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {/* 💡 1. COMBINED COMPACT FOOD CATEGORY CARD ROW */}
        {foodExpenses.length > 0 && (
          <>
            <div 
              onClick={() => setIsFoodExpanded(!isFoodExpanded)}
              className="flex items-center justify-between p-3 bg-zinc-900/10 hover:bg-zinc-900/30 transition-colors cursor-pointer border-l-2 border-amber-500/50 select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-500 w-3 text-center">
                  {isFoodExpanded ? '▼' : '▶'}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  FOOD
                </span>
                <span className="text-zinc-100 font-semibold">
                  Food Summary <span className="text-[11px] text-zinc-500 font-normal">({foodExpenses.length} items)</span>
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-red-400 font-bold">-${totalFoodSum.toFixed(2)}</span>
                <span className="text-[10px] text-zinc-500 px-1 font-medium bg-zinc-800/60 rounded border border-zinc-700/50 uppercase">
                  {isFoodExpanded ? 'Hide' : 'View'}
                </span>
              </div>
            </div>

            {/* 💡 2. ACCORDION EXPANSION CONTAINER PANEL */}
            {isFoodExpanded && (
              <div className="bg-zinc-950/60 divide-y divide-zinc-900 border-b border-zinc-800">
                {foodExpenses.map((item) => (
                  <div key={`food-sub-${item.id}`} className="flex items-center justify-between p-2.5 pl-9 pr-3 hover:bg-zinc-900/20 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 font-mono">└─</span>
                      <span className="text-zinc-400 font-mono">Item: {item.description}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-400 font-mono">-${item.amount.toFixed(2)}</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation(); // Stop click bubble from re-collapsing accordion
                          handleDelete('expenses', item.id);
                        }}
                        className={`text-zinc-600 hover:text-red-400 p-1 cursor-pointer ${PRESSABLE_SOFT_CLASS}`}
                        title="Remove Sub-item"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Regular Expense Outflow Items (Non-Food categories remain ungrouped) */}
        {nonFoodExpenses.map((item) => (
          <div key={`exp-${item.id}`} className="flex items-center justify-between p-3 hover:bg-zinc-900/40 transition-colors">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                item.isFixed 
                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' 
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                {item.isFixed ? 'FIXED BILL' : item.category.toUpperCase()}
              </span>
              <span className="text-zinc-200 font-medium">{item.description}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-zinc-300 font-medium">-${item.amount.toFixed(2)}</span>
              <button 
                onClick={() => handleDelete('expenses', item.id)}
                className={`text-zinc-500 hover:text-red-400 p-1 cursor-pointer ${PRESSABLE_SOFT_CLASS}`}
                title="Remove Item"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}