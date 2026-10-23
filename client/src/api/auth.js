import api from './client.js';

/** Returns the current user, or null when there is no valid session. */
export async function fetchMe() {
  try {
    const { data } = await api.get('/auth/me');
    return data.data.user;
  } catch (err) {
    if (err.response?.status === 401) return null;
    throw err;
  }
}

export async function loginRequest(values) {
  const { data } = await api.post('/auth/login', values);
  return data.data.user;
}

export async function registerRequest(values) {
  const { data } = await api.post('/auth/register', values);
  return data.data.user;
}

export async function logoutRequest() {
  await api.post('/auth/logout');
}

export async function updateProfileRequest(values) {
  const { data } = await api.patch('/users/me', values);
  return data.data.user;
}
