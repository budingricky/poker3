export interface Player {
  id: string;
  name: string;
  roomId: string;
  isOnline: boolean;
  socketId?: string;
  joinedAt: number;
  // Game specific
  handCards: string[];
  score: number;
}

export enum RoomStatus {
  WAITING = 'WAITING',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED'
}

export interface Room {
  id: string;
  name: string;
  status: RoomStatus;
  hostId: string;
  maxPlayers: number;
  players: Player[];
  createdAt: number;
}
