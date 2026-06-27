import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

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
  build: {
    // Increase the threshold slightly since dashboard utilities are inherently dense
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // Automatically split node_modules dependencies into separate chunk files
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Group heavy UI/charting utilities separately if needed
            if (id.includes('recharts') || id.includes('d3')) {
              return 'vendor-charts';
            }
            return 'vendor'; // Everything else goes to a general vendor chunk
          }
        }
      }
    }
  }
})