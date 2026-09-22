import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // ngrok assigns a new subdomain to each tunnel; the leading dot allows only
    // subdomains of this development tunnel domain, never arbitrary Host values.
    allowedHosts: ['.ngrok-free.app'],
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3001' },
  },
});
