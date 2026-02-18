import { createContext, useContext, useState, useEffect } from 'react';

const ClienteContext = createContext(null);

const STORAGE_KEY = 'opus_cliente_profile';

/**
 * Tenant slug for this client-app instance.
 * In production this would come from the URL/subdomain.
 * For now, default to 'la-xola' or read from env.
 */
const TENANT_SLUG = import.meta.env.VITE_TENANT_SLUG || 'la-xola';

export function ClienteProvider({ children }) {
  const [cliente, setCliente] = useState(null);
  const [loyalty, setLoyalty] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cliente) setCliente(parsed.cliente);
        if (parsed.loyalty) setLoyalty(parsed.loyalty);
        if (parsed.session) setSession(parsed.session);
      }
    } catch { /* ignore corrupt data */ }
    setLoading(false);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (cliente || session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cliente, loyalty, session }));
    }
  }, [cliente, loyalty, session]);

  /**
   * Login via phone number + optional name.
   * Calls POST /api/v1/clientes/login with tenant_slug.
   */
  const login = async (telefono, nombre) => {
    const res = await fetch('/api/v1/clientes/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefono, nombre, tenant_slug: TENANT_SLUG }),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('No se pudo conectar al servidor. Intenta de nuevo.');
    }

    if (!res.ok) {
      throw new Error(data?.error?.message || 'Error al iniciar sesion');
    }

    setSession({
      session_id: data.session_id,
      token: data.token,
      telefono: data.telefono,
      cliente_nombre: data.cliente_nombre,
    });

    if (data.cliente) {
      setCliente(data.cliente);
    } else {
      // No loyalty account — save basic info
      setCliente({
        nombre: nombre || data.cliente_nombre,
        telefono: data.telefono,
      });
    }

    if (data.loyalty) {
      setLoyalty(data.loyalty);
    }

    return data;
  };

  /**
   * Refresh loyalty data (e.g., after visiting Mi Cuenta).
   */
  const refreshLoyalty = async () => {
    if (!session?.telefono) return null;
    try {
      const res = await fetch(
        `/api/v1/clientes/loyalty/${encodeURIComponent(session.telefono)}?tenant_slug=${TENANT_SLUG}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      if (data.cliente) setCliente(data.cliente);
      if (data.loyalty) setLoyalty(data.loyalty);
      return data;
    } catch {
      return null;
    }
  };

  /**
   * Logout — clear all state and localStorage.
   */
  const logout = () => {
    setCliente(null);
    setLoyalty(null);
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const isLoggedIn = !!session;

  return (
    <ClienteContext.Provider value={{
      cliente,
      loyalty,
      session,
      isLoggedIn,
      loading,
      tenantSlug: TENANT_SLUG,
      login,
      logout,
      refreshLoyalty,
    }}>
      {children}
    </ClienteContext.Provider>
  );
}

export function useCliente() {
  const ctx = useContext(ClienteContext);
  if (!ctx) throw new Error('useCliente must be used within ClienteProvider');
  return ctx;
}

export default ClienteContext;
