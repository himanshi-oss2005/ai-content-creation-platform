import axios from 'axios';

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const BASE = isLocal ? (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') : (import.meta.env.VITE_API_URL || '/api');

const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ── Prime CSRF cookie then attach token on every mutating request ────────────
let csrfReady = false;
let csrfPromise = null;

let savedCsrfToken = null;

function getCsrfToken() {
  if (savedCsrfToken) return savedCsrfToken;
  const token = document.cookie
    .split('; ')
    .find((c) => c.startsWith('XSRF-TOKEN='))
    ?.split('=')[1];
  return token;
}

api.interceptors.request.use(async (config) => {
  // For mutating requests, ensure CSRF is ready before proceeding
  if (['post', 'put', 'patch', 'delete'].includes(config.method) && !csrfReady) {
    // If another request is already priming CSRF, wait for it
    if (!csrfPromise) {
      csrfPromise = axios
        .get(`${BASE}/health`, { withCredentials: true })
        .then(() => { csrfReady = true; })
        .catch((err) => { 
          // Log error but continue anyway - health check might not be critical
          console.warn('CSRF init health check failed:', err.message);
          csrfReady = true;
        });
    }
    await csrfPromise;
  }
  
  // Get CSRF token and add to headers with correct case
  const csrf = getCsrfToken();
  if (csrf) {
    // Use lowercase header name to match backend expectation
    config.headers['x-xsrf-token'] = csrf;
  } else if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
    // Log warning if CSRF token is missing for a mutating request
    console.warn('CSRF token not found in cookies for', config.method.toUpperCase(), config.url);
  }
  
  // Ensure Content-Type is always set for mutating requests
  if (['post', 'put', 'patch'].includes(config.method) && !config.data) {
    config.data = {};
  }
  return config;
});

// ── Response interceptor — normalise errors & capture CSRF ────────────────────
api.interceptors.response.use(
  (res) => {
    // Capture CSRF token from headers if backend provides it (for cross-domain setups)
    if (res.headers['x-xsrf-token']) {
      savedCsrfToken = res.headers['x-xsrf-token'];
    }
    return res;
  },
  (err) => {
    const status = err.response?.status;

    // Auto-logout on 401 — token expired or invalid
    if (status === 401) {
      // Redirect only if not already on an auth page
      if (!window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/signup')) {
        window.location.href = '/login';
      }
    }

    // Log full error response for debugging
    if (status === 400 || status === 403) {
      console.error(`API Error ${status}:`, {
        url: err.config?.url,
        method: err.config?.method,
        headers: err.config?.headers,
        responseData: err.response?.data,
      });
    }

    // Normalise error message — never expose raw stack traces to the UI
    let serverMessage = err.response?.data?.error || err.response?.data?.message;
    
    if (!serverMessage && err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
      serverMessage = err.response.data.errors[0]?.msg || err.response.data.errors[0];
    }

    if (typeof serverMessage === 'object' && serverMessage !== null) {
      serverMessage = serverMessage.message || serverMessage.msg || JSON.stringify(serverMessage);
    }

    const networkMessage = err.code === 'ECONNABORTED' ? 'Request timed out. Please try again.' : null;
    const fallback = typeof status === 'number' && status >= 500
      ? 'Something went wrong on our end. Please try again.'
      : err.message || 'Request failed';

    const message = serverMessage || networkMessage || fallback;

    return Promise.reject(new Error(message));
  }
);

export default api;
