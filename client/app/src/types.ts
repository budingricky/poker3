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

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // 人民币分
  currency: 'CNY';
  type: 'coin' | 'avatar' | 'theme' | 'vip';
  icon: string;
}

export interface PurchaseRequest {
  productId: string;
  paymentMethod: 'wechat' | 'alipay';
  redirectUrl?: string;
}

export interface PurchaseResult {
  orderId: string;
  paymentUrl: string;
  qrCodeUrl?: string;
  status: 'pending' | 'paid' | 'failed';
}
