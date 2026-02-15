import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import ConnectFlow, { type ConnectStep } from '../components/ConnectFlow'
import { discoverLanServers, type DiscoveredServer } from '../services/lanDiscovery'
import { clearServerBaseUrl, getServerBaseUrl, normalizeBaseUrl, setServerBaseUrl } from '../services/serverConfig'
import { socket } from '../services/socket'

type Mode = 'online' | 'lan'

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok'; message: string }
  | { status: 'error'; message: string }

async function checkWs(wsUrl: string, timeoutMs: number, retries = 3) {
  let lastError: Error | null = null
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(wsUrl)
        const timer = window.setTimeout(() => {
          try {
            ws.close()
          } catch {
          }
          reject(new Error('WebSocket 连接超时（常见原因：防火墙未放行端口，或系统代理拦截 WS）'))
        }, timeoutMs)

        ws.onopen = () => {
          window.clearTimeout(timer)
          try {
            ws.close()
          } catch {
          }
          resolve()
        }
        ws.onerror = () => {
          window.clearTimeout(timer)
          try {
            ws.close()
          } catch {
          }
          reject(new Error('WebSocket 连接失败'))
        }
      })
      return
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (i < retries - 1) await sleep(1000)
    }
  }
  throw lastError
}

async function fetchServerInfo(baseUrl: string, timeoutMs: number, isBeijing: boolean = false, isDev: boolean = false) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const requestUrl = `${baseUrl}/api/info`
    console.log('Fetching server info from:', requestUrl)
    
    const res = await fetch(requestUrl, { 
      method: 'GET', 
      cache: 'no-store', 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    })
    
    console.log('Response status:', res.status, res.statusText)
    
    const contentType = res.headers.get('content-type') || ''
    console.log('Content-Type:', contentType)
    
    if (!contentType.includes('application/json')) {
      const text = await res.text()
      console.error('Server returned non-JSON response. Full text:', text)
      console.error('Response snippet:', text.substring(0, 500))
      throw new Error(`服务端返回了非 JSON 响应 (${res.status}): ${text.substring(0, 100)}`)
    }
    
    const json = (await res.json()) as any
    console.log('JSON response:', json)
    
    if (!res.ok || json?.success === false) throw new Error(typeof json?.error === 'string' ? json.error : '服务端不可用')
    const data = json?.data || json
    const wsPath = String(data?.wsPath || '/ws').trim()
    let wsUrl: string
    
    if (isDev && isBeijing) {
      wsUrl = `ws://${window.location.host}/beijing/ws`
    } else {
      wsUrl = baseUrl.replace(/^http/i, 'ws').replace(/\/+$/, '') + (wsPath.startsWith('/') ? wsPath : '/' + wsPath)
      if (baseUrl.startsWith('https://')) wsUrl = wsUrl.replace(/^ws:\/\//i, 'wss://')
    }
    
    console.log('WebSocket URL:', wsUrl)
    return { wsUrl }
  } catch (error) {
    console.error('Error in fetchServerInfo:', error)
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

const sleep = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit) {
  console.log('Fetching URL:', url)
  const timeoutController = new AbortController()
  const timer = window.setTimeout(() => timeoutController.abort(), timeoutMs)

  const external = init?.signal
  const onExternalAbort = () => timeoutController.abort()
  try {
    if (external) external.addEventListener('abort', onExternalAbort, { once: true })
    const response = await fetch(url, { 
      cache: 'no-store', 
      ...init, 
      signal: timeoutController.signal 
    })
    console.log('Fetch response status:', response.status, response.statusText)
    return response
  } catch (error) {
    console.error('Fetch failed for URL', url, 'Error:', error)
    throw error
  } finally {
    if (external) external.removeEventListener('abort', onExternalAbort)
    window.clearTimeout(timer)
  }
}

