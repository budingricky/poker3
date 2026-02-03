import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { Room } from '../types';

export default function Lobby() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Try to recover player name from local storage
    const storedName = localStorage.getItem('playerName');
    if (storedName) setPlayerName(storedName);
    loadRooms();
    socket.joinLobby();
    const onRoomUpdate = () => {
      loadRooms();
    };
    socket.on('room_update', onRoomUpdate);

    return () => {
      socket.off('room_update', onRoomUpdate);
      socket.leaveLobby();
    };
  }, []);

  const loadRooms = async () => {
    try {
        const res = await api.getRooms();
        if (res.success) {
          setRooms(res.data);
        }
    } catch (e) {
        console.error("Failed to load rooms", e);
    }
  };

  const handleCreateRoom = async () => {
    if (!playerName) return alert('请输入您的昵称');
    try {
        const storedPlayerId = localStorage.getItem('playerId');
        const res = await api.createRoom(playerName, newRoomName, storedPlayerId || undefined);
        if (res.success) {
          const { room, player } = res.data;
          localStorage.setItem('playerId', player.id);
          localStorage.setItem('playerName', player.name);
          navigate(`/room/${room.id}`);
        } else {
          alert(res.error);
        }
    } catch (e) {
        alert("创建房间失败");
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!playerName) return alert('请输入您的昵称');
    try {
        const storedPlayerId = localStorage.getItem('playerId');
        const res = await api.joinRoom(roomId, playerName, storedPlayerId || undefined);
        if (res.success) {
          const { player } = res.data;
          localStorage.setItem('playerId', player.id);
          localStorage.setItem('playerName', player.name);
          navigate(`/room/${roomId}`);
        } else {
          alert(res.error);
        }
    } catch (e) {
        alert("加入房间失败");
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-green-800">挖坑游戏大厅</h1>
      
      <div className="mb-8 p-4 bg-white rounded shadow">
        <h2 className="text-xl font-semibold mb-4">玩家信息</h2>
        <input
          type="text"
          placeholder="输入您的昵称"
          className="border p-2 rounded w-full max-w-xs"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-4 bg-white rounded shadow">
          <h2 className="text-xl font-semibold mb-4">创建房间</h2>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="房间名称（可选）"
              className="border p-2 rounded"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
            />
            <button
              onClick={handleCreateRoom}
              className="bg-green-600 text-white p-2 rounded hover:bg-green-700"
            >
              创建房间
            </button>
          </div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">可用房间</h2>
            <button onClick={loadRooms} className="text-blue-600 text-sm">刷新</button>
          </div>
          {rooms.length === 0 ? (
            <p className="text-gray-500">暂无可用房间</p>
          ) : (
            <ul className="space-y-2">
              {rooms.map(room => (
                <li key={room.id} className="border p-2 rounded flex justify-between items-center">
                  <span>{room.name} ({room.players.length}/{room.maxPlayers})</span>
                  <button
                    onClick={() => handleJoinRoom(room.id)}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
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
  );
}
