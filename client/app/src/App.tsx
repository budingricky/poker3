import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom'
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

function App() {
  return (
    <Router>
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
