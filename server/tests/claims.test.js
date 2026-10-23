import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import ItemReport from '../src/models/ItemReport.js';
import Claim from '../src/models/Claim.js';
import User from '../src/models/User.js';
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

const foundBody = (o = {}) => ({
  type: 'FOUND', title: 'Brown wallet', category: 'WALLETS_PURSES',
  description: 'Found on a bench outside the cafeteria.', dateOccurred: '2026-10-11', location: 'Cafeteria',
  privateDetails: 'Student card of Ravi inside',
  verificationQuestions: [
    { question: 'Which bank card is inside?', expectedAnswer: 'HDFC' },
    { question: 'What is the wallet lining colour?', expectedAnswer: 'Red' },
  ], ...o,
});
const lostBody = (o = {}) => ({
  type: 'LOST', title: 'Brown wallet', category: 'WALLETS_PURSES',
  description: 'Lost near the cafeteria yesterday evening.', dateOccurred: '2026-10-10', location: 'Cafeteria', ...o,
});

async function setup() {
  const finder = await makeUser('finder@example.com');
  const claimant = await makeUser('claimant@example.com');
  const created = (await post(finder, '/api/v1/items', foundBody())).body.data.item;
  const asOwner = (await finder.agent.get(`/api/v1/items/${created.id}`)).body.data.item;
  const questionIds = asOwner.verificationQuestions.map((q) => q.id);
  const claimBody = (o = {}) => ({
    explanation: 'It is my wallet, I lost it on Friday evening.',
    answers: [{ questionId: questionIds[0], answer: 'hdfc debit' }, { questionId: questionIds[1], answer: 'red' }],
    evidence: 'I can show a photo of the wallet on my phone.', ...o,
  });
  return { finder, claimant, itemId: created.id, questionIds, claimBody };
}

describe('claim questions on the item page', () => {
  it('shows question texts (never answers) only to signed-in non-owners', async () => {
    const { claimant, itemId } = await setup();
    const anon = await request(app).get(`/api/v1/items/${itemId}`);
    expect(anon.body.data.item.claimQuestions).toBeUndefined();
    const res = await claimant.agent.get(`/api/v1/items/${itemId}`);
    expect(res.body.data.item.claimQuestions).toHaveLength(2);
    expect(res.body.data.item.myActiveClaim).toBeNull();
    expect(JSON.stringify(res.body)).not.toMatch(/HDFC|Red\b|expectedAnswer|privateDetails|Ravi/);
  });
});

describe('submitting a claim', () => {
  it('requires authentication', async () => {
    const { itemId, claimBody } = await setup();
    const anon = request.agent(app);
    const csrf = await getCsrf(anon);
    const res = await anon.post(`/api/v1/items/${itemId}/claims`).set('X-CSRF-Token', csrf).send(claimBody());
    expect(res.status).toBe(401);
  });

  it('creates a PENDING claim and never reveals expected answers', async () => {
    const { claimant, itemId, claimBody } = await setup();
    const res = await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody());
    expect(res.status).toBe(201);
    expect(res.body.data.claim.status).toBe('PENDING');
    expect(JSON.stringify(res.body)).not.toMatch(/HDFC|expectedAnswer/);
    const mine = await claimant.agent.get(`/api/v1/items/${itemId}`);
    expect(mine.body.data.item.myActiveClaim.status).toBe('PENDING');
  });

  it('rejects claiming your own report', async () => {
    const { finder, itemId, claimBody } = await setup();
    expect((await post(finder, `/api/v1/items/${itemId}/claims`, claimBody())).status).toBe(403);
  });

  it('rejects a duplicate active claim by the same user', async () => {
    const { claimant, itemId, claimBody } = await setup();
    expect((await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody())).status).toBe(201);
    expect((await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody())).status).toBe(409);
    expect(await Claim.countDocuments()).toBe(1);
  });

  it('rejects claims on LOST reports, returned/closed items and withdrawn items', async () => {
    const { finder, claimant, itemId, claimBody } = await setup();
    const lostItem = (await post(finder, '/api/v1/items', lostBody())).body.data.item;
    expect((await post(claimant, `/api/v1/items/${lostItem.id}/claims`, claimBody())).status).toBe(400);

    await ItemReport.updateOne({ _id: itemId }, { status: 'RETURNED' });
    expect((await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody())).status).toBe(409);
    await ItemReport.updateOne({ _id: itemId }, { status: 'CLOSED' });
    expect((await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody())).status).toBe(409);
    await ItemReport.updateOne({ _id: itemId }, { status: 'WITHDRAWN' });
    expect((await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody())).status).toBe(404);
  });

  it.each([
    ['missing explanation', (b) => ({ ...b, explanation: 'short' })],
    ['no answers', (b) => ({ ...b, answers: [] })],
    ['one question unanswered', (b) => ({ ...b, answers: [b.answers[0]] })],
    ['unknown question id', (b) => ({ ...b, answers: [b.answers[0], { questionId: '64b7f0f0f0f0f0f0f0f0f0f0', answer: 'x' }] })],
    ['same question twice', (b) => ({ ...b, answers: [b.answers[0], b.answers[0]] })],
    ['blank answer', (b) => ({ ...b, answers: [b.answers[0], { ...b.answers[1], answer: '  ' }] })],
  ])('rejects invalid input: %s', async (_l, mutate) => {
    const { claimant, itemId, claimBody } = await setup();
    const res = await post(claimant, `/api/v1/items/${itemId}/claims`, mutate(claimBody()));
    expect(res.status).toBe(400);
    expect(await Claim.countDocuments()).toBe(0);
  });
});

