import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// ACE-Step Music web UI. Vite proxies API + audio traffic to the local Express
// backend. All hosts bind to 0.0.0.0 so the UI is reachable from any device on
// the local network.
//
// Tailwind CSS is compiled at build time via the @tailwindcss/vite plugin — no
// CDN, fully local. The frontend port can be overridden with the UI_PORT env
// var (default 3000), useful when Open WebUI already occupies 3000.
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
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});