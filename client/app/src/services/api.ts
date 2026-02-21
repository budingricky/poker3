import { getApiUrl } from './serverConfig'
import { Product } from '../types'

const DEFAULT_TIMEOUT = 30000
const MAX_RETRIES = 3

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
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
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
  initiateFinalSettlement: async (roomId: string, playerId: string) => {
    return fetchJson('/api/room/initiate_final_settlement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, playerId }),
    })
  },
  confirmFinalSettlement: async (roomId: string, playerId: string) => {
    return fetchJson('/api/room/confirm_final_settlement', {
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
  getProducts: async () => {
    // 模拟产品数据，避免调用未部署的支付接口
    return Promise.resolve({
      success: true,
      data: [
        { id: 'coin_100', name: '100游戏币', description: '可用于购买头像、主题等', price: 600, currency: 'CNY', type: 'coin', icon: '💰' },
        { id: 'coin_500', name: '500游戏币', description: '超值礼包', price: 3000, currency: 'CNY', type: 'coin', icon: '💎' },
        { id: 'coin_1000', name: '1000游戏币', description: '豪华礼包，额外赠送100币', price: 5000, currency: 'CNY', type: 'coin', icon: '🎁' },
        { id: 'avatar_1', name: '炫酷头像', description: '专属稀有头像', price: 1500, currency: 'CNY', type: 'avatar', icon: '👑' },
        { id: 'theme_dark', name: '暗黑主题', description: '深色界面主题', price: 2000, currency: 'CNY', type: 'theme', icon: '🎨' },
        { id: 'vip_30', name: 'VIP月卡', description: '30天VIP特权', price: 3000, currency: 'CNY', type: 'vip', icon: '⭐' },
      ] as Product[]
    })
  },
  createOrder: async (productId: string, paymentMethod: 'wechat' | 'alipay') => {
    // 模拟订单创建，避免调用未部署的支付接口
    const orderId = 'mock_order_' + Date.now()
    return Promise.resolve({
      success: true,
      data: {
        orderId,
        paymentUrl: `https://example.com/payment/${orderId}`,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`mock://payment/${orderId}`)}`,
        status: 'pending'
      }
    })
  },
  checkOrderStatus: async (orderId: string) => {
    // 模拟订单状态查询，避免调用未部署的支付接口
    return Promise.resolve({
      success: true,
      data: {
        orderId,
        status: orderId.includes('mock') ? 'paid' : 'pending',
        paidAt: Date.now()
      }
    })
  },
}
