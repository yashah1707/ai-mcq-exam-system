import axios from 'axios';
import { requestLogout, showToast } from '../utils/appEvents';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

// attach token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Global response handler: if server returns 401, trigger app logout
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const requestUrl = String(err?.config?.url || '').toLowerCase();
    const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');
    const hadToken = Boolean(localStorage.getItem('token'));

    // Only force logout for protected API calls, not failed login attempts.
    if (status === 401 && hadToken && !isAuthEndpoint) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Inform the app that a logout should happen (AuthContext listens for this)
        requestLogout({ to: '/login' });
        // notify user
        showToast('Session expired or unauthorized. Please login again.', { type: 'warning' });
      } catch (e) {
        // no-op
      }
    }
    return Promise.reject(err);
  }
);

export default api;
