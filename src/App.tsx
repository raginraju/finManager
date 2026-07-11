import { useEffect, useState } from 'react';
import { useWealthStore } from './store/useWealthStore';
import { GoogleAuthButton } from './components/GoogleAuth';
import { AppHeader } from './components/AppHeader';
import { AccountingPeriodsNav } from './components/AccountingPeriodsNav';
import { FinancialSummary } from './components/FinancialSummary';
import { DataEntryForms } from './components/DataEntryForms';
import { SyncToast } from './components/SyncToast';
import { PurgeModal } from './components/PurgeModal';
import { UndoSnackbar } from './components/UndoSnackbar';
import { PRESSABLE_SOFT_CLASS } from './util/pressable';
import { calculateTrustBillingCycle } from './store/helpers'; 

import { StudyTracker } from './components/StudyTracker';
import { DebtManager } from './components/DebtManager';
import { GymTracker } from './components/GymTracker';

// Expose to console for debugging
if (typeof window !== 'undefined') {
  (window as any).debugStore = useWealthStore;
}

function App() {
  const {
    fetchInitialData,
    isLoading,
    isHydrating,
    availableMonths,
    selectedMonthYear,
    setSelectedMonthYear,
    addMonthYear,
    deleteMonthYear,
    clearAllData,
    gdriveToken,
    syncWithCloud,
    pullFromCloud,
    syncStatus,
    lastSyncedAt,
    income,     
    expenses,
    debts
  } = useWealthStore();

  // 💡 FIXED: Updated Tab Routing signature to include 'gym'
  const [activeTab, setActiveTab] = useState<'ledger' | 'study' | 'debts' | 'gym'>('ledger');

  // Modal Control State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [newMonthYear, setNewMonthYear] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const initializeAndPull = async () => {
      await fetchInitialData();
      if (gdriveToken) {
        try {
          await pullFromCloud();
        } catch (error) {
          console.error("Failed to execute background auto-pull framework:", error);
        }
      }
    };

    void initializeAndPull();
  }, [fetchInitialData, gdriveToken, pullFromCloud]);

  /* ==========================================================================
     💡 1. CORE CASH FLOW MATH (PREVENTS DOUBLE COUNTING)
     ========================================================================== */
  const currentMonthIncome = income.filter(i => i.monthYear === selectedMonthYear);
  const netTakeHome = currentMonthIncome.reduce((sum, i) => sum + i.netTakeHome, 0);

  const currentMonthExpenses = expenses.filter(e => e.monthYear === selectedMonthYear);

  // EXCLUDES all itemized Trust expenses from the cash total. 
  // Cash outflow is only hit when you log the manual "Credit -> Trust" bill payment.
  const totalExpenses = currentMonthExpenses
    .filter(e => !e.description.includes('(Trust)'))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const totalDebtInstallments = debts
    .filter(d => d.monthYear === selectedMonthYear)
    .reduce((sum, d) => sum + Number(d.monthlyPayment || 0), 0);

  const totalSpent = totalExpenses + totalDebtInstallments;
  const remainingSurplus = netTakeHome - totalSpent;

  /* ==========================================================================
     💡 2. STRICT TRUST CYCLE TRACKING (BLUE BOX)
     ========================================================================== */
  const trustCycle = calculateTrustBillingCycle(selectedMonthYear);

  const formatDateLabel = (date: Date) => 
    date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const cycleStartLabel = formatDateLabel(trustCycle.cycleStart);
  const cycleEndLabel = formatDateLabel(trustCycle.cycleEnd);

  const trustCardSpent = expenses
    .filter(e => {
      const isTargetCategory = ['Food', 'Util', 'Custom'].includes(e.category);
      const isTrustTagged = e.description.includes('(Trust)');
      
      if (!isTargetCategory || !isTrustTagged) return false;

      const dayMatch = e.description.match(/^(\d+)-/);
      const transactionDay = dayMatch ? parseInt(dayMatch[1], 10) : 1;
      
      const [year, month] = e.monthYear.split('-').map(Number);
      const exactTxDate = new Date(year, month - 1, transactionDay);
      
      exactTxDate.setHours(0, 0, 0, 0);
      trustCycle.cycleStart.setHours(0, 0, 0, 0);
      trustCycle.cycleEnd.setHours(0, 0, 0, 0);

      return exactTxDate >= trustCycle.cycleStart && exactTxDate <= trustCycle.cycleEnd;
    })
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const totalTrustObligationBalance = trustCardSpent;

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <p className="text-xs font-medium tracking-widest animate-pulse uppercase">Syncing Ledger Vault...</p>
      </div>
    );
  }

  if (!gdriveToken) {
    return (
      <div className="min-h-screen w-full bg-zinc-950 text-zinc-50 font-sans flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Ledger Matrix</h1>
          <GoogleAuthButton className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors cursor-pointer" />
        </div>
      </div>
    );
  }

  if (isHydrating) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <p className="text-xs font-medium tracking-widest animate-pulse uppercase">Loading from Drive...</p>
      </div>
    );
  }

  const handleExecutePurge = async () => {
    if (confirmText.toUpperCase() === 'PURGE') {
      await clearAllData();
      setIsModalOpen(false);
      setConfirmText('');
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-50 font-sans flex flex-col justify-between selection:bg-zinc-800 selection:text-zinc-100">

      <div className="max-w-6xl w-full mx-auto p-6 md:p-8 space-y-6">
        <AppHeader
          syncStatus={syncStatus}
          lastSyncedAt={lastSyncedAt}
          onManualSync={() => { void syncWithCloud(); }}
          onPullSync={() => { void pullFromCloud(); }} 
        />

        {/* ==========================================================================
            💡 NAVIGATION TABS
            ========================================================================== */}
        <div className="flex flex-wrap justify-center gap-3 md:gap-4 mb-4 md:mb-8">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-5 py-2 text-xs md:text-sm font-medium rounded-full transition-all ${
              activeTab === 'ledger' 
                ? 'bg-zinc-100 text-zinc-900 shadow-md shadow-zinc-100/10' 
                : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-transparent hover:border-zinc-700/50 hover:bg-zinc-900'
            }`}
          >
            Financial Ledger
          </button>
          <button
            onClick={() => setActiveTab('debts')}
            className={`px-5 py-2 text-xs md:text-sm font-medium rounded-full transition-all ${
              activeTab === 'debts' 
                ? 'bg-purple-500 text-zinc-950 shadow-md shadow-purple-500/20' 
                : 'bg-zinc-900/80 text-zinc-400 hover:text-purple-300 border border-transparent hover:border-purple-900/50 hover:bg-zinc-900'
            }`}
          >
            Debt Manager
          </button>
          <button
            onClick={() => setActiveTab('study')}
            className={`px-5 py-2 text-xs md:text-sm font-medium rounded-full transition-all ${
              activeTab === 'study' 
                ? 'bg-emerald-500 text-zinc-950 shadow-md shadow-emerald-500/20' 
                : 'bg-zinc-900/80 text-zinc-400 hover:text-emerald-300 border border-transparent hover:border-emerald-900/50 hover:bg-zinc-900'
            }`}
          >
            Study Tracker
          </button>
          {/* 💡 NEW: Gym Progress Tab Option Selector */}
          <button
            onClick={() => setActiveTab('gym')}
            className={`px-5 py-2 text-xs md:text-sm font-medium rounded-full transition-all ${
              activeTab === 'gym' 
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20' 
                : 'bg-zinc-900/80 text-zinc-400 hover:text-amber-300 border border-transparent hover:border-amber-900/50 hover:bg-zinc-900'
            }`}
          >
            Gym Progress
          </button>
        </div>

        {/* ==========================================================================
            💡 TAB ROUTING
            ========================================================================== */}
        {activeTab === 'study' ? (
          <StudyTracker />
        ) : activeTab === 'debts' ? (
          <DebtManager />
        ) : activeTab === 'gym' ? (
          <GymTracker />
        ) : (
          <div className="grid gap-6 md:grid-cols-4 items-start">
            <AccountingPeriodsNav
              availableMonths={availableMonths}
              selectedMonthYear={selectedMonthYear}
              newMonthYear={newMonthYear}
              onNewMonthYearChange={setNewMonthYear}
              onSelectMonth={setSelectedMonthYear}
              onAddMonth={(monthYear) => addMonthYear(monthYear, false)}
              onCopyPrevious={(monthYear) => addMonthYear(monthYear, true)}
              onDeleteMonth={(monthYear) => deleteMonthYear(monthYear)}
            />

            <div className="space-y-6 md:col-span-3">
              <FinancialSummary
                netTakeHome={netTakeHome}
                totalSpent={totalSpent}
                remainingSurplus={remainingSurplus}
              />

              {/* Trust Card Balance Sub-Ledger Panel */}
              {totalTrustObligationBalance > 0 && (
                <div className="rounded-xl border border-blue-500/10 bg-blue-500/5 px-4 py-2.5 flex flex-col sm:flex-row gap-1 sm:gap-0 justify-between sm:items-center text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                      <span className="text-zinc-300 font-medium">Trust Card Cycle Obligations:</span>
                    </div>
                    <span className="text-[11px] text-zinc-500 font-normal sm:border-l sm:border-zinc-800 sm:pl-3">
                      Cycle: {cycleStartLabel} – {cycleEndLabel}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-blue-400 text-right text-sm sm:text-xs tracking-tight">
                    ${totalTrustObligationBalance.toFixed(2)}
                  </span>
                </div>
              )}

              <DataEntryForms />
            </div>
          </div>
        )}

      </div>

      <footer className="w-full border-t border-zinc-900 py-6 px-8 text-center bg-zinc-950 mt-auto">
        <button
          onClick={() => setIsModalOpen(true)}
          className={`text-[11px] font-medium text-zinc-600 hover:text-red-400/80 tracking-wide uppercase cursor-pointer ${PRESSABLE_SOFT_CLASS}`}
        >
          Destructive System Operations & Purge Control
        </button>
      </footer>

      <PurgeModal
        isOpen={isModalOpen}
        confirmText={confirmText}
        onConfirmTextChange={setConfirmText}
        onCancel={() => {
          setIsModalOpen(false);
          setConfirmText('');
        }}
        onConfirm={handleExecutePurge}
      />
      
      <SyncToast /> 
      <UndoSnackbar />
    </div>
  );
}

export default App;