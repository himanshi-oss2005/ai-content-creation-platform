import api from './axios';

export const userApi = {
  getProfile: () =>
    api.get('/users/profile').then((r) => r.data.user),

  updateProfile: (name) =>
    api.patch('/users/profile', { name }).then((r) => r.data.user),

  getCredits: () =>
    api.get('/users/credits').then((r) => r.data),

  getTransactions: ({ page = 1, limit = 15 } = {}) =>
    api.get('/users/transactions', { params: { page, limit } }).then((r) => r.data),

  getPromptHistory: () =>
    api.get('/users/prompt-history').then((r) => r.data.history),

  addPromptHistory: (prompt) =>
    api.post('/users/prompt-history', { prompt }),
};
