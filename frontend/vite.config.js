import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    include: /src\/.*\.[jt]sx?$/,
    loader: 'jsx',
  },
  optimizeDeps: {
    esbuild: {
      loader: { '.js': 'jsx', '.jsx': 'jsx' },
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/polymarket': {
        target: 'https://gamma-api.polymarket.com',
        changeOrigin: true,
        // Preserve incoming query string and simply rewrite the prefix so
        // dev requests forward whatever params the client sets (search, tag, page, order, etc.)
        rewrite: (p) => p.replace(/^\/api\/polymarket/, '/events'),
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'build',
  },
})
