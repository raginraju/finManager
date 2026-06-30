import { useState } from 'react';
import { useWealthStore } from '../store/useWealthStore';
import { db } from '../db';
import { PRESSABLE_SOFT_CLASS } from '../util/pressable';

export function DataLedger() {
  const { 
    income, 
    expenses, 
    debts, 
    selectedMonthYear, 
    syncWithCloud,
    deleteExpense 
  } = useWealthStore();
  
  const [isFoodExpanded, setIsFoodExpanded] = useState(false);

  // Track which specific item is currently being edited
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTable, setEditingTable] = useState<'income' | 'expenses' | 'debts' | null>(null);
  
  // Buffers to hold changing text inputs
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');

  // Filter items strictly tied to the active timeframe
  const currentIncome = income.filter((i) => i.monthYear === selectedMonthYear);
  const currentExpenses = expenses.filter((e) => e.monthYear === selectedMonthYear);
  const currentDebts = debts.filter((d) => d.monthYear === selectedMonthYear);

  const foodExpenses = currentExpenses.filter((e) => e.category === 'Food');
  const nonFoodExpenses = currentExpenses.filter((e) => e.category !== 'Food');
  const totalFoodSum = foodExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Initialize row parameters into state for editing
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

  // 💡 Save updates instantly to local DB, local store state, and Google Drive
  const handleSaveEdit = async () => {
    if (!editingId || !editingTable || !editName || !editAmount) return;
    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount)) return;

    try {
      if (editingTable === 'income') {
        const item = income.find(i => i.id === editingId);
        if (!item) return;
        const updatedItem = { ...item, name: editName, grossAmount: parsedAmount, netTakeHome: parsedAmount };
        
        await db.income.put(updatedItem);
        useWealthStore.setState({ income: income.map(i => i.id === editingId ? updatedItem : i) });

      } else if (editingTable === 'debts') {
        const item = debts.find(d => d.id === editingId);
        if (!item) return;
        const updatedItem = { ...item, name: editName, monthlyPayment: parsedAmount };
        
        await db.debts.put(updatedItem);
        useWealthStore.setState({ debts: debts.map(d => d.id === editingId ? updatedItem : d) });

      } else if (editingTable === 'expenses') {
        const item = expenses.find(e => e.id === editingId);
        if (!item) return;
        const updatedItem = { ...item, description: editName, amount: parsedAmount };
        
        await db.expenses.put(updatedItem);
        useWealthStore.setState({ expenses: expenses.map(e => e.id === editingId ? updatedItem : e) });
      }

      await syncWithCloud();
      cancelEditing();
    } catch (err) {
      console.error("Failed to save changes safely:", err);
    }
  };

  const handleGlobalDelete = async (table: 'income' | 'expenses' | 'debts', id: number | undefined) => {
    if (!id) return;
    try {
      await db[table].delete(id);
      if (table === 'income') {
        useWealthStore.setState({ income: income.filter(item => item.id !== id) });
      } else if (table === 'debts') {
        useWealthStore.setState({ debts: debts.filter(item => item.id !== id) });
      } else if (table === 'expenses') {
        useWealthStore.setState({ expenses: expenses.filter(item => item.id !== id) });
      }
      await syncWithCloud();
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

        {/* ================= FOOD ACCORDION ITEMS (NESTED EDITING) ================= */}
        {foodExpenses.length > 0 && (
          <>
            <div 
              onClick={() => setIsFoodExpanded(!isFoodExpanded)}
              className="flex items-center justify-between p-3 bg-zinc-900/10 hover:bg-zinc-900/30 transition-colors cursor-pointer border-l-2 border-amber-500/50 select-none"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-500 w-3 text-center">{isFoodExpanded ? '▼' : '▶'}</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">FOOD</span>
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

            {isFoodExpanded && (
              <div className="bg-zinc-950/60 divide-y divide-zinc-900 border-b border-zinc-800">
                {foodExpenses.map((item) => {
                  const isEditing = editingId === item.id && editingTable === 'expenses';
                  return (
                    <div key={`food-sub-${item.id}`} className="flex items-center justify-between p-2.5 pl-9 pr-3 hover:bg-zinc-900/20 transition-colors min-h-[44px]">
                      <div className="flex items-center gap-2 flex-1 mr-4">
                        <span className="text-zinc-500 font-mono shrink-0">└─</span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 text-zinc-400 font-mono rounded px-2 py-0.5 text-xs w-full focus:outline-none focus:border-zinc-700"
                          />
                        ) : (
                          <span className="text-zinc-400 font-mono">Item: {item.description}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 text-zinc-400 font-mono rounded px-2 py-0.5 text-xs w-24 text-right focus:outline-none focus:border-zinc-700"
                          />
                        ) : (
                          <span className="text-zinc-400 font-mono">-${item.amount.toFixed(2)}</span>
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
                              onClick={() => item.id && deleteExpense(item.id)}
                              className={`text-zinc-600 hover:text-red-400 p-1 cursor-pointer ${PRESSABLE_SOFT_CLASS}`}
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
                      onClick={() => item.id && deleteExpense(item.id)}
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