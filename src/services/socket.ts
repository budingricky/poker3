import { io } from 'socket.io-client';

// In development, we need to point to the backend port.
// In production, if served from the same origin, it can be undefined or relative.
const URL = 'http://localhost:3001';

export const socket = io(URL, {
  autoConnect: false
});
