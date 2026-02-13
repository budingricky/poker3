/**
 * local server entry file, for local development
 */
import app from './app.js';
import { createServer } from 'http';
import { socketService } from './services/socketService.js';
import { startUdpDiscovery, type UdpDiscoveryHandle } from './udpDiscovery.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const httpServer = createServer(app);
let udpDiscovery: UdpDiscoveryHandle | null = null;

// Initialize WebSocket Server
socketService.init(httpServer);

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server ready on port ${PORT}`);
  const addr = httpServer.address();
  const httpPort =
    typeof addr === 'object' && addr && typeof addr.port === 'number' ? addr.port : Number(PORT);
  udpDiscovery = startUdpDiscovery({ httpPort });
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
