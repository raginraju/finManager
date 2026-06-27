import { GoogleAuth } from './GoogleAuth';

interface AppHeaderProps {
  gdriveToken: string | null;
}

export function AppHeader({ gdriveToken }: AppHeaderProps) {
  return (
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
  );
}
