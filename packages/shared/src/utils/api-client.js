/**
 * Shared HTTP API client for all OPUS frontend packages.
 *
 * Provides a unified fetch wrapper with:
 *  - Bearer token authentication
 *  - Automatic JSON request/response handling
 *  - Structured error objects ({ message, status, code, details })
 *  - Configurable 401 handling (redirect or callback)
 *  - Optional token refresh support
 *
 * @example
 *   // Basic usage (admin)
 *   import { createApiClient } from '@opus/shared/utils/api-client';
 *   export const api = createApiClient({ tokenKey: 'opus_token', onUnauthorized: () => window.location.href = '/login' });
 *
 *   // With token refresh (waiter-app)
 *   export const api = createApiClient({
 *     tokenKey: 'opus_waiter_token',
 *     onUnauthorized: handleRefreshOrLogout,
 *   });
 */

/**
 * @typedef {object} ApiClientOptions
 * @property {string} [tokenKey='opus_token'] - localStorage key for the auth token
 * @property {string} [basePath='/api/v1'] - Base URL path for all requests
 * @property {((response: Response) => void | Promise<void>)} [onUnauthorized] - Callback on 401
 */

/**
 * Create a configured API client instance.
 *
 * @param {ApiClientOptions} [options]
 * @returns {ApiClient}
 */
export function createApiClient(options = {}) {
  const {
    tokenKey = 'opus_token',
    basePath = '/api/v1',
    onUnauthorized,
  } = options;

  return new ApiClient(tokenKey, basePath, onUnauthorized);
}

class ApiClient {
  /** @param {string} tokenKey @param {string} basePath @param {Function} [onUnauthorized] */
  constructor(tokenKey, basePath, onUnauthorized) {
    this._tokenKey = tokenKey;
    this._basePath = basePath;
    this._onUnauthorized = onUnauthorized;
    this.token = typeof localStorage !== 'undefined'
      ? localStorage.getItem(tokenKey)
      : null;
  }

  /** Persist (or clear) the token. */
  setToken(token) {
    this.token = token;
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem(this._tokenKey, token);
      else localStorage.removeItem(this._tokenKey);
    }
  }

  /**
   * Core request method.
   * @param {string} path - API path (appended to basePath)
   * @param {RequestInit & { skipAuth?: boolean }} [options]
   * @returns {Promise<any>} Parsed JSON response
   */
  async request(path, options = {}) {
    const { skipAuth, ...fetchOptions } = options;
    const url = `${this._basePath}${path}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && !skipAuth ? { Authorization: `Bearer ${this.token}` } : {}),
      ...fetchOptions.headers,
    };

    const res = await fetch(url, { ...fetchOptions, headers });

    if (res.status === 401) {
      if (this._onUnauthorized) {
        await this._onUnauthorized(res);
      }
      const error = new Error('No autorizado');
      error.status = 401;
      error.code = 'UNAUTHORIZED';
      throw error;
    }

    // Safely parse JSON — proxy errors or network issues may return non-JSON
    let data;
    try {
      data = await res.json();
    } catch {
      const error = new Error(
        res.ok ? 'Respuesta invalida del servidor' : `Error del servidor (${res.status})`
      );
      error.status = res.status;
      error.code = 'INVALID_RESPONSE';
      throw error;
    }

    if (!res.ok) {
      const error = new Error(data?.error?.message || 'Error del servidor');
      error.status = res.status;
      error.code = data?.error?.code;
      error.details = data?.error?.details;
      throw error;
    }

    return data;
  }

  /** GET request */
  get(path) { return this.request(path); }

  /** POST request with JSON body */
  post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  }

  /** PUT request with JSON body */
  put(path, body) {
    return this.request(path, { method: 'PUT', body: JSON.stringify(body) });
  }

  /** DELETE request */
  delete(path) {
    return this.request(path, { method: 'DELETE' });
  }

  /** Alias for delete (useful when `delete` is a reserved word in some contexts) */
  del(path) { return this.delete(path); }
}

export default ApiClient;