describe('who can see claims and private data', () => {
  it('finder sees claimant answers with their own expected answers; claimant and strangers do not', async () => {
    const { finder, claimant, itemId, claimBody } = await setup();
    const stranger = await makeUser('stranger@example.com');
    const claimId = (await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody())).body.data.claim.id;

    const list = await finder.agent.get(`/api/v1/items/${itemId}/claims`);
    expect(list.status).toBe(200);
    expect(list.body.data.claims).toHaveLength(1);
    expect(list.body.data.claims[0].answers[0]).toMatchObject({ answer: 'hdfc debit', expectedAnswer: 'HDFC' });
    expect(list.body.data.claims[0].claimant.name).toBe('claimant');
    expect(JSON.stringify(list.body)).not.toMatch(/claimant@example\.com/);

    expect((await claimant.agent.get(`/api/v1/items/${itemId}/claims`)).status).toBe(403);
    expect((await stranger.agent.get(`/api/v1/items/${itemId}/claims`)).status).toBe(403);

    const asFinder = await finder.agent.get(`/api/v1/claims/${claimId}`);
    expect(asFinder.body.data.viewAs).toBe('FINDER');
    expect(asFinder.body.data.claim.answers[0].expectedAnswer).toBe('HDFC');

    const asClaimant = await claimant.agent.get(`/api/v1/claims/${claimId}`);
    expect(asClaimant.body.data.viewAs).toBe('CLAIMANT');
    expect(JSON.stringify(asClaimant.body)).not.toMatch(/HDFC|expectedAnswer/);

    expect((await stranger.agent.get(`/api/v1/claims/${claimId}`)).status).toBe(404);
    expect((await request(app).get(`/api/v1/claims/${claimId}`)).status).toBe(401);
  });

  it('lists my claims and incoming claims separately', async () => {
    const { finder, claimant, itemId, claimBody } = await setup();
    await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody());
    const mine = await claimant.agent.get('/api/v1/claims/me');
    expect(mine.body.data.claims).toHaveLength(1);
    expect(mine.body.data.claims[0].item.title).toBe('Brown wallet');
    expect((await finder.agent.get('/api/v1/claims/me')).body.data.claims).toHaveLength(0);
    const incoming = await finder.agent.get('/api/v1/claims/incoming?status=PENDING');
    expect(incoming.body.data.claims).toHaveLength(1);
    expect(incoming.body.data.claims[0].claimant.name).toBe('claimant');
    expect((await claimant.agent.get('/api/v1/claims/incoming')).body.data.claims).toHaveLength(0);
  });
});

