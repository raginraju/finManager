import { useWealthStore } from '../useWealthStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function FinancialSummary() {
  const { expenses, debts, income, selectedMonthYear } = useWealthStore();

  // Aggregate current month's direct cash inflows
  const currentMonthIncome = income.filter(i => i.monthYear === selectedMonthYear);
  const netTakeHome = currentMonthIncome.reduce((sum, i) => sum + i.netTakeHome, 0);

  // Filter regular expenses and structural installations
  const totalFixedExpenses = expenses
    .filter(e => e.monthYear === selectedMonthYear && e.isFixed)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalDebtInstallments = debts
    .filter(d => d.monthYear === selectedMonthYear)
    .reduce((sum, d) => sum + d.monthlyPayment, 0);

  const remainingSurplus = netTakeHome - totalFixedExpenses - totalDebtInstallments;

  const chartData = [
    { name: 'Cash Inflow', amount: netTakeHome, type: 'income' },
    { name: 'Fixed Outflows', amount: totalFixedExpenses, type: 'expense' },
    { name: 'Debt Commitments', amount: totalDebtInstallments, type: 'expense' },
    { name: 'Remaining Buffer', amount: remainingSurplus, type: 'surplus' }
  ];

  return (
    <div className="w-full space-y-6">
      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <p className="text-xs font-medium tracking-wider text-zinc-400 uppercase">Total Inflow</p>
          <p className="text-3xl font-semibold text-zinc-50 tracking-tight mt-2">${netTakeHome.toFixed(2)}</p>
          <span className="text-xs text-zinc-500 block mt-1">Disposable cash revenue</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <p className="text-xs font-medium tracking-wider text-zinc-400 uppercase">Fixed Obligations</p>
          <p className="text-3xl font-semibold text-red-400 tracking-tight mt-2">${(totalFixedExpenses + totalDebtInstallments).toFixed(2)}</p>
          <span className="text-xs text-zinc-500 block mt-1">Bills & locked commitments</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 shadow-sm">
          <p className="text-xs font-medium tracking-wider text-zinc-400 uppercase">Unallocated Surplus</p>
          <p className={`text-3xl font-semibold tracking-tight mt-2 ${remainingSurplus < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            ${remainingSurplus.toFixed(2)}
          </p>
          <span className="text-xs text-zinc-500 block mt-1">Working cash margin</span>
        </div>
      </div>

      {/* Waterfall Graphic */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/20 p-6 shadow-sm h-80">
        <h3 className="text-sm font-medium text-zinc-200 mb-4">Cash Flow Velocity Waterfall ({selectedMonthYear})</h3>
        {netTakeHome === 0 && totalFixedExpenses === 0 && totalDebtInstallments === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">
            No transactions found for this period. Register entries below.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
              <YAxis stroke="#71717a" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '6px' }}
                labelStyle={{ color: '#f4f4f5', fontSize: '12px', fontWeight: '500' }}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => {
                  let color = '#a1a1aa';
                  if (entry.type === 'income') color = '#2563eb';
                  if (entry.type === 'expense') color = '#ea580c';
                  if (entry.type === 'surplus') color = '#16a34a';
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}