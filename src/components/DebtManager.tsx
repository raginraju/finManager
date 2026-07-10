import { useState, useEffect } from 'react';
import { useWealthStore } from '../store/useWealthStore';
import { PRESSABLE_SOFT_CLASS } from '../util/pressable';
import { getSQLiteEngine } from '../db';

const ACCOUNT_SOURCES = ["Credit Card", "Cash Line", "Trust", "TFL"];

export function DebtManager() {
  const { debts, installments, expenses, upsertDebt, upsertInstallment, selectedMonthYear } = useWealthStore();
  
  // States for Global Debts
  const [debtName, setDebtName] = useState(ACCOUNT_SOURCES[0]);
  const [debtBalance, setDebtBalance] = useState('');

  // States for Split Installments
  const [instParent, setInstParent] = useState(ACCOUNT_SOURCES[2]); // Defaults to Trust
  const [instName, setInstName] = useState('');
  const [instAmount, setInstAmount] = useState('');
  const [instMonths, setInstMonths] = useState('');
  const [instStartingMonth, setInstStartingMonth] = useState(selectedMonthYear);

  // Keep the starting month input loosely synced if you change months in the main nav
  useEffect(() => {
    setInstStartingMonth(selectedMonthYear);
  }, [selectedMonthYear]);

  const handleAddDebt = async () => {
    if (!debtName || !debtBalance) return;
    const parsedBalance = parseFloat(debtBalance);
    if (isNaN(parsedBalance)) return;

    try {
      const existingDebt = debts.find(d => d.name === debtName);
      await upsertDebt({
        id: existingDebt?.id, 
        monthYear: 'GLOBAL', 
        name: debtName,
        totalBalance: parsedBalance, 
        monthlyPayment: 0, 
        isFixedInstallment: false
      });
      setDebtBalance('');
    } catch (err) { console.error("Failed to add debt account:", err); }
  };

  const handleAddInstallment = async () => {
    if (!instParent || !instName || !instAmount || !instMonths || !instStartingMonth) return;
    
    try {
      await upsertInstallment({
        parentName: instParent,
        name: instName,
        totalAmount: parseFloat(instAmount),
        totalMonths: parseInt(instMonths, 10),
        startingMonth: instStartingMonth
      });
      setInstName('');
      setInstAmount('');
      setInstMonths('');
    } catch (err) { console.error(err); }
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
    } catch (err) { console.error("Failed to delete debt:", err); }
  };

  const handleDeleteInstallment = async (id: number | undefined) => {
    if (!id) return;
    const store = useWealthStore.getState();
    await store.deleteInstallment(id);
  };

  // 💡 NEW: Dual Math Engine - Calculates both the Grand Total and the Current Month's Commitment
  const { totalSplitRemaining, currentMonthSplitTotal } = installments.reduce((acc, inst) => {
    const validPayments = expenses.filter(e => {
      const desc = (e.description || '').trim().toLowerCase();
      const cat = (e.category || '').trim().toLowerCase();
      const target = inst.parentName.trim().toLowerCase();
      
      const isMasterPayment = desc === target || cat === target;
      const isAfterStart = e.monthYear >= inst.startingMonth;
      return isMasterPayment && isAfterStart;
    });

    const uniquePaidMonths = new Set(validPayments.map(e => e.monthYear)).size;
    const monthsPending = Math.max(0, inst.totalMonths - uniquePaidMonths);
    const monthlySplitAmount = inst.totalAmount / inst.totalMonths;
    
    // If the installment isn't fully paid off yet, add it to our totals
    if (monthsPending > 0) {
      acc.totalSplitRemaining += (monthsPending * monthlySplitAmount);
      
      // Only add to THIS month's total if the installment has actually started by the month we are viewing!
      if (inst.startingMonth <= selectedMonthYear) {
        acc.currentMonthSplitTotal += monthlySplitAmount;
      }
    }
    
    return acc;
  }, { totalSplitRemaining: 0, currentMonthSplitTotal: 0 });

  return (
    <div className="flex flex-col space-y-8 w-full max-w-4xl mx-auto mt-4 pb-10">
      
      {/* ==========================================
          SECTION 1: GLOBAL LUMP SUM DEBTS
          ========================================== */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-purple-400 mb-1">Global Debt & Liability Manager</h2>
        <p className="text-xs text-zinc-400 mb-6">Set your Starting Balances here. The system will automatically calculate remaining balances based on your ledger entries.</p>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={debtName}
            onChange={(e) => setDebtName(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/50 appearance-none cursor-pointer"
          >
            {ACCOUNT_SOURCES.map(source => <option key={source} value={source}>{source}</option>)}
          </select>
          <input
            type="number"
            placeholder="Starting Amount Owed"
            value={debtBalance}
            onChange={(e) => setDebtBalance(e.target.value)}
            className="w-full sm:w-48 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500/50 font-mono"
          />
          <button
            onClick={handleAddDebt}
            disabled={!debtBalance}
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
              
              const matchingExpenses = expenses.filter(e => {
                const desc = (e.description || '').trim().toLowerCase();
                const cat = (e.category || '').trim().toLowerCase();
                const target = debt.name.trim().toLowerCase();
                return desc === target || cat === target;
              });

              const totalDeducted = matchingExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
              const remainingBalance = Math.max(0, debt.totalBalance - totalDeducted);

              return (
                <div key={debt.id} className="flex flex-col p-4 hover:bg-zinc-900/40 transition-colors group">
                  
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Starting Balance</span>
                      <span className="text-zinc-300 font-mono text-sm">${debt.totalBalance.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-zinc-800 pt-3 sm:pt-0 sm:pl-4">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Total Deductions</span>
                      <span className="text-emerald-400 font-mono text-sm">-${totalDeducted.toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col border-t sm:border-t-0 sm:border-l border-zinc-800 pt-3 sm:pt-0 sm:pl-4 sm:items-end">
                      <span className="text-[10px] text-purple-400/80 uppercase tracking-wider mb-1 font-bold">Remaining</span>
                      <span className="text-purple-400 font-mono text-lg font-bold">${remainingBalance.toFixed(2)}</span>
                    </div>
                  </div>

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

      {/* ==========================================
          SECTION 1.5: MONTHLY BILL ESTIMATOR
          ========================================== */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-emerald-400">Monthly Bill Estimator</h2>
          <p className="text-xs text-zinc-400">Sum of all daily spending on your Trust card for <span className="font-bold text-zinc-300">{selectedMonthYear}</span>.</p>
        </div>
        
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-6 py-4 flex flex-col items-end shrink-0 w-full sm:w-auto">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Estimated Bill Due</span>
          <span className="text-3xl font-mono font-light text-emerald-400">
            ${expenses
              .filter(e => {
                const desc = (e.description || '').toLowerCase();
                const cat = (e.category || '').toLowerCase();
                
                return e.monthYear === selectedMonthYear && 
                (desc.includes('trust') || cat.includes('trust')) &&
                desc.trim() !== 'trust' && cat.trim() !== 'trust'; 
              })
              .reduce((sum, e) => sum + Number(e.amount || 0), 0)
              .toFixed(2)}
          </span>
        </div>
      </div>

      {/* ==========================================
          SECTION 2: SPLIT INSTALLMENTS (BNPL)
          ========================================== */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold tracking-tight text-blue-400 mb-1">Split Installment Plans</h2>
        <p className="text-xs text-zinc-400 mb-6">Months pending auto-decrement ONLY when a master payment is made to the parent account in your ledger.</p>
        
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <select
            value={instParent}
            onChange={(e) => setInstParent(e.target.value)}
            className="col-span-2 md:col-span-1 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 appearance-none"
          >
            {ACCOUNT_SOURCES.map(source => <option key={source} value={source}>{source}</option>)}
          </select>
          
          <input
            type="text"
            placeholder="Item Name"
            value={instName}
            onChange={(e) => setInstName(e.target.value)}
            className="col-span-2 md:col-span-1 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50"
          />
          
          <div className="col-span-2 md:col-span-1 relative">
            <span className="absolute -top-2 left-2 bg-zinc-900/40 px-1 text-[9px] text-zinc-500 uppercase tracking-widest font-semibold backdrop-blur-sm">
              Start Month
            </span>
            <input
              type="month"
              value={instStartingMonth}
              onChange={(e) => setInstStartingMonth(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 appearance-none font-mono"
            />
          </div>

          <input
            type="number"
            placeholder="Total Amount ($)"
            value={instAmount}
            onChange={(e) => setInstAmount(e.target.value)}
            className="col-span-1 md:col-span-1 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500/50"
          />
          
          <input
            type="number"
            placeholder="Total Months"
            value={instMonths}
            onChange={(e) => setInstMonths(e.target.value)}
            className="col-span-1 md:col-span-1 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-blue-500/50"
          />
          
          <button
            onClick={handleAddInstallment}
            disabled={!instName || !instAmount || !instMonths || !instStartingMonth}
            className="col-span-2 md:col-span-1 px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-500 text-zinc-950 hover:bg-blue-400 disabled:opacity-50 transition-all"
          >
            Add Split
          </button>
        </div>

        {installments?.length > 0 && (
          <div className="mt-8 space-y-4">
            
            {/* 💡 UPDATED: DUAL TOTALS SUMMARY HEADER */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-end border-b border-zinc-800/80 pb-3 mb-4 px-1 gap-2">
              <span className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Active Plans ({installments.length})</span>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider">Monthly Due:</span>
                  <span className="text-lg font-mono font-bold text-zinc-200">${currentMonthSplitTotal.toFixed(2)}</span>
                </div>
                
                <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-zinc-800/80 pt-2 sm:pt-0 sm:pl-6 w-full sm:w-auto">
                  <span className="text-[10px] text-blue-400/80 uppercase tracking-wider font-bold">Total Pending:</span>
                  <span className="text-xl font-mono font-bold text-blue-400">${totalSplitRemaining.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {installments.map((inst) => {
              
              const validPayments = expenses.filter(e => {
                const desc = (e.description || '').trim().toLowerCase();
                const cat = (e.category || '').trim().toLowerCase();
                const target = inst.parentName.trim().toLowerCase();
                
                const isMasterPayment = desc === target || cat === target;
                const isAfterStart = e.monthYear >= inst.startingMonth;
                return isMasterPayment && isAfterStart;
              });

              const uniquePaidMonths = new Set(validPayments.map(e => e.monthYear)).size;
              const monthsPending = Math.max(0, inst.totalMonths - uniquePaidMonths);
              const monthlySplitAmount = inst.totalAmount / inst.totalMonths;
              const remainingBalance = monthsPending * monthlySplitAmount;
              const progressPercent = Math.min(100, (uniquePaidMonths / inst.totalMonths) * 100);

              return (
                <div key={inst.id} className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-4 relative overflow-hidden">
                  
                  <div className="absolute left-0 top-0 h-full bg-blue-500/5 z-0 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                  
                  <div className="relative z-10 flex flex-col sm:flex-row justify-between sm:items-center gap-2 sm:gap-4">
                    
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 uppercase tracking-widest">{inst.parentName}</span>
                        <span className="text-zinc-200 font-medium">{inst.name}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500">Started: {inst.startingMonth} • Total: ${inst.totalAmount.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center justify-between w-full sm:w-auto border-t border-zinc-800/60 sm:border-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                      
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div className="flex flex-col items-start sm:items-end">
                          <span className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Pending</span>
                          <span className="text-zinc-100 font-mono font-bold">{monthsPending} <span className="text-xs text-zinc-500 font-normal">/ {inst.totalMonths}</span></span>
                        </div>
                        
                        <div className="flex flex-col items-end border-l border-zinc-800 pl-4 sm:pl-6">
                          <span className="text-[10px] text-blue-400 uppercase tracking-wider mb-0.5 font-bold">Remaining</span>
                          <span className="text-blue-400 font-mono text-lg font-bold">
                            ${remainingBalance.toFixed(2)}
                            <span className="text-[10px] text-zinc-500 font-normal ml-1 hidden min-[380px]:inline-block">(${monthlySplitAmount.toFixed(2)}/mo)</span>
                          </span>
                        </div>
                      </div>

                      <button onClick={() => handleDeleteInstallment(inst.id)} className="ml-4 text-zinc-600 hover:text-red-400 p-2 cursor-pointer transition-colors bg-zinc-900/50 sm:bg-transparent rounded-lg">✕</button>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}