import { useEffect, useState } from 'react';
import { useWealthStore } from './useWealthStore';
import { AppHeader } from './components/AppHeader';
import { AccountingPeriodsNav } from './components/AccountingPeriodsNav';
import { FinancialSummary } from './components/FinancialSummary';
import { DataEntryForms } from './components/DataEntryForms';
import { DataLedger } from './components/DataLedger';
import { SyncToast } from './components/SyncToast';
import { PurgeModal } from './components/PurgeModal';

function App() {
  const {
    fetchInitialData,
    isLoading,
    availableMonths,
    selectedMonthYear,
    setSelectedMonthYear,
    addMonthYear,
    clearAllData,
    gdriveToken
  } = useWealthStore();

  // Modal Control State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [newMonthYear, setNewMonthYear] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <p className="text-xs font-medium tracking-widest animate-pulse uppercase">Syncing Ledger Vault...</p>
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

      {/* Main Container Content */}
      <div className="max-w-6xl w-full mx-auto p-6 md:p-8 space-y-6">

        {/* Header Block */}
        <AppHeader gdriveToken={gdriveToken} />

        {/* Structural View Grid */}
        <div className="grid gap-6 md:grid-cols-4 items-start">

          {/* Navigation Blocks */}
          <AccountingPeriodsNav
            availableMonths={availableMonths}
            selectedMonthYear={selectedMonthYear}
            newMonthYear={newMonthYear}
            onNewMonthYearChange={setNewMonthYear}
            onSelectMonth={setSelectedMonthYear}
            onAddMonth={(monthYear) => addMonthYear(monthYear, false)}
            onCopyPrevious={(monthYear) => addMonthYear(monthYear, true)}
          />

          {/* Core Dashboards Tier */}
          <div className="space-y-6 md:col-span-3">
            <FinancialSummary />
            <DataEntryForms />
            <DataLedger />
          </div>

        </div>
      </div>

      {/* Footer Block with Relocated Purge Action */}
      <footer className="w-full border-t border-zinc-900 py-6 px-8 text-center bg-zinc-950">
        <button
          onClick={() => setIsModalOpen(true)}
          className="text-[11px] font-medium text-zinc-600 hover:text-red-400/80 transition-colors tracking-wide uppercase cursor-pointer"
        >
          Destructive System Operations & Purge Control
        </button>
      </footer>

      {/* Custom Destructive Confirmation Modal Overlay */}
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
      
      {/* Global Non-Disturbing Toast Notification Container */}
      <SyncToast /> {/* <-- Mount it here */}
    </div>
  );
}

export default App;