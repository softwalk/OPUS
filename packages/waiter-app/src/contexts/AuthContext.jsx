import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEYS = {
  accessToken: 'opus_waiter_token',
  refreshToken: 'opus_waiter_refresh_token',
  user: 'opus_waiter_user',
  tenant: 'opus_waiter_tenant',
};

const API_BASE = '/api/v1';

/**
 * AuthProvider — manages authentication state, token refresh, and provides
 * user/tenant info to all child components.
 *
 * Tokens:
 *   - accessToken: short-lived (15m default), used in API headers
 *   - refreshToken: long-lived (7d default), used to obtain new access tokens
 *
 * Automatic refresh: schedules token refresh before expiry. On 401, attempts
 * a single refresh before redirecting to login.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.user)); }
    catch { return null; }
  });
  const [tenant, setTenant] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.tenant)); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const accessTokenRef = useRef(localStorage.getItem(STORAGE_KEYS.accessToken));
  const refreshTokenRef = useRef(localStorage.getItem(STORAGE_KEYS.refreshToken));
  const refreshTimerRef = useRef(null);
  const isRefreshingRef = useRef(false);

  /** Persist tokens and schedule automatic refresh */
  const setTokens = useCallback((accessToken, refreshToken) => {
    accessTokenRef.current = accessToken;
    refreshTokenRef.current = refreshToken;

    if (accessToken) {
      localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
    } else {
      localStorage.removeItem(STORAGE_KEYS.accessToken);
    }

    if (refreshToken) {
      localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
    } else {
      localStorage.removeItem(STORAGE_KEYS.refreshToken);
    }

    // Schedule refresh 1 minute before access token expires
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    if (accessToken) {
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const expiresMs = payload.exp * 1000;
        const refreshAt = expiresMs - Date.now() - 60_000; // 1 min before expiry
        if (refreshAt > 0) {
          refreshTimerRef.current = setTimeout(() => refreshAccessToken(), refreshAt);
        }
      } catch { /* token parse error — skip scheduling */ }
    }
  }, []);

  /** Clear all auth state and redirect to login */
  const logout = useCallback(() => {
    setUser(null);
    setTenant(null);
    setTokens(null, null);
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.tenant);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, [setTokens]);

  /** Attempt to refresh the access token using the refresh token */
  const refreshAccessToken = useCallback(async () => {
    if (isRefreshingRef.current) return false;
    if (!refreshTokenRef.current) return false;

    isRefreshingRef.current = true;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTokenRef.current }),
      });

      if (!res.ok) {
        logout();
        return false;
      }

      const data = await res.json();
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch {
      logout();
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [logout, setTokens]);

  /** Login — calls /auth/login and stores tokens + user + tenant */
  const login = useCallback(async ({ codigo, password, tenant_slug }) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, password, tenant_slug }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || 'Credenciales invalidas');
      }

      setTokens(data.accessToken || data.token, data.refreshToken);
      setUser(data.user);
      setTenant(data.tenant);
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));
      localStorage.setItem(STORAGE_KEYS.tenant, JSON.stringify(data.tenant));

      return data;
    } finally {
      setLoading(false);
    }
  }, [setTokens]);

  /**
   * Authenticated fetch wrapper. On 401, attempts one refresh before failing.
   * All API calls should go through this method.
   */
  const authFetch = useCallback(async (path, options = {}) => {
    const url = `${API_BASE}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(accessTokenRef.current ? { Authorization: `Bearer ${accessTokenRef.current}` } : {}),
      ...options.headers,
    };

    let res = await fetch(url, { ...options, headers });

    // On 401, try refreshing the token once
    if (res.status === 401 && refreshTokenRef.current) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry with new token
        const retryHeaders = {
          ...headers,
          Authorization: `Bearer ${accessTokenRef.current}`,
        };
        res = await fetch(url, { ...options, headers: retryHeaders });
      }
    }

    if (res.status === 401) {
      logout();
      throw new Error('No autorizado');
    }

    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data?.error?.message || 'Error');
      error.status = res.status;
      error.code = data?.error?.code;
      throw error;
    }

    return data;
  }, [refreshAccessToken, logout]);

  /** Convenience methods */
  const get = useCallback((path) => authFetch(path), [authFetch]);
  const post = useCallback((path, body) =>
    authFetch(path, { method: 'POST', body: JSON.stringify(body) }), [authFetch]);
  const put = useCallback((path, body) =>
    authFetch(path, { method: 'PUT', body: JSON.stringify(body) }), [authFetch]);
  const del = useCallback((path) =>
    authFetch(path, { method: 'DELETE' }), [authFetch]);

  // Schedule initial token refresh on mount
  useEffect(() => {
    if (accessTokenRef.current) {
      try {
        const payload = JSON.parse(atob(accessTokenRef.current.split('.')[1]));
        const expiresMs = payload.exp * 1000;
        const refreshAt = expiresMs - Date.now() - 60_000;
        if (refreshAt > 0) {
          refreshTimerRef.current = setTimeout(() => refreshAccessToken(), refreshAt);
        } else if (refreshTokenRef.current) {
          // Access token already expired — try refreshing now
          refreshAccessToken();
        }
      } catch { /* ignore parse errors */ }
    }
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [refreshAccessToken]);

  const isAuthenticated = !!user && !!accessTokenRef.current;

  const value = {
    user,
    tenant,
    loading,
    isAuthenticated,
    login,
    logout,
    get,
    post,
    put,
    del,
    authFetch,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context.
 * @returns {{ user, tenant, loading, isAuthenticated, login, logout, get, post, put, del, authFetch }}
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
