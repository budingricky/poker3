import { getServerBaseUrl, normalizeBaseUrl } from './serverConfig'

export type DiscoveredServer = {
  name: string
  ip: string
  httpPort: number
  httpUrl: string
}

function uniqServers(list: DiscoveredServer[]) {
  const map = new Map<string, DiscoveredServer>()
  for (const s of list) {
    const key = `${s.ip}:${s.httpPort}`
    if (!map.has(key)) map.set(key, s)
  }
  return Array.from(map.values())
}

async function httpProbe(baseUrl: string, timeoutMs: number): Promise<DiscoveredServer | null> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${baseUrl}/api/info`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    })
    const json = (await res.json()) as any
    if (!res.ok || json?.success === false) return null
    const data = json?.data || json
    const ip = String(data?.ip || '').trim()
    const httpPort = Number(data?.httpPort || 0)
    const name = String(data?.name || 'Poker3').trim()
    if (!ip || !httpPort) return null
    const httpUrl = normalizeBaseUrl(String(data?.httpUrl || baseUrl))
    if (!httpUrl) return null
    return { name, ip, httpPort, httpUrl }
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

async function discoverViaHttpScan({
  timeoutMs,
  maxConcurrency = 24,
}: {
  timeoutMs: number
  maxConcurrency?: number
}) {
  const candidates: string[] = []
  const schemes: Array<'https' | 'http'> = window.location.protocol === 'https:' ? ['https', 'http'] : ['http', 'https']
  const ports = [3001, 8080]

  for (const scheme of schemes) candidates.push(`${scheme}://localhost:3001`)
  try {
    const host = window.location.hostname
    if (host && /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      for (const scheme of schemes) candidates.push(`${scheme}://${host}:3001`)
    }
  } catch {
  }

  const saved = getServerBaseUrl()
  if (saved) candidates.push(saved)

  const prefixes: string[] = []
  try {
    const host = window.location.hostname
    if (host && /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
      const parts = host.split('.').map(n => Number(n))
      if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
        for (const scheme of schemes) prefixes.push(`${scheme}://${parts[0]}.${parts[1]}.${parts[2]}.`)
      }
    }
  } catch {
  }
  for (const scheme of schemes) {
    prefixes.push(
      `${scheme}://192.168.1.`,
      `${scheme}://192.168.0.`,
      `${scheme}://10.0.0.`,
      `${scheme}://10.0.1.`,
      `${scheme}://172.16.0.`,
    )
  }
  for (const prefix of prefixes) {
    for (const p of ports) {
      for (let i = 2; i <= 254; i += 1) {
        candidates.push(`${prefix}${i}:${p}`)
      }
    }
  }

  const results: DiscoveredServer[] = []
  let index = 0
  // Increased deadline to 6 seconds to cover more IPs
  const deadline = Date.now() + 6000

  async function worker() {
    while (index < candidates.length && Date.now() < deadline && results.length < 3) {
      const i = index
      index += 1
      const baseUrl = candidates[i]
      // Use slightly shorter timeout for individual probes to scan faster, but respect input if reasonable
      const probeTimeout = Math.min(timeoutMs, 800) 
      const ok = await httpProbe(baseUrl, probeTimeout)
      if (ok) results.push(ok)
    }
  }

  // Increased concurrency to 48 for faster scanning
  await Promise.all(Array.from({ length: 48 }, () => worker()))
  return uniqServers(results)
}

async function discoverViaUdp({ timeoutMs }: { timeoutMs: number }) {
  const w = window as any
  const req = typeof w?.require === 'function' ? w.require : null
  if (!req) return []

  let dgram: any
  try {
    dgram = req('dgram')
  } catch {
    return []
  }
  let os: any
  try {
    os = req('os')
  } catch {
    os = null
  }

  const ipToInt = (ip: string) => {
    const parts = ip.split('.').map(n => Number(n))
    if (parts.length !== 4 || parts.some(n => !Number.isFinite(n))) return null
    let out = 0
    for (const p of parts) out = (out << 8) + (p & 255)
    return out >>> 0
  }
  const intToIp = (n: number) => {
    return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`
  }
  const getBroadcastTargets = () => {
    const targets = new Set<string>()
    targets.add('255.255.255.255')
    const nets = os?.networkInterfaces?.() || {}
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (!net) continue
        if (net.family !== 'IPv4') continue
        if (net.internal) continue
        const addr = String(net.address || '')
        const mask = String(net.netmask || '')
        if (!addr || addr.startsWith('169.254.')) continue
        const ipInt = ipToInt(addr)
        const maskInt = ipToInt(mask)
        if (ipInt === null || maskInt === null) continue
        const broadcastInt = (ipInt | (~maskInt >>> 0)) >>> 0
        targets.add(intToIp(broadcastInt))
      }
    }
    return Array.from(targets)
  }

  const discovered: DiscoveredServer[] = []
  const socket = dgram.createSocket('udp4')

  await new Promise<void>(resolve => {
    const timer = setTimeout(() => {
      try {
        socket.close()
      } catch {
      }
      resolve()
    }, timeoutMs)

    socket.on('message', (msg: any) => {
      try {
        const text = msg.toString('utf8')
        const json = JSON.parse(text)
        if (json?.type !== 'poker3_discovery_response') return
        const ip = String(json?.ip || '').trim()
        const httpPort = Number(json?.httpPort || 0)
        const name = String(json?.name || 'Poker3').trim()
        const httpUrl = normalizeBaseUrl(String(json?.httpUrl || `http://${ip}:${httpPort}`))
        if (!ip || !httpPort || !httpUrl) return
        discovered.push({ name, ip, httpPort, httpUrl })
      } catch {
      }
    })

    socket.bind(0, '0.0.0.0', () => {
      try {
        socket.setBroadcast(true)
      } catch {
      }
      const payload = Buffer.from('poker3_discovery', 'utf8')
      const targets = getBroadcastTargets()
      const sendOnce = () => {
        for (const host of targets) {
          try {
            socket.send(payload, 0, payload.length, 32100, host)
          } catch {
          }
        }
      }
      sendOnce()
      setTimeout(sendOnce, 80)
      setTimeout(sendOnce, 160)
    })

    socket.on('error', () => {
      clearTimeout(timer)
      try {
        socket.close()
      } catch {
      }
      resolve()
    })
  })

  return uniqServers(discovered)
}

export async function discoverLanServers({ timeoutMs }: { timeoutMs: number }) {
  const udp = await discoverViaUdp({ timeoutMs })
  if (udp.length) return udp
  return discoverViaHttpScan({ timeoutMs })
}
