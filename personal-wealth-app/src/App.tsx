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
    syncStatus,
    lastSyncedAt,
    income,     
    expenses,
    debts
  } = useWealthStore();

  // Modal Control State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [newMonthYear, setNewMonthYear] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Root-level Metric Computations
  const currentMonthIncome = income.filter(i => i.monthYear === selectedMonthYear);
  const netTakeHome = currentMonthIncome.reduce((sum, i) => sum + i.netTakeHome, 0);

  const totalExpenses = expenses
    .filter(e => e.monthYear === selectedMonthYear)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const totalDebtInstallments = debts
    .filter(d => d.monthYear === selectedMonthYear)
    .reduce((sum, d) => sum + Number(d.monthlyPayment || 0), 0);

  const totalSpent = totalExpenses + totalDebtInstallments;
  const remainingSurplus = netTakeHome - totalSpent;

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
          netTakeHome={netTakeHome}
          totalSpent={totalSpent}
          remainingSurplus={remainingSurplus}
          syncStatus={syncStatus}
          lastSyncedAt={lastSyncedAt}
          onManualSync={() => { void syncWithCloud(); }}
        />

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
            <FinancialSummary />
            <DataEntryForms />
          </div>
        </div>
      </div>

      <footer className="w-full border-t border-zinc-900 py-6 px-8 text-center bg-zinc-950">
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