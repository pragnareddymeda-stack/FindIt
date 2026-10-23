import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import ItemReport from '../src/models/ItemReport.js';
import Claim from '../src/models/Claim.js';
import Handover from '../src/models/Handover.js';
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
const post = (u, url, body = {}) => u.agent.post(url).set('X-CSRF-Token', u.csrf).send(body);
const patch = (u, url, body = {}) => u.agent.patch(url).set('X-CSRF-Token', u.csrf).send(body);

const future = (days = 2) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

async function approvedSetup() {
  const finder = await makeUser('finder@example.com');
  const claimant = await makeUser('claimant@example.com');
  const item = (await post(finder, '/api/v1/items', {
    type: 'FOUND', title: 'Brown wallet', category: 'WALLETS_PURSES', description: 'Found on a bench near the cafeteria.',
    dateOccurred: '2026-10-11', location: 'Cafeteria', privateDetails: 'Card of Ravi',
    verificationQuestions: [{ question: 'Which bank card is inside?', expectedAnswer: 'HDFC' }],
  })).body.data.item;
  const qid = (await finder.agent.get(`/api/v1/items/${item.id}`)).body.data.item.verificationQuestions[0].id;
  const claimBody = { explanation: 'It is my wallet, lost on Friday.', answers: [{ questionId: qid, answer: 'HDFC' }] };
  const claimId = (await post(claimant, `/api/v1/items/${item.id}/claims`, claimBody)).body.data.claim.id;
  await patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'APPROVED' });
  return { finder, claimant, itemId: item.id, claimId, claimBody };
}

const schedule = (o = {}) => ({ status: 'SCHEDULED', meetingTime: future(), meetingPlace: 'Library main gate', note: 'Wearing a blue jacket', ...o });

describe('starting a handover', () => {
  it('requires an approved claim', async () => {
    const finder = await makeUser('finder@example.com');
    const claimant = await makeUser('claimant@example.com');
    const item = (await post(finder, '/api/v1/items', {
      type: 'FOUND', title: 'Brown wallet', category: 'WALLETS_PURSES', description: 'Found on a bench near the cafeteria.',
      dateOccurred: '2026-10-11', location: 'Cafeteria', verificationQuestions: [{ question: 'Which bank card is inside?' }],
    })).body.data.item;
    const qid = (await finder.agent.get(`/api/v1/items/${item.id}`)).body.data.item.verificationQuestions[0].id;
    const claimId = (await post(claimant, `/api/v1/items/${item.id}/claims`, { explanation: 'It is mine, honestly.', answers: [{ questionId: qid, answer: 'HDFC' }] })).body.data.claim.id;
    expect((await post(finder, `/api/v1/claims/${claimId}/handover`)).status).toBe(409);
    expect(await Handover.countDocuments()).toBe(0);
  });

  it('lets either party start it once; the item stays ACTIVE', async () => {
    const { finder, claimant, claimId, itemId } = await approvedSetup();
    const res = await post(claimant, `/api/v1/claims/${claimId}/handover`);
    expect(res.status).toBe(201);
    expect(res.body.data.handover).toMatchObject({ status: 'ARRANGING', viewAs: 'CLAIMANT' });
    expect(res.body.data.handover.nextActions.sort()).toEqual(['CANCELLED', 'DISPUTED', 'SCHEDULED']);
    expect((await post(finder, `/api/v1/claims/${claimId}/handover`)).status).toBe(409);
    expect((await ItemReport.findById(itemId)).status).toBe('ACTIVE');
  });

  it('hides the claim from strangers and requires authentication', async () => {
    const { claimId } = await approvedSetup();
    const stranger = await makeUser('stranger@example.com');
    expect((await post(stranger, `/api/v1/claims/${claimId}/handover`)).status).toBe(404);
    const anon = request.agent(app);
    const csrf = await getCsrf(anon);
    expect((await anon.post(`/api/v1/claims/${claimId}/handover`).set('X-CSRF-Token', csrf).send({})).status).toBe(401);
  });

  it('is reachable from the claim page for the two parties only', async () => {
    const { finder, claimId } = await approvedSetup();
    const before = await finder.agent.get(`/api/v1/claims/${claimId}`);
    expect(before.body.data).toMatchObject({ canHandover: true, handover: null });
    await post(finder, `/api/v1/claims/${claimId}/handover`);
    const after = await finder.agent.get(`/api/v1/claims/${claimId}`);
    expect(after.body.data.handover.status).toBe('ARRANGING');
    const admin = await makeUser('admin@example.com');
    await User.updateOne({ email: 'admin@example.com' }, { role: 'ADMIN' });
    expect((await admin.agent.get(`/api/v1/claims/${claimId}`)).body.data.canHandover).toBe(false);
  });
});

