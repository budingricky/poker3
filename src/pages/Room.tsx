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
    socket.connect();
    socket.emit('join_room', roomId);
    
    socket.on('game_started', () => {
        setIsGameStarted(true);
    });

    return () => {
      socket.off('game_started');
      socket.disconnect();
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
        setError("Failed to load room");
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
          alert("Failed to start game");
      }
  };

  if (isGameStarted && roomId && playerId) {
      return <GameTable roomId={roomId} playerId={playerId} />;
  }

  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;
  if (!room) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{room.name}</h1>
        <span className="bg-gray-200 px-3 py-1 rounded text-sm">
          Status: {room.status}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {room.players.map(player => (
          <div key={player.id} className="bg-white p-4 rounded shadow text-center border">
            <div className="w-12 h-12 bg-gray-300 rounded-full mx-auto mb-2 flex items-center justify-center">
              {player.name[0].toUpperCase()}
            </div>
            <div className="font-semibold">{player.name}</div>
            {player.id === room.hostId && <div className="text-xs text-orange-500">Host</div>}
            {player.id === playerId && <div className="text-xs text-green-500">(You)</div>}
          </div>
        ))}
        {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-gray-100 p-4 rounded border border-dashed flex items-center justify-center text-gray-400">
            Empty Seat
          </div>
        ))}
      </div>

      <div className="text-center">
        {playerId === room.hostId && room.status === 'WAITING' ? (
          <button
            onClick={handleStartGame}
            className="bg-green-600 text-white px-6 py-2 rounded-lg text-lg hover:bg-green-700 disabled:opacity-50"
            disabled={room.players.length < 2} 
          >
            Start Game
          </button>
        ) : (
          <div className="text-gray-600">
            {room.status === 'WAITING' ? 'Waiting for host to start...' : 'Game in progress'}
          </div>
        )}
      </div>
      
      <div className="mt-8 text-center">
        <button onClick={() => navigate('/')} className="text-blue-600 underline">
          Back to Lobby
        </button>
      </div>
    </div>
  );
}
