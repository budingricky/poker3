import fs from 'fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ command }) => {
  const certPath = process.env.VITE_HTTPS_CERT_PATH || ''
  const keyPath = process.env.VITE_HTTPS_KEY_PATH || ''
  const https =
    certPath && keyPath
      ? {
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
        }
      : undefined

  return {
    base: command === 'build' ? './' : '/',
    plugins: [react(), tsconfigPaths()],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      https,
    },
    preview: {
      host: true,
      port: 5173,
      strictPort: true,
      https,
    },
  }
})
