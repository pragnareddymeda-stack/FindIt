import api from './client.js';

/** Returns the health payload; for a 503 (degraded) it still returns the payload. */
export async function getHealth() {
  try {
    const { data } = await api.get('/health');
    return data.data;
  } catch (err) {
    if (err.response?.data?.data) return err.response.data.data;
    throw err;
  }
}
