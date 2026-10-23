import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import ItemReport from '../src/models/ItemReport.js';
import { detectImageType } from '../src/utils/imageType.js';

vi.mock('../src/services/cloudinary.js', () => ({ uploadImage: vi.fn(), deleteImage: vi.fn() }));
import { uploadImage, deleteImage } from '../src/services/cloudinary.js';
import { startTestDb, clearTestDb, stopTestDb } from './helpers/db.js';
import { buildTestApp, getCsrf } from './helpers/app.js';
import { makeUserOn, post, patch } from './helpers/flow.js';

const app = buildTestApp();
const makeUser = (email) => makeUserOn(app, email);

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(32)]);

const ENV = { CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' };
const setEnv = () => Object.assign(process.env, ENV);
const clearEnv = () => Object.keys(ENV).forEach((k) => delete process.env[k]);

beforeAll(startTestDb);
afterAll(async () => { clearEnv(); await stopTestDb(); });
beforeEach(async () => {
  await clearTestDb();
  vi.clearAllMocks();
  setEnv();
  uploadImage.mockResolvedValue({ url: 'https://res.cloudinary.com/demo/image/upload/v1/findit/items/a1.png', publicId: 'findit/items/a1' });
  deleteImage.mockResolvedValue(undefined);
});
afterEach(clearEnv);

const lostBody = () => ({
  type: 'LOST', title: 'Black wallet', category: 'WALLETS_PURSES', description: 'Lost near the library entrance.',
  dateOccurred: '2026-10-10', location: 'Library',
});
const newItem = async (u) => (await post(u, '/api/v1/items', lostBody())).body.data.item;
const upload = (u, id, buffer, { filename = 'photo.png', contentType = 'image/png' } = {}) =>
  u.agent.post(`/api/v1/items/${id}/image`).set('X-CSRF-Token', u.csrf).attach('image', buffer, { filename, contentType });

describe('detectImageType', () => {
  it('recognises JPEG, PNG and WebP by their bytes and nothing else', () => {
    expect(detectImageType(JPEG)).toBe('image/jpeg');
    expect(detectImageType(PNG)).toBe('image/png');
    expect(detectImageType(WEBP)).toBe('image/webp');
    expect(detectImageType(Buffer.from('<?php echo 1; ?> not an image at all'))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectImageType(Buffer.alloc(3))).toBeNull();
    expect(detectImageType(null)).toBeNull();
  });
});

describe('GET /config', () => {
  it('reports whether photo upload is available', async () => {
    expect((await request(app).get('/api/v1/config')).body.data.uploadsEnabled).toBe(true);
    clearEnv();
    expect((await request(app).get('/api/v1/config')).body.data.uploadsEnabled).toBe(false);
  });
});

describe('uploading a photo', () => {
  it('says plainly that it is not configured when Cloudinary is not set up', async () => {
    const owner = await makeUser('owner@example.com');
    const item = await newItem(owner);
    clearEnv();
    const res = await upload(owner, item.id, PNG);
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/not configured/i);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('stores the photo URL for the owner and shows it publicly, without the internal id', async () => {
    const owner = await makeUser('owner@example.com');
    const item = await newItem(owner);
    const res = await upload(owner, item.id, PNG);
    expect(res.status).toBe(200);
    expect(res.body.data.item.imageUrl).toBe('https://res.cloudinary.com/demo/image/upload/v1/findit/items/a1.png');
    expect(uploadImage).toHaveBeenCalledTimes(1);

    const pub = await request(app).get(`/api/v1/items/${item.id}`);
    expect(pub.body.data.item.imageUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    const list = await request(app).get('/api/v1/items');
    expect(list.body.data.items[0].imageUrl).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(JSON.stringify([res.body, pub.body, list.body])).not.toMatch(/imagePublicId|findit\/items\/a1"/);
  });

  it('accepts JPEG and WebP too', async () => {
    const owner = await makeUser('owner@example.com');
    const item = await newItem(owner);
    expect((await upload(owner, item.id, JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })).status).toBe(200);
    expect((await upload(owner, item.id, WEBP, { filename: 'a.webp', contentType: 'image/webp' })).status).toBe(200);
  });

  it('replaces an earlier photo and deletes the old one from Cloudinary', async () => {
    const owner = await makeUser('owner@example.com');
    const item = await newItem(owner);
    await upload(owner, item.id, PNG);
    uploadImage.mockResolvedValue({ url: 'https://res.cloudinary.com/demo/image/upload/v2/findit/items/b2.png', publicId: 'findit/items/b2' });
    const res = await upload(owner, item.id, PNG);
    expect(res.body.data.item.imageUrl).toMatch(/b2\.png$/);
    expect(deleteImage).toHaveBeenCalledWith('findit/items/a1');
  });

  it('is limited to the owner of an active report, and needs a login', async () => {
    const owner = await makeUser('owner@example.com');
    const other = await makeUser('other@example.com');
    const item = await newItem(owner);
    expect((await upload(other, item.id, PNG)).status).toBe(403);
    const anon = request.agent(app);
    const csrf = await getCsrf(anon);
    expect((await anon.post(`/api/v1/items/${item.id}/image`).set('X-CSRF-Token', csrf).attach('image', PNG, { filename: 'a.png', contentType: 'image/png' })).status).toBe(401);
    expect((await upload(owner, '64b7f0f0f0f0f0f0f0f0f0f0', PNG)).status).toBe(404);
    expect((await upload(owner, 'not-an-id', PNG)).status).toBe(404);
    await ItemReport.updateOne({ _id: item.id }, { status: 'WITHDRAWN' });
    expect((await upload(owner, item.id, PNG)).status).toBe(409);
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('needs the CSRF token', async () => {
    const owner = await makeUser('owner@example.com');
    const item = await newItem(owner);
    const res = await owner.agent.post(`/api/v1/items/${item.id}/image`).attach('image', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
  });

  it.each([
    ['a text file', Buffer.from('just some text, not an image'), { filename: 'a.txt', contentType: 'text/plain' }, 400],
    ['an SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), { filename: 'a.svg', contentType: 'image/svg+xml' }, 400],
    ['text pretending to be a PNG', Buffer.from('<script>alert(1)</script> padding padding'), { filename: 'a.png', contentType: 'image/png' }, 400],
    ['a PNG labelled as JPEG', PNG, { filename: 'a.jpg', contentType: 'image/jpeg' }, 400],
    ['a file over 3 MB', Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024 + 10)]), { filename: 'big.png', contentType: 'image/png' }, 413],
  ])('rejects %s', async (_label, buffer, opts, status) => {
    const owner = await makeUser('owner@example.com');
    const item = await newItem(owner);
    const res = await upload(owner, item.id, buffer, opts);
    expect(res.status).toBe(status);
    expect(uploadImage).not.toHaveBeenCalled();
    expect((await ItemReport.findById(item.id)).imageUrl).toBe('');
  });

  it('rejects a request with no file', async () => {
    const owner = await makeUser('owner@example.com');
    const item = await newItem(owner);
    const res = await owner.agent.post(`/api/v1/items/${item.id}/image`).set('X-CSRF-Token', owner.csrf).field('note', 'no file here');
    expect(res.status).toBe(400);
  });

  it('reports an upstream failure honestly and leaves the report unchanged', async () => {
    const owner = await makeUser('owner@example.com');
    const item = await newItem(owner);
    uploadImage.mockRejectedValue(new Error('cloudinary down'));
    const res = await upload(owner, item.id, PNG);
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).not.toMatch(/cloudinary down|stack/i);
    expect((await ItemReport.findById(item.id)).imageUrl).toBe('');
  });

  it('cannot be set through a normal create or edit request', async () => {
    const owner = await makeUser('owner@example.com');
    const fake = 'https://res.cloudinary.com/demo/image/upload/evil.png';
    const created = await post(owner, '/api/v1/items', { ...lostBody(), imageUrl: fake, imagePublicId: 'x' });
    expect(created.status).toBe(201);
    expect(created.body.data.item.imageUrl).toBe('');
    const edited = await patch(owner, `/api/v1/items/${created.body.data.item.id}`, { title: 'New title here', imageUrl: fake });
    expect(edited.body.data.item.imageUrl).toBe('');
  });
});

describe('removing a photo', () => {
  it('removes it from the report and from Cloudinary', async () => {
    const owner = await makeUser('owner@example.com');
    const item = await newItem(owner);
    await upload(owner, item.id, PNG);
    const res = await owner.agent.delete(`/api/v1/items/${item.id}/image`).set('X-CSRF-Token', owner.csrf);
    expect(res.status).toBe(200);
    expect(res.body.data.item.imageUrl).toBe('');
    expect(deleteImage).toHaveBeenCalledWith('findit/items/a1');
    expect((await owner.agent.delete(`/api/v1/items/${item.id}/image`).set('X-CSRF-Token', owner.csrf)).status).toBe(404);
  });

  it('is limited to the owner', async () => {
    const owner = await makeUser('owner@example.com');
    const other = await makeUser('other@example.com');
    const item = await newItem(owner);
    await upload(owner, item.id, PNG);
    expect((await other.agent.delete(`/api/v1/items/${item.id}/image`).set('X-CSRF-Token', other.csrf)).status).toBe(403);
    expect((await ItemReport.findById(item.id)).imageUrl).not.toBe('');
  });
});
