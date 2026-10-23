import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import ItemReport from '../src/models/ItemReport.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db.js';
import { buildTestApp, getCsrf, registerVia } from './helpers/app.js';

const app = buildTestApp();

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

async function makeUser(email) {
  const agent = request.agent(app);
  const res = await registerVia(agent, { email, name: email.split('@')[0] });
  const csrf = await getCsrf(agent);
  return { agent, csrf, id: res.body.data.user.id };
}
const post = (u, url, body) => u.agent.post(url).set('X-CSRF-Token', u.csrf).send(body);
const patch = (u, url, body) => u.agent.patch(url).set('X-CSRF-Token', u.csrf).send(body);
const del = (u, url) => u.agent.delete(url).set('X-CSRF-Token', u.csrf);

const lost = (o = {}) => ({
  type: 'LOST', title: 'Black leather wallet', category: 'WALLETS_PURSES',
  description: 'Lost near the central library entrance.', dateOccurred: '2026-10-10',
  location: 'Central library', ...o,
});
const found = (o = {}) => ({
  type: 'FOUND', title: 'Brown wallet', category: 'WALLETS_PURSES',
  description: 'Found on a bench outside the cafeteria.', dateOccurred: '2026-10-11',
  location: 'Cafeteria', privateDetails: 'Student card of a person named Ravi inside',
  verificationQuestions: [{ question: 'Which bank card is inside?', expectedAnswer: 'HDFC' }], ...o,
});

describe('create', () => {
  it('requires authentication', async () => {
    const agent = request.agent(app);
    const csrf = await getCsrf(agent);
    const res = await agent.post('/api/v1/items').set('X-CSRF-Token', csrf).send(lost());
    expect(res.status).toBe(401);
  });

  it('creates a LOST report owned by the caller with ACTIVE status', async () => {
    const u = await makeUser('ravi@example.com');
    const res = await post(u, '/api/v1/items', lost());
    expect(res.status).toBe(201);
    const { item } = res.body.data;
    expect(item).toMatchObject({ type: 'LOST', status: 'ACTIVE', isOwner: true, contactPreference: 'IN_APP' });
    expect((await ItemReport.findById(item.id)).createdBy.toString()).toBe(u.id);
  });

  it('ignores mass-assigned status, createdBy and private fields on LOST reports', async () => {
    const u = await makeUser('ravi@example.com');
    const other = await makeUser('other@example.com');
    const res = await post(u, '/api/v1/items', lost({ status: 'RETURNED', createdBy: other.id, privateDetails: 'x', verificationQuestions: [{ question: 'Anything at all?' }] }));
    expect(res.status).toBe(201);
    const doc = await ItemReport.findById(res.body.data.item.id).lean();
    expect(doc.status).toBe('ACTIVE');
    expect(doc.createdBy.toString()).toBe(u.id);
    expect(doc.privateDetails).toBe('');
    expect(doc.verificationQuestions).toHaveLength(0);
  });

  it('creates a FOUND report with private details and questions', async () => {
    const u = await makeUser('fin@example.com');
    const res = await post(u, '/api/v1/items', found());
    expect(res.status).toBe(201);
    expect(res.body.data.item.verificationQuestions[0].expectedAnswer).toBe('HDFC');
  });

  it.each([
    ['short title', lost({ title: 'ab' })],
    ['bad category', lost({ category: 'SPACESHIPS' })],
    ['future date', lost({ dateOccurred: '2999-01-01' })],
    ['missing location', lost({ location: '' })],
    ['bad type', lost({ type: 'STOLEN' })],
    ['FOUND without questions', found({ verificationQuestions: [] })],
    ['bad time', lost({ approxTime: '25:99' })],
  ])('rejects invalid input: %s', async (_l, body) => {
    const u = await makeUser('ravi@example.com');
    const res = await post(u, '/api/v1/items', body);
    expect(res.status).toBe(400);
  });
});

