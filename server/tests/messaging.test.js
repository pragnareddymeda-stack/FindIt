import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import Message from '../src/models/Message.js';
import Conversation from '../src/models/Conversation.js';
import User from '../src/models/User.js';
import { createApp } from '../src/app.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db.js';
import { buildTestApp } from './helpers/app.js';
import { makeUserOn, post, claimFlow } from './helpers/flow.js';

const app = buildTestApp();
const makeUser = (email) => makeUserOn(app, email);

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

const send = (u, convId, text) => post(u, `/api/v1/conversations/${convId}/messages`, { text });

describe('opening a conversation for a claim', () => {
  it('is available to the finder and the claimant, and is the same conversation for both', async () => {
    const { finder, claimant, claimId } = await claimFlow(app);
    const a = await finder.agent.get(`/api/v1/claims/${claimId}/conversation`);
    const b = await claimant.agent.get(`/api/v1/claims/${claimId}/conversation`);
    expect(a.status).toBe(200);
    expect(a.body.data.conversation.id).toBe(b.body.data.conversation.id);
    expect(a.body.data.conversation.other.name).toBe('claimant');
    expect(b.body.data.conversation.other.name).toBe('finder');
    expect(await Conversation.countDocuments()).toBe(1);
  });

  it('is hidden from strangers and administrators, and needs a login', async () => {
    const { claimId } = await claimFlow(app);
    const stranger = await makeUser('stranger@example.com');
    const admin = await makeUser('admin@example.com');
    await User.updateOne({ email: 'admin@example.com' }, { role: 'ADMIN' });
    expect((await stranger.agent.get(`/api/v1/claims/${claimId}/conversation`)).status).toBe(404);
    expect((await admin.agent.get(`/api/v1/claims/${claimId}/conversation`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/claims/${claimId}/conversation`)).status).toBe(401);
    expect((await stranger.agent.get('/api/v1/claims/not-an-id/conversation')).status).toBe(404);
  });

  it('survives two simultaneous requests without creating a duplicate', async () => {
    const { finder, claimant, claimId } = await claimFlow(app);
    await Promise.all([
      finder.agent.get(`/api/v1/claims/${claimId}/conversation`),
      claimant.agent.get(`/api/v1/claims/${claimId}/conversation`),
    ]);
    expect(await Conversation.countDocuments()).toBe(1);
  });
});

describe('sending and reading messages', () => {
  it('lets both parties exchange messages in order', async () => {
    const { finder, claimant, conversationId } = await claimFlow(app);
    const id = await conversationId(finder);
    expect((await send(finder, id, 'Hi, can you describe the wallet lining?')).status).toBe(201);
    expect((await send(claimant, id, 'It is red.')).status).toBe(201);
    const res = await claimant.agent.get(`/api/v1/conversations/${id}/messages`);
    expect(res.status).toBe(200);
    expect(res.body.data.messages.map((m) => m.text)).toEqual(['Hi, can you describe the wallet lining?', 'It is red.']);
    expect(res.body.data.messages[0].sender.name).toBe('finder');
    expect(res.body.data.hasMore).toBe(false);
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.com|passwordHash/);
  });

  it('keeps messages private from strangers and administrators', async () => {
    const { finder, conversationId } = await claimFlow(app);
    const id = await conversationId(finder);
    await send(finder, id, 'Private words');
    const stranger = await makeUser('stranger@example.com');
    const admin = await makeUser('admin@example.com');
    await User.updateOne({ email: 'admin@example.com' }, { role: 'ADMIN' });
    for (const u of [stranger, admin]) {
      expect((await u.agent.get(`/api/v1/conversations/${id}/messages`)).status).toBe(404);
      expect((await send(u, id, 'Let me in')).status).toBe(404);
      expect((await u.agent.get('/api/v1/conversations')).body.data.conversations).toHaveLength(0);
    }
    expect(await Message.countDocuments()).toBe(1);
    expect((await request(app).get(`/api/v1/conversations/${id}/messages`)).status).toBe(401);
    expect((await finder.agent.get('/api/v1/conversations/not-an-id/messages')).status).toBe(404);
  });

  it('validates the message text and stores it verbatim for the client to escape', async () => {
    const { finder, conversationId } = await claimFlow(app);
    const id = await conversationId(finder);
    expect((await send(finder, id, '   ')).status).toBe(400);
    expect((await send(finder, id, 'x'.repeat(1001))).status).toBe(400);
    expect((await post(finder, `/api/v1/conversations/${id}/messages`, {})).status).toBe(400);
    const html = '<img src=x onerror=alert(1)>';
    const res = await send(finder, id, `  ${html}  `);
    expect(res.status).toBe(201);
    expect(res.body.data.message.text).toBe(html);
  });

  it('pages through history with a cursor', async () => {
    const { finder, conversationId } = await claimFlow(app);
    const id = await conversationId(finder);
    for (let i = 1; i <= 5; i++) await send(finder, id, `message ${i}`);
    const first = await finder.agent.get(`/api/v1/conversations/${id}/messages?limit=2`);
    expect(first.body.data.messages.map((m) => m.text)).toEqual(['message 4', 'message 5']);
    expect(first.body.data.hasMore).toBe(true);
    const older = await finder.agent.get(`/api/v1/conversations/${id}/messages?limit=2&before=${first.body.data.messages[0].id}`);
    expect(older.body.data.messages.map((m) => m.text)).toEqual(['message 2', 'message 3']);
    expect((await finder.agent.get(`/api/v1/conversations/${id}/messages?before=nope`)).status).toBe(400);
    expect((await finder.agent.get(`/api/v1/conversations/${id}/messages?limit=500`)).status).toBe(400);
  });

  it('closes the conversation for sending once the claim is rejected, but keeps it readable', async () => {
    const { finder, claimant, conversationId, reject } = await claimFlow(app);
    const id = await conversationId(finder);
    await send(finder, id, 'One last message');
    await reject();
    const blocked = await send(claimant, id, 'Please reconsider');
    expect(blocked.status).toBe(409);
    const read = await claimant.agent.get(`/api/v1/conversations/${id}/messages`);
    expect(read.status).toBe(200);
    expect(read.body.data.conversation.canSend).toBe(false);
  });

  it('keeps working after the claim is approved', async () => {
    const { finder, claimant, conversationId, approve } = await claimFlow(app);
    const id = await conversationId(finder);
    await approve();
    expect((await send(claimant, id, 'Thank you!')).status).toBe(201);
  });

  it('rate limits message sending per user', async () => {
    const limited = createApp({ authRateLimitMax: 1000, messageRateLimitMax: 2 });
    const { finder, conversationId } = await claimFlow(limited);
    const id = await conversationId(finder);
    expect((await send(finder, id, 'one')).status).toBe(201);
    expect((await send(finder, id, 'two')).status).toBe(201);
    expect((await send(finder, id, 'three')).status).toBe(429);
  });
});

describe('conversation list and unread counts', () => {
  it('counts unread messages for the recipient only, and opening the chat clears them', async () => {
    const { finder, claimant, conversationId } = await claimFlow(app);
    const id = await conversationId(finder);
    await send(finder, id, 'First');
    await send(finder, id, 'Second');

    const forClaimant = await claimant.agent.get('/api/v1/conversations');
    expect(forClaimant.body.data.unreadTotal).toBe(2);
    expect(forClaimant.body.data.conversations[0]).toMatchObject({ unread: 2, other: { name: 'finder' }, item: { title: 'Brown wallet' } });
    expect(forClaimant.body.data.conversations[0].lastMessage).toMatchObject({ text: 'Second', mine: false });

    const forFinder = await finder.agent.get('/api/v1/conversations');
    expect(forFinder.body.data.conversations[0]).toMatchObject({ unread: 0 });
    expect(forFinder.body.data.conversations[0].lastMessage.mine).toBe(true);

    await claimant.agent.get(`/api/v1/conversations/${id}/messages`);
    expect((await claimant.agent.get('/api/v1/conversations')).body.data.unreadTotal).toBe(0);
  });
});

describe('notifications', () => {
  const list = (u, qs = '') => u.agent.get(`/api/v1/notifications${qs}`);

  it('are created for new claims, decisions, messages and handover updates', async () => {
    const { finder, claimant, claimId, approve, conversationId } = await claimFlow(app);
    const f1 = (await list(finder)).body.data.notifications;
    expect(f1).toHaveLength(1);
    expect(f1[0]).toMatchObject({ type: 'NEW_CLAIM', read: false, link: `/claims/${claimId}` });

    await approve();
    const c1 = (await list(claimant)).body.data.notifications;
    expect(c1[0]).toMatchObject({ type: 'CLAIM_APPROVED', link: `/claims/${claimId}` });
    expect(c1[0].body).toMatch(/Answers match/);

    const handoverId = (await post(finder, `/api/v1/claims/${claimId}/handover`)).body.data.handover.id;
    expect((await list(claimant)).body.data.notifications[0]).toMatchObject({ type: 'HANDOVER_UPDATE', title: 'Handover started' });

    const convId = await conversationId(finder);
    await send(finder, convId, 'See you at the library gate');
    expect((await list(claimant)).body.data.notifications[0]).toMatchObject({ type: 'NEW_MESSAGE', link: `/conversations/${convId}` });

    const dispute = await claimant.agent.patch(`/api/v1/handovers/${handoverId}/status`).set('X-CSRF-Token', claimant.csrf).send({ status: 'DISPUTED', reason: 'The finder never replied to me.' });
    expect(dispute.status).toBe(200);
    expect((await list(finder)).body.data.notifications[0]).toMatchObject({ type: 'DISPUTE_UPDATE' });
  });

  it('notifies the claimant when a claim is rejected', async () => {
    const { claimant, reject } = await claimFlow(app);
    await reject();
    expect((await list(claimant)).body.data.notifications[0]).toMatchObject({ type: 'CLAIM_REJECTED' });
  });

  it('merges repeated messages into one unread notification per conversation', async () => {
    const { finder, claimant, conversationId } = await claimFlow(app);
    const id = await conversationId(finder);
    await send(finder, id, 'Message one');
    await send(finder, id, 'Message two');
    const res = await list(claimant);
    const msgs = res.body.data.notifications.filter((n) => n.type === 'NEW_MESSAGE');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].body).toMatch(/Message two/);
    // Opening the conversation marks that notification as read.
    await claimant.agent.get(`/api/v1/conversations/${id}/messages`);
    const after = (await list(claimant)).body.data.notifications.find((n) => n.type === 'NEW_MESSAGE');
    expect(after.read).toBe(true);
    // A later message starts a fresh unread one.
    await send(finder, id, 'Message three');
    expect((await list(claimant)).body.data.notifications.filter((n) => n.type === 'NEW_MESSAGE' && !n.read)).toHaveLength(1);
  });

  it('can be marked read one at a time or all at once, and only by their owner', async () => {
    const { finder, claimant, claimId, approve } = await claimFlow(app);
    await approve();
    await post(finder, `/api/v1/claims/${claimId}/handover`);
    const mine = (await list(claimant)).body.data;
    expect(mine.unreadCount).toBe(2);

    const stranger = await makeUser('stranger@example.com');
    const target = mine.notifications[0].id;
    expect((await stranger.agent.patch(`/api/v1/notifications/${target}/read`).set('X-CSRF-Token', stranger.csrf)).status).toBe(404);
    expect((await list(claimant)).body.data.unreadCount).toBe(2);

    const one = await claimant.agent.patch(`/api/v1/notifications/${target}/read`).set('X-CSRF-Token', claimant.csrf);
    expect(one.status).toBe(200);
    expect(one.body.data.notification.read).toBe(true);
    expect((await list(claimant, '?unread=true')).body.data.notifications).toHaveLength(1);

    const finderBefore = (await list(finder)).body.data.unreadCount;
    const all = await claimant.agent.patch('/api/v1/notifications/read-all').set('X-CSRF-Token', claimant.csrf);
    expect(all.body.data.updated).toBe(1);
    expect((await list(claimant)).body.data.unreadCount).toBe(0);
    expect((await list(finder)).body.data.unreadCount).toBe(finderBefore); // other people's are untouched
  });

  it('are private, paginated and need a login', async () => {
    const { finder, claimant } = await claimFlow(app);
    expect((await list(claimant)).body.data.notifications).toHaveLength(0);
    expect((await list(finder, '?limit=1&page=1')).body.pagination).toMatchObject({ limit: 1, total: 1 });
    expect((await request(app).get('/api/v1/notifications')).status).toBe(401);
    expect((await finder.agent.patch('/api/v1/notifications/not-an-id/read').set('X-CSRF-Token', finder.csrf)).status).toBe(404);
    expect((await list(finder, '?unread=maybe')).status).toBe(400);
  });
});
