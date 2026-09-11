import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ACE-Step UI runs as a LAN-accessible web UI. Vite proxies API + audio
// traffic to the local Express backend. The backend in turn talks to the
// ACE-Step REST API server. All hosts bind to 0.0.0.0 so the UI is reachable
// from any device on the local network.
//
// The frontend port can be overridden with the UI_PORT env var, e.g.:
//   UI_PORT=3005 ./start-all-macos.sh
// Default is 3000. Change it if the default collides with another service
// (e.g. Open WebUI on port 3000).
const UI_PORT = Number(process.env.UI_PORT) || 3000;

export default defineConfig({
  server: {
    port: UI_PORT,
    strictPort: true,
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