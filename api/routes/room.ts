import express, { Request, Response } from 'express';
import { roomService } from '../services/roomService.js';
import { gameService } from '../services/gameService.js';

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
        res.status(400).json({ success: false, error: 'Room ID is required' });
        return;
    }

    const gameState = gameService.startGame(roomId);
    res.json({ success: true, data: { status: 'started' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Game State (for player)
router.get('/:roomId/game/:playerId', (req: Request, res: Response) => {
    try {
        const { roomId, playerId } = req.params;
        const state = gameService.getGameState(roomId, playerId);
        if (!state) {
             res.status(404).json({ success: false, error: 'Game not found' });
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
    const { playerName, roomName } = req.body;
    if (!playerName) {
        res.status(400).json({ success: false, error: 'Player name is required' });
        return;
    }
    const finalRoomName = roomName || `${playerName}'s Room`;
    
    const room = roomService.createRoom(playerName, finalRoomName);
    const player = room.players[0]; // Host

    res.json({ success: true, data: { room, player } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Join room
router.post('/join', (req: Request, res: Response) => {
  try {
    const { roomId, playerName } = req.body;
    if (!roomId || !playerName) {
        res.status(400).json({ success: false, error: 'Room ID and Player name are required' });
        return;
    }

    const result = roomService.joinRoom(roomId, playerName);
    res.json({ success: true, data: result });
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
        res.status(404).json({ success: false, error: 'Room not found' });
        return;
    }
    res.json({ success: true, data: room });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
