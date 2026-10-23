import axios from 'axios';

// withCredentials sends the HTTP-only auth cookie. The JWT is never readable from JavaScript.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
});

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
let csrfToken = null;
let csrfRequest = null;

// The CSRF token is kept in memory only (not localStorage); the server pairs it with an HTTP-only cookie.
async function ensureCsrfToken() {
  if (csrfToken) return csrfToken;
  csrfRequest ??= api
    .get('/auth/csrf')
    .then((res) => (csrfToken = res.data.data.csrfToken))
    .finally(() => { csrfRequest = null; });
  return csrfRequest;
}

api.interceptors.request.use(async (config) => {
  if (UNSAFE.has((config.method || 'get').toUpperCase())) {
    config.headers['X-CSRF-Token'] = await ensureCsrfToken();
  }
  return config;
});

// If the CSRF cookie expired, fetch a fresh token and retry once.
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;
    if (response?.status === 403 && response.data?.code === 'CSRF_INVALID' && config && !config._csrfRetried) {
      config._csrfRetried = true;
      csrfToken = null;
      return api(config);
    }
    throw error;
  },
);

export default api;
