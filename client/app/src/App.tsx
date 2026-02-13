import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchHealth } from './lib/api'
import { normalizeBaseUrl } from './lib/urls'
import { createPokerWs, type WsStatus } from './lib/ws'

const STORAGE_KEY = 'poker3.serverBaseUrl'

export default function App() {
  const [serverInput, setServerInput] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ?? 'http://localhost:3001'
  })
  const serverBaseUrl = useMemo(() => normalizeBaseUrl(serverInput), [serverInput])

  const [health, setHealth] = useState<{ ok: boolean; text: string } | null>(null)
  const [wsStatus, setWsStatus] = useState<WsStatus>('disconnected')
  const [wsLog, setWsLog] = useState<string[]>([])

  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, serverInput)
  }, [serverInput])

  function addLog(line: string) {
    setWsLog(prev => [line, ...prev].slice(0, 20))
  }

  async function onCheckHealth() {
    if (!serverBaseUrl) return
    setHealth(null)
    const r = await fetchHealth(serverBaseUrl)
    setHealth(r)
  }

  function onConnectWs() {
    if (!serverBaseUrl) return
    try {
      wsRef.current?.close()
    } catch {
    }
    setWsStatus('connecting')
    const ws = createPokerWs(serverBaseUrl)
    wsRef.current = ws
    ws.onopen = () => {
      setWsStatus('connected')
      addLog('ws open')
      ws.send(JSON.stringify({ event: 'join_lobby', data: null }))
    }
    ws.onmessage = evt => {
      addLog(`ws message: ${evt.data}`)
    }
    ws.onerror = () => {
      setWsStatus('error')
      addLog('ws error')
    }
    ws.onclose = () => {
      setWsStatus('disconnected')
      addLog('ws close')
    }
  }

  function onDisconnectWs() {
    try {
      wsRef.current?.close()
    } catch {
    } finally {
      wsRef.current = null
      setWsStatus('disconnected')
    }
  }

  return (
    <main>
      <h1>Poker3 客户端</h1>
      <p className="muted">服务端只提供 API 与 WebSocket，本客户端负责界面显示。</p>

      <div className="card">
        <h2>连接设置</h2>
        <div className="row">
          <label>
            服务端地址：
            <input
              value={serverInput}
              onChange={e => setServerInput(e.target.value)}
              style={{ width: 320, marginLeft: 8, padding: '6px 10px' }}
              placeholder="http://192.168.1.10:3001"
            />
          </label>
          <button onClick={onCheckHealth} disabled={!serverBaseUrl}>
            检查 /api/health
          </button>
          {health && <span className={health.ok ? 'ok' : 'bad'}>{health.text}</span>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>WebSocket</h2>
        <div className="row">
          <span>
            状态：<strong>{wsStatus}</strong>
          </span>
          <button onClick={onConnectWs} disabled={!serverBaseUrl || wsStatus === 'connecting'}>
            连接
          </button>
          <button onClick={onDisconnectWs} disabled={wsStatus === 'disconnected'}>
            断开
          </button>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="muted">最近日志：</div>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{wsLog.join('\n')}</pre>
        </div>
      </div>
    </main>
  )
}

