import { createApiClient } from '@opus/shared/utils/api-client';

export const api = createApiClient({
  tokenKey: 'opus_client_token',
  // Client app does not auto-redirect on 401 — the context handles it
});

export default api;