describe('deciding on claims', () => {
  async function withClaim() {
    const ctx = await setup();
    const claimId = (await post(ctx.claimant, `/api/v1/items/${ctx.itemId}/claims`, ctx.claimBody())).body.data.claim.id;
    return { ...ctx, claimId };
  }

  it('lets the finder approve with a note', async () => {
    const { finder, claimId } = await withClaim();
    const res = await patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'APPROVED', reviewNote: 'Answers match.' });
    expect(res.status).toBe(200);
    expect(res.body.data.claim).toMatchObject({ status: 'APPROVED', reviewNote: 'Answers match.' });
  });

  it('lets the finder reject, and the claimant may then claim again', async () => {
    const { finder, claimant, itemId, claimId, claimBody } = await withClaim();
    expect((await patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'REJECTED', reviewNote: 'Lining colour is wrong.' })).body.data.claim.status).toBe('REJECTED');
    expect((await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody())).status).toBe(201);
  });

  it('forbids the claimant and hides the claim from strangers', async () => {
    const { claimant, claimId } = await withClaim();
    const stranger = await makeUser('stranger@example.com');
    expect((await patch(claimant, `/api/v1/claims/${claimId}/decision`, { decision: 'APPROVED' })).status).toBe(403);
    expect((await patch(stranger, `/api/v1/claims/${claimId}/decision`, { decision: 'APPROVED' })).status).toBe(404);
    expect((await Claim.findById(claimId)).status).toBe('PENDING');
  });

  it('rejects invalid decisions and decisions on claims that are already decided', async () => {
    const { finder, claimId } = await withClaim();
    expect((await patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'PENDING' })).status).toBe(400);
    expect((await patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'WITHDRAWN' })).status).toBe(400);
    expect((await patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'APPROVED' })).status).toBe(200);
    expect((await patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'REJECTED' })).status).toBe(409);
  });

  it('allows an administrator to review and decide', async () => {
    const { claimId } = await withClaim();
    const admin = await makeUser('admin@example.com');
    await User.updateOne({ email: 'admin@example.com' }, { role: 'ADMIN' });
    expect((await admin.agent.get(`/api/v1/claims/${claimId}`)).status).toBe(200);
    expect((await patch(admin, `/api/v1/claims/${claimId}/decision`, { decision: 'REJECTED' })).status).toBe(200);
  });

  it('never approves automatically', async () => {
    const { claimId } = await withClaim();
    expect((await Claim.findById(claimId)).status).toBe('PENDING');
  });

  it('approves at most one claim per item, even when decisions arrive simultaneously', async () => {
    const { finder, claimant, itemId, claimBody, claimId } = await withClaim();
    const second = await makeUser('second@example.com');
    const secondId = (await post(second, `/api/v1/items/${itemId}/claims`, claimBody())).body.data.claim.id;
    const results = await Promise.all([
      patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'APPROVED' }),
      patch(finder, `/api/v1/claims/${secondId}/decision`, { decision: 'APPROVED' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await Claim.countDocuments({ item: itemId, status: 'APPROVED' })).toBe(1);
    void claimant;
  });

  it('refuses concurrent conflicting decisions on the same claim', async () => {
    const { finder, claimId } = await withClaim();
    const results = await Promise.all([
      patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'APPROVED' }),
      patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'REJECTED' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('blocks new claims once one is approved', async () => {
    const { finder, itemId, claimId, claimBody } = await withClaim();
    await patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'APPROVED' });
    const late = await makeUser('late@example.com');
    expect((await post(late, `/api/v1/items/${itemId}/claims`, claimBody())).status).toBe(409);
  });

  it('refuses a decision when the item is no longer active', async () => {
    const { finder, itemId, claimId } = await withClaim();
    await ItemReport.updateOne({ _id: itemId }, { status: 'CLOSED' });
    expect((await patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'APPROVED' })).status).toBe(409);
  });
});

