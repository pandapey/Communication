import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    // Auto-logout on expired/invalid token (but keep the failing request's error)
    if (status === 401 && localStorage.getItem('token')) {
      const url = err?.config?.url || '';
      // don't loop on auth endpoints themselves
      if (!url.includes('/auth/login') && !url.includes('/auth/register') && !url.includes('/auth/me')) {
        localStorage.removeItem('token');
        if (!window.location.pathname.startsWith('/login')) {
          window.dispatchEvent(new CustomEvent('syncspace:unauthorized'));
        }
      }
    }
    return Promise.reject(err);
  }
);

export function apiErrorMessage(err, fallback = 'Something went wrong') {
  return err?.response?.data?.message || err?.message || fallback;
}

export default api;
