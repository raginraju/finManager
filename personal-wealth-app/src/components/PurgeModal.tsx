interface PurgeModalProps {
  isOpen: boolean;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function PurgeModal({
  isOpen,
  confirmText,
  onConfirmTextChange,
  onCancel,
  onConfirm,
}: PurgeModalProps) {
  if (!isOpen) return null;

  const isConfirmed = confirmText.toUpperCase() === 'PURGE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 tracking-tight">Confirm Vault Destruction</h3>
          <p className="text-xs text-zinc-400 leading-relaxed mt-1">
            This action completely wipes all local IndexedDB tables and overwrites your personal Google Drive json backup file. This cannot be undone.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
            Type <span className="text-red-400 font-bold select-none">PURGE</span> to confirm closure
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder="PURGE"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2 text-xs text-zinc-100 tracking-widest uppercase focus:outline-none focus:border-red-500 font-mono"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={!isConfirmed}
            onClick={() => {
              void onConfirm();
            }}
            className={`flex-1 py-2 rounded-md text-xs font-medium transition-all select-none ${isConfirmed
              ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-sm shadow-red-900/20'
              : 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed border border-transparent'
              }`}
          >
            Wipe Catalog
          </button>
        </div>
      </div>
    </div>
  );
}
