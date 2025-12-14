import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001, // Інший порт для фронтенду
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // URL бекенду
        changeOrigin: true,
      },
    },
  },
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false, // Вимкнути sourcemaps для продакшену
    chunkSizeWarningLimit: 600, // Підвищити ліміт попередження
  },
})