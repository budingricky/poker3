import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
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
    if (!playerName) return alert('Please enter your name');
    try {
        const res = await api.createRoom(playerName, newRoomName);
        if (res.success) {
          const { room, player } = res.data;
          localStorage.setItem('playerId', player.id);
          localStorage.setItem('playerName', player.name);
          navigate(`/room/${room.id}`);
        } else {
          alert(res.error);
        }
    } catch (e) {
        alert("Failed to create room");
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!playerName) return alert('Please enter your name');
    try {
        const res = await api.joinRoom(roomId, playerName);
        if (res.success) {
          const { player } = res.data;
          localStorage.setItem('playerId', player.id);
          localStorage.setItem('playerName', player.name);
          navigate(`/room/${roomId}`);
        } else {
          alert(res.error);
        }
    } catch (e) {
        alert("Failed to join room");
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-green-800">Poker3 Lobby</h1>
      
      <div className="mb-8 p-4 bg-white rounded shadow">
        <h2 className="text-xl font-semibold mb-4">Identity</h2>
        <input
          type="text"
          placeholder="Enter your nickname"
          className="border p-2 rounded w-full max-w-xs"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-4 bg-white rounded shadow">
          <h2 className="text-xl font-semibold mb-4">Create Room</h2>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Room Name (Optional)"
              className="border p-2 rounded"
              value={newRoomName}
              onChange={e => setNewRoomName(e.target.value)}
            />
            <button
              onClick={handleCreateRoom}
              className="bg-green-600 text-white p-2 rounded hover:bg-green-700"
            >
              Create Room
            </button>
          </div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Available Rooms</h2>
            <button onClick={loadRooms} className="text-blue-600 text-sm">Refresh</button>
          </div>
          {rooms.length === 0 ? (
            <p className="text-gray-500">No rooms available.</p>
          ) : (
            <ul className="space-y-2">
              {rooms.map(room => (
                <li key={room.id} className="border p-2 rounded flex justify-between items-center">
                  <span>{room.name} ({room.players.length}/{room.maxPlayers})</span>
                  <button
                    onClick={() => handleJoinRoom(room.id)}
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm"
                  >
                    Join
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
