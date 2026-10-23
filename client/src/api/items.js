import api from './client.js';

export async function listItems(params) {
  const { data } = await api.get('/items', { params });
  return { items: data.data.items, pagination: data.pagination };
}

export async function listMyItems(params) {
  const { data } = await api.get('/items/mine', { params });
  return { items: data.data.items, pagination: data.pagination };
}

export async function getItem(id) {
  const { data } = await api.get(`/items/${id}`);
  return data.data.item;
}

export async function createItem(payload) {
  const { data } = await api.post('/items', payload);
  return data.data.item;
}

export async function updateItem(id, payload) {
  const { data } = await api.patch(`/items/${id}`, payload);
  return data.data.item;
}

export async function withdrawItem(id) {
  const { data } = await api.delete(`/items/${id}`);
  return data.data.item;
}

export async function getMatches(id) {
  const { data } = await api.get(`/items/${id}/matches`);
  return data.data;
}

export async function reportListing(id, payload) {
  const { data } = await api.post(`/items/${id}/abuse`, payload);
  return data.data.abuseReport;
}

export async function uploadItemImage(id, file) {
  const form = new FormData();
  form.append('image', file);
  const { data } = await api.post(`/items/${id}/image`, form);
  return data.data.item;
}

export async function deleteItemImage(id) {
  const { data } = await api.delete(`/items/${id}/image`);
  return data.data.item;
}
