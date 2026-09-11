import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ACE-Step UI runs as a LAN-accessible web UI. Vite proxies API + audio
// traffic to the local Express backend. The backend in turn talks to the
// ACE-Step REST API server. All hosts bind to 0.0.0.0 so the UI is reachable
// from any device on the local network.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/audio': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/editor': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});