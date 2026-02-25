import axios from 'axios';

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
    if (status === 401) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Inform the app that a logout should happen (AuthContext listens for this)
        window.dispatchEvent(new CustomEvent('app:logout'));
        // notify user
        window.dispatchEvent(new CustomEvent('app:toast', { detail: { type: 'warning', message: 'Session expired or unauthorized. Please login again.' } }));
      } catch (e) {
        // no-op
      }
    }
    return Promise.reject(err);
  }
);

export default api;
