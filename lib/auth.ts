export const getToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

export const setToken = (token: string) =>
  localStorage.setItem('accessToken', token);

export const getRefreshToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;

export const setRefreshToken = (token: string) =>
  localStorage.setItem('refreshToken', token);

export const clearToken = () =>
  localStorage.removeItem('accessToken');

export const getUser = () => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
};

export const setUser = (user: object) =>
  localStorage.setItem('user', JSON.stringify(user));

export const clearAuth = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
};
