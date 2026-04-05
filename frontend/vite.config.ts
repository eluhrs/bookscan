import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://api:8001',
        changeOrigin: true,
      },
    },
    https: fs.existsSync('/app/localhost+1.pem')
      ? {
          cert: fs.readFileSync('/app/localhost+1.pem'),
          key: fs.readFileSync('/app/localhost+1-key.pem'),
        }
      : undefined,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    globals: true,
  },
})