describe('browse, search, filters, pagination', () => {
  it('never exposes private details or answers publicly, and hides withdrawn/hidden reports', async () => {
    const u = await makeUser('fin@example.com');
    await post(u, '/api/v1/items', found());
    const gone = (await post(u, '/api/v1/items', found({ title: 'Withdrawn one' }))).body.data.item;
    await del(u, `/api/v1/items/${gone.id}`);
    await ItemReport.create({ ...found({ title: 'Hidden one' }), dateOccurred: new Date(), createdBy: u.id, status: 'HIDDEN' });

    const res = await request(app).get('/api/v1/items');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/HDFC|Ravi|privateDetails|verificationQuestions|expectedAnswer/);
  });

  it('sorts newest first and paginates', async () => {
    const u = await makeUser('ravi@example.com');
    for (let i = 1; i <= 5; i++) await post(u, '/api/v1/items', lost({ title: `Item number ${i}` }));
    const p1 = await request(app).get('/api/v1/items?limit=2&page=1');
    expect(p1.body.data.items.map((i) => i.title)).toEqual(['Item number 5', 'Item number 4']);
    expect(p1.body.pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });
    const p3 = await request(app).get('/api/v1/items?limit=2&page=3');
    expect(p3.body.data.items.map((i) => i.title)).toEqual(['Item number 1']);
  });

  it('filters by type, category, location, keyword and date range', async () => {
    const u = await makeUser('ravi@example.com');
    await post(u, '/api/v1/items', lost());
    await post(u, '/api/v1/items', found());
    await post(u, '/api/v1/items', lost({ title: 'Blue water bottle', category: 'OTHER', description: 'Steel bottle with a sticker.', location: 'Sports ground', dateOccurred: '2026-09-01' }));

    const count = async (qs) => (await request(app).get(`/api/v1/items?${qs}`)).body.data.items.length;
    expect(await count('type=FOUND')).toBe(1);
    expect(await count('type=LOST')).toBe(2);
    expect(await count('category=OTHER')).toBe(1);
    expect(await count('location=library')).toBe(1);
    expect(await count('q=bottle')).toBe(1);
    expect(await count('q=wallet')).toBe(2);
    expect(await count('from=2026-10-01&to=2026-10-31')).toBe(2);
    expect(await count('from=2026-10-11')).toBe(1);
    expect(await count('to=2026-10-10')).toBe(2);
  });

  it('treats regex characters in the location filter literally', async () => {
    const u = await makeUser('ravi@example.com');
    await post(u, '/api/v1/items', lost());
    const res = await request(app).get('/api/v1/items?location=.*');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
  });

  it('rejects invalid query parameters', async () => {
    expect((await request(app).get('/api/v1/items?status=HIDDEN')).status).toBe(400);
    expect((await request(app).get('/api/v1/items?limit=1000')).status).toBe(400);
    expect((await request(app).get('/api/v1/items?page=0')).status).toBe(400);
    expect((await request(app).get('/api/v1/items?type=NOPE')).status).toBe(400);
  });
});

describe('details', () => {
  it('shows private fields only to the owner', async () => {
    const owner = await makeUser('fin@example.com');
    const other = await makeUser('other@example.com');
    const { id } = (await post(owner, '/api/v1/items', found())).body.data.item;

    const anon = await request(app).get(`/api/v1/items/${id}`);
    expect(anon.status).toBe(200);
    expect(anon.body.data.item.isOwner).toBe(false);
    expect(JSON.stringify(anon.body)).not.toMatch(/HDFC|Ravi|expectedAnswer|privateDetails/);

    const asOther = await other.agent.get(`/api/v1/items/${id}`);
    expect(JSON.stringify(asOther.body)).not.toMatch(/HDFC|Ravi|expectedAnswer|privateDetails/);

    const asOwner = await owner.agent.get(`/api/v1/items/${id}`);
    expect(asOwner.body.data.item.isOwner).toBe(true);
    expect(asOwner.body.data.item.privateDetails).toMatch(/Ravi/);
  });

  it('returns 404 for unknown or malformed ids and for withdrawn reports (except to the owner)', async () => {
    const owner = await makeUser('fin@example.com');
    expect((await request(app).get('/api/v1/items/not-an-id')).status).toBe(404);
    expect((await request(app).get('/api/v1/items/64b7f0f0f0f0f0f0f0f0f0f0')).status).toBe(404);
    const { id } = (await post(owner, '/api/v1/items', lost())).body.data.item;
    await del(owner, `/api/v1/items/${id}`);
    expect((await request(app).get(`/api/v1/items/${id}`)).status).toBe(404);
    expect((await owner.agent.get(`/api/v1/items/${id}`)).status).toBe(200);
  });
});

