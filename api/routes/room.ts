import express, { Request, Response } from 'express';
import { roomService } from '../services/roomService.js';
import { gameService } from '../services/gameService.js';
import { socketService } from '../services/socketService.js';

const router = express.Router();

// Get all rooms
router.get('/', (req: Request, res: Response) => {
  try {
    const rooms = roomService.getAllRooms();
    res.json({ success: true, data: rooms });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start Game
router.post('/start', (req: Request, res: Response) => {
  try {
    const { roomId } = req.body;
    if (!roomId) {
        res.status(400).json({ success: false, error: '房间 ID 不能为空' });
        return;
    }

    gameService.startGame(roomId);
    res.json({ success: true, data: { status: 'started' } });
    socketService.broadcastLobby('room_update');
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get Game State (for player)
router.get('/:roomId/game/:playerId', (req: Request, res: Response) => {
    try {
        const { roomId, playerId } = req.params;
        const state = gameService.getGameState(roomId, playerId);
        if (!state) {
             res.status(404).json({ success: false, error: '游戏未找到' });
             return;
        }
        res.json({ success: true, data: state });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create room
router.post('/create', (req: Request, res: Response) => {
  try {
    const { playerName, roomName, playerId } = req.body;
    if (!playerName) {
        res.status(400).json({ success: false, error: '玩家昵称不能为空' });
        return;
    }
    const finalRoomName = roomName || `${playerName}的房间`;
    
    const room = roomService.createRoom(playerName, finalRoomName, playerId);
    const player = room.players[0]; // Host

    res.json({ success: true, data: { room, player } });
    socketService.broadcastLobby('room_update');
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Join room
router.post('/join', (req: Request, res: Response) => {
  try {
    const { roomId, playerName, playerId } = req.body;
    if (!roomId || !playerName) {
        res.status(400).json({ success: false, error: '房间 ID 和玩家昵称不能为空' });
        return;
    }

    const result = roomService.joinRoom(roomId, playerName, playerId);
    socketService.broadcast(roomId, 'room_update');
    socketService.broadcastLobby('room_update');
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Leave room
router.post('/leave', (req: Request, res: Response) => {
  try {
    const { roomId, playerId } = req.body;
    if (!roomId || !playerId) {
        res.status(400).json({ success: false, error: '缺少必要参数' });
        return;
    }
    
    const result = roomService.removePlayer(roomId, playerId);
    if (!result.roomDeleted) {
        socketService.broadcast(roomId, 'room_update');
    }
    socketService.broadcastLobby('room_update');
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Close room
router.post('/close', (req: Request, res: Response) => {
  try {
    const { roomId, playerId } = req.body;
    if (!roomId || !playerId) {
        res.status(400).json({ success: false, error: '缺少必要参数' });
        return;
    }

    roomService.closeRoom(roomId, playerId);
    socketService.broadcast(roomId, 'room_closed'); // Broadcast to all clients in room
    socketService.broadcastLobby('room_update');
    res.json({ success: true, data: { closed: true } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Play Cards
router.post('/play', (req: Request, res: Response) => {
  try {
    const { roomId, playerId, cards } = req.body; // cards is array of codes
    if (!roomId || !playerId || !cards) {
        res.status(400).json({ success: false, error: '缺少必要参数' });
        return;
    }

    gameService.handlePlayCards(roomId, playerId, cards);
    res.json({ success: true, data: { status: 'played' } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Pass
router.post('/pass', (req: Request, res: Response) => {
  try {
    const { roomId, playerId } = req.body;
    if (!roomId || !playerId) {
        res.status(400).json({ success: false, error: '缺少必要参数' });
        return;
    }

    gameService.handlePass(roomId, playerId);
    res.json({ success: true, data: { status: 'passed' } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Bid
router.post('/bid', (req: Request, res: Response) => {
  try {
    const { roomId, playerId, score } = req.body;
    if (!roomId || !playerId || score === undefined) {
        res.status(400).json({ success: false, error: '缺少必要参数' });
        return;
    }

    gameService.handleBid(roomId, playerId, Number(score));
    res.json({ success: true, data: { status: 'bid' } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Take Hole Cards (Digger only)
router.post('/take_hole', (req: Request, res: Response) => {
  try {
    const { roomId, playerId } = req.body;
    if (!roomId || !playerId) {
      res.status(400).json({ success: false, error: '缺少必要参数' });
      return;
    }
    gameService.takeHoleCards(roomId, playerId);
    res.json({ success: true, data: { status: 'taken' } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get room details
router.get('/:roomId', (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const room = roomService.getRoom(roomId);
    if (!room) {
        res.status(404).json({ success: false, error: '房间未找到' });
        return;
    }
    res.json({ success: true, data: room });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
