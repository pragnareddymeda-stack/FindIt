import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import User from '../src/models/User.js';
import ItemReport from '../src/models/ItemReport.js';
import Claim from '../src/models/Claim.js';
import Handover from '../src/models/Handover.js';
import AbuseReport from '../src/models/AbuseReport.js';
import AuditLog from '../src/models/AuditLog.js';
import Notification from '../src/models/Notification.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db.js';
import { buildTestApp, getCsrf } from './helpers/app.js';
import { makeUserOn, post, patch, claimFlow } from './helpers/flow.js';

const app = buildTestApp();
const makeUser = (email) => makeUserOn(app, email);
const makeAdmin = async (email = 'admin@example.com') => {
  const u = await makeUser(email);
  await User.updateOne({ email }, { role: 'ADMIN' }); // sessions are re-checked on every request
  return u;
};

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

const FAKE_ID = '64b7f0f0f0f0f0f0f0f0f0f0';
const lostBody = (o = {}) => ({
  type: 'LOST', title: 'Black wallet', category: 'WALLETS_PURSES', description: 'Lost near the library entrance.',
  dateOccurred: '2026-10-10', location: 'Library', ...o,
});
const foundBody = (o = {}) => ({
  type: 'FOUND', title: 'Blue umbrella', category: 'ACCESSORIES', description: 'Found at the bus stop outside.',
  dateOccurred: '2026-10-11', location: 'Bus stop', verificationQuestions: [{ question: 'What colour is the handle?' }], ...o,
});
const createItem = async (u, body) => (await post(u, '/api/v1/items', body)).body.data.item;
const report = (u, itemId, body = { reason: 'SPAM', details: 'Looks like an advert' }) => post(u, `/api/v1/items/${itemId}/abuse`, body);

describe('admin routes are protected on the server', () => {
  const routes = [
    ['get', '/api/v1/admin/dashboard'],
    ['get', '/api/v1/admin/users'],
    ['get', '/api/v1/admin/reports'],
    ['get', '/api/v1/admin/abuse-reports'],
    ['get', '/api/v1/admin/disputes'],
    ['get', '/api/v1/admin/audit-logs'],
    ['patch', `/api/v1/admin/users/${FAKE_ID}/status`, { status: 'SUSPENDED', reason: 'Spamming people' }],
    ['patch', `/api/v1/admin/reports/${FAKE_ID}/moderation`, { action: 'HIDE', reason: 'Not appropriate' }],
    ['patch', `/api/v1/admin/abuse-reports/${FAKE_ID}`, { status: 'DISMISSED' }],
    ['patch', `/api/v1/admin/disputes/${FAKE_ID}/resolution`, { resolution: 'CANCEL', note: 'Nobody replied' }],
  ];

  it.each(routes)('%s %s needs a login', async (method, url, body) => {
    const agent = request.agent(app);
    const csrf = await getCsrf(agent);
    const res = await agent[method](url).set('X-CSRF-Token', csrf).send(body);
    expect(res.status).toBe(401);
  });

  it.each(routes)('%s %s is forbidden to regular users', async (method, url, body) => {
    const user = await makeUser('user@example.com');
    const res = await user.agent[method](url).set('X-CSRF-Token', user.csrf).send(body);
    expect(res.status).toBe(403);
  });

  it('is forbidden to an administrator who has been suspended', async () => {
    const admin = await makeAdmin();
    await User.updateOne({ email: 'admin@example.com' }, { status: 'SUSPENDED' });
    expect((await admin.agent.get('/api/v1/admin/dashboard')).status).toBe(403);
  });

  it('cannot be reached by registering with role ADMIN', async () => {
    const sneaky = request.agent(app);
    const csrf = await getCsrf(sneaky);
    const res = await sneaky.post('/api/v1/auth/register').set('X-CSRF-Token', csrf).send({ name: 'Sneaky One', email: 'sneaky@example.com', password: 'Passw0rdOK', role: 'ADMIN' });
    expect(res.body.data.user.role).toBe('USER');
    expect((await sneaky.get('/api/v1/admin/dashboard')).status).toBe(403);
  });
});

