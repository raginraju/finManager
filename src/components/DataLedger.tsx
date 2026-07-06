import { useState } from 'react';
import { useWealthStore } from '../store/useWealthStore';
import { PRESSABLE_SOFT_CLASS } from '../util/pressable';

export function DataLedger() {
  const { 
    income, 
    expenses, 
    debts, 
    selectedMonthYear, 
    deleteExpense,
    upsertIncome,
    upsertDebt
  } = useWealthStore();
  
  // Master toggle set to true by default
  const [isFoodExpanded, setIsFoodExpanded] = useState(true);

  // 1. TIER 1: 10-Day Buckets State
  const getRangeLabel = (day: number) => {
    if (day <= 10) return 'Day 1 – 10';
    if (day <= 20) return 'Day 11 – 20';
    return 'Day 21+';
  };

  const [expandedRanges, setExpandedRanges] = useState<Record<string, boolean>>(() => {
    const todayNumber = new Date().getDate(); 
    return { [getRangeLabel(todayNumber)]: true }; // Auto-expands today's 10-day bucket
  });

  const toggleRangeCollapse = (rangeLabel: string) => {
    setExpandedRanges(prev => ({ ...prev, [rangeLabel]: !prev[rangeLabel] }));
  };

  // 2. TIER 2: Individual Days State
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>(() => {
    const todayNumber = new Date().getDate();
    return { [todayNumber.toString()]: true }; // Auto-expands today's exact day folder
  });

  const toggleDayCollapse = (dayStr: string) => {
    setExpandedDays(prev => ({ ...prev, [dayStr]: !prev[dayStr] }));
  };

  // Track editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTable, setEditingTable] = useState<'income' | 'expenses' | 'debts' | null>(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');

  const currentIncome = income.filter((i) => i.monthYear === selectedMonthYear);
  const currentExpenses = expenses.filter((e) => e.monthYear === selectedMonthYear);
  const currentDebts = debts.filter((d) => d.monthYear === selectedMonthYear);

  const foodExpenses = currentExpenses.filter((e) => e.category === 'Food');
  const nonFoodExpenses = currentExpenses.filter((e) => e.category !== 'Food');
  const totalFoodSum = foodExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Group into 10-day buckets
  const groupedFoodByRange = foodExpenses.reduce((acc, item) => {
    const dayMatch = item.description.match(/^(\d+)-/);
    let rangeLabel = 'Unsorted';
    
    if (dayMatch) {
      const dayNumber = parseInt(dayMatch[1], 10);
      rangeLabel = getRangeLabel(dayNumber);
    }
    
    if (!acc[rangeLabel]) {
      acc[rangeLabel] = [];
    }
    acc[rangeLabel].push(item);
    return acc;
  }, {} as Record<string, typeof foodExpenses>);

  const orderedBuckets = ['Day 1 – 10', 'Day 11 – 20', 'Day 21+', 'Unsorted'];

  const startEditing = (table: 'income' | 'expenses' | 'debts', id: number, initialName: string, initialAmount: number) => {
    setEditingId(id);
    setEditingTable(table);
    setEditName(initialName);
    setEditAmount(initialAmount.toString());
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingTable(null);
    setEditName('');
    setEditAmount('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingTable || !editName || !editAmount) return;
    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount)) return;

    try {
      if (editingTable === 'income') {
        await upsertIncome({ id: editingId, monthYear: selectedMonthYear, name: editName, grossAmount: parsedAmount, netTakeHome: parsedAmount, updatedAt: new Date().toISOString() });
      } else if (editingTable === 'debts') {
        await upsertDebt({ id: editingId, monthYear: selectedMonthYear, name: editName, totalBalance: 0, monthlyPayment: parsedAmount, isFixedInstallment: false });
      } else if (editingTable === 'expenses') {
        const item = expenses.find(e => e.id === editingId);
        if (!item) return;
        await deleteExpense(editingId);
        await useWealthStore.getState().addExpense({
          monthYear: selectedMonthYear,
          description: editName,
          amount: parsedAmount,
          date: item.date,
          category: item.category,
          isFixed: item.isFixed
        });
      }
      cancelEditing();
    } catch (err) {
      console.error("Failed to save changes safely:", err);
    }
  };

  const handleGlobalDelete = async (table: 'income' | 'expenses' | 'debts', id: number | undefined) => {
    if (!id) return;
    try {
      const store = useWealthStore.getState();
      if (table === 'income') {
        useWealthStore.setState({ income: income.filter(item => item.id !== id) });
        await store.syncWithCloud();
        await store.fetchInitialData();
      } else if (table === 'debts') {
        useWealthStore.setState({ debts: debts.filter(item => item.id !== id) });
        await store.syncWithCloud();
        await store.fetchInitialData();
      } else if (table === 'expenses') {
        await deleteExpense(id);
      }
    } catch (err) {
      console.error("Failed to delete entry:", err);
    }
  };

  const hasData = currentIncome.length > 0 || currentExpenses.length > 0 || currentDebts.length > 0;
  if (!hasData) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 shadow-sm overflow-hidden w-full">
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/40">
        <h3 className="text-xs font-semibold tracking-wider text-zinc-200 uppercase">Itemized Statement Ledger</h3>
      </div>
      
      <div className="divide-y divide-zinc-800 font-sans text-xs">
        {/* ================= INCOME ITEMS ================= */}
        {currentIncome.map((item) => {
          const isEditing = editingId === item.id && editingTable === 'income';
          return (
            <div key={`inc-${item.id}`} className="flex items-center justify-between p-3 hover:bg-zinc-900/40 transition-colors min-h-[48px]">
              <div className="flex items-center gap-2 flex-1 mr-4">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">INCOME</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-0.5 text-xs w-full focus:outline-none focus:border-zinc-700"
                  />
                ) : (
                  <span className="text-zinc-200 font-medium">{item.name}</span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isEditing ? (
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-emerald-400 font-medium rounded px-2 py-0.5 text-xs w-24 text-right focus:outline-none focus:border-zinc-700 font-mono"
                  />
                ) : (
                  <span className="text-emerald-400 font-medium font-mono">+${item.grossAmount.toFixed(2)}</span>
                )}
                
                {isEditing ? (
                  <div className="flex gap-1.5 ml-2">
                    <button onClick={handleSaveEdit} className="text-emerald-400 hover:text-emerald-300 font-medium px-1">Save</button>
                    <button onClick={cancelEditing} className="text-zinc-500 hover:text-zinc-400 px-1">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 ml-2">
                    <button 
                      onClick={() => startEditing('income', item.id!, item.name, item.grossAmount)}
                      className="text-zinc-500 hover:text-zinc-300 font-medium"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleGlobalDelete('income', item.id)}
                      className={`text-zinc-500 hover:text-red-400 p-1 cursor-pointer ${PRESSABLE_SOFT_CLASS}`}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ================= DEBT LIABILITY ITEMS ================= */}
        {currentDebts.map((item) => {
          const isEditing = editingId === item.id && editingTable === 'debts';
          return (
            <div key={`debt-${item.id}`} className="flex items-center justify-between p-3 hover:bg-zinc-900/40 transition-colors min-h-[48px]">
              <div className="flex items-center gap-2 flex-1 mr-4">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">LIABILITY</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-0.5 text-xs w-full focus:outline-none focus:border-zinc-700"
                  />
                ) : (
                  <span className="text-zinc-200 font-medium">{item.name}</span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isEditing ? (
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-red-400 font-medium rounded px-2 py-0.5 text-xs w-24 text-right focus:outline-none focus:border-zinc-700 font-mono"
                  />
                ) : (
                  <span className="text-red-400 font-medium font-mono">-${item.monthlyPayment.toFixed(2)}</span>
                )}
                
                {isEditing ? (
                  <div className="flex gap-1.5 ml-2">
                    <button onClick={handleSaveEdit} className="text-emerald-400 hover:text-emerald-300 font-medium px-1">Save</button>
                    <button onClick={cancelEditing} className="text-zinc-500 hover:text-zinc-400 px-1">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 ml-2">
                    <button 
                      onClick={() => startEditing('debts', item.id!, item.name, item.monthlyPayment)}
                      className="text-zinc-500 hover:text-zinc-300 font-medium"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleGlobalDelete('debts', item.id)}
                      className={`text-zinc-500 hover:text-red-400 p-1 cursor-pointer ${PRESSABLE_SOFT_CLASS}`}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ================= FOOD ACCORDION ITEMS (NESTED COLLAPSE) ================= */}
        {foodExpenses.length > 0 && (
          <>
            <div 
              onClick={() => setIsFoodExpanded(!isFoodExpanded)}
              className="flex items-center justify-between p-3 bg-zinc-900/10 hover:bg-zinc-900/30 transition-colors cursor-pointer border-l-2 border-amber-500/50 select-none"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-[10px] font-mono text-zinc-500 w-3 shrink-0">{isFoodExpanded ? '▼' : '▶'}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">FOOD</span>
                
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="text-zinc-100 font-semibold truncate text-xs sm:text-sm">
                    Food Summary
                  </span>
                  <span className="text-[10px] text-zinc-500 font-normal">
                    ({foodExpenses.length} {foodExpenses.length === 1 ? 'item' : 'items'})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-right">
                <span className="text-red-400 font-bold font-mono whitespace-nowrap text-xs sm:text-sm">
                  -${totalFoodSum.toFixed(2)}
                </span>
                <span className="text-[9px] sm:text-[10px] text-zinc-500 px-1 py-0.5 font-medium bg-zinc-800/60 rounded border border-zinc-700/50 uppercase select-none shrink-0">
                  {isFoodExpanded ? 'Hide' : 'View'}
                </span>
              </div>
            </div>

            {isFoodExpanded && (
              <div className="bg-zinc-950/60 flex flex-col py-2 border-b border-zinc-800">
                {orderedBuckets.map(rangeLabel => {
                  const bucketItems = groupedFoodByRange[rangeLabel];
                  if (!bucketItems || bucketItems.length === 0) return null;

                  const rangeTotal = bucketItems.reduce((sum, i) => sum + i.amount, 0);
                  const isRangeExpanded = expandedRanges[rangeLabel];

                  // TIER 2: Group the bucket's items by their specific day
                  const itemsByDay = bucketItems.reduce((acc, item) => {
                    const dayMatch = item.description.match(/^(\d+)-/);
                    const dayStr = dayMatch ? dayMatch[1] : 'Unknown';
                    if (!acc[dayStr]) acc[dayStr] = [];
                    acc[dayStr].push(item);
                    return acc;
                  }, {} as Record<string, typeof bucketItems>);

                  // Sort days numerically so e.g. Day 2 comes before Day 10
                  const sortedDays = Object.keys(itemsByDay).sort((a, b) => parseInt(a) - parseInt(b));

                  return (
                    <div key={rangeLabel} className="flex flex-col mb-1 last:mb-0">
                      
                      {/* Bucket Header (e.g., Day 1 - 10) */}
                      <button
                        onClick={() => toggleRangeCollapse(rangeLabel)}
                        className="flex items-center justify-between py-2 px-4 hover:bg-zinc-900/30 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-zinc-600 font-mono w-3 shrink-0">
                            {isRangeExpanded ? '▼' : '▶'}
                          </span>
                          <span className="text-zinc-300 font-medium text-xs tracking-wide uppercase">
                            {rangeLabel} <span className="text-zinc-600 font-normal ml-1">({bucketItems.length})</span>
                          </span>
                        </div>
                        <span className="text-amber-500/70 font-mono text-xs font-medium">
                          -${rangeTotal.toFixed(2)}
                        </span>
                      </button>

                      {/* Bucket Contents (The specific days) */}
                      {isRangeExpanded && (
                        <div className="flex flex-col pb-1">
                          {sortedDays.map(dayStr => {
                            const dayItems = itemsByDay[dayStr];
                            const dayTotal = dayItems.reduce((sum, i) => sum + i.amount, 0);
                            const isDayExpanded = expandedDays[dayStr];
                            const isToday = dayStr === new Date().getDate().toString();

                            return (
                              <div key={`day-${dayStr}`} className="flex flex-col">
                                {/* Specific Day Header (e.g., Day 4) */}
                                <button
                                  onClick={() => toggleDayCollapse(dayStr)}
                                  className={`flex items-center justify-between py-1.5 px-2 pl-9 hover:bg-zinc-900/40 transition-colors text-left border-l-2 ${isToday ? 'border-emerald-500/50 bg-zinc-900/20' : 'border-transparent'}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] text-zinc-500 font-mono w-3 shrink-0">
                                      {isDayExpanded ? '▼' : '▶'}
                                    </span>
                                    <span className={`font-medium text-[11px] ${isToday ? 'text-emerald-400/80' : 'text-zinc-400'}`}>
                                      Day {dayStr} <span className="text-zinc-600 font-normal ml-1">({dayItems.length})</span>
                                    </span>
                                  </div>
                                  <span className="text-zinc-500 font-mono text-[11px]">
                                    -${dayTotal.toFixed(2)}
                                  </span>
                                </button>

                                {/* Day Contents (The actual item logs) */}
                                {isDayExpanded && (
                                  <div className="flex flex-col bg-zinc-900/10 pb-1">
                                    {dayItems.map((item) => {
                                      const isEditing = editingId === item.id && editingTable === 'expenses';
                                      return (
                                        <div key={`food-item-${item.id}`} className="flex items-center justify-between py-1.5 pl-14 pr-4 hover:bg-zinc-900/30 transition-colors min-h-[36px]">
                                          <div className="flex items-center gap-2 flex-1 mr-4">
                                            <span className="text-zinc-600 font-mono shrink-0">└</span>
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono rounded px-2 py-0.5 text-[11px] w-full focus:outline-none focus:border-zinc-600"
                                              />
                                            ) : (
                                              <span className="text-zinc-400 font-mono text-[11px]">{item.description}</span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-3 shrink-0">
                                            {isEditing ? (
                                              <input
                                                type="number"
                                                value={editAmount}
                                                onChange={(e) => setEditAmount(e.target.value)}
                                                className="bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono rounded px-2 py-0.5 text-[11px] w-16 text-right focus:outline-none focus:border-zinc-600"
                                              />
                                            ) : (
                                              <span className="text-zinc-400 font-mono text-[11px]">-${item.amount.toFixed(2)}</span>
                                            )}

                                            {isEditing ? (
                                              <div className="flex gap-1.5 ml-2">
                                                <button onClick={handleSaveEdit} className="text-emerald-400 hover:text-emerald-300 font-medium text-[10px] px-1">Save</button>
                                                <button onClick={cancelEditing} className="text-zinc-500 hover:text-zinc-400 text-[10px] px-1">Cancel</button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-2 ml-1">
                                                <button 
                                                  onClick={() => startEditing('expenses', item.id!, item.description, item.amount)}
                                                  className="text-zinc-500 hover:text-zinc-300 font-medium text-[10px]"
                                                >
                                                  Edit
                                                </button>
                                                <button 
                                                  onClick={() => item.id && handleGlobalDelete('expenses', item.id)}
                                                  className={`text-zinc-600 hover:text-red-400 p-1 cursor-pointer text-[10px] ${PRESSABLE_SOFT_CLASS}`}
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ================= NON-FOOD EXPENSE ITEMS ================= */}
        {nonFoodExpenses.map((item) => {
          const isEditing = editingId === item.id && editingTable === 'expenses';
          return (
            <div key={`exp-${item.id}`} className="flex items-center justify-between p-3 hover:bg-zinc-900/40 transition-colors min-h-[48px]">
              <div className="flex items-center gap-2 flex-1 mr-4">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0 ${
                  item.isFixed 
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' 
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  {item.isFixed ? 'FIXED BILL' : item.category.toUpperCase()}
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-100 rounded px-2 py-0.5 text-xs w-full focus:outline-none focus:border-zinc-700"
                  />
                ) : (
                  <span className="text-zinc-200 font-medium">{item.description}</span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {isEditing ? (
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-300 font-medium rounded px-2 py-0.5 text-xs w-24 text-right focus:outline-none focus:border-zinc-700 font-mono"
                  />
                ) : (
                  <span className="text-zinc-300 font-medium font-mono">-${item.amount.toFixed(2)}</span>
                )}

                {isEditing ? (
                  <div className="flex gap-1.5 ml-2">
                    <button onClick={handleSaveEdit} className="text-emerald-400 hover:text-emerald-300 font-medium px-1">Save</button>
                    <button onClick={cancelEditing} className="text-zinc-500 hover:text-zinc-400 px-1">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 ml-2">
                    <button 
                      onClick={() => startEditing('expenses', item.id!, item.description, item.amount)}
                      className="text-zinc-500 hover:text-zinc-300 font-medium"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => item.id && handleGlobalDelete('expenses', item.id)}
                      className={`text-zinc-500 hover:text-red-400 p-1 cursor-pointer ${PRESSABLE_SOFT_CLASS}`}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}