const API_BASE = '/api';

export const api = {
  getRooms: async () => {
    const res = await fetch(`${API_BASE}/room`, { cache: 'no-store' });
    return res.json();
  },
  createRoom: async (playerName: string, roomName?: string, playerId?: string) => {
    const res = await fetch(`${API_BASE}/room/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ playerName, roomName, playerId })
    });
    return res.json();
  },
  joinRoom: async (roomId: string, playerName: string, playerId?: string) => {
    const res = await fetch(`${API_BASE}/room/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ roomId, playerName, playerId })
    });
    return res.json();
  },
  getRoom: async (roomId: string) => {
      const res = await fetch(`${API_BASE}/room/${roomId}`, { cache: 'no-store' });
      return res.json();
  },
  startGame: async (roomId: string) => {
    const res = await fetch(`${API_BASE}/room/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ roomId })
    });
    return res.json();
  },
  getGameState: async (roomId: string, playerId: string) => {
      const res = await fetch(`${API_BASE}/room/${roomId}/game/${playerId}`, { cache: 'no-store' });
      return res.json();
  },
  leaveRoom: async (roomId: string, playerId: string) => {
    const res = await fetch(`${API_BASE}/room/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ roomId, playerId })
    });
    return res.json();
  },
  closeRoom: async (roomId: string, playerId: string) => {
    const res = await fetch(`${API_BASE}/room/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ roomId, playerId })
    });
    return res.json();
  },
  bid: async (roomId: string, playerId: string, score: number) => {
    const res = await fetch(`${API_BASE}/room/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ roomId, playerId, score })
    });
    return res.json();
  },
  takeHole: async (roomId: string, playerId: string) => {
    const res = await fetch(`${API_BASE}/room/take_hole`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ roomId, playerId })
    });
    return res.json();
  },
  playCards: async (roomId: string, playerId: string, cards: string[]) => {
    const res = await fetch(`${API_BASE}/room/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ roomId, playerId, cards })
    });
    return res.json();
  },
  pass: async (roomId: string, playerId: string) => {
    const res = await fetch(`${API_BASE}/room/pass`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ roomId, playerId })
    });
    return res.json();
  }
};
