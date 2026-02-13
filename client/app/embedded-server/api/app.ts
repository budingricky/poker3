/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import os from 'os'
import authRoutes from './routes/auth.js'
import roomRoutes from './routes/room.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.disable('etag')

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  next()
})

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/room', roomRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

const isPrivateIpv4 = (ip: string): boolean => {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return false
  const [a, b] = ip.split('.').map(n => Number(n))
  if ([a, b].some(n => Number.isNaN(n))) return false
  if (a === 10) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

const getIpv4Candidates = (): string[] => {
  const nets = os.networkInterfaces()
  const results: string[] = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (!net) continue
      if (net.family !== 'IPv4') continue
      if (net.internal) continue
      const addr = net.address
      if (!addr || addr.startsWith('169.254.')) continue
      results.push(addr)
    }
  }
  return Array.from(new Set(results))
}

/**
 * info
 */
app.get('/api/info', (req: Request, res: Response) => {
  const name = process.env.POKER3_SERVER_NAME || os.hostname() || 'poker3'
  const socketPort = (req.socket as any)?.localPort
  const httpPort = typeof socketPort === 'number' ? socketPort : Number(process.env.PORT || 3001)
  const isTls = !!(req.socket as any)?.encrypted
  const protocol = isTls ? 'https' : 'http'
  const ipv4s = getIpv4Candidates()
  const privateIp = ipv4s.find(isPrivateIpv4) || ipv4s[0] || ''
  res.status(200).json({
    success: true,
    data: {
      name,
      ip: privateIp,
      httpPort,
      protocol,
      httpUrl: privateIp ? `${protocol}://${privateIp}:${httpPort}` : '',
      wsUrl: privateIp ? `${protocol === 'https' ? 'wss' : 'ws'}://${privateIp}:${httpPort}/ws` : '',
      apiPrefix: '/api',
      wsPath: '/ws',
      ipv4s,
    },
  })
})

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