describe('dashboard', () => {
  it('shows zeros on an empty platform, with every category present', async () => {
    const admin = await makeAdmin();
    const res = await admin.agent.get('/api/v1/admin/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.data.totals).toMatchObject({ users: 1, activeLost: 0, activeFound: 0, pendingClaims: 0, successfulReturns: 0, awaitingModeration: 0, openDisputes: 0, openAbuseReports: 0 });
    expect(res.body.data.categories).toHaveLength(9);
  });

  it('reports real numbers from the database', async () => {
    const admin = await makeAdmin();
    const { finder, claimant, itemId, claimId, approve } = await claimFlow(app); // 2 users, 1 FOUND item, 1 pending claim
    await createItem(claimant, lostBody());
    await createItem(claimant, lostBody({ title: 'Old keys', category: 'KEYS' }));
    const spam = await createItem(finder, foundBody());
    await report(claimant, spam.id);
    await User.updateOne({ email: 'claimant@example.com' }, { status: 'SUSPENDED' });

    let t = (await admin.agent.get('/api/v1/admin/dashboard')).body.data;
    expect(t.totals).toMatchObject({ users: 3, suspendedUsers: 1, activeLost: 2, activeFound: 2, pendingClaims: 1, awaitingModeration: 1, openAbuseReports: 1, successfulReturns: 0 });
    const wallets = t.categories.find((c) => c.category === 'WALLETS_PURSES');
    expect(wallets).toMatchObject({ lost: 1, found: 1, total: 2 });
    expect(t.categories.find((c) => c.category === 'KEYS')).toMatchObject({ lost: 1, found: 0 });

    await approve();
    await post(finder, `/api/v1/claims/${claimId}/handover`);
    await ItemReport.updateOne({ _id: itemId }, { status: 'RETURNED' });
    t = (await admin.agent.get('/api/v1/admin/dashboard')).body.data;
    expect(t.totals).toMatchObject({ pendingClaims: 0, successfulReturns: 1, activeFound: 1 });
  });
});

describe('user management', () => {
  it('lists, searches and filters users, including emails (admin only)', async () => {
    const admin = await makeAdmin();
    await makeUser('maria@example.com');
    await makeUser('omar@example.com');
    const all = await admin.agent.get('/api/v1/admin/users');
    expect(all.body.pagination.total).toBe(3);
    expect(all.body.data.users[0]).toHaveProperty('email');
    expect(JSON.stringify(all.body)).not.toMatch(/passwordHash/);
    expect((await admin.agent.get('/api/v1/admin/users?q=mari')).body.data.users).toHaveLength(1);
    expect((await admin.agent.get('/api/v1/admin/users?role=ADMIN')).body.data.users).toHaveLength(1);
    expect((await admin.agent.get('/api/v1/admin/users?q=.*')).body.data.users).toHaveLength(0);
    expect((await admin.agent.get('/api/v1/admin/users?limit=2&page=2')).body.data.users).toHaveLength(1);
    expect((await admin.agent.get('/api/v1/admin/users?role=OWNER')).status).toBe(400);
  });

  it('suspends and reactivates with an audit trail; suspension locks the person out immediately', async () => {
    const admin = await makeAdmin();
    const victim = await makeUser('victim@example.com');
    expect((await victim.agent.get('/api/v1/auth/me')).status).toBe(200);

    const bad = await patch(admin, `/api/v1/admin/users/${victim.id}/status`, { status: 'SUSPENDED' });
    expect(bad.status).toBe(400); // a reason is required
    const res = await patch(admin, `/api/v1/admin/users/${victim.id}/status`, { status: 'SUSPENDED', reason: 'Harassing other users' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.status).toBe('SUSPENDED');

    expect((await victim.agent.get('/api/v1/auth/me')).status).toBe(403);
    const login = await request.agent(app);
    const csrf = await getCsrf(login);
    expect((await login.post('/api/v1/auth/login').set('X-CSRF-Token', csrf).send({ email: 'victim@example.com', password: 'Passw0rdOK' })).status).toBe(403);

    expect((await patch(admin, `/api/v1/admin/users/${victim.id}/status`, { status: 'SUSPENDED', reason: 'Again please' })).status).toBe(409);
    const back = await patch(admin, `/api/v1/admin/users/${victim.id}/status`, { status: 'ACTIVE' });
    expect(back.status).toBe(200);
    expect((await victim.agent.get('/api/v1/auth/me')).status).toBe(200);

    const logs = await AuditLog.find().sort({ createdAt: 1, _id: 1 });
    expect(logs.map((l) => l.action)).toEqual(['USER_SUSPENDED', 'USER_REACTIVATED']);
    expect(logs[0].summary).toMatch(/Harassing other users/);
    expect(String(logs[0].actor)).toBe(admin.id);
  });

  it('cannot suspend yourself or another administrator, and unknown ids are 404', async () => {
    const admin = await makeAdmin();
    const other = await makeAdmin('other-admin@example.com');
    expect((await patch(admin, `/api/v1/admin/users/${admin.id}/status`, { status: 'SUSPENDED', reason: 'Oops, myself' })).status).toBe(403);
    expect((await patch(admin, `/api/v1/admin/users/${other.id}/status`, { status: 'SUSPENDED', reason: 'Coup attempt' })).status).toBe(403);
    expect((await patch(admin, `/api/v1/admin/users/${FAKE_ID}/status`, { status: 'SUSPENDED', reason: 'Who is that' })).status).toBe(404);
    expect((await patch(admin, '/api/v1/admin/users/not-an-id/status', { status: 'SUSPENDED', reason: 'Who is that' })).status).toBe(404);
    expect((await patch(admin, `/api/v1/admin/users/${admin.id}/status`, { status: 'DELETED' })).status).toBe(400);
    expect(await AuditLog.countDocuments()).toBe(0);
    expect((await User.findById(other.id)).status).toBe('ACTIVE');
  });
});

describe('abuse reports', () => {
  it('lets signed-in users complain once about someone else\'s visible listing', async () => {
    const owner = await makeUser('owner@example.com');
    const other = await makeUser('other@example.com');
    const item = await createItem(owner, lostBody());
    expect((await report(other, item.id)).status).toBe(201);
    expect((await report(other, item.id)).status).toBe(409);
    expect((await report(owner, item.id)).status).toBe(403);
    expect((await report(other, FAKE_ID)).status).toBe(404);
    expect((await report(other, item.id, { reason: 'BORING' })).status).toBe(400);
    const anon = request.agent(app);
    const csrf = await getCsrf(anon);
    expect((await anon.post(`/api/v1/items/${item.id}/abuse`).set('X-CSRF-Token', csrf).send({ reason: 'SPAM' })).status).toBe(401);
    await ItemReport.updateOne({ _id: item.id }, { status: 'HIDDEN' });
    expect((await report(await makeUser('third@example.com'), item.id)).status).toBe(404);
  });

  it('lets admins list and handle them once', async () => {
    const admin = await makeAdmin();
    const owner = await makeUser('owner@example.com');
    const other = await makeUser('other@example.com');
    const item = await createItem(owner, lostBody());
    await report(other, item.id, { reason: 'SCAM', details: 'Asks for money' });

    const list = await admin.agent.get('/api/v1/admin/abuse-reports');
    expect(list.body.data.abuseReports).toHaveLength(1);
    expect(list.body.data.abuseReports[0]).toMatchObject({ reason: 'SCAM', reporter: { name: 'other' }, item: { title: 'Black wallet' } });
    expect(JSON.stringify(list.body)).not.toMatch(/@example\.com/);

    const id = list.body.data.abuseReports[0].id;
    const done = await patch(admin, `/api/v1/admin/abuse-reports/${id}`, { status: 'DISMISSED', note: 'Looks fine to me.' });
    expect(done.status).toBe(200);
    expect(done.body.data.abuseReport).toMatchObject({ status: 'DISMISSED', resolutionNote: 'Looks fine to me.' });
    expect((await patch(admin, `/api/v1/admin/abuse-reports/${id}`, { status: 'RESOLVED' })).status).toBe(409);
    expect((await patch(admin, `/api/v1/admin/abuse-reports/${FAKE_ID}`, { status: 'RESOLVED' })).status).toBe(404);
    expect((await patch(admin, `/api/v1/admin/abuse-reports/${id}`, { status: 'OPEN' })).status).toBe(400);
    expect((await admin.agent.get('/api/v1/admin/abuse-reports')).body.data.abuseReports).toHaveLength(0);
    expect((await admin.agent.get('/api/v1/admin/abuse-reports?status=DISMISSED')).body.data.abuseReports).toHaveLength(1);
    expect((await AuditLog.findOne()).action).toBe('ABUSE_REPORT_DISMISSED');

    // The same person may complain again once the earlier complaint is closed.
    expect((await report(other, item.id)).status).toBe(201);
  });
});

describe('report moderation', () => {
  it('lists every report including hidden and withdrawn ones, with open complaint counts, and no private data', async () => {
    const admin = await makeAdmin();
    const finder = await makeUser('finder@example.com');
    const other = await makeUser('other@example.com');
    const a = await createItem(finder, foundBody());
    const b = await createItem(finder, foundBody({ title: 'Red scarf', verificationQuestions: [{ question: 'Where was it?', expectedAnswer: 'SECRETANSWER' }] }));
    await ItemReport.updateOne({ _id: b.id }, { status: 'WITHDRAWN' });
    await report(other, a.id);

    const all = await admin.agent.get('/api/v1/admin/reports');
    expect(all.body.data.reports).toHaveLength(2);
    expect(all.body.data.reports.find((r) => r.id === a.id).openAbuseReports).toBe(1);
    expect(JSON.stringify(all.body)).not.toMatch(/SECRETANSWER|privateDetails|verificationQuestions|expectedAnswer/);
    expect((await admin.agent.get('/api/v1/admin/reports?flagged=true')).body.data.reports.map((r) => r.id)).toEqual([a.id]);
    expect((await admin.agent.get('/api/v1/admin/reports?status=WITHDRAWN')).body.data.reports).toHaveLength(1);
    expect((await admin.agent.get('/api/v1/admin/reports?type=LOST')).body.data.reports).toHaveLength(0);
  });

  it('hides a report: gone from public pages, owner told, complaints closed, audit logged; unhide restores it', async () => {
    const admin = await makeAdmin();
    const owner = await makeUser('owner@example.com');
    const other = await makeUser('other@example.com');
    const item = await createItem(owner, lostBody());
    await report(other, item.id);

    expect((await patch(admin, `/api/v1/admin/reports/${item.id}/moderation`, { action: 'HIDE' })).status).toBe(400); // reason required
    const res = await patch(admin, `/api/v1/admin/reports/${item.id}/moderation`, { action: 'HIDE', reason: 'Contains a phone number' });
    expect(res.status).toBe(200);
    expect(res.body.data.report.status).toBe('HIDDEN');

    expect((await request(app).get('/api/v1/items')).body.data.items).toHaveLength(0);
    expect((await request(app).get(`/api/v1/items/${item.id}`)).status).toBe(404);
    expect((await owner.agent.get(`/api/v1/items/${item.id}`)).status).toBe(200); // the owner can still see it
    expect((await owner.agent.get('/api/v1/items/mine')).body.data.items[0].status).toBe('HIDDEN');
    expect((await patch(owner, `/api/v1/items/${item.id}`, { title: 'Edited title now' })).status).toBe(409);

    expect((await AbuseReport.findOne({ item: item.id })).status).toBe('RESOLVED');
    const note = await Notification.findOne({ user: owner.id, type: 'MODERATION_ACTION' });
    expect(note.body).toMatch(/Contains a phone number/);
    expect((await AuditLog.findOne({ action: 'REPORT_HIDDEN' })).summary).toMatch(/Black wallet/);

    expect((await patch(admin, `/api/v1/admin/reports/${item.id}/moderation`, { action: 'HIDE', reason: 'Hide it twice' })).status).toBe(409);
    const back = await patch(admin, `/api/v1/admin/reports/${item.id}/moderation`, { action: 'UNHIDE' });
    expect(back.status).toBe(200);
    expect(back.body.data.report.status).toBe('ACTIVE');
    expect((await request(app).get('/api/v1/items')).body.data.items).toHaveLength(1);
    expect((await patch(admin, `/api/v1/admin/reports/${item.id}/moderation`, { action: 'UNHIDE' })).status).toBe(409);
  });

  it('only hides active reports and rejects unknown actions and ids', async () => {
    const admin = await makeAdmin();
    const owner = await makeUser('owner@example.com');
    const item = await createItem(owner, lostBody());
    await ItemReport.updateOne({ _id: item.id }, { status: 'RETURNED' });
    expect((await patch(admin, `/api/v1/admin/reports/${item.id}/moderation`, { action: 'HIDE', reason: 'Too late for this' })).status).toBe(409);
    expect((await patch(admin, `/api/v1/admin/reports/${item.id}/moderation`, { action: 'DELETE' })).status).toBe(400);
    expect((await patch(admin, `/api/v1/admin/reports/${FAKE_ID}/moderation`, { action: 'HIDE', reason: 'Nothing here' })).status).toBe(404);
    expect((await ItemReport.findById(item.id)).status).toBe('RETURNED');
  });
});

describe('dispute management', () => {
  async function disputed() {
    const ctx = await claimFlow(app);
    await ctx.approve();
    const hid = (await post(ctx.finder, `/api/v1/claims/${ctx.claimId}/handover`)).body.data.handover.id;
    await patch(ctx.claimant, `/api/v1/handovers/${hid}/status`, { status: 'DISPUTED', reason: 'The finder never turned up.' });
    return { ...ctx, hid };
  }

  it('lists open disputes with both parties and the reason', async () => {
    const admin = await makeAdmin();
    const { hid } = await disputed();
    const res = await admin.agent.get('/api/v1/admin/disputes');
    expect(res.status).toBe(200);
    expect(res.body.data.disputes).toHaveLength(1);
    expect(res.body.data.disputes[0]).toMatchObject({ id: hid, status: 'DISPUTED', disputeReason: 'The finder never turned up.', finder: { name: 'finder' }, claimant: { name: 'claimant' } });
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.com/);
    expect((await admin.agent.get('/api/v1/admin/disputes?state=resolved')).body.data.disputes).toHaveLength(0);
  });

  it('can mark the item as returned, closing the dispute for everyone', async () => {
    const admin = await makeAdmin();
    const { hid, itemId, finder, claimant } = await disputed();
    expect((await patch(admin, `/api/v1/admin/disputes/${hid}/resolution`, { resolution: 'COMPLETE' })).status).toBe(400); // note required
    const res = await patch(admin, `/api/v1/admin/disputes/${hid}/resolution`, { resolution: 'COMPLETE', note: 'Both confirmed by email.' });
    expect(res.status).toBe(200);
    expect(res.body.data.dispute).toMatchObject({ status: 'COMPLETED', resolutionNote: 'Both confirmed by email.' });
    expect(res.body.data.dispute.history.at(-1)).toMatchObject({ status: 'COMPLETED', role: 'ADMIN' });
    expect((await ItemReport.findById(itemId)).status).toBe('RETURNED');
    for (const u of [finder, claimant]) {
      expect(await Notification.countDocuments({ user: u.id, type: 'DISPUTE_UPDATE', title: 'Your dispute was resolved' })).toBe(1);
    }
    expect((await AuditLog.findOne({ action: 'DISPUTE_RESOLVED' })).summary).toMatch(/Brown wallet/);
    expect((await admin.agent.get('/api/v1/admin/disputes?state=resolved')).body.data.disputes).toHaveLength(1);
    expect((await admin.agent.get('/api/v1/admin/disputes')).body.data.disputes).toHaveLength(0);
  });

  it('can cancel the handover, releasing the claim so the item can be claimed again', async () => {
    const admin = await makeAdmin();
    const { hid, claimId, itemId, claimBody } = await disputed();
    const res = await patch(admin, `/api/v1/admin/disputes/${hid}/resolution`, { resolution: 'CANCEL', note: 'Neither side responded.' });
    expect(res.status).toBe(200);
    expect(res.body.data.dispute.status).toBe('CANCELLED');
    expect(await Claim.findById(claimId)).toMatchObject({ status: 'REJECTED', isActive: false });
    expect((await ItemReport.findById(itemId)).status).toBe('ACTIVE');
    const someone = await makeUser('someone@example.com');
    expect((await post(someone, `/api/v1/items/${itemId}/claims`, claimBody)).status).toBe(201);
  });

  it('can be resolved only once, and only when actually disputed', async () => {
    const admin = await makeAdmin();
    const { hid, claimId } = await disputed();
    const body = { resolution: 'CANCEL', note: 'Closing this one.' };
    const both = await Promise.all([
      patch(admin, `/api/v1/admin/disputes/${hid}/resolution`, body),
      patch(admin, `/api/v1/admin/disputes/${hid}/resolution`, { resolution: 'COMPLETE', note: 'Or maybe returned.' }),
    ]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await patch(admin, `/api/v1/admin/disputes/${hid}/resolution`, body)).status).toBe(409);
    expect((await patch(admin, `/api/v1/admin/disputes/${FAKE_ID}/resolution`, body)).status).toBe(404);
    expect(await AuditLog.countDocuments({ action: 'DISPUTE_RESOLVED' })).toBe(1);
  });

  it('refuses to touch a handover that is not disputed', async () => {
    const admin = await makeAdmin();
    const ctx = await claimFlow(app);
    await ctx.approve();
    const hid = (await post(ctx.finder, `/api/v1/claims/${ctx.claimId}/handover`)).body.data.handover.id;
    expect((await patch(admin, `/api/v1/admin/disputes/${hid}/resolution`, { resolution: 'COMPLETE', note: 'Skipping the queue.' })).status).toBe(409);
    expect((await Handover.findById(hid)).status).toBe('ARRANGING');
  });
});

