const STORAGE_KEY = 'poker3.serverBaseUrl'
const DEFAULT_SERVER_URL = 'https://39.105.107.234:3001'

function isBeijingServer(baseUrl: string): boolean {
  return baseUrl.includes('39.105.107.234')
}

function isDevServer(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  const protocol = window.location.protocol
  return (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.'))
}

type Listener = (baseUrl: string) => void

const listeners = new Set<Listener>()
let cachedBaseUrl = read()

function read(): string {
  if (typeof window === 'undefined') return DEFAULT_SERVER_URL
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? ''
  if (!raw) return DEFAULT_SERVER_URL
  return normalizeBaseUrl(raw)
}

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const hostPart = trimmed.split('/')[0] || ''
  const hostOnly = (hostPart.split(':')[0] || '').trim().toLowerCase()
  const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostOnly)
  const isPrivateIpv4 = (() => {
    if (!isIpv4) return false
    const [a, b] = hostOnly.split('.').map(n => Number(n))
    if ([a, b].some(n => Number.isNaN(n))) return false
    if (a === 10) return true
    if (a === 127) return true
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    return false
  })()
  const isLanLike =
    hostOnly === 'localhost' ||
    hostOnly === '0.0.0.0' ||
    isPrivateIpv4 ||
    hostOnly.endsWith('.local')

  const preferred = (() => {
    if (typeof window === 'undefined') return isLanLike ? 'http' : 'https'
    const p = window.location?.protocol || ''
    if (p === 'https:') return 'https'
    if (p === 'http:') return 'http'
    return isLanLike ? 'http' : 'https'
  })()
  return `${preferred}://${trimmed}`
}

export function getServerBaseUrl(): string {
  return cachedBaseUrl
}

function getEffectiveBaseUrl(base: string): string {
  if (typeof window === 'undefined') return base
  if (!base) return base
  const host = window.location?.hostname || ''
  if (!host || host === 'localhost' || host === '127.0.0.1') return base
  try {
    const u = new URL(base)
    const isLocal =
      u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '0.0.0.0'
    if (!isLocal) return base
    const port = u.port ? `:${u.port}` : ''
    return `${u.protocol}//${host}${port}`
  } catch {
    return base
  }
}

export function setServerBaseUrl(input: string) {
  const next = normalizeBaseUrl(input)
  cachedBaseUrl = next
  window.localStorage.setItem(STORAGE_KEY, next)
  listeners.forEach(cb => cb(next))
}

export function clearServerBaseUrl() {
  cachedBaseUrl = DEFAULT_SERVER_URL
  window.localStorage.removeItem(STORAGE_KEY)
  listeners.forEach(cb => cb(DEFAULT_SERVER_URL))
}

export function subscribeServerBaseUrl(cb: Listener) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getApiUrl(pathname: string) {
  const base = getServerBaseUrl()
  if (!base) throw new Error('未设置服务端地址')
  
  const finalBase = getEffectiveBaseUrl(base)
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`
  
  return `${finalBase}${p}`
}

export function getWsUrl() {
  const base = getServerBaseUrl()
  if (!base) throw new Error('未设置服务端地址')
  
  const finalBase = getEffectiveBaseUrl(base)
  
  if (finalBase.startsWith('https:')) {
    const url = finalBase.replace('https:', 'wss:') + '/ws'
    console.log('[getWsUrl] Generated WSS URL:', url)
    return url
  }
  const url = finalBase.replace('http:', 'ws:') + '/ws'
  console.log('[getWsUrl] Generated WS URL:', url)
  return url
}
