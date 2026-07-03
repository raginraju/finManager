interface AppHeaderProps {
  netTakeHome: number;
  totalSpent: number;
  remainingSurplus: number;
  syncStatus: 'idle' | 'syncing' | 'loading' | 'saved' | 'error';
  lastSyncedAt: number | null;
  onManualSync: () => void;
}

export function AppHeader({ netTakeHome, totalSpent, remainingSurplus, syncStatus, lastSyncedAt, onManualSync }: AppHeaderProps) {
  const lastSyncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : 'Never';

  return (
    <header className="space-y-6 border-b border-zinc-800 pb-6">
      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Ledger Matrix</h1>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-medium tracking-wide uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse"></span>
              Cloud Core Active
            </div>
          </div>
          <p className="text-sm text-zinc-400 mt-1">Encrypted Workspace Node</p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1.5">
          <button
            onClick={onManualSync}
            disabled={syncStatus === 'syncing'}
            className="px-3 py-2 rounded-md text-xs font-medium tracking-wide border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncStatus === 'syncing' ? 'Syncing...' : 'Manual Sync'}
          </button>
          <p className="text-[11px] text-zinc-500">Last synced: {lastSyncedLabel}</p>
        </div>
      </div>

      {/* Relocated Metrics Grid — Now sitting proudly above the main line */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3 w-full">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-sm">
          <p className="text-[10px] font-medium tracking-wider text-zinc-400 uppercase">Total Inflow</p>
          <p className="text-2xl font-semibold text-zinc-50 tracking-tight mt-1">${netTakeHome.toFixed(2)}</p>
          <span className="text-[10px] text-zinc-500 block mt-0.5">Disposable cash revenue</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-sm">
          <p className="text-[10px] font-medium tracking-wider text-zinc-400 uppercase">Spent</p>
          <p className="text-2xl font-semibold text-red-400 tracking-tight mt-1">${totalSpent.toFixed(2)}</p>
          <span className="text-[10px] text-zinc-500 block mt-0.5">Total operational monthly outflow</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 shadow-sm">
          <p className="text-[10px] font-medium tracking-wider text-zinc-400 uppercase">Unallocated Surplus</p>
          <p className={`text-2xl font-semibold tracking-tight mt-1 ${remainingSurplus < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            ${remainingSurplus.toFixed(2)}
          </p>
          <span className="text-[10px] text-zinc-500 block mt-0.5">Working cash margin</span>
        </div>
      </div>
    </header>
  );
}