describe('audit logs', () => {
  it('records admin access to private claim data, but not the finder\'s own', async () => {
    const admin = await makeAdmin();
    const { finder, claimId, itemId } = await claimFlow(app);
    await finder.agent.get(`/api/v1/claims/${claimId}`);
    await finder.agent.get(`/api/v1/items/${itemId}/claims`);
    expect(await AuditLog.countDocuments()).toBe(0);

    expect((await admin.agent.get(`/api/v1/claims/${claimId}`)).status).toBe(200);
    expect((await admin.agent.get(`/api/v1/items/${itemId}/claims`)).status).toBe(200);
    expect(await AuditLog.countDocuments({ action: 'CLAIM_VIEWED_BY_ADMIN' })).toBe(2);
  });

  it('records an administrator deciding a claim', async () => {
    const admin = await makeAdmin();
    const { claimId } = await claimFlow(app);
    expect((await patch(admin, `/api/v1/claims/${claimId}/decision`, { decision: 'REJECTED', reviewNote: 'Policy' })).status).toBe(200);
    expect(await AuditLog.countDocuments({ action: 'CLAIM_DECIDED_BY_ADMIN' })).toBe(1);
  });

  it('lists newest first with actor names, can filter and paginate, and has no edit or delete', async () => {
    const admin = await makeAdmin();
    const u1 = await makeUser('u1@example.com');
    const u2 = await makeUser('u2@example.com');
    await patch(admin, `/api/v1/admin/users/${u1.id}/status`, { status: 'SUSPENDED', reason: 'First offence' });
    await patch(admin, `/api/v1/admin/users/${u2.id}/status`, { status: 'SUSPENDED', reason: 'Second offence' });
    await patch(admin, `/api/v1/admin/users/${u1.id}/status`, { status: 'ACTIVE' });

    const res = await admin.agent.get('/api/v1/admin/audit-logs');
    expect(res.body.data.logs.map((l) => l.action)).toEqual(['USER_REACTIVATED', 'USER_SUSPENDED', 'USER_SUSPENDED']);
    expect(res.body.data.logs[0].actor.name).toBe('admin');
    expect((await admin.agent.get('/api/v1/admin/audit-logs?action=USER_SUSPENDED')).body.data.logs).toHaveLength(2);
    expect((await admin.agent.get('/api/v1/admin/audit-logs?limit=2&page=2')).body.data.logs).toHaveLength(1);
    expect((await admin.agent.get('/api/v1/admin/audit-logs?action=EVERYTHING')).status).toBe(400);

    const id = res.body.data.logs[0].id;
    expect((await admin.agent.delete(`/api/v1/admin/audit-logs/${id}`).set('X-CSRF-Token', admin.csrf)).status).toBe(404);
    expect((await admin.agent.patch(`/api/v1/admin/audit-logs/${id}`).set('X-CSRF-Token', admin.csrf).send({ summary: 'tampered' })).status).toBe(404);
    expect(await AuditLog.countDocuments()).toBe(3);
  });
});
