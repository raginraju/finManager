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
      {/* Metrics Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">Net Take Home</p>
          <p className="text-lg font-mono font-semibold text-emerald-400 mt-1">${netTakeHome.toFixed(2)}</p>
        </div>
        
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">Total Outflow</p>
          <p className="text-lg font-mono font-semibold text-red-400 mt-1">-${totalSpent.toFixed(2)}</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">Remaining Surplus</p>
          <p className={`text-lg font-mono font-semibold mt-1 ${remainingSurplus >= 0 ? 'text-zinc-100' : 'text-red-400'}`}>
            ${remainingSurplus.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Container Headings */}
      <div className="flex items-center justify-between pt-2">
        <h3 className="text-sm font-medium text-zinc-200">
          Statement Ledger ({selectedMonthYear})
        </h3>
        <span className="text-xs text-zinc-500">
          Records for the selected month
        </span>
      </div>

      {/* Main Table Ledger Component */}
      <DataLedger />
    </div>
  );
}