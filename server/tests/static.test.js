import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';

let dir;
let app;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'findit-dist-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>FindIt test app</title><div id="root"></div>');
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log("hi")');
  app = createApp({ clientDist: dir, apiRateLimitMax: 1_000_000 });
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('serving the built client from the API server (single-origin deployment)', () => {
  it('serves index.html and static assets', async () => {
    const home = await request(app).get('/');
    expect(home.status).toBe(200);
    expect(home.text).toContain('FindIt test app');
    expect((await request(app).get('/assets/app.js')).status).toBe(200);
  });

  it('falls back to index.html for client-side routes', async () => {
    const res = await request(app).get('/items/abc123/edit');
    expect(res.status).toBe(200);
    expect(res.text).toContain('FindIt test app');
  });

  it('never serves the app for API or socket paths: unknown API routes stay JSON 404s', async () => {
    const api = await request(app).get('/api/v1/nope');
    expect(api.status).toBe(404);
    expect(api.headers['content-type']).toMatch(/json/);
    expect(api.body.success).toBe(false);
    expect((await request(app).get('/api/nope')).headers['content-type']).toMatch(/json/);
  });

  it('allows Cloudinary photos and blob previews in the content security policy', async () => {
    const csp = (await request(app).get('/')).headers['content-security-policy'];
    expect(csp).toMatch(/img-src[^;]*https:\/\/res\.cloudinary\.com/);
    expect(csp).toMatch(/img-src[^;]*blob:/);
    expect(csp).toMatch(/script-src 'self'/);
  });

  it('is off by default: without a client build the server only has the API', async () => {
    const plain = createApp({ apiRateLimitMax: 1_000_000 });
    expect((await request(plain).get('/')).status).toBe(404);
  });
});
