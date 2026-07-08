import { useState } from 'react';
import { useWealthStore } from '../store/useWealthStore';
import { PRESSABLE_SOFT_CLASS } from '../util/pressable';
import { getSQLiteEngine } from '../db';

// 💡 Fixed list of allowed liability accounts to prevent typos
const ACCOUNT_SOURCES = ["Credit Card", "Cash Line", "Trust", "TFL"];

export function DebtManager() {
  // 💡 Now importing 'expenses' to calculate deductions dynamically
  const { debts, expenses, upsertDebt } = useWealthStore();
  
  const [name, setName] = useState(ACCOUNT_SOURCES[0]);
  const [balance, setBalance] = useState('');

  const handleAddDebt = async () => {
    if (!name || !balance) return;
    const parsedBalance = parseFloat(balance);
    if (isNaN(parsedBalance)) return;

    try {
      // 💡 FIXED: Check if the account already exists. If it does, grab its ID so we UPDATE instead of INSERT.
      const existingDebt = debts.find(d => d.name === name);

      await upsertDebt({
        id: existingDebt?.id, // Passes the ID to trigger the UPDATE command
        monthYear: 'GLOBAL', 
        name: name,
        totalBalance: parsedBalance, 
        monthlyPayment: 0, 
        isFixedInstallment: false
      });
      setBalance('');
    } catch (err) {
      console.error("Failed to add debt account:", err);
    }
  };

  const handleGlobalDelete = async (id: number | undefined) => {
    if (!id) return;
    try {
      const store = useWealthStore.getState();
      useWealthStore.setState({ debts: debts.filter(item => item.id !== id) });
      
      const db = await getSQLiteEngine();
      await db.run(`DELETE FROM debts WHERE id = ?`, [id]);
      
      await store.syncWithCloud();
      await store.fetchInitialData();
    } catch (err) {
      console.error("Failed to delete debt:", err);
    }
  };

  return (
    <div className="flex flex-col space-y-6 w-full max-w-4xl mx-auto mt-4 pb-10">
      
      {/* --- ADD NEW DEBT FORM --- */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-purple-400 mb-1">Global Debt & Liability Manager</h2>
        <p className="text-xs text-zinc-400 mb-6">Set your Starting Balances here. The system will automatically calculate remaining balances based on your ledger entries.</p>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 💡 Replaced free-text input with strict Dropdown */}
          <select
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
          >
            {ACCOUNT_SOURCES.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Starting Amount Owed"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-full sm:w-48 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/50 font-mono"
          />
          <button
            onClick={handleAddDebt}
            disabled={!balance}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-purple-500 text-zinc-950 hover:bg-purple-400 disabled:opacity-50 transition-all shrink-0"
          >
            Set Starting Balance
          </button>
        </div>
      </div>

      {/* --- ACTIVE DEBTS & TRANSACTIONS --- */}
      <div className="bg-zinc-900/20 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/40 flex justify-between items-center">
          <h3 className="text-xs font-semibold tracking-wider text-zinc-200 uppercase">Master Running Balances</h3>
        </div>
        
        {debts.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">No global debt accounts configured.</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {debts.map((debt) => {
              
              // 💡 THE DYNAMIC MATH ENGINE
              // Find all expenses where the Description OR Category perfectly matches the Debt Name (e.g., "TFL")
              const matchingExpenses = expenses.filter(e => {
                const desc = (e.description || '').trim().toLowerCase();
                const cat = (e.category || '').trim().toLowerCase();
                const target = debt.name.trim().toLowerCase();
                
                // Matches if it's the exact category, exact description, or if the description contains the word
                return desc === target || cat === target || desc.includes(target);
              });

              // Sum them up
              const totalDeducted = matchingExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
              // Calculate Remaining
              const remainingBalance = Math.max(0, debt.totalBalance - totalDeducted);

              return (
                <div key={debt.id} className="flex flex-col p-4 hover:bg-zinc-900/40 transition-colors group">
                  
                  {/* Top Row: Title & Delete */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        LIABILITY
                      </span>
                      <span className="text-zinc-100 font-medium text-lg">{debt.name}</span>
                    </div>
                    <button 
                      onClick={() => handleGlobalDelete(debt.id)}
                      className={`text-zinc-600 hover:text-red-400 px-2 cursor-pointer transition-colors ${PRESSABLE_SOFT_CLASS}`}
                      title="Delete Account"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Middle Row: The Balance Breakdown */}
                  <div className="grid grid-cols-3 gap-4 mb-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Starting Balance</span>
                      <span className="text-zinc-300 font-mono text-sm">${debt.totalBalance.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col border-l border-zinc-800 pl-4">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Total Deductions</span>
                      <span className="text-emerald-400 font-mono text-sm">-${totalDeducted.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col border-l border-zinc-800 pl-4 items-end">
                      <span className="text-[10px] text-purple-400/80 uppercase tracking-wider mb-1 font-bold">Remaining</span>
                      <span className="text-purple-400 font-mono text-lg font-bold">${remainingBalance.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Bottom Row: Transaction Mini-Ledger */}
                  {matchingExpenses.length > 0 && (
                    <div className="pl-2 pr-2">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Linked Ledger Transactions</p>
                      <div className="space-y-1.5">
                        {matchingExpenses.map(exp => (
                          <div key={exp.id} className="flex justify-between items-center text-xs text-zinc-400 border-l-2 border-zinc-800 pl-3">
                            <div className="flex gap-3">
                              <span className="text-zinc-500 font-mono">{exp.date}</span>
                              <span>{exp.monthYear} Ledger</span>
                            </div>
                            <span className="font-mono text-emerald-500/80">-${Number(exp.amount).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}