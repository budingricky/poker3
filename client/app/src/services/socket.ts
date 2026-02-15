import { getWsUrl, subscribeServerBaseUrl } from './serverConfig'

type Listener = (...args: any[]) => void

class SocketClient {
  private ws: WebSocket | null = null
  private listeners: Record<string, Listener[]> = {}
  private pendingMessages: string[] = []
  private manualClose = false
  private reconnectAttempts = 0
  private reconnectTimer: number | null = null
  private joinedLobby = false
  private joinedRoomId: string | null = null
  private joinedPlayerId: string | null = null
  private currentUrl: string | null = null
  private lastOpenAt = 0
  private lastMessageAt = 0
  private heartbeatTimer: number | null = null
  private heartbeatInterval = 45000
  private connectTimeout = 30000
  private minReconnectDelay = 2000
  private maxReconnectDelay = 30000

  constructor() {
    subscribeServerBaseUrl(() => {
      if (this.joinedLobby || this.joinedRoomId) {
        this.reconnectSoon()
      } else {
        this.disconnect()
      }
    })
  }

  isConnected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN
  }

  getReadyState() {
    return this.ws ? this.ws.readyState : null
  }

  getLastOpenAt() {
    return this.lastOpenAt || 0
  }

  getLastMessageAt() {
    return this.lastMessageAt || 0
  }

  private startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'ping', data: Date.now() }))
      }
    }, this.heartbeatInterval)
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  private reconnectSoon() {
    try {
      this.ws?.close()
    } catch {
    }
    this.ws = null
    this.connect()
  }

  connect() {
    let url: string
    try {
      url = getWsUrl()
    } catch {
      return
    }
    if (!url) return

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.currentUrl === url) return
      this.disconnect()
    }

    this.currentUrl = url
    this.manualClose = false

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    try {
      this.ws = new WebSocket(url)
    } catch {
      this.ws = null
      if (!this.manualClose) {
        const delay = Math.min(this.maxReconnectDelay, this.minReconnectDelay * Math.pow(1.5, Math.min(10, this.reconnectAttempts)))
        this.reconnectAttempts += 1
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = null
          this.connect()
        }, delay)
      }
      return
    }
    const connectTimer = window.setTimeout(() => {
      try {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close()
        }
      } catch {
      }
    }, this.connectTimeout)

    this.ws.onopen = () => {
      window.clearTimeout(connectTimer)
      this.reconnectAttempts = 0
      this.lastOpenAt = Date.now()
      this.startHeartbeat()
      if (this.pendingMessages.length > 0) {
        const messages = [...this.pendingMessages]
        this.pendingMessages = []
        messages.forEach(m => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(m)
        })
      }
      if (this.joinedLobby) this.emit('join_lobby', true)
      if (this.joinedRoomId) {
        const payload = this.joinedPlayerId
          ? { roomId: this.joinedRoomId, playerId: this.joinedPlayerId }
          : this.joinedRoomId
        this.emit('join_room', payload)
      }
      if (this.listeners['ws_open']) {
        this.listeners['ws_open'].forEach(cb => cb(this.currentUrl))
      }
    }

    this.ws.onmessage = event => {
      this.lastMessageAt = Date.now()
      try {
        const message = JSON.parse(event.data)
        const { event: eventName, data } = message
        if (eventName === 'pong') {
          return
        }
        if (eventName && this.listeners[eventName]) {
          this.listeners[eventName].forEach(cb => cb(data))
        }
      } catch {
      }
    }

    this.ws.onclose = () => {
      window.clearTimeout(connectTimer)
      this.stopHeartbeat()
      this.ws = null
      if (this.listeners['ws_close']) {
        this.listeners['ws_close'].forEach(cb => cb(this.currentUrl))
      }
      if (!this.manualClose) {
        const delay = Math.min(this.maxReconnectDelay, this.minReconnectDelay * Math.pow(1.5, Math.min(10, this.reconnectAttempts)))
        this.reconnectAttempts += 1
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectTimer = null
          this.connect()
        }, delay)
      }
    }

    this.ws.onerror = () => {
    }
  }

  emit(event: string, data: any) {
    const payload = JSON.stringify({ event, data })
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload)
      return
    }
    if (this.pendingMessages.length < 50) {
      this.pendingMessages.push(payload)
    }
  }

  joinLobby() {
    this.joinedLobby = true
    this.connect()
    this.emit('join_lobby', true)
  }

  leaveLobby() {
    this.joinedLobby = false
    this.emit('leave_lobby', true)
  }

  joinRoom(roomId: string, playerId?: string) {
    this.joinedRoomId = roomId
    this.joinedPlayerId = playerId || null
    this.connect()
    this.emit('join_room', playerId ? { roomId, playerId } : roomId)
  }

  leaveRoom(roomId: string, playerId?: string) {
    if (this.joinedRoomId === roomId) this.joinedRoomId = null
    if (this.joinedPlayerId === playerId) this.joinedPlayerId = null
    this.emit('leave_room', playerId ? { roomId, playerId } : roomId)
  }

  on(event: string, cb: Listener) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(cb)
  }

  off(event: string, cb?: Listener) {
    if (!this.listeners[event]) return
    if (cb) {
      this.listeners[event] = this.listeners[event].filter(l => l !== cb)
    } else {
      delete this.listeners[event]
    }
  }

  disconnect() {
    this.stopHeartbeat()
    if (this.ws) {
      this.manualClose = true
      try {
        this.ws.close()
      } catch {
      }
      this.ws = null
    }
    this.joinedLobby = false
    this.joinedRoomId = null
    this.joinedPlayerId = null
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.pendingMessages = []
  }
}

export const socket = new SocketClient()
