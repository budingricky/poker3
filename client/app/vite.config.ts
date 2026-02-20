import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import fs from 'fs'
import path from 'path'

export default defineConfig(({ command, mode }) => {
  const certPath = path.resolve(__dirname, '../../.certs/poker3.local+lan.pem')
  const keyPath = path.resolve(__dirname, '../../.certs/poker3.local+lan-key.pem')
  const useHttps = mode === 'https' || process.env.HTTPS === 'true'
  const httpsConfig = useHttps && fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    : undefined

  return {
    base: command === 'build' ? './' : '/',
    plugins: [react(), tsconfigPaths({ projects: ['./tsconfig.json'] })],
    server: {
      https: httpsConfig,
      host: true,
      port: 5174,
      strictPort: false,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          secure: false,
          changeOrigin: true,
        },
        '/ws': {
          target: 'ws://localhost:3001',
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
      port: 5174,
      strictPort: false,
    },
  }
})
