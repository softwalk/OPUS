const API_BASE = '/api/v1';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('opus_client_token');
  }

  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('opus_client_token', token);
    else localStorage.removeItem('opus_client_token');
  }

  async request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data?.error?.message || 'Error');
      error.status = res.status;
      throw error;
    }
    return data;
  }

  get(path) { return this.request(path); }
  post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body) }); }
  put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body) }); }
}

export const api = new ApiClient();
export default api;
