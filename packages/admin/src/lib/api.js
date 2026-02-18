const API_BASE = '/api/v1';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('opus_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('opus_token', token);
    } else {
      localStorage.removeItem('opus_token');
    }
  }

  async request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    const res = await fetch(url, { ...options, headers });
    
    if (res.status === 401) {
      this.setToken(null);
      window.location.href = '/login';
      throw new Error('No autorizado');
    }

    const data = await res.json();
    
    if (!res.ok) {
      const error = new Error(data?.error?.message || 'Error del servidor');
      error.status = res.status;
      error.code = data?.error?.code;
      error.details = data?.error?.details;
      throw error;
    }

    return data;
  }

  get(path) { return this.request(path); }
  
  post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  }
  
  put(path, body) {
    return this.request(path, { method: 'PUT', body: JSON.stringify(body) });
  }
  
  delete(path) {
    return this.request(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
export default api;