describe('privacy', () => {
  it('shows a handover only to its two parties (and read-only to admins) and never exposes contact details', async () => {
    const { finder, claimant, claimId } = await approvedSetup();
    const id = (await post(finder, `/api/v1/claims/${claimId}/handover`)).body.data.handover.id;
    const stranger = await makeUser('stranger@example.com');
    const admin = await makeUser('admin@example.com');
    await User.updateOne({ email: 'admin@example.com' }, { role: 'ADMIN' });

    expect((await stranger.agent.get(`/api/v1/handovers/${id}`)).status).toBe(404);
    expect((await patch(stranger, `/api/v1/handovers/${id}/status`, schedule())).status).toBe(404);
    expect((await request(app).get(`/api/v1/handovers/${id}`)).status).toBe(401);
    expect((await stranger.agent.get('/api/v1/handovers/me')).body.data.handovers).toHaveLength(0);

    const asClaimant = await claimant.agent.get(`/api/v1/handovers/${id}`);
    expect(asClaimant.status).toBe(200);
    expect(JSON.stringify(asClaimant.body)).not.toMatch(/@example\.com|passwordHash|HDFC|Ravi/);
    expect(asClaimant.body.data.handover.finder.name).toBe('finder');

    const asAdmin = await admin.agent.get(`/api/v1/handovers/${id}`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data.handover.nextActions).toEqual([]);
    expect((await patch(admin, `/api/v1/handovers/${id}/status`, schedule())).status).toBe(403);
  });

  it('lists my handovers for both parties', async () => {
    const { finder, claimant, claimId } = await approvedSetup();
    await post(finder, `/api/v1/claims/${claimId}/handover`);
    for (const u of [finder, claimant]) {
      const res = await u.agent.get('/api/v1/handovers/me');
      expect(res.body.data.handovers).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    }
    expect((await finder.agent.get('/api/v1/handovers/me?status=COMPLETED')).body.data.handovers).toHaveLength(0);
    expect((await finder.agent.get('/api/v1/handovers/me?status=NOPE')).status).toBe(400);
  });
});

