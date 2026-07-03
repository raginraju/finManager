import { useWealthStore } from '../store/useWealthStore';

export function SyncToast() {
  const syncStatus = useWealthStore((state) => state.syncStatus);

  if (syncStatus === 'idle') return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-none">
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl text-[11px] font-medium tracking-wide">
        {syncStatus === 'syncing' ? (
          <>
            {/* Spinning Indicator */}
            <div className="h-3 w-3 animate-spin rounded-full border border-zinc-700 border-t-blue-500" />
            <span className="text-zinc-400">Saving changes to Google Drive...</span>
          </>
        ) : (
          <>
            {/* Pulsing Static Saved Indicator */}
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-emerald-400 font-semibold">Cloud synced successfully</span>
          </>
        )}
      </div>
    </div>
  );
}