import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useCliente } from '../context/ClienteContext';
import api from '../lib/api';
import { formatMoney } from '../lib/format';
import Header from '../components/Header';

/**
 * Pedir — Unified ordering page.
 *
 * Modes:
 *   1. QR Mesa: Client scanned QR at restaurant — mesa already assigned.
 *      URL: /pedir?mesa=5   (mesa number from QR)
 *   2. Delivery: Client at home — needs address form.
 *      URL: /pedir?modo=delivery
 *   3. Para llevar: Client at restaurant, orders to go.
 *      URL: /pedir?modo=para_llevar
 *   4. Default: Asks user to choose mode.
 */
export default function Pedir() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { cliente, isLoggedIn, tenantSlug } = useCliente();

  // Determine mode from URL
  const mesaParam = searchParams.get('mesa'); // mesa number from QR
  const modoParam = searchParams.get('modo');

  const [mode, setMode] = useState(mesaParam ? 'qr_mesa' : modoParam || null);
  const [mesa] = useState(mesaParam ? parseInt(mesaParam, 10) : null);

  // Menu state
  const [productos, setProductos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [grupoActivo, setGrupoActivo] = useState('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Cart
  const [cart, setCart] = useState([]);

  // Checkout
  const [step, setStep] = useState('menu'); // menu | checkout | success
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deliveryForm, setDeliveryForm] = useState({
    nombre: '', telefono: '', direccion: '', notas: '',
  });
  const [orderResult, setOrderResult] = useState(null);

  // Load menu
  useEffect(() => {
    const load = async () => {
      try {
        const menuRes = await api.get(`/stock-control/menu-disponible?tenant=${tenantSlug}`);
        const menuObj = menuRes?.menu || {};
        const flatProducts = [];
        const grupoSet = [];
        for (const [grupoNombre, items] of Object.entries(menuObj)) {
          grupoSet.push({ id: grupoNombre, nombre: grupoNombre });
          for (const item of items) {
            flatProducts.push({
              id: item.id,
              clave: item.clave,
              descripcion: item.nombre,
              precio_venta: item.precio,
              grupo_id: grupoNombre,
              grupo_nombre: grupoNombre,
            });
          }
        }
        setProductos(flatProducts);
        setGrupos(grupoSet);
      } catch (err) {
        console.error('Error loading menu:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenantSlug]);

  // Prefill delivery form with profile
  useEffect(() => {
    if (isLoggedIn && cliente) {
      setDeliveryForm(f => ({
        ...f,
        nombre: f.nombre || cliente.nombre || '',
        telefono: f.telefono || cliente.telefono || '',
      }));
    }
  }, [isLoggedIn, cliente]);

  // --- Cart operations ---
  const addToCart = (producto) => {
    setCart(prev => {
      const existing = prev.find(i => i.producto_id === producto.id);
      if (existing) {
        return prev.map(i => i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, {
        producto_id: producto.id,
        nombre: producto.descripcion,
        precio: producto.precio_venta,
        cantidad: 1,
      }];
    });
  };

  const updateQuantity = (productoId, delta) => {
    setCart(prev => prev
      .map(i => i.producto_id === productoId ? { ...i, cantidad: i.cantidad + delta } : i)
      .filter(i => i.cantidad > 0)
    );
  };

  const cartTotal = cart.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const cartCount = cart.reduce((s, i) => s + i.cantidad, 0);

  // --- Submit order ---
  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        tenant_slug: tenantSlug,
        tipo: mode,
        items: cart.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
        cliente_nombre: deliveryForm.nombre || cliente?.nombre || null,
        cliente_telefono: deliveryForm.telefono || cliente?.telefono || null,
        notas: deliveryForm.notas || null,
      };

      if (mode === 'qr_mesa' && mesa) {
        payload.mesa_numero = mesa;
      }

      if (mode === 'delivery') {
        if (!deliveryForm.direccion) {
          setError('La direccion de entrega es requerida');
          setSubmitting(false);
          return;
        }
        payload.direccion_entrega = deliveryForm.direccion;
      }

      const res = await fetch('/api/v1/clientes/pedir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Error al enviar pedido');

      setOrderResult(data);
      setStep('success');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // --- MODE SELECTOR ---
  if (!mode) {
    return (
      <div className="pb-20">
        <Header title="Pedir" />
        <div className="px-4 py-8 space-y-4">
          <p className="text-center text-gray-500 text-sm mb-4">Como quieres recibir tu pedido?</p>

          {/* Option: Estoy en mesa */}
          <button
            onClick={() => {
              const num = prompt('Cual es el numero de tu mesa?');
              if (num) {
                navigate(`/pedir?mesa=${num}`);
                window.location.reload();
              }
            }}
            className="w-full bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow text-left"
          >
            <span className="text-3xl">🪑</span>
            <div>
              <p className="font-semibold">Estoy en el restaurante</p>
              <p className="text-xs text-gray-400">Pedir a mi mesa</p>
            </div>
          </button>

          {/* Option: Delivery */}
          <button
            onClick={() => setMode('delivery')}
            className="w-full bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow text-left"
          >
            <span className="text-3xl">🛵</span>
            <div>
              <p className="font-semibold">Enviar a domicilio</p>
              <p className="text-xs text-gray-400">Delivery a tu direccion</p>
            </div>
          </button>

          {/* Option: Para llevar */}
          <button
            onClick={() => setMode('para_llevar')}
            className="w-full bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow text-left"
          >
            <span className="text-3xl">🥡</span>
            <div>
              <p className="font-semibold">Para llevar</p>
              <p className="text-xs text-gray-400">Paso a recoger</p>
            </div>
          </button>

          {!isLoggedIn && (
            <p className="text-xs text-gray-400 text-center mt-4">
              <Link to="/mi-cuenta" className="text-orange-500 font-medium">Inicia sesion</Link> para prellenar tus datos automaticamente.
            </p>
          )}
        </div>
      </div>
    );
  }

  // --- SUCCESS ---
  if (step === 'success') {
    const modeLabels = { qr_mesa: 'en tu mesa', delivery: 'a domicilio', para_llevar: 'para llevar' };
    return (
      <div className="pb-20">
        <Header title="Pedido Enviado" />
        <div className="px-6 py-12 text-center">
          <span className="text-5xl mb-4 block">{mode === 'delivery' ? '🛵' : mode === 'qr_mesa' ? '🍽️' : '🥡'}</span>
          <h2 className="text-xl font-bold mb-2">Pedido Confirmado!</h2>
          <p className="text-gray-500">Tu pedido {modeLabels[mode]} fue recibido.</p>
          {mesa && <p className="text-sm text-gray-400 mt-1">Mesa {mesa}</p>}
          <p className="text-lg font-bold text-orange-500 mt-3">{formatMoney(cartTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{cartCount} {cartCount === 1 ? 'producto' : 'productos'}</p>

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => { setCart([]); setStep('menu'); setOrderResult(null); }}
              className="flex-1 py-2.5 bg-orange-500 text-white rounded-full font-medium"
            >
              Nuevo Pedido
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 rounded-full font-medium"
            >
              Inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- CHECKOUT ---
  if (step === 'checkout') {
    return (
      <div className="pb-20">
        <Header title="Confirmar Pedido" />
        <div className="px-4 py-4 space-y-4">
          {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg text-sm">{error}</div>}

          {/* Mode badge */}
          <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg text-sm text-orange-700 dark:text-orange-300">
            <span>{mode === 'qr_mesa' ? '🪑' : mode === 'delivery' ? '🛵' : '🥡'}</span>
            <span>
              {mode === 'qr_mesa' && `Mesa ${mesa}`}
              {mode === 'delivery' && 'Delivery a domicilio'}
              {mode === 'para_llevar' && 'Para llevar'}
            </span>
          </div>

          {/* Cart items */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-2">
            <h3 className="font-semibold mb-2">Tu Pedido</h3>
            {cart.map(item => (
              <div key={item.producto_id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(item.producto_id, -1)}
                      className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold">-</button>
                    <span className="w-6 text-center font-medium">{item.cantidad}</span>
                    <button onClick={() => updateQuantity(item.producto_id, 1)}
                      className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center text-xs font-bold">+</button>
                  </div>
                  <span>{item.nombre}</span>
                </div>
                <span className="font-semibold">{formatMoney(item.precio * item.cantidad)}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between font-bold mt-2">
              <span>Total</span>
              <span className="text-orange-500">{formatMoney(cartTotal)}</span>
            </div>
          </div>

          {/* Delivery form */}
          <div className="space-y-3">
            <input
              placeholder="Tu nombre"
              value={deliveryForm.nombre}
              onChange={e => setDeliveryForm(f => ({ ...f, nombre: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
            <input
              placeholder="Telefono"
              type="tel"
              value={deliveryForm.telefono}
              onChange={e => setDeliveryForm(f => ({ ...f, telefono: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
            {mode === 'delivery' && (
              <textarea
                required
                placeholder="Direccion de entrega"
                value={deliveryForm.direccion}
                onChange={e => setDeliveryForm(f => ({ ...f, direccion: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
              />
            )}
            <textarea
              placeholder="Notas (sin cebolla, extra salsa, etc.)"
              value={deliveryForm.notas}
              onChange={e => setDeliveryForm(f => ({ ...f, notas: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('menu')} className="flex-1 py-3 bg-gray-200 dark:bg-gray-700 rounded-full font-medium">
              Volver
            </button>
            <button onClick={handleSubmit} disabled={submitting}
              className="flex-1 py-3 bg-orange-500 text-white rounded-full font-semibold disabled:opacity-50">
              {submitting ? 'Enviando...' : 'Confirmar Pedido'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- MENU (product selection) ---
  const filtered = productos
    .filter(p => grupoActivo === 'todos' || p.grupo_id === grupoActivo)
    .filter(p => !search || p.descripcion?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="pb-20">
      <Header title={mode === 'qr_mesa' ? `Pedir — Mesa ${mesa}` : mode === 'delivery' ? 'Pedir — Delivery' : 'Pedir — Para Llevar'} />

      {/* Search */}
      <div className="px-4 py-3">
        <input
          type="text"
          placeholder="Buscar platillo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm border-0 focus:ring-2 focus:ring-orange-500 outline-none"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setGrupoActivo('todos')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${grupoActivo === 'todos' ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
        >
          Todos
        </button>
        {grupos.map(g => (
          <button
            key={g.id}
            onClick={() => setGrupoActivo(g.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${grupoActivo === g.id ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
          >
            {g.nombre}
          </button>
        ))}
      </div>

      {/* Products */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : (
        <div className="px-4 space-y-2">
          {filtered.map(p => {
            const inCart = cart.find(i => i.producto_id === p.id);
            return (
              <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-xl flex-shrink-0">
                  🍽️
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.descripcion}</p>
                  <p className="text-xs text-gray-400">{p.grupo_nombre}</p>
                </div>
                <p className="font-bold text-orange-500 text-sm whitespace-nowrap mr-2">{formatMoney(p.precio_venta)}</p>

                {inCart ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateQuantity(p.id, -1)}
                      className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-bold">-</button>
                    <span className="w-6 text-center text-sm font-bold">{inCart.cantidad}</span>
                    <button onClick={() => updateQuantity(p.id, 1)}
                      className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">+</button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(p)}
                    className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                    +
                  </button>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-8">No hay platillos disponibles</p>
          )}
        </div>
      )}

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-16 inset-x-0 px-4 pb-2 z-40">
          <button onClick={() => setStep('checkout')}
            className="w-full py-3 bg-orange-500 text-white rounded-full font-semibold shadow-lg flex items-center justify-center gap-2">
            Ver Pedido ({cartCount}) · {formatMoney(cartTotal)}
          </button>
        </div>
      )}
    </div>
  );
}
