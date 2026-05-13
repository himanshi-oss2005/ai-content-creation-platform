import api from './axios';

export const paymentApi = {
  createCheckout: () =>
    api.post('/payments/checkout').then((r) => r.data),

  cancelSubscription: () =>
    api.post('/payments/cancel').then((r) => r.data),
};
