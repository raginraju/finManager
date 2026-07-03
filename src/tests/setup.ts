import { beforeEach, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  // Clear mock environment indicators before each run
  vi.stubGlobal('window', {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn()
        }
      }
    }
  });
});