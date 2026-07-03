import { useWealthStore } from '../store/useWealthStore';
import { DataLedger } from './DataLedger';

interface FinancialSummaryProps {
  netTakeHome: number;
  totalSpent: number;
  remainingSurplus: number;
}

export function FinancialSummary({ netTakeHome, totalSpent, remainingSurplus }: FinancialSummaryProps) {
  const selectedMonthYear = useWealthStore((state) => state.selectedMonthYear);

  return (
    <div className="w-full space-y-4">
      {/* Metrics Dashboard Cards - Forced to 1 row on mobile viewports */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 sm:p-4 min-w-0">
          <p className="text-[9px] sm:text-[10px] font-medium tracking-wide text-zinc-500 uppercase truncate">
            Net Take Home
          </p>
          <p className="text-sm sm:text-lg font-mono font-semibold text-emerald-400 mt-1 truncate">
            ${netTakeHome.toFixed(2)}
          </p>
        </div>
        
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 sm:p-4 min-w-0">
          <p className="text-[9px] sm:text-[10px] font-medium tracking-wide text-zinc-500 uppercase truncate">
            Total Outflow
          </p>
          <p className="text-sm sm:text-lg font-mono font-semibold text-red-400 mt-1 truncate">
            -${totalSpent.toFixed(2)}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 sm:p-4 min-w-0">
          <p className="text-[9px] sm:text-[10px] font-medium tracking-wide text-zinc-500 uppercase truncate">
            Remaining Surplus
          </p>
          <p className={`text-sm sm:text-lg font-mono font-semibold mt-1 truncate ${
            remainingSurplus >= 0 ? 'text-zinc-100' : 'text-red-400'
          }`}>
            ${remainingSurplus.toFixed(2)}
          </p>
        </div>

      </div>

      {/* Container Headings */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 pt-2">
        <h3 className="text-xs sm:text-sm font-medium text-zinc-200">
          Statement Ledger ({selectedMonthYear})
        </h3>
        <span className="text-[10px] sm:text-xs text-zinc-500">
          Records for the selected month
        </span>
      </div>

      {/* Main Table Ledger Component */}
      <DataLedger />
    </div>
  );
}