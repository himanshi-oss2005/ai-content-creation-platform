import api from './axios';

export const authApi = {
  register: (name, email, password) =>
    api.post('/auth/register', { name, email, password }).then((r) => r.data),

  login: (email, password) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),

  getMe: () =>
    api.get('/auth/me').then((r) => r.data.user),

  forgotPassword: (email) =>
    api.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token, password) =>
    api.post('/auth/reset-password', { token, password }).then((r) => r.data),

  logout: () =>
    api.post('/auth/logout').then((r) => r.data),
};
