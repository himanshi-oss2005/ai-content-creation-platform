import api from './axios';

export const contentApi = {
  generate: ({ type, tone, prompt, length = 'medium', language = 'English', keywords = [], wordCount } = {}) =>
    api.post('/content/generate', { type, tone, prompt, length, language, keywords, ...(wordCount && { wordCount }) })
       .then((r) => r.data),

  regenerate: ({ contentId, tone, length, keywords }) =>
    api.post('/content/regenerate', { contentId, tone, length, keywords })
       .then((r) => r.data),

  updateContent: (id, output) =>
    api.patch(`/content/${id}`, { output }).then((r) => r.data),

  generateToneComparison: ({ type, tones, prompt, length = 'medium', language = 'English', keywords = [] }) =>
    api.post('/content/generate/tone-compare', { type, tones, prompt, length, language, keywords })
       .then((r) => r.data),

  generateAB: ({ type, tone, prompt, length = 'medium', language = 'English', keywords = [] }) =>
    api.post('/content/generate/ab', { type, tone, prompt, length, language, keywords })
       .then((r) => r.data),

  selectABVariant: ({ selectedId, rejectedId }) =>
    api.post('/content/ab/select', { selectedId, rejectedId }).then((r) => r.data),

  getHistory: ({ page = 1, limit = 8, type, search, favorites, dateFrom, dateTo } = {}) => {
    const params = { page, limit };
    if (type)      params.type      = type;
    if (search)    params.search    = search;
    if (favorites) params.favorites = 'true';
    if (dateFrom)  params.dateFrom  = dateFrom;
    if (dateTo)    params.dateTo    = dateTo;
    return api.get('/content/history', { params }).then((r) => r.data);
  },

  getStats: () =>
    api.get('/content/stats').then((r) => r.data),

  delete: (id) =>
    api.delete(`/content/${id}`).then((r) => r.data),

  toggleFavorite: (id) =>
    api.patch(`/content/${id}/favorite`).then((r) => r.data),

  bulkExport: (ids, format) =>
    api.post('/content/bulk-export', { ids, format }, { responseType: 'blob' })
       .then((r) => r.data),

  toggleShare: (id) =>
    api.patch(`/content/${id}/share`).then((r) => r.data),

  getShared: (token) =>
    api.get(`/content/share/${token}`).then((r) => r.data),
};

export const templateApi = {
  list:   ()         => api.get('/templates').then((r) => r.data),
  create: (data)     => api.post('/templates', data).then((r) => r.data),
  update: (id, data) => api.patch(`/templates/${id}`, data).then((r) => r.data),
  delete: (id)       => api.delete(`/templates/${id}`).then((r) => r.data),
  use:    (id)       => api.post(`/templates/${id}/use`).then((r) => r.data),
};

export const adminApi = {
  getStats:       ()           => api.get('/admin/stats').then((r) => r.data),
  getUsers:       (params)     => api.get('/admin/users', { params }).then((r) => r.data),
  updateUserRole: (id, role)   => api.patch(`/admin/users/${id}/role`, { role }).then((r) => r.data),
  getAnalytics:   ()           => api.get('/admin/analytics').then((r) => r.data),
};
