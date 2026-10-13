import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
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
