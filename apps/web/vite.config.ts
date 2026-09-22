import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // ngrok assigns a new subdomain to each tunnel; only this development domain is allowed.
    allowedHosts: ['.ngrok-free.app'],
    proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001', xfwd: true } },
  },
});
