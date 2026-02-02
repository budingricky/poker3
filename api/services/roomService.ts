import { Room, Player, RoomStatus } from '../models/types.js';
import { v4 as uuidv4 } from 'uuid';

class RoomService {
  private rooms: Map<string, Room> = new Map();

  createRoom(hostName: string, roomName: string): Room {
    const roomId = uuidv4();
    const hostPlayer: Player = {
      id: uuidv4(),
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

  joinRoom(roomId: string, playerName: string): { player: Player; room: Room } {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');
    if (room.players.length >= room.maxPlayers) throw new Error('Room is full');
    if (room.status !== RoomStatus.WAITING) throw new Error('Game already started');

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

  removePlayer(roomId: string, playerId: string): void {
      const room = this.rooms.get(roomId);
      if (room) {
          room.players = room.players.filter(p => p.id !== playerId);
          if (room.players.length === 0) {
              this.rooms.delete(roomId);
          }
      }
  }
}

export const roomService = new RoomService();
