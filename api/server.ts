/**
 * local server entry file, for local development
 */
import app from './app.js';
import { createServer } from 'http';
import { socketService } from './services/socketService.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const httpServer = createServer(app);

// Initialize WebSocket Server
socketService.init(httpServer);

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server ready on port ${PORT}`);
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
