import api from './client.js';

/** Server capabilities. Returns uploadsEnabled false when the server cannot be asked, so the UI never promises photos it cannot store. */
export async function getConfig() {
  try {
    const { data } = await api.get('/config');
    return { uploadsEnabled: Boolean(data.data.uploadsEnabled) };
  } catch {
    return { uploadsEnabled: false };
  }
}
