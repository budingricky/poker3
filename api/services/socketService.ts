import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export interface ExtendedWebSocket extends WebSocket {
    roomId?: string;
    inLobby?: boolean;
    isAlive: boolean;
}

class SocketService {
    private wss: WebSocketServer | null = null;
    private roomClients: Map<string, Set<ExtendedWebSocket>> = new Map();
    private lobbyClients: Set<ExtendedWebSocket> = new Set();

    init(server: Server) {
        this.wss = new WebSocketServer({ server, path: '/ws' });
        
        this.wss.on('connection', (ws: ExtendedWebSocket) => {
            ws.isAlive = true;
            ws.inLobby = false;
            ws.on('pong', () => { ws.isAlive = true; });

            console.log('A user connected');

            ws.on('message', (message: string) => {
                try {
                    const parsed = JSON.parse(message);
                    const { event, data } = parsed;
                    
                    if (event === 'join_room') {
                        const roomId = data;
                        ws.roomId = roomId;
                        if (!this.roomClients.has(roomId)) {
                            this.roomClients.set(roomId, new Set());
                        }
                        this.roomClients.get(roomId)!.add(ws);
                        console.log(`User joined room ${roomId}`);
                    }
                    if (event === 'leave_room') {
                        const roomId = data;
                        if (roomId && this.roomClients.has(roomId)) {
                            this.roomClients.get(roomId)!.delete(ws);
                            if (this.roomClients.get(roomId)!.size === 0) {
                                this.roomClients.delete(roomId);
                            }
                        }
                        if (ws.roomId === roomId) ws.roomId = undefined;
                    }
                    if (event === 'join_lobby') {
                        ws.inLobby = true;
                        this.lobbyClients.add(ws);
                    }
                    if (event === 'leave_lobby') {
                        ws.inLobby = false;
                        this.lobbyClients.delete(ws);
                    }
                } catch (e) {
                    console.error('WS message error', e);
                }
            });

            ws.on('close', () => {
                if (ws.roomId && this.roomClients.has(ws.roomId)) {
                    this.roomClients.get(ws.roomId)!.delete(ws);
                    if (this.roomClients.get(ws.roomId)!.size === 0) {
                        this.roomClients.delete(ws.roomId);
                    }
                }
                if (ws.inLobby) {
                    this.lobbyClients.delete(ws);
                }
                console.log('User disconnected');
            });
        });

        // Keep-alive
        const interval = setInterval(() => {
            if (!this.wss) return;
            this.wss.clients.forEach((ws: any) => {
                if (ws.isAlive === false) return ws.terminate();
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);

        this.wss.on('close', () => {
            clearInterval(interval);
        });
    }

    broadcast(roomId: string, event: string, data?: any) {
        const clients = this.roomClients.get(roomId);
        if (clients) {
            const message = JSON.stringify({ event, data });
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }
    }

    broadcastLobby(event: string, data?: any) {
        if (this.lobbyClients.size === 0) return;
        const message = JSON.stringify({ event, data });
        this.lobbyClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

export const socketService = new SocketService();
