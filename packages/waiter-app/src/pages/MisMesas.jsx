import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatMoney } from '../lib/format';

export default function MisMesas() {
  const { get, post, user } = useAuth();
  const navigate = useNavigate();
  const [mesas, setMesas] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef();
  const [personas, setPersonas] = useState(1);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [opening, setOpening] = useState(false);

  const currentUser = user;

  const fetchMesas = async () => {
    try {
      const data = await get('/pos/mesas');
      setMesas(data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchMesas();
    intervalRef.current = setInterval(fetchMesas, 10000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const abrirMesa = async () => {
    if (!selectedMesa) return;
    setOpening(true);
    try {
      const result = await post(`/pos/mesas/${selectedMesa.id}/abrir`, { personas: Number(personas) });
      fetchMesas();
      setSelectedMesa(null);
      setPersonas(1);
      if (result.cuenta?.id) navigate(`/orden?cuenta=${result.cuenta.id}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setOpening(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">Cargando...</div>;

  // Group mesas by zona
  const zonas = {};
  (mesas || []).forEach(mesa => {
    const zona = mesa.zona_nombre || 'Sin Zona';
    if (!zonas[zona]) zonas[zona] = [];
    zonas[zona].push(mesa);
  });
  const zonaNames = Object.keys(zonas).sort();

  // Stats
  const total = mesas.length;
  const ocupadas = mesas.filter(m => m.estado === 'ocupada').length;
  const reservadas = mesas.filter(m => m.estado === 'reservada').length;

  return (
    <div className="pb-20 px-4 pt-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold">Mis Mesas</h1>
          {currentUser && (
            <p className="text-xs text-gray-400">{currentUser.nombre} · {currentUser.puesto}</p>
          )}
        </div>
        <button onClick={fetchMesas} className="text-sm text-blue-600 font-medium">Actualizar</button>
      </div>

      {/* Quick stats */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-lg font-bold text-green-600">{total - ocupadas - reservadas}</p>
          <p className="text-[10px] text-gray-400">Libres</p>
        </div>
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-lg font-bold text-blue-600">{ocupadas}</p>
          <p className="text-[10px] text-gray-400">Ocupadas</p>
        </div>
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg p-2 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-lg font-bold text-yellow-600">{reservadas}</p>
          <p className="text-[10px] text-gray-400">Reservadas</p>
        </div>
      </div>

      {/* Mesas by zona */}
      {zonaNames.map(zona => (
        <div key={zona} className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{zona}</p>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
            {zonas[zona].map(mesa => (
              <button
                key={mesa.id}
                onClick={() => {
                  if (mesa.estado === 'libre') {
                    setSelectedMesa(mesa);
                    setPersonas(1);
                  } else if (mesa.cuenta_id) {
                    navigate(`/orden?cuenta=${mesa.cuenta_id}`);
                  }
                }}
                className={`relative p-3 rounded-xl border-2 text-center transition-all active:scale-95
                  ${mesa.estado === 'libre' ? 'border-green-300 bg-green-50 dark:bg-green-900/10' : ''}
                  ${mesa.estado === 'ocupada' ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/10' : ''}
                  ${mesa.estado === 'reservada' ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/10' : ''}
                `}
              >
                <p className="text-2xl font-bold">{mesa.numero}</p>
                <p className={`text-xs font-medium mt-0.5 ${
                  mesa.estado === 'libre' ? 'text-green-600' :
                  mesa.estado === 'ocupada' ? 'text-blue-600' :
                  'text-yellow-600'
                }`}>
                  {mesa.estado}
                </p>
                {mesa.estado === 'ocupada' && mesa.total != null && (
                  <p className="text-xs font-semibold mt-0.5">{formatMoney(mesa.total)}</p>
                )}
                {mesa.mesero_nombre && mesa.estado === 'ocupada' && (
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{mesa.mesero_nombre}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Open Mesa Modal */}
      {selectedMesa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedMesa(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mx-4 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">Abrir Mesa {selectedMesa.numero}</h2>
            <p className="text-sm text-gray-400 mb-4">
              {selectedMesa.zona_nombre} · Cap. {selectedMesa.capacidad}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Personas</label>
              <input
                type="number"
                min="1"
                max={selectedMesa.capacidad || 20}
                value={personas}
                onChange={e => setPersonas(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
              />
            </div>
            {currentUser && (
              <p className="text-xs text-gray-400 mb-4">
                Mesero asignado: <strong>{currentUser.nombre}</strong>
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedMesa(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={abrirMesa}
                disabled={opening}
                className="flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {opening ? 'Abriendo...' : 'Abrir Mesa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
