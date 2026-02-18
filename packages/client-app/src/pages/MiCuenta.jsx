import { useState, useEffect } from 'react';
import { useCliente } from '../context/ClienteContext';
import Header from '../components/Header';

export default function MiCuenta() {
  const { cliente, loyalty, isLoggedIn, login, logout, refreshLoyalty, loading: ctxLoading } = useCliente();
  const [phone, setPhone] = useState('');
  const [nombre, setNombre] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Refresh loyalty data when entering the page while logged in
  useEffect(() => {
    if (isLoggedIn) {
      refreshLoyalty();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(phone, nombre || undefined);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setPhone('');
    setNombre('');
  };

  const tierColors = {
    bronce: 'from-yellow-700 to-yellow-800',
    plata: 'from-gray-400 to-gray-500',
    oro: 'from-yellow-400 to-yellow-500',
    platino: 'from-purple-500 to-purple-600',
  };

  const tierIcons = {
    bronce: '🥉',
    plata: '🥈',
    oro: '🥇',
    platino: '💎',
  };

  if (ctxLoading) {
    return (
      <div className="pb-20">
        <Header title="Mi Cuenta" />
        <div className="flex items-center justify-center py-20 text-gray-400">Cargando...</div>
      </div>
    );
  }

  // --- LOGIN FORM ---
  if (!isLoggedIn) {
    return (
      <div className="pb-20">
        <Header title="Mi Cuenta" />
        <form onSubmit={handleLogin} className="px-6 py-8">
          <div className="text-center mb-8">
            <span className="text-5xl mb-4 block">⭐</span>
            <h2 className="text-xl font-bold">Programa de Lealtad</h2>
            <p className="text-sm text-gray-400 mt-1">Ingresa tus datos para ver tus puntos y hacer pedidos</p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg text-sm mb-4">{error}</div>
          )}

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Tu nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
            <input
              type="tel"
              required
              placeholder="Tu numero de telefono"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold disabled:opacity-50 transition-colors"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            Al ingresar, podras ver tus puntos, hacer pedidos y reservaciones.
          </p>
        </form>
      </div>
    );
  }

  // --- PROFILE VIEW ---
  const tier = loyalty?.nivel || cliente?.nivel_fidelizacion || 'bronce';
  const puntos = loyalty?.puntos_acumulados ?? cliente?.puntos_acumulados ?? 0;
  const hasLoyalty = !!(loyalty || cliente?.puntos_acumulados != null);
  const resumen = loyalty?.resumen;
  const ultimas = loyalty?.ultimas_transacciones;

  return (
    <div className="pb-20">
      <Header title="Mi Cuenta" />

      {/* Profile Header */}
      <div className="px-4 pt-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 flex items-center gap-4 shadow-sm">
          <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-2xl">
            {tierIcons[tier] || '👤'}
          </div>
          <div className="flex-1">
            <p className="font-bold text-lg">{cliente?.nombre || 'Cliente'}</p>
            <p className="text-sm text-gray-400">{cliente?.telefono}</p>
            {cliente?.email && <p className="text-xs text-gray-400">{cliente.email}</p>}
          </div>
        </div>
      </div>

      {/* Loyalty Card */}
      {hasLoyalty ? (
        <div className={`mx-4 mt-4 rounded-2xl bg-gradient-to-br ${tierColors[tier] || tierColors.bronce} text-white p-6 shadow-lg`}>
          <div className="flex items-center justify-between">
            <p className="text-sm opacity-80">Programa de Lealtad</p>
            <span className="text-2xl">{tierIcons[tier]}</span>
          </div>
          <div className="flex items-end justify-between mt-4">
            <div>
              <p className="text-3xl font-bold">{puntos}</p>
              <p className="text-xs opacity-80">puntos acumulados</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold uppercase">{tier}</p>
              <p className="text-xs opacity-80">nivel actual</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 text-white p-6 shadow-lg">
          <p className="text-sm opacity-80">Programa de Lealtad</p>
          <p className="mt-2 text-sm">
            Aun no tienes cuenta de lealtad. Pregunta en el restaurante para registrarte y empezar a acumular puntos.
          </p>
        </div>
      )}

      {/* Stats */}
      {resumen && (
        <div className="grid grid-cols-3 gap-2 px-4 mt-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-green-500">{resumen.total_acumulado || 0}</p>
            <p className="text-[10px] text-gray-400">Ganados</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-red-400">{resumen.total_canjeado || 0}</p>
            <p className="text-[10px] text-gray-400">Canjeados</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-orange-500">{resumen.total_transacciones || 0}</p>
            <p className="text-[10px] text-gray-400">Transacciones</p>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {ultimas?.length > 0 && (
        <div className="px-4 mt-4">
          <h3 className="font-semibold mb-3 text-sm">Ultimas Transacciones</h3>
          <div className="space-y-2">
            {ultimas.map((t, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t.descripcion}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(t.created_at).toLocaleDateString('es-MX', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                <span className={`font-bold ${t.puntos > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {t.puntos > 0 ? '+' : ''}{t.puntos}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="px-4 mt-8">
        <button
          onClick={handleLogout}
          className="w-full py-2.5 text-sm text-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 rounded-xl transition-colors"
        >
          Cerrar sesion
        </button>
      </div>
    </div>
  );
}
