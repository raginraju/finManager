interface AppHeaderProps {
  syncStatus: 'idle' | 'syncing' | 'loading' | 'saved' | 'error';
  lastSyncedAt: number | null;
  onManualSync: () => void;
  onPullSync: () => void;
}

export function AppHeader({ 
  syncStatus, 
  lastSyncedAt, 
  onManualSync,
  onPullSync 
}: AppHeaderProps) {
  const lastSyncedLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : 'Never';

  return (
    <header className="space-y-6 border-b border-zinc-800 pb-6">
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

        <div className="flex flex-col items-start sm:items-end gap-1.5 w-full sm:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onPullSync}
              disabled={syncStatus === 'syncing'}
              className="flex-1 sm:flex-none px-3 py-2 rounded-md text-xs font-medium tracking-wide border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Pull from Cloud
            </button>
            <button
              onClick={onManualSync}
              disabled={syncStatus === 'syncing'}
              className="flex-1 sm:flex-none px-3 py-2 rounded-md text-xs font-medium tracking-wide border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {syncStatus === 'syncing' ? 'Syncing...' : 'Push to Cloud'}
            </button>
          </div>
          <p className="text-[11px] text-zinc-500">Last state handshake: {lastSyncedLabel}</p>
        </div>
      </div>
    </header>
  );
}