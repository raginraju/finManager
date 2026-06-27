import { useWealthStore } from '../useWealthStore';
import { DataLedger } from './DataLedger';

export function FinancialSummary() {
  const selectedMonthYear = useWealthStore((state) => state.selectedMonthYear);

  return (
    <div className="w-full space-y-3">
      {/* Container Headings */}
      <div className="flex items-center justify-between">
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