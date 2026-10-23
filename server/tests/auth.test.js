import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import { createApp } from '../src/app.js';
import { authenticate, requireRole } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { signToken } from '../src/utils/tokens.js';
import { AUTH_COOKIE } from '../src/utils/cookies.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db.js';
import { buildTestApp, getCsrf, registerVia, loginVia, validUser } from './helpers/app.js';

const app = buildTestApp();
const agent = () => request.agent(app);

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe('registration', () => {
  it('creates a USER, sets an HTTP-only cookie and never returns the hash or token', async () => {
    const res = await registerVia(agent());
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ name: 'Asha Verma', email: 'asha@example.com', role: 'USER' });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/token/i);
    const cookie = res.headers['set-cookie'].find((c) => c.startsWith(`${AUTH_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('stores only a bcrypt hash', async () => {
    await registerVia(agent());
    const doc = await User.findOne({ email: 'asha@example.com' }).select('+passwordHash').lean();
    expect(doc.passwordHash).not.toBe('Passw0rdOK');
    expect(doc.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare('Passw0rdOK', doc.passwordHash)).toBe(true);
  });

  it('ignores attempts to self-assign ADMIN or change status', async () => {
    const res = await registerVia(agent(), { role: 'ADMIN', status: 'ACTIVE' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('USER');
    expect((await User.findOne({ email: 'asha@example.com' })).role).toBe('USER');
  });

  it('rejects a duplicate email, case-insensitively', async () => {
    await registerVia(agent());
    const res = await registerVia(agent(), { email: 'ASHA@Example.com' });
    expect(res.status).toBe(409);
    expect(await User.countDocuments()).toBe(1);
  });

  it.each([
    ['short password', { password: 'a1' }],
    ['no number', { password: 'onlyletters' }],
    ['no letter', { password: '12345678' }],
    ['bad email', { email: 'not-an-email' }],
    ['missing name', { name: '' }],
  ])('rejects invalid input: %s', async (_label, overrides) => {
    const res = await registerVia(agent(), overrides);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(Array.isArray(res.body.details)).toBe(true);
  });
});

describe('login, session and logout', () => {
  it('logs in with correct credentials and restores the session via /auth/me', async () => {
    const a = agent();
    await registerVia(request(app));
    const res = await loginVia(a, { email: 'asha@example.com', password: 'Passw0rdOK' });
    expect(res.status).toBe(200);
    const me = await a.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('asha@example.com');
  });

  it('gives the same 401 message for a wrong password and an unknown email', async () => {
    await registerVia(request(app));
    const wrong = await loginVia(agent(), { email: 'asha@example.com', password: 'WrongPass1' });
    const unknown = await loginVia(agent(), { email: 'nobody@example.com', password: 'WrongPass1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('blocks suspended accounts from logging in', async () => {
    await registerVia(request(app));
    await User.updateOne({ email: 'asha@example.com' }, { status: 'SUSPENDED' });
    const res = await loginVia(agent(), { email: 'asha@example.com', password: 'Passw0rdOK' });
    expect(res.status).toBe(403);
  });

  it('rejects /auth/me without a cookie', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('logout clears the session', async () => {
    const a = agent();
    await registerVia(a);
    expect((await a.get('/api/v1/auth/me')).status).toBe(200);
    const token = await getCsrf(a);
    const out = await a.post('/api/v1/auth/logout').set('X-CSRF-Token', token);
    expect(out.status).toBe(200);
    expect((await a.get('/api/v1/auth/me')).status).toBe(401);
  });

  it('rejects an existing session once the account is suspended', async () => {
    const a = agent();
    await registerVia(a);
    await User.updateOne({ email: 'asha@example.com' }, { status: 'SUSPENDED' });
    const res = await a.get('/api/v1/auth/me');
    expect(res.status).toBe(403);
  });
});

describe('CSRF protection', () => {
  it('rejects unsafe requests without a CSRF token', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
  });

  it('rejects a CSRF header that does not match the cookie', async () => {
    const a = agent();
    await getCsrf(a);
    const res = await a.post('/api/v1/auth/login').set('X-CSRF-Token', 'f'.repeat(64)).send({ email: 'a@b.co', password: 'x' });
    expect(res.status).toBe(403);
  });
});

describe('profile', () => {
  it('requires authentication', async () => {
    const a = agent();
    const token = await getCsrf(a);
    const res = await a.patch('/api/v1/users/me').set('X-CSRF-Token', token).send({ name: 'New Name' });
    expect(res.status).toBe(401);
  });

  it('updates name and phone but ignores role and email', async () => {
    const a = agent();
    await registerVia(a);
    const token = await getCsrf(a);
    const res = await a
      .patch('/api/v1/users/me')
      .set('X-CSRF-Token', token)
      .send({ name: 'Asha V', phone: '+91 98765 43210', role: 'ADMIN', email: 'evil@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ name: 'Asha V', phone: '+91 98765 43210', role: 'USER', email: 'asha@example.com' });
  });

  it('rejects an update with no allowed fields', async () => {
    const a = agent();
    await registerVia(a);
    const token = await getCsrf(a);
    const res = await a.patch('/api/v1/users/me').set('X-CSRF-Token', token).send({ role: 'ADMIN' });
    expect(res.status).toBe(400);
  });
});

describe('role checks (server-side)', () => {
  const mini = express();
  mini.use(cookieParser());
  mini.get('/admin-only', authenticate, requireRole('ADMIN'), (_req, res) => res.json({ ok: true }));
  mini.use(errorHandler);

  const asUser = async (role, status = 'ACTIVE') => {
    const user = await User.create({ name: 'Role Test', email: `${role}-${status}@example.com`.toLowerCase(), passwordHash: 'x', role, status });
    return `${AUTH_COOKIE}=${signToken(user._id)}`;
  };

  it('401 without a session', async () => {
    expect((await request(mini).get('/admin-only')).status).toBe(401);
  });
  it('401 with a garbage token', async () => {
    expect((await request(mini).get('/admin-only').set('Cookie', `${AUTH_COOKIE}=garbage`)).status).toBe(401);
  });
  it('403 for a regular USER', async () => {
    expect((await request(mini).get('/admin-only').set('Cookie', await asUser('USER'))).status).toBe(403);
  });
  it('200 for an ADMIN', async () => {
    expect((await request(mini).get('/admin-only').set('Cookie', await asUser('ADMIN'))).status).toBe(200);
  });
  it('403 for a suspended ADMIN', async () => {
    expect((await request(mini).get('/admin-only').set('Cookie', await asUser('ADMIN', 'SUSPENDED'))).status).toBe(403);
  });
});

describe('rate limiting', () => {
  it('returns 429 after too many login attempts', async () => {
    const limited = createApp({ authRateLimitMax: 2 });
    const a = request.agent(limited);
    const token = (await a.get('/api/v1/auth/csrf')).body.data.csrfToken;
    const attempt = () => a.post('/api/v1/auth/login').set('X-CSRF-Token', token).send({ email: 'x@example.com', password: 'WrongPass1' });
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(429);
  });
});