describe('arranging the meeting', () => {
  async function started() {
    const ctx = await approvedSetup();
    const id = (await post(ctx.finder, `/api/v1/claims/${ctx.claimId}/handover`)).body.data.handover.id;
    return { ...ctx, id };
  }

  it('lets either party set and change the meeting details', async () => {
    const { finder, claimant, id } = await started();
    const first = await patch(claimant, `/api/v1/handovers/${id}/status`, schedule());
    expect(first.status).toBe(200);
    expect(first.body.data.handover).toMatchObject({ status: 'SCHEDULED', meetingPlace: 'Library main gate' });
    const second = await patch(finder, `/api/v1/handovers/${id}/status`, schedule({ meetingPlace: 'Cafeteria entrance' }));
    expect(second.status).toBe(200);
    expect(second.body.data.handover.meetingPlace).toBe('Cafeteria entrance');
    expect(second.body.data.handover.history.map((e) => e.status)).toEqual(['ARRANGING', 'SCHEDULED', 'SCHEDULED']);
  });

  it.each([
    ['past time', { meetingTime: new Date(Date.now() - 3600_000).toISOString() }],
    ['more than 60 days away', { meetingTime: future(90) }],
    ['bad time', { meetingTime: 'tomorrow-ish' }],
    ['no place', { meetingPlace: '' }],
  ])('rejects invalid details: %s', async (_l, override) => {
    const { finder, id } = await started();
    expect((await patch(finder, `/api/v1/handovers/${id}/status`, schedule(override))).status).toBe(400);
  });

  it('rejects unknown or non-targetable statuses', async () => {
    const { finder, id } = await started();
    for (const status of ['ARRANGING', 'RETURNED', 'whatever']) {
      expect((await patch(finder, `/api/v1/handovers/${id}/status`, { status })).status).toBe(400);
    }
    expect((await patch(finder, `/api/v1/handovers/${id}/status`, {})).status).toBe(400);
  });
});

describe('completing the handover', () => {
  async function started() {
    const ctx = await approvedSetup();
    const id = (await post(ctx.finder, `/api/v1/claims/${ctx.claimId}/handover`)).body.data.handover.id;
    return { ...ctx, id };
  }

  it('marks the report RETURNED only after the finder records it AND the claimant confirms', async () => {
    const { finder, claimant, id, itemId } = await started();
    await patch(finder, `/api/v1/handovers/${id}/status`, schedule());

    const handed = await patch(finder, `/api/v1/handovers/${id}/status`, { status: 'HANDED_OVER' });
    expect(handed.status).toBe(200);
    expect(handed.body.data.handover.status).toBe('HANDED_OVER');
    expect((await ItemReport.findById(itemId)).status).toBe('ACTIVE'); // not yet

    const done = await patch(claimant, `/api/v1/handovers/${id}/status`, { status: 'COMPLETED' });
    expect(done.status).toBe(200);
    expect(done.body.data.handover.status).toBe('COMPLETED');
    expect(done.body.data.handover.nextActions).toEqual([]);
    expect((await ItemReport.findById(itemId)).status).toBe('RETURNED');
    expect(done.body.data.handover.history.map((e) => e.status)).toEqual(['ARRANGING', 'SCHEDULED', 'HANDED_OVER', 'COMPLETED']);

    const listed = await request(app).get('/api/v1/items?status=RETURNED');
    expect(listed.body.data.items).toHaveLength(1);
    expect((await request(app).get('/api/v1/items')).body.data.items).toHaveLength(0);
  });

  it('enforces who may do what', async () => {
    const { finder, claimant, id } = await started();
    expect((await patch(claimant, `/api/v1/handovers/${id}/status`, { status: 'HANDED_OVER' })).status).toBe(403);
    expect((await patch(finder, `/api/v1/handovers/${id}/status`, { status: 'COMPLETED' })).status).toBe(403);
  });

  it('cannot confirm receipt before the finder recorded the handover', async () => {
    const { claimant, id, itemId } = await started();
    expect((await patch(claimant, `/api/v1/handovers/${id}/status`, { status: 'COMPLETED' })).status).toBe(409);
    expect((await ItemReport.findById(itemId)).status).toBe('ACTIVE');
  });

  it('cannot be completed or changed twice', async () => {
    const { finder, claimant, id } = await started();
    await patch(finder, `/api/v1/handovers/${id}/status`, { status: 'HANDED_OVER' });
    await patch(claimant, `/api/v1/handovers/${id}/status`, { status: 'COMPLETED' });
    expect((await patch(claimant, `/api/v1/handovers/${id}/status`, { status: 'COMPLETED' })).status).toBe(409);
    expect((await patch(finder, `/api/v1/handovers/${id}/status`, schedule())).status).toBe(409);
    expect((await patch(finder, `/api/v1/handovers/${id}/status`, { status: 'DISPUTED', reason: 'Changed my mind about it.' })).status).toBe(409);
  });
});

