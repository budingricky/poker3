import { getApiUrl } from './serverConfig'

const DEFAULT_TIMEOUT = 10000
const MAX_RETRIES = 2

async function fetchWithRetry(url: string, init?: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        ...init,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      return res
    } catch (e) {
      clearTimeout(timeoutId)
      lastError = e instanceof Error ? e : new Error(String(e))
      if (i < retries) {
        await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)))
      }
    }
  }
  throw lastError || new Error('请求失败')
}

async function fetchJson(pathname: string, init?: RequestInit) {
  const res = await fetchWithRetry(getApiUrl(pathname), init)
  return res.json()
}

export const api = {
  health: async () => {
    return fetchJson('/api/health', { method: 'GET' })
  },
  info: async () => {
    return fetchJson('/api/info', { method: 'GET' })
  },
  getRooms: async () => {
    return fetchJson('/api/room', { method: 'GET' })
  },
  createRoom: async (playerName: string, roomName?: string, playerId?: string) => {
    return fetchJson('/api/room/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, roomName, playerId }),
    })
  },
  joinRoom: async (roomId: string, playerName: string, playerId?: string) => {
    return fetchJson('/api/room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerName, playerId }),
    })
  },
  getRoom: async (roomId: string) => {
    return fetchJson(`/api/room/${roomId}`, { method: 'GET' })
  },
  startGame: async (roomId: string) => {
    return fetchJson('/api/room/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId }),
    })
  },
  getGameState: async (roomId: string, playerId: string) => {
    return fetchJson(`/api/room/${roomId}/game/${playerId}`, { method: 'GET' })
  },
  leaveRoom: async (roomId: string, playerId: string) => {
    return fetchJson('/api/room/leave', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    })
  },
  closeRoom: async (roomId: string, playerId: string) => {
    return fetchJson('/api/room/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    })
  },
  bid: async (roomId: string, playerId: string, score: number) => {
    return fetchJson('/api/room/bid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId, score }),
    })
  },
  takeHole: async (roomId: string, playerId: string) => {
    return fetchJson('/api/room/take_hole', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    })
  },
  surrender: async (roomId: string, playerId: string) => {
    return fetchJson('/api/room/surrender', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    })
  },
  confirmContinue: async (roomId: string, playerId: string) => {
    return fetchJson('/api/room/confirm_continue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    })
  },
  playCards: async (roomId: string, playerId: string, cards: string[]) => {
    return fetchJson('/api/room/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId, cards }),
    })
  },
  pass: async (roomId: string, playerId: string) => {
    return fetchJson('/api/room/pass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    })
  },
  nextRound: async (roomId: string, playerId: string) => {
    return fetchJson('/api/room/next_round', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    })
  },
  setSettlementMultiplier: async (roomId: string, playerId: string, multiplier: number) => {
    return fetchJson('/api/room/settlement_multiplier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId, multiplier }),
    })
  },
  undo: async (roomId: string, playerId: string) => {
    return fetchJson('/api/room/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    })
  },
  addBot: async (roomId: string, playerId: string) => {
    return fetchJson('/api/room/add-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    })
  },
  getTRTCSig: async (userId: string) => {
    return fetchJson('/api/auth/trtc_sig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
  },
}
