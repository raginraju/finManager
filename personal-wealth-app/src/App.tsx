import { useEffect, useState } from 'react';
import { useWealthStore } from './useWealthStore';
import { GoogleAuth } from './components/GoogleAuth';
import { FinancialSummary } from './components/FinancialSummary';
import { DataEntryForms } from './components/DataEntryForms';
import { DataLedger } from './components/DataLedger';
import { SyncToast } from './components/SyncToast';

function App() {
  const {
    fetchInitialData,
    isLoading,
    availableMonths,
    selectedMonthYear,
    setSelectedMonthYear,
    clearAllData,
    gdriveToken
  } = useWealthStore();

  // Modal Control State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

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
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-800 pb-6 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Ledger Matrix</h1>

              {gdriveToken && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-medium tracking-wide">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  CLOUD SYNCED
                </div>
              )}
            </div>
            <p className="text-sm text-zinc-400 mt-1">Local Sandbox Storage Active</p>
          </div>

          <div className="w-full sm:w-auto sm:min-w-[300px]">
            <GoogleAuth />
          </div>
        </header>

        {/* Structural View Grid */}
        <div className="grid gap-6 md:grid-cols-4 items-start">

          {/* Navigation Blocks */}
          <div className="space-y-2 md:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-2 mb-3">Accounting Periods</p>
            <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
              {availableMonths.map((monthStr) => {
                const isActive = selectedMonthYear === monthStr;
                const [year, month] = monthStr.split('-');
                const dateObj = new Date(parseInt(year), parseInt(month) - 1);
                const displayLabel = dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

                return (
                  <button
                    key={monthStr}
                    onClick={() => setSelectedMonthYear(monthStr)}
                    className={`whitespace-nowrap w-full text-left px-3 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${isActive
                        ? 'bg-zinc-100 text-zinc-900 font-semibold shadow-sm'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                      }`}
                  >
                    {displayLabel}
                  </button>
                );
              })}
            </div>
          </div>

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
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">Confirm Vault Destruction</h3>
              <p className="text-xs text-zinc-400 leading-relaxed mt-1">
                This action completely wipes all local IndexedDB tables and overwrites your personal Google Drive json backup file. This cannot be undone.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                Type <span className="text-red-400 font-bold select-none">PURGE</span> to confirm closure
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="PURGE"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 tracking-widest uppercase focus:outline-none focus:border-red-500 font-mono"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setIsModalOpen(false); setConfirmText(''); }}
                className="flex-1 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={confirmText.toUpperCase() !== 'PURGE'} // <-- Add .toUpperCase() here
                onClick={handleExecutePurge}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-all select-none ${confirmText.toUpperCase() === 'PURGE' // <-- Add .toUpperCase() here
                    ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-sm shadow-red-900/20'
                    : 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed border border-transparent'
                  }`}
              >
                Wipe Catalog
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Global Non-Disturbing Toast Notification Container */}
      <SyncToast /> {/* <-- Mount it here */}
    </div>
  );
}

export default App;