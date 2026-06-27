import { useWealthStore } from '../useWealthStore';
import { triggerHaptic } from '../util/haptics';

// Declare the global google object so TypeScript doesn't complain
declare global {
  interface Window {
    google: any;
  }
}

export function GoogleAuth() {
  // Pull actions and reactive token state from our Zustand engine
  const setGDriveToken = useWealthStore((state) => state.setGDriveToken);
  const hydrateFromCloud = useWealthStore((state) => (state as any).hydrateFromCloud as () => Promise<void>);
  const token = useWealthStore((state) => state.gdriveToken);

  const handleLogin = () => {
    triggerHaptic('medium');

    // Initialize the Google Token Client
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file', // Strict sandbox scope
      callback: async (response: any) => {
        if (response.error !== undefined) {
          console.error('Login Failed:', response);
          triggerHaptic('error');
          throw response;
        }
        
        // 1. Commit token to global Zustand state engine
        setGDriveToken(response.access_token);

        // 2. Instantly hydrate from cloud (shows loading overlay until done)
        if (hydrateFromCloud) await hydrateFromCloud();
        triggerHaptic('success');
      },
    });

    // Trigger the popup
    client.requestAccessToken();
  };

  const isConnected = Boolean(token);

  return (
    <div className="flex flex-col items-start gap-4 p-4 border border-zinc-800 rounded-xl bg-zinc-900/50 w-full">
      <h3 className="text-sm font-semibold text-zinc-200 tracking-wide uppercase">Cloud Backup</h3>
      <p className="text-xs text-zinc-400 leading-relaxed">
        Securely backup your dynamic local financial data to your personal Google Drive sandbox.
      </p>
      
      {!isConnected ? (
        <button
          onClick={handleLogin}
          className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors cursor-pointer"
        >
          Authenticate with Google
        </button>
      ) : (
        <div className="px-4 py-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 rounded-md border border-emerald-500/20 shadow-sm animate-fade-in">
          ✓ Connected to Google Drive
        </div>
      )}
    </div>
  );
}

interface GoogleAuthButtonProps {
  className?: string;
}

export function GoogleAuthButton({ className }: GoogleAuthButtonProps) {
  const setGDriveToken = useWealthStore((state) => state.setGDriveToken);
  const syncWithCloud = useWealthStore((state) => state.syncWithCloud);

  const handleLogin = () => {
    triggerHaptic('medium');

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: async (response: any) => {
        if (response.error !== undefined) {
          console.error('Login Failed:', response);
          triggerHaptic('error');
          throw response;
        }

        setGDriveToken(response.access_token);
        await syncWithCloud();
        triggerHaptic('success');
      },
    });

    client.requestAccessToken();
  };

  return (
    <button
      onClick={handleLogin}
      className={className ?? 'px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-md transition-colors cursor-pointer'}
    >
      Authenticate with Google
    </button>
  );
}