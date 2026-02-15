import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ command }) => {
  const certPath = process.env.VITE_HTTPS_CERT_PATH || path.resolve(__dirname, '../../.certs/poker3.local+lan.pem')
  const keyPath = process.env.VITE_HTTPS_KEY_PATH || path.resolve(__dirname, '../../.certs/poker3.local+lan-key.pem')
  const certExists = fs.existsSync(certPath)
  const keyExists = fs.existsSync(keyPath)
  const https =
    certExists && keyExists
      ? {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
        }
      : undefined

  return {
    base: command === 'build' ? './' : '/',
    plugins: [react(), tsconfigPaths({ projects: ['./tsconfig.json'] })],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      https,
      proxy: {
        '/api': {
          target: https ? 'https://localhost:3001' : 'http://localhost:3001',
          secure: false,
          changeOrigin: true,
        },
        '/ws': {
          target: https ? 'https://localhost:3001' : 'http://localhost:3001',
          secure: false,
          ws: true,
          changeOrigin: true,
        },
      },
      watch: {
        ignored: ['**/ios/**', '**/android/**'],
      },
    },
    optimizeDeps: {
      entries: ['index.html'],
    },
    preview: {
      host: true,
      port: 5173,
      strictPort: true,
      https,
    },
  }
})
