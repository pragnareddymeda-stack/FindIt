import api from './client.js';

export async function createHandover(claimId) {
  const { data } = await api.post(`/claims/${claimId}/handover`);
  return data.data.handover;
}

export async function listMyHandovers(params) {
  const { data } = await api.get('/handovers/me', { params });
  return { handovers: data.data.handovers, pagination: data.pagination };
}

export async function getHandover(id) {
  const { data } = await api.get(`/handovers/${id}`);
  return data.data.handover;
}

export async function updateHandoverStatus(id, payload) {
  const { data } = await api.patch(`/handovers/${id}/status`, payload);
  return data.data.handover;
}
