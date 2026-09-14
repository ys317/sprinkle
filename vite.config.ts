import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // @solana/web3.js v1 and spl-token expect a Node-style global in the browser.
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer/',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  build: {
    target: 'es2022',
  },
  server: {
    proxy: {
      // Mirrors the /api/candyshop rewrite in vercel.json so the swap flow works in `vite dev`.
      '/api/candyshop': {
        target: 'https://swap.cookiescan.io',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/candyshop/, '/api'),
        headers: { 'user-agent': 'sprinkle-dev/1.0' },
      },
    },
  },
})
