const API_BASE = 'http://localhost:3001/api';

export const api = {
  getRooms: async () => {
    const res = await fetch(`${API_BASE}/room`);
    return res.json();
  },
  createRoom: async (playerName: string, roomName?: string) => {
    const res = await fetch(`${API_BASE}/room/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, roomName })
    });
    return res.json();
  },
  joinRoom: async (roomId: string, playerName: string) => {
    const res = await fetch(`${API_BASE}/room/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerName })
    });
    return res.json();
  },
  getRoom: async (roomId: string) => {
      const res = await fetch(`${API_BASE}/room/${roomId}`);
      return res.json();
  },
  startGame: async (roomId: string) => {
    const res = await fetch(`${API_BASE}/room/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId })
    });
    return res.json();
  },
  getGameState: async (roomId: string, playerId: string) => {
      const res = await fetch(`${API_BASE}/room/${roomId}/game/${playerId}`);
      return res.json();
  }
};
