import { io } from 'socket.io-client';

let socket = null;
let currentToken = null;

export function connectSocket(token) {
  if (socket && currentToken === token && socket.connected) return socket;
  if (socket) {
    try { socket.removeAllListeners(); socket.disconnect(); } catch {}
    socket = null;
  }
  currentToken = token;
  socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
    randomizationFactor: 0.4,
    timeout: 12000,
    transports: ['websocket', 'polling'],
  });
  return socket;
}

export function getSocket() { return socket; }

export function disconnectSocket() {
  try { socket?.removeAllListeners(); socket?.disconnect(); } catch {}
  socket = null;
  currentToken = null;
}
