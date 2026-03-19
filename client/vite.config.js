import { defineConfig, splitVendorChunkPlugin } from 'vite';

export default defineConfig({
  plugins: [splitVendorChunkPlugin()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('recharts')) {
            return 'charts';
          }

          if (id.includes('jspdf') || id.includes('jspdf-autotable')) {
            return 'pdf-vendors';
          }

          if (id.includes('html2canvas')) {
            return 'canvas-vendor';
          }

          if (id.includes('papaparse')) {
            return 'csv-vendor';
          }

          if (id.includes('react-router')) {
            return 'router';
          }

          if (id.includes('react')) {
            return 'react-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
});