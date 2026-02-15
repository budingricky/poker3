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
        const delay = Math.min(3000, 250 * Math.max(1, this.reconnectAttempts))
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
    }, 5000)

    this.ws.onopen = () => {
      window.clearTimeout(connectTimer)
      this.reconnectAttempts = 0
      if (this.pendingMessages.length > 0) {
        const messages = this.pendingMessages
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
    }

    this.ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data)
        const { event: eventName, data } = message
        if (eventName && this.listeners[eventName]) {
          this.listeners[eventName].forEach(cb => cb(data))
        }
      } catch {
      }
    }

    this.ws.onclose = () => {
      window.clearTimeout(connectTimer)
      this.ws = null
      if (!this.manualClose) {
        const delay = Math.min(3000, 250 * Math.max(1, this.reconnectAttempts))
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
    this.pendingMessages.push(payload)
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
  }
}

export const socket = new SocketClient()
