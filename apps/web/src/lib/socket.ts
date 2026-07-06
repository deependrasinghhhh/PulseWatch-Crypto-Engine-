import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('access_token');
    socket = io(window.location.origin, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    // Update token in case it changed
    const token = localStorage.getItem('access_token');
    s.auth = { token };
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function subscribeToSymbol(symbol: string) {
  const s = getSocket();
  if (s.connected) {
    s.emit('subscribe:symbol', { symbol: symbol.toUpperCase() });
  }
}

export function unsubscribeFromSymbol(symbol: string) {
  const s = getSocket();
  if (s.connected) {
    s.emit('unsubscribe:symbol', { symbol: symbol.toUpperCase() });
  }
}
