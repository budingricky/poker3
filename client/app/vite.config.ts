import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ command }) => {
  return {
    base: command === 'build' ? './' : '/',
    plugins: [react(), tsconfigPaths({ projects: ['./tsconfig.json'] })],
    server: {
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
        '/beijing': {
          target: 'http://39.105.107.234:3001',
          secure: false,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/beijing/, ''),
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
