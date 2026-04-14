import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: {
      '/api': { target: 'http://localhost:8106', changeOrigin: true },
      '/storage': { target: 'http://localhost:8106', changeOrigin: true },
    },
  },
  build: {
    outDir: '../frontend_dist',
    emptyOutDir: true,
  },
})
