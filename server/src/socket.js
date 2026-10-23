import { Server } from 'socket.io';
import { parse as parseCookie } from 'cookie';
import User from './models/User.js';
import { config } from './config/env.js';
import { setIo } from './realtime.js';
import { verifyToken } from './utils/tokens.js';
import { AUTH_COOKIE } from './utils/cookies.js';
import { ApiError } from './utils/ApiError.js';
import { postMessage, loadConversation, markRead } from './services/messaging.js';
import { socketSendSchema, socketReadSchema } from './validators/messaging.js';

const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 20;

/** Per-socket limit so one connection cannot flood a conversation. */
function allowed(socket) {
  const now = Date.now();
  socket.data.sent = (socket.data.sent || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (socket.data.sent.length >= RATE_MAX) return false;
  socket.data.sent.push(now);
  return true;
}

async function activeUser(socket) {
  const user = await User.findById(socket.data.userId);
  if (!user || user.status !== 'ACTIVE') throw new ApiError(403, 'Account unavailable');
  return user;
}

const errorText = (err) => (err instanceof ApiError ? err.message : 'Something went wrong');

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.clientUrl, credentials: true },
    maxHttpBufferSize: 100_000,
  });

  // Authenticate every connection with the same HTTP-only cookie the REST API uses.
  io.use(async (socket, next) => {
    try {
      const origin = socket.handshake.headers.origin;
      // WebSockets are not covered by CORS, so check the Origin ourselves (cross-site WebSocket hijacking).
      if (origin && origin !== config.clientUrl) return next(new Error('Origin not allowed'));

      const token = parseCookie(socket.handshake.headers.cookie || '')[AUTH_COOKIE];
      if (!token) return next(new Error('Authentication required'));
      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        return next(new Error('Authentication required'));
      }
      const user = await User.findById(payload.sub).select('status');
      if (!user || user.status !== 'ACTIVE') return next(new Error('Authentication required'));
      socket.data.userId = String(user._id);
      return next();
    } catch {
      return next(new Error('Authentication required'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`); // personal room: notifications and new messages

    socket.on('message:send', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        if (!allowed(socket)) return reply({ ok: false, error: 'You are sending messages too quickly' });
        const parsed = socketSendSchema.safeParse(payload);
        if (!parsed.success) return reply({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid message' });
        const user = await activeUser(socket);
        const message = await postMessage({ conversationId: parsed.data.conversationId, user, text: parsed.data.text });
        return reply({ ok: true, message });
      } catch (err) {
        return reply({ ok: false, error: errorText(err) });
      }
    });

    socket.on('conversation:read', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const parsed = socketReadSchema.safeParse(payload);
        if (!parsed.success) return reply({ ok: false, error: 'Invalid request' });
        const user = await activeUser(socket);
        const { conv, role } = await loadConversation(parsed.data.conversationId, user); // membership check
        await markRead(conv, role);
        return reply({ ok: true });
      } catch (err) {
        return reply({ ok: false, error: errorText(err) });
      }
    });
  });

  setIo(io);
  return io;
}
