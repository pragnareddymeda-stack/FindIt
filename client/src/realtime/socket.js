import { io } from 'socket.io-client';

// Same origin by default (the Vite dev server proxies /socket.io to Express). When the API is on another
// origin, set VITE_SOCKET_URL at build time. The HTTP-only auth cookie is what authenticates the socket.
export function createSocket() {
  return io(import.meta.env.VITE_SOCKET_URL || undefined, { withCredentials: true });
}
