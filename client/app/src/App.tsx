import React, { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import ModeSelect from './pages/ModeSelect'
import Placeholder from './pages/Placeholder'
import Offline from './pages/Offline'
import ServerSelect from './pages/ServerSelect'
import Lobby from './pages/Lobby'
import Room from './pages/Room'
import './index.css'

const BGM_ENABLED_KEY = 'poker3.bgmEnabled'
const DEFAULT_BGM_VOLUME = 0.22

function LegacyRoomRedirect() {
  const { roomId } = useParams<{ roomId: string }>()
  return <Navigate to={roomId ? `/lan/room/${roomId}` : '/lan'} replace />
}

function MusicManager() {
    const location = useLocation()
    const lobbyAudioRef = useRef<HTMLAudioElement | null>(null)
    const gameAudioRef = useRef<HTMLAudioElement | null>(null)
    const enabledRef = useRef<boolean>(true)
    const baseVolumeRef = useRef<number>(DEFAULT_BGM_VOLUME)

    useEffect(() => {
        if (!lobbyAudioRef.current) {
            lobbyAudioRef.current = new Audio('/music/lobby.mp3')
            lobbyAudioRef.current.loop = true
            lobbyAudioRef.current.volume = baseVolumeRef.current
        }
        if (!gameAudioRef.current) {
            gameAudioRef.current = new Audio('/music/game.mp3')
            gameAudioRef.current.loop = true
            gameAudioRef.current.volume = baseVolumeRef.current
        }

        const path = location.pathname
        const isGame = path.includes('/room/') || path === '/offline'
        
        if (isGame) {
            lobbyAudioRef.current.pause()
            if (enabledRef.current) gameAudioRef.current.play().catch(() => {})
        } else {
            gameAudioRef.current.pause()
            if (enabledRef.current) lobbyAudioRef.current.play().catch(() => {})
        }

        return () => {
        }
    }, [location.pathname])

    useEffect(() => {
        const readEnabled = () => {
            const raw = window.localStorage.getItem(BGM_ENABLED_KEY)
            enabledRef.current = raw === null ? true : raw === '1'
            if (!enabledRef.current) {
                lobbyAudioRef.current?.pause()
                gameAudioRef.current?.pause()
            }
        }

        const setVolume = (vol: number) => {
            const v = Math.max(0, Math.min(1, vol))
            if (lobbyAudioRef.current) lobbyAudioRef.current.volume = v
            if (gameAudioRef.current) gameAudioRef.current.volume = v
        }

        readEnabled()
        setVolume(baseVolumeRef.current)

        const onToggle = () => {
            readEnabled()
            setVolume(baseVolumeRef.current)
            if (!enabledRef.current) return
            const path = location.pathname
            const isGame = path.includes('/room/') || path === '/offline'
            if (isGame) gameAudioRef.current?.play().catch(() => {})
            else lobbyAudioRef.current?.play().catch(() => {})
        }

        const onMicOn = () => {
            if (!enabledRef.current) return
            setVolume(Math.max(0, baseVolumeRef.current * 0.25))
        }
        const onMicOff = () => {
            if (!enabledRef.current) return
            setVolume(baseVolumeRef.current)
        }

        window.addEventListener('poker3-bgm-toggle', onToggle)
        window.addEventListener('trtc-mic-enabled', onMicOn)
        window.addEventListener('trtc-mic-disabled', onMicOff)
        return () => {
            window.removeEventListener('poker3-bgm-toggle', onToggle)
            window.removeEventListener('trtc-mic-enabled', onMicOn)
            window.removeEventListener('trtc-mic-disabled', onMicOff)
        }
    }, [location.pathname])

    useEffect(() => {
        const tick = () => {
            const v = baseVolumeRef.current
            if (enabledRef.current) {
                if (lobbyAudioRef.current) lobbyAudioRef.current.volume = Math.max(0, Math.min(1, lobbyAudioRef.current.volume))
                if (gameAudioRef.current) gameAudioRef.current.volume = Math.max(0, Math.min(1, gameAudioRef.current.volume))
                if (lobbyAudioRef.current && lobbyAudioRef.current.volume > v) lobbyAudioRef.current.volume = v
                if (gameAudioRef.current && gameAudioRef.current.volume > v) gameAudioRef.current.volume = v
            }
        }
        const id = window.setInterval(tick, 1000)
        return () => window.clearInterval(id)
    }, [])

    return null
}

function BgmToggle() {
  const [enabled, setEnabled] = React.useState(() => {
    const raw = window.localStorage.getItem(BGM_ENABLED_KEY)
    return raw === null ? true : raw === '1'
  })

  return (
    <button
      type="button"
      onClick={() => {
        const next = !enabled
        setEnabled(next)
        window.localStorage.setItem(BGM_ENABLED_KEY, next ? '1' : '0')
        window.dispatchEvent(new CustomEvent('poker3-bgm-toggle'))
      }}
      className={[
        'fixed left-3 bottom-3 z-[60] rounded-full px-4 py-2 text-sm font-bold border backdrop-blur',
        enabled ? 'bg-white/10 hover:bg-white/15 border-white/20 text-white' : 'bg-black/50 hover:bg-black/60 border-white/10 text-white/80',
      ].join(' ')}
      title={enabled ? '点击关闭背景音乐' : '点击开启背景音乐'}
    >
      {enabled ? 'BGM 开' : 'BGM 关'}
    </button>
  )
}

function App() {
  return (
    <Router>
      <MusicManager />
      <BgmToggle />
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Routes>
          <Route path="/" element={<ModeSelect />} />
          <Route path="/online" element={<ServerSelect mode="online" />} />
          <Route path="/offline" element={<Offline />} />
          <Route path="/server-select/lan" element={<ServerSelect mode="lan" />} />
          <Route path="/lan" element={<Lobby />} />
          <Route path="/lan/room/:roomId" element={<Room />} />
          <Route path="/room/:roomId" element={<LegacyRoomRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
