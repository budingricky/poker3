/**
 * local server entry file, for local development
 */
import app from './app.js';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import fs from 'fs';
import { socketService } from './services/socketService.js';
import { gameService } from './services/gameService.js';
import { roomService } from './services/roomService.js';
import { RoomStatus } from './models/types.js';
import { startUdpDiscovery, type UdpDiscoveryHandle } from './udpDiscovery.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || ''
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || ''
const USE_HTTPS = !!(SSL_CERT_PATH && SSL_KEY_PATH)

const httpServer = USE_HTTPS
  ? createHttpsServer(
      {
        cert: fs.readFileSync(SSL_CERT_PATH),
        key: fs.readFileSync(SSL_KEY_PATH),
      },
      app,
    )
  : createHttpServer(app);
let udpDiscovery: UdpDiscoveryHandle | null = null;

// Initialize WebSocket Server
socketService.init(httpServer);
socketService.setOnPlayerOffline((roomId, _playerId) => {
  const room = roomService.getRoom(roomId);
  if (!room) return;
  if (room.status !== RoomStatus.FINISHED) return;
  gameService.resetRoomToWaiting(roomId);
  socketService.broadcast(roomId, 'room_update');
  socketService.broadcastLobby('room_update');
});

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server ready on port ${PORT}`);
  const addr = httpServer.address();
  const httpPort =
    typeof addr === 'object' && addr && typeof addr.port === 'number' ? addr.port : Number(PORT);
  udpDiscovery = startUdpDiscovery({ httpPort, protocol: USE_HTTPS ? 'https' : 'http' });
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  try {
    udpDiscovery?.close();
  } catch {
  }
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  try {
    udpDiscovery?.close();
  } catch {
  }
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
