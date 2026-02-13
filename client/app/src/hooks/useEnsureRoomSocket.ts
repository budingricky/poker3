import { useEffect } from 'react'
import { socket } from '../services/socket'

export function useEnsureRoomSocket(roomId: string, playerId?: string | null) {
  useEffect(() => {
    if (!roomId) return
    socket.joinRoom(roomId, playerId || undefined)
    return () => {
      socket.leaveRoom(roomId, playerId || undefined)
    }
  }, [playerId, roomId])
}

