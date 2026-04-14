import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import http from 'http'

function httpRedirect(httpsPort: number): Plugin {
  return {
    name: 'http-redirect',
    configureServer() {
      http
        .createServer((req, res) => {
          const host = (req.headers.host ?? 'localhost').replace(/:\d+$/, '')
          res.writeHead(301, { Location: `https://${host}:${httpsPort}${req.url}` })
          res.end()
        })
        .listen(5180)
    },
  }
}

export default defineConfig({
  plugins: [react(), httpRedirect(3001)],
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