describe('edit and withdraw', () => {
  it('lets the owner edit but ignores type and status changes', async () => {
    const owner = await makeUser('ravi@example.com');
    const { id } = (await post(owner, '/api/v1/items', lost())).body.data.item;
    const res = await patch(owner, `/api/v1/items/${id}`, { title: 'Updated wallet title', type: 'FOUND', status: 'RETURNED' });
    expect(res.status).toBe(200);
    expect(res.body.data.item).toMatchObject({ title: 'Updated wallet title', type: 'LOST', status: 'ACTIVE' });
  });

  it('forbids other users and anonymous visitors', async () => {
    const owner = await makeUser('ravi@example.com');
    const other = await makeUser('other@example.com');
    const { id } = (await post(owner, '/api/v1/items', lost())).body.data.item;
    expect((await patch(other, `/api/v1/items/${id}`, { title: 'Hacked title' })).status).toBe(403);
    expect((await del(other, `/api/v1/items/${id}`)).status).toBe(403);
    const anon = request.agent(app);
    const csrf = await getCsrf(anon);
    expect((await anon.patch(`/api/v1/items/${id}`).set('X-CSRF-Token', csrf).send({ title: 'Hacked title' })).status).toBe(401);
    expect((await ItemReport.findById(id)).title).toBe('Black leather wallet');
  });

  it('rejects an empty update and removing all questions from a FOUND report', async () => {
    const owner = await makeUser('fin@example.com');
    const { id } = (await post(owner, '/api/v1/items', found())).body.data.item;
    expect((await patch(owner, `/api/v1/items/${id}`, { status: 'RETURNED' })).status).toBe(400);
    expect((await patch(owner, `/api/v1/items/${id}`, { verificationQuestions: [] })).status).toBe(400);
  });

  it('withdraws (soft delete) once, then refuses further edits and withdrawals', async () => {
    const owner = await makeUser('ravi@example.com');
    const { id } = (await post(owner, '/api/v1/items', lost())).body.data.item;
    const res = await del(owner, `/api/v1/items/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.item.status).toBe('WITHDRAWN');
    expect(await ItemReport.countDocuments({ _id: id })).toBe(1);
    expect((await del(owner, `/api/v1/items/${id}`)).status).toBe(409);
    expect((await patch(owner, `/api/v1/items/${id}`, { title: 'Too late now' })).status).toBe(409);
  });
});

describe('my reports', () => {
  it('lists only my reports (including withdrawn) and is not shadowed by /:id', async () => {
    const a = await makeUser('a@example.com');
    const b = await makeUser('b@example.com');
    await post(a, '/api/v1/items', lost());
    const gone = (await post(a, '/api/v1/items', lost({ title: 'Withdrawn mine' }))).body.data.item;
    await del(a, `/api/v1/items/${gone.id}`);
    await post(b, '/api/v1/items', lost({ title: 'Belongs to B' }));

    const res = await a.agent.get('/api/v1/items/mine');
    expect(res.status).toBe(200);
    expect(res.body.data.items.map((i) => i.title).sort()).toEqual(['Black leather wallet', 'Withdrawn mine']);
    const onlyWithdrawn = await a.agent.get('/api/v1/items/mine?status=WITHDRAWN');
    expect(onlyWithdrawn.body.data.items).toHaveLength(1);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/v1/items/mine')).status).toBe(401);
  });
});
