import axios from 'axios';

// In production VITE_API_URL = 'https://your-app.onrender.com/api' (or 'https://your-app.onrender.com')
// In dev, Vite proxies /api → localhost:5000
let rawURL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

let baseURL;
if (rawURL) {
  // If user provided full URL without /api, ensure /api is attached
  baseURL = rawURL.endsWith('/api') ? rawURL : `${rawURL}/api`;
} else {
  // Fallback to relative /api for local dev proxy
  baseURL = '/api';
}

if (typeof window !== 'undefined') {
  console.log('🔗 [NTEE API] Target:', baseURL, '| VITE_API_URL env:', import.meta.env.VITE_API_URL || '(not set)');
}

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ── Global response error handler ─────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status;
    const url     = error.config?.url ?? '';

    // 401 on any non-login endpoint → token is invalid/expired → force logout
    if (status === 401 && !url.includes('/auth/login')) {
      localStorage.removeItem('ntee_token');
      localStorage.removeItem('ntee_user');
      // Dispatch a custom event so AuthContext can react without a circular import
      window.dispatchEvent(new CustomEvent('ntee:session-expired'));
    }

    // 403 should NOT log the user out — it's a permission issue, not an auth issue
    // (e.g. trying to access a resource that belongs to someone else)

    return Promise.reject(error);
  }
);

export default api;
