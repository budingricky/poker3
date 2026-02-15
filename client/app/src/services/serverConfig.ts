const STORAGE_KEY = 'poker3.serverBaseUrl'

type Listener = (baseUrl: string) => void

const listeners = new Set<Listener>()
let cachedBaseUrl = read()

function read(): string {
  if (typeof window === 'undefined') return ''
  const raw = window.localStorage.getItem(STORAGE_KEY) ?? ''
  return normalizeBaseUrl(raw)
}

export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  const preferred =
    typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'https' : 'http'
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
  cachedBaseUrl = ''
  window.localStorage.removeItem(STORAGE_KEY)
  listeners.forEach(cb => cb(''))
}

export function subscribeServerBaseUrl(cb: Listener) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function getApiUrl(pathname: string) {
  if (import.meta.env.DEV) {
    const p = pathname.startsWith('/') ? pathname : `/${pathname}`
    return p
  }
  const base = getEffectiveBaseUrl(getServerBaseUrl())
  if (!base) throw new Error('未设置服务端地址')
  let effectiveBase = base
  if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && effectiveBase.startsWith('http://')) {
    try {
      const u = new URL(effectiveBase)
      if (u.hostname === window.location.hostname) {
        effectiveBase = effectiveBase.replace(/^http:\/\//i, 'https://')
      }
    } catch {
    }
  }
  const p = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${effectiveBase}${p}`
}

export function getWsUrl() {
  if (import.meta.env.DEV) {
    if (typeof window === 'undefined') return ''
    const protocol = window.location?.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location?.host || ''
    if (!host) return ''
    return `${protocol}://${host}/ws`
  }
  const base = getEffectiveBaseUrl(getServerBaseUrl())
  if (!base) throw new Error('未设置服务端地址')
  let effectiveBase = base
  if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && effectiveBase.startsWith('http://')) {
    try {
      const u = new URL(effectiveBase)
      if (u.hostname === window.location.hostname) {
        effectiveBase = effectiveBase.replace(/^http:\/\//i, 'https://')
      }
    } catch {
    }
  }
  return effectiveBase.replace(/^http/i, 'ws') + '/ws'
}
