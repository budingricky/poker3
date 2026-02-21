import React, { useEffect, useMemo, useState, useCallback } from 'react'
import BackButton from '../components/BackButton'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { clearServerBaseUrl, getServerBaseUrl } from '../services/serverConfig'
import { socket } from '../services/socket'
import { Room } from '../types'

export default function Lobby() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [playerName, setPlayerName] = useState('')
  const [newRoomName, setNewRoomName] = useState('')
  const [serverName, setServerName] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const serverBaseUrl = getServerBaseUrl()
  const serverHostLabel = useMemo(() => {
    try {
      const u = new URL(serverBaseUrl)
      return u.host
    } catch {
      return serverBaseUrl
    }
  }, [serverBaseUrl])

  const loadRooms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.getRooms()
      if (res.success) {
        setRooms(res.data)
      }
    } catch (e) {
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!serverBaseUrl) {
      navigate('/')
      return
    }
    const storedName = localStorage.getItem('playerName')
    if (storedName) setPlayerName(storedName)

    loadRooms()
    socket.joinLobby()

    const onRoomUpdate = () => {
      loadRooms()
    }
    const onWsOpen = () => {
      loadRooms()
    }
    socket.on('room_update', onRoomUpdate)
    socket.on('ws_open', onWsOpen)

    api
      .info()
      .then((r: any) => {
        const name = String(r?.data?.name || r?.data?.data?.name || '')
        if (name) setServerName(name)
      })
      .catch(() => {
      })

    return () => {
      socket.off('room_update', onRoomUpdate)
      socket.off('ws_open', onWsOpen)
      socket.leaveLobby()
    }
  }, [navigate, serverBaseUrl, loadRooms])

  const handleCreateRoom = async () => {
    if (!playerName) return alert('请输入您的昵称')
    try {
      const storedPlayerId = localStorage.getItem('playerId')
      const res = await api.createRoom(playerName, newRoomName, storedPlayerId || undefined)
      if (res.success) {
        const { room, player } = res.data
        localStorage.setItem('playerId', player.id)
        localStorage.setItem('playerName', player.name)
        navigate(`/lan/room/${room.id}`)
      } else {
        alert(res.error)
      }
    } catch (e) {
      alert('创建房间失败')
    }
  }

  const handleJoinRoom = async (roomId: string) => {
    if (!playerName) return alert('请输入您的昵称')
    try {
      const storedPlayerId = localStorage.getItem('playerId')
      const res = await api.joinRoom(roomId, playerName, storedPlayerId || undefined)
      if (res.success) {
        const { player } = res.data
        localStorage.setItem('playerId', player.id)
        localStorage.setItem('playerName', player.name)
        navigate(`/lan/room/${roomId}`)
      } else {
        alert(res.error)
      }
    } catch (e) {
      alert('加入房间失败')
    }
  }

  return (
    <div className="p-3 md:p-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-3xl font-extrabold text-green-800">联机大厅</div>
          <div className="text-sm text-gray-600 mt-1">同一局域网内可见的房间列表</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/shop')}
            className="rounded-full bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 font-semibold min-h-[44px] flex items-center gap-2"
          >
            <span>🛒</span> 游戏商店
          </button>
          <BackButton to="/" label="返回" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow border p-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">已连接服务器</div>
            <div className="font-bold text-gray-900">
              {serverName ? serverName : 'Poker3 Server'}
            </div>
            <div className="font-mono text-sm text-gray-700">{serverHostLabel}</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadRooms}
              className="rounded-full bg-gray-100 hover:bg-gray-200 px-4 py-2 font-semibold min-h-[44px]"
            >
              刷新房间
            </button>
            <button
              onClick={() => {
                clearServerBaseUrl()
                navigate('/')
              }}
              className="rounded-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 font-semibold min-h-[44px]"
            >
              断开连接
            </button>
          </div>
        </div>
      </div>
      
      <div className="mb-8 p-4 bg-white rounded-2xl shadow border">
        <h2 className="text-xl font-bold mb-4">玩家信息</h2>
        <input
          type="text"
          placeholder="输入您的昵称"
          className="border p-3 rounded-xl w-full max-w-full md:max-w-xs"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-4 bg-white rounded-2xl shadow border">
          <h2 className="text-xl font-bold mb-4">创建房间</h2>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="房间名称（可选）"
              className="border p-3 rounded-xl"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
            />
            <button
              onClick={handleCreateRoom}
              className="rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-3 min-h-[44px]"
            >
              创建房间
            </button>
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl shadow border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">可用房间</h2>
            <button onClick={loadRooms} className="text-blue-600 font-semibold text-sm">刷新</button>
          </div>
          {rooms.length === 0 ? (
            <p className="text-gray-500">暂无可用房间</p>
          ) : (
            <ul className="space-y-2">
              {rooms.map(room => (
                <li key={room.id} className="border p-3 rounded-xl flex justify-between items-center">
                  <div>
                    <div className="font-semibold text-gray-900">{room.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {room.players.length}/{room.maxPlayers} 人
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoinRoom(room.id)}
                    className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 font-bold text-sm min-h-[44px]"
                  >
                    加入
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
