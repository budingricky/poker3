import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { Room as RoomType } from '../types';
import GameTable from '../components/GameTable';

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<RoomType | null>(null);
  const [error, setError] = useState('');
  const [isGameStarted, setIsGameStarted] = useState(false);
  const navigate = useNavigate();
  const playerId = localStorage.getItem('playerId');

  useEffect(() => {
    if (!roomId) return;
    loadRoom();
    
    // Socket connection
    socket.joinRoom(roomId);
    
    socket.on('game_started', () => {
        setIsGameStarted(true);
        loadRoom();
    });

    socket.on('room_closed', () => {
      alert('房间已解散');
      navigate('/');
    });

    socket.on('room_update', () => {
        loadRoom();
    });

    return () => {
      socket.off('game_started');
      socket.off('room_update');
      socket.off('room_closed');
      socket.leaveRoom(roomId);
    };
  }, [roomId]);

  useEffect(() => {
      if (room?.status === 'PLAYING') {
          setIsGameStarted(true);
      }
  }, [room]);

  const loadRoom = async () => {
    if (!roomId) return;
    try {
        const res = await api.getRoom(roomId);
        if (res.success) {
          setRoom(res.data);
        } else {
          setError(res.error);
        }
    } catch (e) {
        setError("加载房间失败");
    }
  };
  
  const handleStartGame = async () => {
      if (!roomId) return;
      try {
          const res = await api.startGame(roomId);
          if (!res.success) {
              alert(res.error);
          }
      } catch (e) {
          alert("开始游戏失败");
      }
  };

  const handleLeaveRoom = async () => {
    if (!roomId || !playerId) return;
    try {
        await api.leaveRoom(roomId, playerId);
        navigate('/');
    } catch (e) {
        alert("退出房间失败");
    }
  };

  const handleCloseRoom = async () => {
    if (!roomId || !playerId) return;
    if (!window.confirm("确定要解散房间吗？")) return;
    try {
        await api.closeRoom(roomId, playerId);
        // Socket will handle redirect
    } catch (e) {
        alert("解散房间失败");
    }
  };

  if (isGameStarted && roomId && playerId) {
      return <GameTable roomId={roomId} playerId={playerId} />;
  }

  if (error) return <div className="p-4 text-red-600">错误：{error}</div>;
  if (!room) return <div className="p-4">加载中...</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{room.name}</h1>
        <span className="bg-gray-200 px-3 py-1 rounded text-sm">
          状态：{room.status}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {room.players.map(player => (
          <div key={player.id} className="bg-white p-4 rounded shadow text-center border">
            <div className="w-12 h-12 bg-gray-300 rounded-full mx-auto mb-2 flex items-center justify-center">
              {player.name[0].toUpperCase()}
            </div>
            <div className="font-semibold">{player.name}</div>
            {player.id === room.hostId && <div className="text-xs text-orange-500">房主</div>}
            {player.id === playerId && <div className="text-xs text-green-500">（你）</div>}
          </div>
        ))}
        {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-gray-100 p-4 rounded border border-dashed flex items-center justify-center text-gray-400">
            空位
          </div>
        ))}
      </div>

      <div className="text-center space-x-4">
        {playerId === room.hostId && room.status === 'WAITING' ? (
          <>
            <button
              onClick={handleStartGame}
              className="bg-green-600 text-white px-6 py-2 rounded-lg text-lg hover:bg-green-700 disabled:opacity-50"
              disabled={room.players.length < 4} 
            >
              开始游戏
            </button>
            <button
              onClick={handleCloseRoom}
              className="bg-red-600 text-white px-6 py-2 rounded-lg text-lg hover:bg-red-700"
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
      
      <div className="mt-8 text-center">
        <button onClick={handleLeaveRoom} className="text-blue-600 underline">
          返回大厅 (退出房间)
        </button>
      </div>
    </div>
  );
}