describe('withdrawing', () => {
  it('lets the claimant withdraw a pending claim, then claim again', async () => {
    const { claimant, itemId, claimBody } = await setup();
    const claimId = (await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody())).body.data.claim.id;
    const res = await patch(claimant, `/api/v1/claims/${claimId}/withdraw`, {});
    expect(res.status).toBe(200);
    expect(res.body.data.claim.status).toBe('WITHDRAWN');
    expect((await patch(claimant, `/api/v1/claims/${claimId}/withdraw`, {})).status).toBe(409);
    expect((await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody())).status).toBe(201);
  });

  it('does not let the finder withdraw someone else\'s claim, nor decide a withdrawn one', async () => {
    const { finder, claimant, itemId, claimBody } = await setup();
    const claimId = (await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody())).body.data.claim.id;
    expect((await patch(finder, `/api/v1/claims/${claimId}/withdraw`, {})).status).toBe(403);
    await patch(claimant, `/api/v1/claims/${claimId}/withdraw`, {});
    expect((await patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'APPROVED' })).status).toBe(409);
  });

  it('blocks withdrawing a report while claims are open, and allows it afterwards', async () => {
    const { finder, claimant, itemId, claimBody } = await setup();
    const claimId = (await post(claimant, `/api/v1/items/${itemId}/claims`, claimBody())).body.data.claim.id;
    expect((await del(finder, `/api/v1/items/${itemId}`)).status).toBe(409);
    await patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'REJECTED' });
    expect((await del(finder, `/api/v1/items/${itemId}`)).status).toBe(200);
  });
});

describe('suggested matches', () => {
  it('requires authentication and the report owner', async () => {
    const owner = await makeUser('owner@example.com');
    const other = await makeUser('other@example.com');
    const item = (await post(owner, '/api/v1/items', lostBody())).body.data.item;
    expect((await request(app).get(`/api/v1/items/${item.id}/matches`)).status).toBe(401);
    expect((await other.agent.get(`/api/v1/items/${item.id}/matches`)).status).toBe(403);
    expect((await owner.agent.get('/api/v1/items/not-an-id/matches')).status).toBe(404);
  });

  it('suggests active reports of the opposite type with an explainable score and no private data', async () => {
    const owner = await makeUser('owner@example.com');
    const finder = await makeUser('finder@example.com');
    const lostItem = (await post(owner, '/api/v1/items', lostBody())).body.data.item;
    await post(finder, '/api/v1/items', foundBody());
    await post(finder, '/api/v1/items', foundBody({ title: 'Silver bicycle', category: 'OTHER', description: 'Parked at the gym.', location: 'Gym', dateOccurred: '2026-09-01' }));
    await post(owner, '/api/v1/items', lostBody({ title: 'Another lost wallet' })); // same type: never suggested

    const res = await owner.agent.get(`/api/v1/items/${lostItem.id}/matches`);
    expect(res.status).toBe(200);
    const { matches, notice, weights } = res.body.data;
    expect(matches).toHaveLength(1);
    expect(matches[0].item.title).toBe('Brown wallet');
    expect(matches[0].percent).toBeGreaterThan(80);
    expect(matches[0].breakdown).toHaveProperty('keywords');
    expect(weights.category).toBe(0.35);
    expect(notice).toMatch(/not proof/i);
    expect(JSON.stringify(res.body)).not.toMatch(/HDFC|Ravi|privateDetails|verificationQuestions|expectedAnswer/);
    expect(await Claim.countDocuments()).toBe(0); // a match never creates or approves a claim
  });

  it('excludes returned, closed, withdrawn and hidden reports and the owner\'s own reports', async () => {
    const owner = await makeUser('owner@example.com');
    const finder = await makeUser('finder@example.com');
    const lostItem = (await post(owner, '/api/v1/items', lostBody())).body.data.item;
    for (const status of ['RETURNED', 'CLOSED', 'WITHDRAWN', 'HIDDEN']) {
      const f = (await post(finder, '/api/v1/items', foundBody())).body.data.item;
      await ItemReport.updateOne({ _id: f.id }, { status });
    }
    const res = await owner.agent.get(`/api/v1/items/${lostItem.id}/matches`);
    expect(res.body.data.matches).toHaveLength(0);
  });

  it('refuses suggestions for reports that are not active', async () => {
    const owner = await makeUser('owner@example.com');
    const item = (await post(owner, '/api/v1/items', lostBody())).body.data.item;
    await del(owner, `/api/v1/items/${item.id}`);
    expect((await owner.agent.get(`/api/v1/items/${item.id}/matches`)).status).toBe(409);
  });
});
