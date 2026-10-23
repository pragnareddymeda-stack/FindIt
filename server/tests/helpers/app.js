import request from 'supertest';
import { createApp } from '../../src/app.js';

export const buildTestApp = () => createApp({ authRateLimitMax: 1000, messageRateLimitMax: 1000, apiRateLimitMax: 1_000_000 });

export async function getCsrf(agent) {
  const res = await agent.get('/api/v1/auth/csrf');
  return res.body.data.csrfToken;
}

export const validUser = (overrides = {}) => ({
  name: 'Asha Verma',
  email: 'asha@example.com',
  password: 'Passw0rdOK',
  ...overrides,
});

export async function registerVia(agent, overrides = {}) {
  const token = await getCsrf(agent);
  return agent.post('/api/v1/auth/register').set('X-CSRF-Token', token).send(validUser(overrides));
}

export async function loginVia(agent, creds) {
  const token = await getCsrf(agent);
  return agent.post('/api/v1/auth/login').set('X-CSRF-Token', token).send(creds);
}

export { request };
