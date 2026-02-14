import React, { useEffect, useRef } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom'
import ModeSelect from './pages/ModeSelect'
import Placeholder from './pages/Placeholder'
import Offline from './pages/Offline'
import ServerSelect from './pages/ServerSelect'
import Lobby from './pages/Lobby'
import Room from './pages/Room'
import './index.css'

function LegacyRoomRedirect() {
  const { roomId } = useParams<{ roomId: string }>()
  return <Navigate to={roomId ? `/lan/room/${roomId}` : '/lan'} replace />
}

function MusicManager() {
    const location = useLocation()
    const lobbyAudioRef = useRef<HTMLAudioElement | null>(null)
    const gameAudioRef = useRef<HTMLAudioElement | null>(null)

    useEffect(() => {
        // Initialize audio elements
        if (!lobbyAudioRef.current) {
            lobbyAudioRef.current = new Audio('/music/lobby.mp3')
            lobbyAudioRef.current.loop = true
            lobbyAudioRef.current.volume = 0.3
        }
        if (!gameAudioRef.current) {
            gameAudioRef.current = new Audio('/music/game.mp3')
            gameAudioRef.current.loop = true
            gameAudioRef.current.volume = 0.3
        }

        const path = location.pathname
        const isGame = path.includes('/room/') || path === '/offline'
        
        // Handle music switching
        if (isGame) {
            lobbyAudioRef.current.pause()
            gameAudioRef.current.play().catch(() => {})
        } else {
            gameAudioRef.current.pause()
            lobbyAudioRef.current.play().catch(() => {})
        }

        return () => {
            // Cleanup on unmount (though this component is top-level)
        }
    }, [location.pathname])

    return null
}

function App() {
  return (
    <Router>
      <MusicManager />
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
