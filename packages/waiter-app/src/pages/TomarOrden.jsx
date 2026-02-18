import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatMoney } from '../lib/format';

export default function TomarOrden() {
  const { get, post, del } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const cuentaId = searchParams.get('cuenta');

  // --- Order-taking state (when cuenta is selected) ---
  const [cuenta, setCuenta] = useState(null);
  const [productos, setProductos] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [activeGroup, setActiveGroup] = useState(null);

  // --- Active cuentas list (when no cuenta selected) ---
  const [cuentasAbiertas, setCuentasAbiertas] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        if (cuentaId) {
          // Load cuenta + productos for order-taking
          const [c, p] = await Promise.all([
            get(`/pos/cuentas/${cuentaId}`),
            get('/productos?limit=200'),
          ]);
          if (c) setCuenta(c);
          setProductos(p?.productos || p?.data || (Array.isArray(p) ? p : []));
        } else {
          // Load all open cuentas so waiter can pick one
          const mesas = await get('/pos/mesas');
          const abiertas = (mesas || []).filter(m => m.estado === 'ocupada' && m.cuenta_id);
          setCuentasAbiertas(abiertas);
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, [cuentaId]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2000); };

  const addConsumo = async (productoId) => {
    if (!cuentaId) return;
    try {
      await post('/pos/consumos', { cuenta_id: cuentaId, producto_id: productoId, cantidad: 1 });
      showToast('Agregado');
      const updated = await get(`/pos/cuentas/${cuentaId}`);
      setCuenta(updated);
    } catch (err) {
      showToast(err.message);
    }
  };

  const cancelConsumo = async (consumoId) => {
    try {
      await del(`/pos/consumos/${consumoId}`);
      showToast('Cancelado');
      const updated = await get(`/pos/cuentas/${cuentaId}`);
      setCuenta(updated);
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleCobrar = async () => {
    try {
      const formasPago = await get('/pos/formas-pago');
      if (formasPago?.length > 0) {
        await post(`/pos/cuentas/${cuentaId}/cobrar`, { forma_pago_id: formasPago[0].id, propina: 0 });
        showToast('Cuenta cobrada');
        navigate('/mesas');
      }
    } catch (err) {
      showToast(err.message);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">Cargando...</div>;

  // ======================================================================
  // NO CUENTA SELECTED — Show list of open cuentas to pick from
  // ======================================================================
  if (!cuentaId) {
    return (
      <div className="pb-20 px-4 pt-4">
        <h1 className="text-xl font-bold mb-4">Tomar Orden</h1>

        {cuentasAbiertas.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-5xl mb-4 block">&#128221;</span>
            <p className="text-gray-400 mb-2">No hay mesas abiertas</p>
            <p className="text-gray-400 text-sm mb-6">Abre una mesa primero para tomar ordenes</p>
            <button onClick={() => navigate('/mesas')} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium">
              Ir a Mesas
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-400 mb-3">Selecciona una mesa para agregar productos:</p>
            {cuentasAbiertas.map(mesa => (
              <button
                key={mesa.id}
                onClick={() => navigate(`/orden?cuenta=${mesa.cuenta_id}`)}
                className="w-full flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 active:bg-blue-50 dark:active:bg-blue-900/10 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <span className="text-xl font-bold text-blue-600">{mesa.numero}</span>
                  </div>
                  <div>
                    <p className="font-semibold">Mesa {mesa.numero}</p>
                    <p className="text-xs text-gray-400">
                      {mesa.personas || '?'} persona{mesa.personas !== 1 ? 's' : ''}
                      {mesa.mesero_nombre ? ` · ${mesa.mesero_nombre}` : ''}
                      {mesa.zona_nombre ? ` · ${mesa.zona_nombre}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">{formatMoney(mesa.total)}</p>
                  <p className="text-xs text-gray-400">abierta</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ======================================================================
  // CUENTA SELECTED — Full order-taking UI
  // ======================================================================

  // Group products by grupo for easy navigation
  const terminados = productos.filter(p => p.tipo === 'terminado');
  const grupos = [...new Set(terminados.map(p => p.grupo_nombre || 'Sin Grupo'))].sort();

  const filteredProds = terminados.filter(p => {
    const matchesSearch = !search || p.descripcion?.toLowerCase().includes(search.toLowerCase());
    const matchesGroup = !activeGroup || (p.grupo_nombre || 'Sin Grupo') === activeGroup;
    return matchesSearch && matchesGroup;
  });

  const activeConsumos = (cuenta?.consumos || []).filter(c => c.estado !== 'cancelado');

  return (
    <div className="pb-20">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 inset-x-4 z-50 bg-blue-600 text-white py-2 px-4 rounded-lg text-center text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      {/* Header with cuenta info */}
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/orden')} className="text-blue-200 hover:text-white">
            &#8592;
          </button>
          <div>
            <p className="font-bold">Mesa {cuenta?.mesa_numero}</p>
            <p className="text-xs text-blue-200">
              {activeConsumos.length} item{activeConsumos.length !== 1 ? 's' : ''}
              {cuenta?.mesero_nombre ? ` · ${cuenta.mesero_nombre}` : ''}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold">{formatMoney(cuenta?.total)}</p>
          <button onClick={handleCobrar} className="text-xs bg-white text-blue-600 px-3 py-1 rounded-full font-medium mt-1">
            Cobrar
          </button>
        </div>
      </div>

      {/* Category tabs */}
      {grupos.length > 1 && (
        <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <button
            onClick={() => setActiveGroup(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors
              ${!activeGroup ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            Todos
          </button>
          {grupos.map(g => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors
                ${activeGroup === g ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-0 h-[calc(100vh-160px)]">
        {/* Product list */}
        <div className="overflow-y-auto border-r border-gray-200 dark:border-gray-800">
          <div className="p-3">
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm border-0"
            />
          </div>
          <div className="px-3 space-y-1 pb-4">
            {filteredProds.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">No hay productos</p>
            ) : (
              filteredProds.map(p => (
                <button
                  key={p.id}
                  onClick={() => addConsumo(p.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/10 active:bg-blue-100 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-sm">{p.descripcion}</p>
                    <p className="text-xs text-gray-400">{p.clave}</p>
                  </div>
                  <span className="font-bold text-blue-600 text-sm">{formatMoney(p.precio_venta)}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Current order */}
        <div className="overflow-y-auto bg-gray-50 dark:bg-gray-950">
          <div className="p-3">
            <h3 className="font-semibold text-sm mb-2">Consumos ({activeConsumos.length})</h3>
            {activeConsumos.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">Sin consumos</p>
            ) : (
              <div className="space-y-1">
                {activeConsumos.map(c => (
                  <div key={c.id} className="bg-white dark:bg-gray-800 rounded-lg p-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{c.producto_nombre || 'Producto'}</p>
                      <p className="text-xs text-gray-400">{c.cantidad} x {formatMoney(c.precio_unitario)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{formatMoney(c.importe)}</span>
                      <button onClick={() => cancelConsumo(c.id)} className="text-red-500 text-xs p-1">&#10005;</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Order summary */}
            {activeConsumos.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{formatMoney(cuenta?.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IVA</span>
                  <span>{formatMoney(cuenta?.iva)}</span>
                </div>
                <div className="flex justify-between font-bold text-base mt-1">
                  <span>Total</span>
                  <span className="text-blue-600">{formatMoney(cuenta?.total)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
