import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import { io as connectClient } from 'socket.io-client';
import Message from '../src/models/Message.js';
import User from '../src/models/User.js';
import { initSocket } from '../src/socket.js';
import { setIo } from '../src/realtime.js';
import { signToken } from '../src/utils/tokens.js';
import { AUTH_COOKIE } from '../src/utils/cookies.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db.js';
import { buildTestApp } from './helpers/app.js';
import { makeUserOn, claimFlow } from './helpers/flow.js';

const app = buildTestApp();
let httpServer;
let ioServer;
let url;
const open = [];

beforeAll(async () => {
  await startTestDb();
  httpServer = http.createServer(app);
  ioServer = initSocket(httpServer);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  url = `http://localhost:${httpServer.address().port}`;
});
afterAll(async () => {
  open.forEach((s) => s.close());
  await new Promise((resolve) => ioServer.close(resolve));
  setIo(null);
  await stopTestDb();
});
beforeEach(clearTestDb);

const connect = (userId, { cookie, origin = 'http://localhost:5173' } = {}) =>
  new Promise((resolve, reject) => {
    const headers = { Origin: origin };
    const value = cookie ?? (userId ? `${AUTH_COOKIE}=${signToken(userId)}` : null);
    if (value) headers.Cookie = value;
    const socket = connectClient(url, { transports: ['websocket'], extraHeaders: headers, reconnection: false });
    open.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (err) => reject(err));
  });

const next = (socket, event, ms = 4000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), ms);
    socket.once(event, (payload) => { clearTimeout(timer); resolve(payload); });
  });

const emitAck = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

describe('socket authentication', () => {
  it('rejects a connection without a session cookie', async () => {
    await expect(connect(null)).rejects.toThrow(/authentication required/i);
  });

  it('rejects an invalid token', async () => {
    await expect(connect(null, { cookie: `${AUTH_COOKIE}=garbage` })).rejects.toThrow(/authentication required/i);
  });

  it('rejects a connection from another origin even with a valid cookie', async () => {
    const user = await makeUserOn(app, 'a@example.com');
    await expect(connect(user.id, { origin: 'http://evil.example' })).rejects.toThrow(/origin not allowed/i);
  });

  it('rejects suspended accounts', async () => {
    const user = await makeUserOn(app, 'a@example.com');
    await User.updateOne({ email: 'a@example.com' }, { status: 'SUSPENDED' });
    await expect(connect(user.id)).rejects.toThrow(/authentication required/i);
  });

  it('accepts a valid session', async () => {
    const user = await makeUserOn(app, 'a@example.com');
    const socket = await connect(user.id);
    expect(socket.connected).toBe(true);
  });
});

describe('real-time messaging', () => {
  it('delivers a sent message and a notification to the other party only', async () => {
    const { finder, claimant, conversationId } = await claimFlow(app);
    const convId = await conversationId(finder);
    const stranger = await makeUserOn(app, 'stranger@example.com');
    const finderSocket = await connect(finder.id);
    const claimantSocket = await connect(claimant.id);
    const strangerSocket = await connect(stranger.id);

    let strangerHeard = false;
    strangerSocket.on('message:new', () => { strangerHeard = true; });
    strangerSocket.on('notification:new', () => { strangerHeard = true; });

    const gotMessage = next(claimantSocket, 'message:new');
    const gotNotification = next(claimantSocket, 'notification:new');
    const ack = await emitAck(finderSocket, 'message:send', { conversationId: convId, text: 'Hello over the socket' });
    expect(ack.ok).toBe(true);

    expect(await gotMessage).toMatchObject({ conversationId: convId, text: 'Hello over the socket', sender: { name: 'finder' } });
    expect(await gotNotification).toMatchObject({ type: 'NEW_MESSAGE', read: false });
    expect(await Message.countDocuments()).toBe(1);
    await new Promise((r) => setTimeout(r, 150));
    expect(strangerHeard).toBe(false);
  });

  it('also pushes REST-sent messages to the recipient', async () => {
    const { finder, claimant, conversationId } = await claimFlow(app);
    const convId = await conversationId(finder);
    const claimantSocket = await connect(claimant.id);
    const heard = next(claimantSocket, 'message:new');
    const res = await finder.agent.post(`/api/v1/conversations/${convId}/messages`).set('X-CSRF-Token', finder.csrf).send({ text: 'Sent over REST' });
    expect(res.status).toBe(201);
    expect((await heard).text).toBe('Sent over REST');
  });

  it('refuses to send into a conversation the user is not part of', async () => {
    const { finder, conversationId } = await claimFlow(app);
    const convId = await conversationId(finder);
    const stranger = await makeUserOn(app, 'stranger@example.com');
    const socket = await connect(stranger.id);
    const ack = await emitAck(socket, 'message:send', { conversationId: convId, text: 'Let me in' });
    expect(ack).toEqual({ ok: false, error: 'Conversation not found' });
    expect(await Message.countDocuments()).toBe(0);
  });

  it('validates event payloads', async () => {
    const { finder, conversationId } = await claimFlow(app);
    const convId = await conversationId(finder);
    const socket = await connect(finder.id);
    expect((await emitAck(socket, 'message:send', { conversationId: 'nope', text: 'hi' })).ok).toBe(false);
    expect((await emitAck(socket, 'message:send', { conversationId: convId, text: '   ' })).ok).toBe(false);
    expect((await emitAck(socket, 'message:send', { conversationId: convId, text: 'x'.repeat(1001) })).ok).toBe(false);
    expect((await emitAck(socket, 'message:send', null)).ok).toBe(false);
    expect((await emitAck(socket, 'message:send', 'just a string')).ok).toBe(false);
    expect((await emitAck(socket, 'conversation:read', {})).ok).toBe(false);
    expect(await Message.countDocuments()).toBe(0);
  });

  it('marks a conversation read for members only', async () => {
    const { finder, claimant, conversationId } = await claimFlow(app);
    const convId = await conversationId(finder);
    await finder.agent.post(`/api/v1/conversations/${convId}/messages`).set('X-CSRF-Token', finder.csrf).send({ text: 'Ping' });
    const stranger = await makeUserOn(app, 'stranger@example.com');
    const claimantSocket = await connect(claimant.id);
    const strangerSocket = await connect(stranger.id);

    expect((await emitAck(strangerSocket, 'conversation:read', { conversationId: convId })).ok).toBe(false);
    expect((await claimant.agent.get('/api/v1/conversations')).body.data.unreadTotal).toBe(1);
    expect((await emitAck(claimantSocket, 'conversation:read', { conversationId: convId })).ok).toBe(true);
    expect((await claimant.agent.get('/api/v1/conversations')).body.data.unreadTotal).toBe(0);
  });

  it('does not deliver to a closed conversation', async () => {
    const { finder, claimant, conversationId, reject } = await claimFlow(app);
    const convId = await conversationId(finder);
    await reject();
    const socket = await connect(claimant.id);
    const ack = await emitAck(socket, 'message:send', { conversationId: convId, text: 'Please reconsider' });
    expect(ack.ok).toBe(false);
    expect(ack.error).toMatch(/closed/i);
  });
});
