import { useEffect } from 'react';
import { useWealthStore } from './useWealthStore';
import { GoogleAuth } from './components/GoogleAuth'; // <-- Import the component

function App() {
  const { fetchInitialData, isLoading, income, expenses, debts } = useWealthStore();

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-400">
        <p className="text-sm font-medium tracking-wide animate-pulse">Initializing Local Vault...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Personal Wealth Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">Local Sandbox Storage Active</p>
      </header>
      
      <main className="grid gap-6 md:grid-cols-2">
        <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/30">
          <p className="text-zinc-400 text-sm">System status normal. Connected tables:</p>
          <ul className="mt-3 space-y-1 text-sm font-mono text-emerald-400">
            <li>• Income Records: {income.length}</li>
            <li>• Expense Records: {expenses.length}</li>
            <li>• Debt Records: {debts.length}</li>
          </ul>
        </div>
        
        {/* Render the Google Auth Component here */}
        <GoogleAuth />
        
      </main>
    </div>
  );
}

export default App;