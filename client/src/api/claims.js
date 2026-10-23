import api from './client.js';

export async function createClaim(itemId, payload) {
  const { data } = await api.post(`/items/${itemId}/claims`, payload);
  return data.data.claim;
}

export async function listMyClaims(params) {
  const { data } = await api.get('/claims/me', { params });
  return { claims: data.data.claims, pagination: data.pagination };
}

export async function listIncomingClaims(params) {
  const { data } = await api.get('/claims/incoming', { params });
  return { claims: data.data.claims, pagination: data.pagination };
}

export async function listItemClaims(itemId, params) {
  const { data } = await api.get(`/items/${itemId}/claims`, { params });
  return { claims: data.data.claims, pagination: data.pagination };
}

/** Returns { claim, viewAs } where viewAs is 'FINDER' or 'CLAIMANT'. */
export async function getClaim(id) {
  const { data } = await api.get(`/claims/${id}`);
  return data.data;
}

export async function decideClaim(id, payload) {
  const { data } = await api.patch(`/claims/${id}/decision`, payload);
  return data.data;
}

export async function withdrawClaim(id) {
  const { data } = await api.patch(`/claims/${id}/withdraw`);
  return data.data;
}
