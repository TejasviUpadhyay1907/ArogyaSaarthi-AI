import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api':     { target: 'http://localhost:4000', changeOrigin: true },
      '/triage':  { target: 'http://localhost:4000', changeOrigin: true },
      '/metrics': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
})
