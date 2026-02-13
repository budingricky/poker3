import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { roomService } from './roomService.js';

export interface ExtendedWebSocket extends WebSocket {
    roomId?: string;
    inLobby?: boolean;
    playerId?: string;
    isAlive: boolean;
}

class SocketService {
    private wss: WebSocketServer | null = null;
    private roomClients: Map<string, Set<ExtendedWebSocket>> = new Map();
    private lobbyClients: Set<ExtendedWebSocket> = new Set();
    private onPlayerOffline: ((roomId: string, playerId: string) => void) | null = null;

    private broadcastExcept(roomId: string, except: ExtendedWebSocket, event: string, data?: any) {
        const clients = this.roomClients.get(roomId);
        if (!clients) return;
        const message = JSON.stringify({ event, data });
        clients.forEach(client => {
            if (client === except) return;
            if (client.readyState === WebSocket.OPEN) client.send(message);
        });
    }

    private sendToPlayer(roomId: string, toPlayerId: string, event: string, data?: any) {
        const clients = this.roomClients.get(roomId);
        if (!clients) return;
        const message = JSON.stringify({ event, data });
        clients.forEach(client => {
            if (client.playerId !== toPlayerId) return;
            if (client.readyState === WebSocket.OPEN) client.send(message);
        });
    }

    setOnPlayerOffline(handler: ((roomId: string, playerId: string) => void) | null) {
        this.onPlayerOffline = handler;
    }

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
                        const roomId = typeof data === 'string' ? data : data?.roomId;
                        const playerId = typeof data === 'object' ? data?.playerId : undefined;
                        if (!roomId) return;
                        ws.roomId = roomId;
                        ws.playerId = typeof playerId === 'string' ? playerId : undefined;
                        if (!this.roomClients.has(roomId)) {
                            this.roomClients.set(roomId, new Set());
                        }
                        this.roomClients.get(roomId)!.add(ws);
                        console.log(`User joined room ${roomId}`);
                        const room = roomService.getRoom(roomId);
                        if (room && ws.playerId) {
                            const p = room.players.find(x => x.id === ws.playerId);
                            if (p) {
                                p.isOnline = true;
                                this.broadcast(roomId, 'room_update');
                            }
                        }
                    }
                    if (event === 'leave_room') {
                        const roomId = typeof data === 'string' ? data : data?.roomId;
                        if (roomId && this.roomClients.has(roomId)) {
                            this.roomClients.get(roomId)!.delete(ws);
                            if (this.roomClients.get(roomId)!.size === 0) {
                                this.roomClients.delete(roomId);
                            }
                        }
                        if (ws.roomId === roomId) ws.roomId = undefined;
                        ws.playerId = undefined;
                    }
                    if (event === 'join_lobby') {
                        ws.inLobby = true;
                        this.lobbyClients.add(ws);
                    }
                    if (event === 'leave_lobby') {
                        ws.inLobby = false;
                        this.lobbyClients.delete(ws);
                    }
                    if (event === 'voice_join') {
                        if (!ws.roomId || !ws.playerId) return;
                        this.broadcastExcept(ws.roomId, ws, 'voice_join', { fromPlayerId: ws.playerId });
                    }
                    if (event === 'voice_leave') {
                        if (!ws.roomId || !ws.playerId) return;
                        this.broadcastExcept(ws.roomId, ws, 'voice_leave', { fromPlayerId: ws.playerId });
                    }
                    if (event === 'webrtc_signal') {
                        if (!ws.roomId || !ws.playerId) return;
                        const toPlayerId = data?.toPlayerId;
                        if (typeof toPlayerId === 'string' && toPlayerId) {
                            this.sendToPlayer(ws.roomId, toPlayerId, 'webrtc_signal', { ...data, fromPlayerId: ws.playerId });
                        } else {
                            this.broadcastExcept(ws.roomId, ws, 'webrtc_signal', { ...data, fromPlayerId: ws.playerId });
                        }
                    }
                } catch (e) {
                    console.error('WS message error', e);
                }
            });

            ws.on('close', () => {
                const roomId = ws.roomId;
                const playerId = ws.playerId;
                if (ws.roomId && this.roomClients.has(ws.roomId)) {
                    this.roomClients.get(ws.roomId)!.delete(ws);
                    if (this.roomClients.get(ws.roomId)!.size === 0) {
                        this.roomClients.delete(ws.roomId);
                    }
                }
                if (ws.inLobby) {
                    this.lobbyClients.delete(ws);
                }
                if (roomId && playerId) {
                    const room = roomService.getRoom(roomId);
                    if (room) {
                        const p = room.players.find(x => x.id === playerId);
                        if (p) {
                            p.isOnline = false;
                            this.broadcast(roomId, 'room_update');
                        }
                    }
                    this.broadcastExcept(roomId, ws, 'voice_leave', { fromPlayerId: playerId });
                    try {
                        this.onPlayerOffline?.(roomId, playerId);
                    } catch {
                    }
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
