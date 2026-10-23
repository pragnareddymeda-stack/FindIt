import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { findMissingEnv } from '../src/config/env.js';

const app = createApp();

describe('GET /api/v1/health', () => {
  it('reports degraded (503) when the database is not connected', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.data.database).toBe('disconnected');
  });
});

describe('error handling', () => {
  it('returns a JSON 404 for unknown routes without a stack trace', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.stack).toBeUndefined();
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
  });
});

describe('env validation', () => {
  it('lists only the names of missing variables', () => {
    expect(findMissingEnv({ JWT_SECRET: 'x' })).toEqual(['MONGODB_URI', 'CLIENT_URL']);
  });
});

describe('general API rate limit', () => {
  it('returns 429 once one client sends too many requests', async () => {
    const limited = createApp({ apiRateLimitMax: 2 });
    expect((await request(limited).get('/api/v1/health')).status).toBe(503);
    expect((await request(limited).get('/api/v1/health')).status).toBe(503);
    const res = await request(limited).get('/api/v1/health');
    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
  });
});
