import { Room, Player, RoomStatus } from '../models/types.js';
import { v4 as uuidv4 } from 'uuid';

class RoomService {
  private rooms: Map<string, Room> = new Map();

  createRoom(hostName: string, roomName: string, playerId?: string): Room {
    const roomId = uuidv4();
    const hostPlayer: Player = {
      id: playerId || uuidv4(), // Reuse existing ID if provided
      name: hostName,
      roomId: roomId,
      isOnline: true,
      joinedAt: Date.now(),
      handCards: [],
      score: 0
    };

    const newRoom: Room = {
      id: roomId,
      name: roomName,
      status: RoomStatus.WAITING,
      hostId: hostPlayer.id,
      maxPlayers: 4,
      players: [hostPlayer],
      createdAt: Date.now()
    };

    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  joinRoom(roomId: string, playerName: string, playerId?: string): { player: Player; room: Room } {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('房间未找到');
    
    // Check if player is re-joining
    if (playerId) {
        const existingPlayer = room.players.find(p => p.id === playerId);
        if (existingPlayer) {
            existingPlayer.isOnline = true; // Mark online
            // Update name if changed
            existingPlayer.name = playerName; 
            return { player: existingPlayer, room };
        }
    }

    if (room.players.length >= room.maxPlayers) throw new Error('房间已满');
    if (room.status !== RoomStatus.WAITING) throw new Error('游戏已开始');

    const newPlayer: Player = {
      id: uuidv4(),
      name: playerName,
      roomId: roomId,
      isOnline: true,
      joinedAt: Date.now(),
      handCards: [],
      score: 0
    };

    room.players.push(newPlayer);
    return { player: newPlayer, room };
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  removePlayer(roomId: string, playerId: string): { roomDeleted: boolean, newHostId?: string } {
      const room = this.rooms.get(roomId);
      if (room) {
          const wasHost = room.hostId === playerId;
          room.players = room.players.filter(p => p.id !== playerId);
          
          if (room.players.length === 0) {
              this.rooms.delete(roomId);
              return { roomDeleted: true };
          } else if (wasHost) {
              // Assign new host to the next player
              room.hostId = room.players[0].id;
              return { roomDeleted: false, newHostId: room.hostId };
          }
      }
      return { roomDeleted: false };
  }

  closeRoom(roomId: string, hostId: string): void {
      const room = this.rooms.get(roomId);
      if (!room) throw new Error('房间未找到');
      if (room.hostId !== hostId) throw new Error('只有房主可以解散房间');
      
      this.rooms.delete(roomId);
      // Notify via Socket (This needs to be handled in the route/controller layer, or here if we import io)
      // Since roomService is decoupled from io in this structure, we rely on the route handler or io.to emit
      // However, io is in server.ts. Let's fix this in route.
  }
}

export const roomService = new RoomService();
