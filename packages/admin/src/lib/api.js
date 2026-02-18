import { createApiClient } from '@opus/shared/utils/api-client';

export const api = createApiClient({
  tokenKey: 'opus_token',
  onUnauthorized: () => {
    localStorage.removeItem('opus_token');
    window.location.href = '/login';
  },
});

export default api;
