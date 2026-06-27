interface AccountingPeriodsNavProps {
  availableMonths: string[];
  selectedMonthYear: string;
  newMonthYear: string;
  onNewMonthYearChange: (value: string) => void;
  onSelectMonth: (monthYear: string) => void;
  onAddMonth: (monthYear: string) => Promise<void>;
  onCopyPrevious: (monthYear: string) => Promise<void>;
}

export function AccountingPeriodsNav({
  availableMonths,
  selectedMonthYear,
  newMonthYear,
  onNewMonthYearChange,
  onSelectMonth,
  onAddMonth,
  onCopyPrevious,
}: AccountingPeriodsNavProps) {
  return (
    <div className="space-y-2 md:col-span-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 px-2 mb-3">Accounting Periods</p>

      <div className="rounded-md border border-zinc-800 bg-zinc-900/40 p-2 space-y-2">
        <input
          type="month"
          value={newMonthYear}
          onChange={(e) => onNewMonthYearChange(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onAddMonth(newMonthYear)}
            className="py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors cursor-pointer border border-zinc-700"
          >
            Add Month
          </button>
          <button
            onClick={() => onCopyPrevious(newMonthYear)}
            className="py-2 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-[11px] font-medium transition-colors cursor-pointer"
          >
            Copy Prev
          </button>
        </div>
      </div>

      <div className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
        {availableMonths.map((monthStr) => {
          const isActive = selectedMonthYear === monthStr;
          const [year, month] = monthStr.split('-');
          const dateObj = new Date(parseInt(year), parseInt(month) - 1);
          const displayLabel = dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

          return (
            <button
              key={monthStr}
              onClick={() => onSelectMonth(monthStr)}
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
  );
}
