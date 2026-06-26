import { useState } from 'react';

// Declare the global google object so TypeScript doesn't complain
declare global {
  interface Window {
    google: any;
  }
}

export function GoogleAuth() {
  const [token, setToken] = useState<string | null>(null);

  const handleLogin = () => {
    // Initialize the Google Token Client
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/drive.file', // Strict sandbox scope
      callback: (response: any) => {
        if (response.error !== undefined) {
          console.error('Login Failed:', response);
          throw response;
        }
        // Success! We have the token needed to talk to Google Drive
        console.log('Access Token acquired!', response.access_token);
        setToken(response.access_token);
      },
    });

    // Trigger the popup
    client.requestAccessToken();
  };

  return (
    <div className="flex flex-col items-start gap-4 p-4 border border-zinc-800 rounded-xl bg-zinc-900/50">
      <h3 className="text-lg font-semibold text-zinc-100">Cloud Sync</h3>
      <p className="text-sm text-zinc-400">
        Securely backup your encrypted local data to your personal Google Drive.
      </p>
      
      {!token ? (
        <button
          onClick={handleLogin}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
        >
          Authenticate with Google
        </button>
      ) : (
        <div className="px-4 py-2 text-sm font-medium text-emerald-400 bg-emerald-400/10 rounded-md border border-emerald-400/20">
          ✓ Connected to Google Drive
        </div>
      )}
    </div>
  );
}