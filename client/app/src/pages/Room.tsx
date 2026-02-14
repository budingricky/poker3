import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BackButton from '../components/BackButton'
import { api } from '../services/api'
import { getServerBaseUrl } from '../services/serverConfig'
import { socket } from '../services/socket'
import { Room as RoomType } from '../types'
import GameTable from '../components/GameTable'
import { useEnsureRoomSocket } from '../hooks/useEnsureRoomSocket'

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>()
  const [room, setRoom] = useState<RoomType | null>(null)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const [playerId, setPlayerId] = useState<string | null>(() => localStorage.getItem('playerId'))
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '玩家')
  const serverBaseUrl = getServerBaseUrl()
  useEnsureRoomSocket(roomId || '', playerId)
  const serverHostLabel = useMemo(() => {
    try {
      const u = new URL(serverBaseUrl)
      return u.host
    } catch {
      return serverBaseUrl
    }
  }, [serverBaseUrl])

  useEffect(() => {
    if (!roomId) return
    if (!getServerBaseUrl()) {
      navigate('/')
      return
    }
    ;(async () => {
      try {
        if (playerId) {
          const res = await api.joinRoom(roomId, playerName, playerId)
          if (res?.success && res?.data?.player?.id) {
            localStorage.setItem('playerId', res.data.player.id)
            localStorage.setItem('playerName', res.data.player.name)
            setPlayerId(res.data.player.id)
            setPlayerName(res.data.player.name)
          }
        }
      } catch {
      } finally {
        loadRoom()
      }
    })()
    
    socket.on('game_started', () => {
      loadRoom()
    })

    socket.on('room_closed', () => {
      alert('房间已解散');
      navigate('/lan')
    })

    socket.on('room_update', () => {
      loadRoom()
    })

    return () => {
      socket.off('game_started')
      socket.off('room_update')
      socket.off('room_closed')
    }
  }, [navigate, roomId, playerId, playerName])

  const loadRoom = async () => {
    if (!roomId) return
    try {
        const res = await api.getRoom(roomId)
        if (res.success) {
          setRoom(res.data)
        } else {
          setError(res.error)
        }
    } catch (e) {
        setError('加载房间失败')
    }
  }
  
  const handleStartGame = async () => {
      if (!roomId) return
      try {
          const res = await api.startGame(roomId)
          if (!res.success) {
              alert(res.error)
          }
      } catch (e) {
          alert('开始游戏失败')
      }
  }

  const handleLeaveRoom = async () => {
    if (!roomId || !playerId) return
    try {
        await api.leaveRoom(roomId, playerId)
        navigate('/lan')
    } catch (e) {
        alert('退出房间失败')
    }
  }

  const handleCloseRoom = async () => {
    if (!roomId || !playerId) return
    if (!window.confirm('确定要解散房间吗？')) return
    try {
        await api.closeRoom(roomId, playerId)
        // Socket will handle redirect
    } catch (e) {
        alert('解散房间失败')
    }
  }

  if (error) return <div className="p-4 text-red-600">错误：{error}</div>
  if (!room) return <div className="p-4">加载中...</div>
  if ((room.status === 'PLAYING' || room.status === 'FINISHED') && roomId && playerId) {
    return <GameTable roomId={roomId} playerId={playerId} />
  }
  const onlineCount = room.players.filter(p => p.isOnline).length
  const seats = Array.from({ length: room.maxPlayers }).map((_, i) => {
    const p = room.players[i]
    if (!p || !p.isOnline) return null
    return p
  })

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-sm text-gray-500">局域网服务器</div>
          <div className="font-mono text-sm text-gray-700">{serverHostLabel}</div>
          <h1 className="text-2xl font-extrabold mt-1">{room.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <BackButton to="/lan" label="返回大厅" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {seats.map((player, idx) =>
          player ? (
            <div key={player.id} className="bg-white p-4 rounded-2xl shadow text-center border">
              <div className="w-12 h-12 bg-gray-300 rounded-full mx-auto mb-2 flex items-center justify-center">
                {player.name[0].toUpperCase()}
              </div>
              <div className="font-semibold">{player.name}</div>
              {player.id === room.hostId && <div className="text-xs text-orange-500">房主</div>}
              {player.id === playerId && <div className="text-xs text-green-500">（你）</div>}
            </div>
          ) : (
            <div
              key={`empty-${idx}`}
              className={`bg-gray-100 p-4 rounded-2xl border border-dashed flex items-center justify-center text-gray-400 ${
                  playerId === room.hostId ? 'cursor-pointer hover:bg-gray-200 hover:text-gray-600 transition-colors' : ''
              }`}
              onClick={async () => {
                  if (playerId !== room.hostId) return
                  if (window.confirm('是否使用AI填补此空位？')) {
                      try {
                          await api.addBot(roomId, playerId)
                      } catch (e) {
                          alert('添加AI失败')
                      }
                  }
              }}
            >
              {playerId === room.hostId ? '点击添加AI' : '空位'}
            </div>
          ),
        )}
      </div>

      <div className="text-center space-x-4">
        {playerId === room.hostId && room.status === 'WAITING' ? (
          <>
            <button
              onClick={handleStartGame}
              className="rounded-full bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3 text-lg disabled:opacity-50"
              disabled={onlineCount < room.maxPlayers}
            >
              开始游戏
            </button>
            <button
              onClick={handleCloseRoom}
              className="rounded-full bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 text-lg"
            >
              解散房间
            </button>
          </>
        ) : (
          <div className="text-gray-600">
            {room.status === 'WAITING' ? '等待房主开始...' : '游戏进行中'}
          </div>
        )}
      </div>
      
      <div className="mt-8 flex justify-center">
        <button onClick={handleLeaveRoom} className="text-blue-700 font-semibold underline">
          退出房间
        </button>
      </div>
    </div>
  )
}