export default function ServerSelect({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const saved = getServerBaseUrl()

  const [serverInput, setServerInput] = useState(saved || '')
  const normalized = useMemo(() => normalizeBaseUrl(serverInput), [serverInput])
  const [check, setCheck] = useState<CheckState>({ status: 'idle' })
  const [discovering, setDiscovering] = useState(mode === 'lan')
  const [servers, setServers] = useState<DiscoveredServer[]>([])
  const [manualVisible, setManualVisible] = useState(mode !== 'lan')
  const [flowOpen, setFlowOpen] = useState(false)
  const [flowTitle, setFlowTitle] = useState('')
  const [flowSteps, setFlowSteps] = useState<ConnectStep[]>([])
  const [flowError, setFlowError] = useState<string | undefined>(undefined)
  const cancelledRef = useRef(false)
  const busyRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const onlineServers = useMemo(() => {
    return [
      { name: '中国香港节点', httpUrl: normalizeBaseUrl('https://api.poker.bd1bmc.xyz') },
      { name: '中国北京节点', httpUrl: normalizeBaseUrl('http://39.105.107.234:3001') },
    ]
  }, [])

  useEffect(() => {
    if (mode !== 'lan') return
    let cancelled = false
    async function run() {
      setDiscovering(true)
      try {
        // Increased timeout to 2000ms to allow sufficient time for UDP broadcast and HTTP scan
        const timeoutMs = 2000 
        const found = await discoverLanServers({ timeoutMs })
        if (cancelled) return
        setServers(found)
        if (found.length === 0) setManualVisible(true)
      } finally {
        if (!cancelled) setDiscovering(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [mode])

  useEffect(() => {
    if (mode === 'online') {
      socket.disconnect()
      clearServerBaseUrl()
      setServerInput('')
    }
  }, [mode])

  const title = mode === 'online' ? '连接服务器' : '选择局域网服务器'
  const subtitle = mode === 'online' ? '连接到 Poker3 北京服务器。' : '自动发现同一局域网内的 Poker3 服务端。'

  const runConnectFlow = async (params: { baseUrl: string; displayName: string }) => {
    if (busyRef.current) return
    busyRef.current = true
    cancelledRef.current = false
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setFlowError(undefined)
    setFlowTitle(params.displayName)
    setCheck({ status: 'checking' })

    const initSteps: ConnectStep[] = [
      { key: 'ping', title: 'Ping 服务器', desc: '测试网络可达性', status: 'active' },
      { key: 'api_health', title: '测试 API 服务', desc: '/api/health', status: 'pending' },
      { key: 'api_info', title: '读取服务信息', desc: '/api/info', status: 'pending' },
      { key: 'ws', title: '连接 WebSocket', desc: '建立实时通道', status: 'pending' },
      { key: 'api_room', title: '连接大厅接口', desc: '/api/room', status: 'pending' },
      { key: 'done', title: '完成连接', desc: '进入联机大厅', status: 'pending' },
    ]
    setFlowSteps(initSteps)
    setFlowOpen(true)
    let activeKey = 'ping'

    const updateStep = (key: string, patch: Partial<ConnectStep>) => {
      setFlowSteps(prev => prev.map(s => (s.key === key ? { ...s, ...patch } : s)))
    }

    const activateNext = (currentKey: string, nextKey: string) => {
      updateStep(currentKey, { status: 'success' })
      updateStep(nextKey, { status: 'active' })
      activeKey = nextKey
    }

    const fail = (key: string, message: string) => {
      updateStep(key, { status: 'error' })
      setFlowError(message)
      setCheck({ status: 'error', message })
    }

    const runStep = async (key: string, minMs: number, fn: () => Promise<void>) => {
      const start = performance.now()
      await fn()
      const cost = performance.now() - start
      if (cost < minMs) await sleep(minMs - cost)
      if (cancelledRef.current) throw new Error('cancelled')
    }

    try {
      const baseUrl = params.baseUrl
      const isBeijing = baseUrl.includes('39.105.107.234')
      const isDev = import.meta.env.DEV && typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      
      console.log('Connection info:', { 
        baseUrl, 
        isBeijing, 
        isDev, 
        hostname: window?.location?.hostname, 
        protocol: window?.location?.protocol,
        import_meta_env_DEV: import.meta.env.DEV 
      })
      
      const apiBase = (isDev && isBeijing) ? '/beijing' : baseUrl
      const wsBase = isDev && isBeijing 
        ? `ws://${window.location.host}/beijing`
        : baseUrl.replace(/^http/i, 'ws')
      
      await runStep('ping', 1500, async () => {
        const res = await fetchWithTimeout(`${apiBase}/api/health`, 15000, { method: 'GET', signal: abortRef.current?.signal })
        if (!res.ok) throw new Error('Ping 失败：无法访问服务端')
      })
      activateNext('ping', 'api_health')

      await runStep('api_health', 1500, async () => {
        const res = await fetchWithTimeout(`${apiBase}/api/health`, 15000, { method: 'GET', signal: abortRef.current?.signal })
        const json = (await res.json().catch(() => null)) as any
        if (!res.ok || json?.success === false) {
          throw new Error(typeof json?.error === 'string' ? json.error : 'API 健康检查失败')
        }
      })
      activateNext('api_health', 'api_info')

      const info = await (async () => {
        let out: { wsUrl: string } | null = null
        await runStep('api_info', 1500, async () => {
          out = await fetchServerInfo(apiBase, 15000, isBeijing, isDev)
        })
        return out!
      })()
      activateNext('api_info', 'ws')

      await runStep('ws', 2000, async () => {
        const derivedWsUrl = wsBase + '/ws'
        await checkWs(derivedWsUrl, 15000, 3)
      })
      activateNext('ws', 'api_room')

      await runStep('api_room', 1500, async () => {
        const res = await fetchWithTimeout(`${apiBase}/api/room`, 15000, { method: 'GET', signal: abortRef.current?.signal })
        const json = (await res.json().catch(() => null)) as any
        if (!res.ok || json?.success === false) throw new Error(typeof json?.error === 'string' ? json.error : '大厅接口不可用')
      })
      activateNext('api_room', 'done')

      await runStep('done', 700, async () => {
        setServerBaseUrl(baseUrl)
        setCheck({ status: 'ok', message: '连接成功' })
      })
      updateStep('done', { status: 'success' })
      await sleep(500)
      if (!cancelledRef.current) navigate('/lan')
    } catch (e) {
      if (String(e) === 'Error: cancelled' || cancelledRef.current) {
        setFlowOpen(false)
        setCheck({ status: 'idle' })
      } else {
        const msg = e instanceof Error ? e.message : String(e)
        fail(activeKey, msg)
      }
    } finally {
      abortRef.current?.abort()
      abortRef.current = null
      busyRef.current = false
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <ConnectFlow
        open={flowOpen}
        title={flowTitle || '服务器'}
        subtitle={mode === 'online' ? '按步骤建立连接（即使很快也会走完动画）' : '正在发现并连接局域网服务器'}
        steps={flowSteps}
        errorMessage={flowError}
        onCancel={() => {
          cancelledRef.current = true
          abortRef.current?.abort()
          setFlowOpen(false)
          setFlowError(undefined)
          setCheck({ status: 'idle' })
        }}
      />
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-sm text-gray-500">{mode === 'online' ? '在线游玩' : '局域网组队'}</div>
          <h1 className="text-2xl font-extrabold mt-1">{title}</h1>
          <div className="text-gray-600 mt-1">{subtitle}</div>
          {check.status === 'checking' ? <div className="text-sm text-gray-600 mt-2">连接中…</div> : null}
          {check.status === 'ok' ? <div className="text-sm text-emerald-700 mt-2">{check.message}</div> : null}
          {check.status === 'error' ? <div className="text-sm text-red-600 mt-2">{check.message}</div> : null}
        </div>
        <div className="flex items-center gap-2">
          {saved ? (
            <button
              onClick={() => {
                clearServerBaseUrl()
                setServerInput('')
                setCheck({ status: 'idle' })
                setManualVisible(true)
              }}
              className="rounded-full bg-white/80 hover:bg-white px-4 py-2 shadow-sm ring-1 ring-gray-200 text-gray-800 font-semibold"
            >
              断开服务器
            </button>
          ) : null}
          <BackButton to="/" label="返回主页" />
        </div>
      </div>

      {mode === 'online' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {onlineServers.map(s => (
            <button
              key={s.httpUrl}
              onClick={() => runConnectFlow({ baseUrl: s.httpUrl, displayName: s.name })}
              className="bg-white rounded-2xl shadow p-5 border text-left hover:bg-gray-50"
              disabled={check.status === 'checking'}
            >
              <div className="text-xl font-bold mb-1">{s.name}</div>
              <div className="font-mono text-sm text-gray-700">{s.httpUrl.replace(/^https?:\/\//, '')}</div>
              <div className="text-xs text-gray-500 mt-2">点击连接</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow p-5 border">
          <div className="rounded-xl border bg-gray-50/60 p-3">
            {discovering ? (
              <div className="text-sm text-gray-600">正在搜索局域网服务器…</div>
            ) : servers.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-800">已发现 {servers.length} 台服务器</div>
                {servers.slice(0, 6).map(s => (
                  <button
                    key={`${s.ip}:${s.httpPort}`}
                    onClick={() => runConnectFlow({ baseUrl: s.httpUrl, displayName: s.name })}
                    className="w-full text-left rounded-xl bg-white hover:bg-gray-50 border px-3 py-2"
                    disabled={check.status === 'checking'}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-bold text-gray-900 truncate">{s.name}</div>
                      <div className="font-mono text-sm text-gray-700 whitespace-nowrap">
                        {s.ip}:{s.httpPort}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">点击连接</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-600">未搜索到可用服务器</div>
            )}
          </div>

          <button
            onClick={() => setManualVisible(v => !v)}
            className="w-full mt-3 rounded-xl bg-white hover:bg-gray-50 border px-4 py-2 font-semibold"
          >
            {manualVisible ? '收起手动输入' : '手动输入地址'}
          </button>

          {manualVisible ? (
            <div className="mt-3 rounded-xl border bg-gray-50/60 p-3">
              <div className="text-sm text-gray-600 mb-2">手动输入服务端地址（例：192.168.1.10:3001）</div>
              <div className="flex items-center gap-2">
                <input
                  value={serverInput}
                  onChange={e => setServerInput(e.target.value)}
                  className="flex-1 rounded-xl border px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  placeholder="http://IP:PORT"
                />
                <button
                  onClick={() => runConnectFlow({ baseUrl: normalized, displayName: '手动输入服务器' })}
                  disabled={check.status === 'checking' || !normalized}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 font-bold"
                >
                  连接
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
