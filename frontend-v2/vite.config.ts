import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // The proxy makes these calls same-origin, but browsers still attach `Origin` to
        // POST/PUT/PATCH/DELETE and http-proxy forwards it verbatim. Spring's CORS filter
        // then sees a cross-origin request, compares it against its allow-list, and
        // rejects with 403. Drop the header so the backend treats it as non-CORS, which
        // keeps dev working no matter which host or port the dev server is reached on.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('Origin');
          });
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge', 'sonner'],
          'vendor-date': ['date-fns', 'date-fns-tz', 'react-day-picker'],
        },
      },
    },
  },
});