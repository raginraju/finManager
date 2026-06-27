import { useEffect, useState } from 'react';
import { useWealthStore } from '../useWealthStore';
import { PRESSABLE_SOFT_CLASS } from '../util/pressable';

export function UndoSnackbar() {
  const snapshot = useWealthStore((s) => s.lastDeletedSnapshot);
  const undo = useWealthStore((s) => s.undoDeleteMonthYear);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (snapshot) {
      setVisible(true);
      const ttl = snapshot.expiresAt - Date.now();
      const t = setTimeout(() => setVisible(false), Math.max(0, ttl + 200));
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [snapshot]);

  if (!snapshot || !visible) return null;

  const [year, month] = snapshot.monthYear.split('-');
  const dateObj = new Date(parseInt(year), parseInt(month) - 1);
  const displayLabel = dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50">
      <div className="flex items-center gap-4 bg-zinc-800/90 text-zinc-100 px-4 py-2 rounded-md shadow-lg">
        <div className="text-sm">Deleted {displayLabel}</div>
        <button onClick={() => { void undo(); }} className={`text-sm font-medium text-blue-400 hover:text-blue-300 ${PRESSABLE_SOFT_CLASS}`}>Undo</button>
      </div>
    </div>
  );
}