describe('disputes', () => {
  async function started() {
    const ctx = await approvedSetup();
    const id = (await post(ctx.finder, `/api/v1/claims/${ctx.claimId}/handover`)).body.data.handover.id;
    return { ...ctx, id };
  }

  it('lets either party raise one with a reason, keeps the item ACTIVE and blocks completion', async () => {
    const { finder, claimant, id, itemId } = await started();
    await patch(finder, `/api/v1/handovers/${id}/status`, { status: 'HANDED_OVER' });
    const res = await patch(claimant, `/api/v1/handovers/${id}/status`, { status: 'DISPUTED', reason: 'I never received the item at all.' });
    expect(res.status).toBe(200);
    expect(res.body.data.handover).toMatchObject({ status: 'DISPUTED', disputeReason: 'I never received the item at all.' });
    expect((await ItemReport.findById(itemId)).status).toBe('ACTIVE');
    expect((await patch(claimant, `/api/v1/handovers/${id}/status`, { status: 'COMPLETED' })).status).toBe(409);
    expect(await Handover.countDocuments({ status: 'DISPUTED' })).toBe(1);
  });

  it('requires a meaningful reason', async () => {
    const { finder, id } = await started();
    expect((await patch(finder, `/api/v1/handovers/${id}/status`, { status: 'DISPUTED' })).status).toBe(400);
    expect((await patch(finder, `/api/v1/handovers/${id}/status`, { status: 'DISPUTED', reason: 'bad' })).status).toBe(400);
  });
});

describe('cancelling', () => {
  async function started() {
    const ctx = await approvedSetup();
    const id = (await post(ctx.finder, `/api/v1/claims/${ctx.claimId}/handover`)).body.data.handover.id;
    return { ...ctx, id };
  }

  it('claimant cancelling withdraws the claim and frees the item for new claims', async () => {
    const { claimant, id, claimId, itemId, claimBody } = await started();
    const res = await patch(claimant, `/api/v1/handovers/${id}/status`, { status: 'CANCELLED', reason: 'I found it at home.' });
    expect(res.status).toBe(200);
    expect(res.body.data.handover.status).toBe('CANCELLED');
    expect(await Claim.findById(claimId)).toMatchObject({ status: 'WITHDRAWN', isActive: false });
    const other = await makeUser('other@example.com');
    expect((await post(other, `/api/v1/items/${itemId}/claims`, claimBody)).status).toBe(201);
  });

  it('finder cancelling rejects the claim with a note', async () => {
    const { finder, id, claimId } = await started();
    await patch(finder, `/api/v1/handovers/${id}/status`, { status: 'CANCELLED' });
    expect(await Claim.findById(claimId)).toMatchObject({ status: 'REJECTED', isActive: false, reviewNote: 'The finder cancelled the handover.' });
  });

  it('is not possible after the item was handed over', async () => {
    const { finder, claimant, id } = await started();
    await patch(finder, `/api/v1/handovers/${id}/status`, { status: 'HANDED_OVER' });
    expect((await patch(claimant, `/api/v1/handovers/${id}/status`, { status: 'CANCELLED' })).status).toBe(409);
  });

  it('a simultaneous hand-over and cancellation cannot both succeed', async () => {
    const { finder, claimant, id, claimId } = await started();
    const results = await Promise.all([
      patch(finder, `/api/v1/handovers/${id}/status`, { status: 'HANDED_OVER' }),
      patch(claimant, `/api/v1/handovers/${id}/status`, { status: 'CANCELLED' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const h = await Handover.findById(id);
    const claim = await Claim.findById(claimId);
    if (h.status === 'CANCELLED') expect(claim.status).toBe('WITHDRAWN');
    else expect(claim.status).toBe('APPROVED');
  });
});
