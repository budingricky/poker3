type Listener = (...args: any[]) => void;

class SocketClient {
  private ws: WebSocket | null = null;
  private listeners: Record<string, Listener[]> = {};
  private url: string;
  private pendingMessages: string[] = [];
  private manualClose = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private joinedLobby = false;
  private joinedRoomId: string | null = null;

  constructor() {
    const PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${PROTOCOL}//${window.location.host}/ws`;
  }

  isConnected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  getReadyState() {
    return this.ws ? this.ws.readyState : null;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.manualClose = false;

    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.ws = new WebSocket(this.url);
    
    this.ws.onopen = () => {
        console.log('WS Connected');
        this.reconnectAttempts = 0;
        if (this.pendingMessages.length > 0) {
          const messages = this.pendingMessages;
          this.pendingMessages = [];
          messages.forEach(m => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(m);
            }
          });
        }
        if (this.joinedLobby) {
          this.emit('join_lobby', true);
        }
        if (this.joinedRoomId) {
          this.emit('join_room', this.joinedRoomId);
        }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { event: eventName, data } = message;
        if (eventName && this.listeners[eventName]) {
          this.listeners[eventName].forEach(cb => cb(data));
        }
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    this.ws.onclose = () => {
        console.log('WS Closed');
        this.ws = null;
        if (!this.manualClose) {
          const delay = Math.min(3000, 250 * Math.max(1, this.reconnectAttempts));
          this.reconnectAttempts += 1;
          this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, delay);
        }
    };
    
    this.ws.onerror = (err) => {
        console.error('WS Error', err);
    };
  }

  emit(event: string, data: any) {
    const payload = JSON.stringify({ event, data });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      return;
    }
    this.pendingMessages.push(payload);
  }

  joinLobby() {
    this.joinedLobby = true;
    this.connect();
    this.emit('join_lobby', true);
  }

  leaveLobby() {
    this.joinedLobby = false;
    this.emit('leave_lobby', true);
  }

  joinRoom(roomId: string) {
    this.joinedRoomId = roomId;
    this.connect();
    this.emit('join_room', roomId);
  }

  leaveRoom(roomId: string) {
    if (this.joinedRoomId === roomId) this.joinedRoomId = null;
    this.emit('leave_room', roomId);
  }

  on(event: string, cb: Listener) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  off(event: string, cb?: Listener) {
    if (!this.listeners[event]) return;
    if (cb) {
        this.listeners[event] = this.listeners[event].filter(l => l !== cb);
    } else {
        delete this.listeners[event];
    }
  }

  disconnect() {
    if (this.ws) {
      this.manualClose = true;
      this.ws.close();
      this.ws = null;
    }
    this.joinedLobby = false;
    this.joinedRoomId = null;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const socket = new SocketClient();
