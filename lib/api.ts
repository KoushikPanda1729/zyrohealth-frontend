'use client';

import axios from 'axios';
import { env } from './env';
import { getRefreshToken, setToken, setRefreshToken, clearAuth } from './auth';

export const api = axios.create({
  baseURL: env.API_URL,
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
  queue.forEach((p) => (token ? p.resolve(token) : p.reject(error)));
  queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    // Don't retry the refresh endpoint itself
    if (original.url?.includes('/api/auth/refresh')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry) {
      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        clearAuth();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers['Authorization'] = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${env.API_URL}/api/auth/refresh`, { refreshToken });
        const tokens = data.data ?? data;
        const newAccessToken = tokens.accessToken;
        const newRefreshToken = tokens.refreshToken;

        setToken(newAccessToken);
        if (newRefreshToken) setRefreshToken(newRefreshToken);

        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        original.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(original);
      } catch (err) {
        processQueue(err, null);
        clearAuth();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export const apiCall = async (method: string, path: string, data?: unknown) => {
  const res = await api({ method, url: path, data });
  return res.data;
};
