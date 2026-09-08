import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // react-apexcharts ships CJS; pre-bundle so default export interop is consistent
  optimizeDeps: {
    include: ['react-apexcharts', 'apexcharts'],
  },
  build: {
    // PDF rendering is loaded only when an admin requests an invoice.
    // Keep its isolated worker/rendering chunk out of the initial route budget.
    chunkSizeWarningLimit: 1500,
    commonjsOptions: {
      include: [/react-apexcharts/, /apexcharts/, /node_modules/],
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) return 'vendor_firebase';
            if (id.includes('@mui') || id.includes('@emotion')) return 'vendor_mui';
            if (id.includes('apexcharts')) return 'vendor_charts';
            if (id.includes('react')) return 'vendor_react';
          }
        },
      },
    },
  },
})
