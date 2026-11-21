import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // shared/contract.ts lives at the repo root (lead-owned). Types only.
      '@shared': path.resolve(import.meta.dirname, '../../shared'),
    },
  },
  server: {
    // Backend (Vercel functions) runs on `vercel dev`; proxy /api to it.
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
})
