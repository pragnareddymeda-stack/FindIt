import request from 'supertest';
import { getCsrf, registerVia } from './app.js';

export async function makeUserOn(app, email) {
  const agent = request.agent(app);
  const res = await registerVia(agent, { email, name: email.split('@')[0] });
  const csrf = await getCsrf(agent);
  return { agent, csrf, id: res.body.data.user.id };
}

export const post = (u, url, body = {}) => u.agent.post(url).set('X-CSRF-Token', u.csrf).send(body);
export const patch = (u, url, body = {}) => u.agent.patch(url).set('X-CSRF-Token', u.csrf).send(body);

/** A finder with a FOUND report and a claimant with a PENDING claim on it. */
export async function claimFlow(app) {
  const finder = await makeUserOn(app, 'finder@example.com');
  const claimant = await makeUserOn(app, 'claimant@example.com');
  const item = (await post(finder, '/api/v1/items', {
    type: 'FOUND', title: 'Brown wallet', category: 'WALLETS_PURSES', description: 'Found on a bench near the cafeteria.',
    dateOccurred: '2026-10-11', location: 'Cafeteria', privateDetails: 'Card of Ravi',
    verificationQuestions: [{ question: 'Which bank card is inside?', expectedAnswer: 'HDFC' }],
  })).body.data.item;
  const qid = (await finder.agent.get(`/api/v1/items/${item.id}`)).body.data.item.verificationQuestions[0].id;
  const claimBody = { explanation: 'It is my wallet, lost on Friday.', answers: [{ questionId: qid, answer: 'HDFC' }] };
  const claimId = (await post(claimant, `/api/v1/items/${item.id}/claims`, claimBody)).body.data.claim.id;
  const approve = () => patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'APPROVED', reviewNote: 'Answers match.' });
  const reject = () => patch(finder, `/api/v1/claims/${claimId}/decision`, { decision: 'REJECTED', reviewNote: 'Colour is wrong.' });
  const conversationId = async (u) => (await u.agent.get(`/api/v1/claims/${claimId}/conversation`)).body.data.conversation.id;
  return { finder, claimant, itemId: item.id, claimId, claimBody, approve, reject, conversationId };
}
