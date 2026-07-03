import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  base: '/finManager/', 
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // 💡 REMOVED optimizeDeps.exclude to let Vite pre-bundle sql.js perfectly
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            return 'vendor'; 
          }
        }
      }
    }
  }
});