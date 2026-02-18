import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import { formatTime } from '../lib/format';

export default function CocinaView() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef();

  const fetchQueue = async () => {
    try {
      const data = await api.get('/cocina/queue');
      setQueue(data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchQueue();
    intervalRef.current = setInterval(fetchQueue, 10000);
    return () => clearInterval(intervalRef.current);
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">Cargando...</div>;

  const listos = queue.filter(i => i.estado === 'listo');
  const enPrep = queue.filter(i => i.estado === 'en_preparacion');
  const pendientes = queue.filter(i => i.estado === 'pendiente');

  const urgencyColor = (u) => u === 'critico' ? 'text-red-500' : u === 'alerta' ? 'text-yellow-500' : 'text-green-500';

  return (
    <div className="pb-20 px-4 pt-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Cocina</h1>
        <button onClick={fetchQueue} className="text-sm text-blue-600 font-medium">Actualizar</button>
      </div>

      {listos.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-green-600 uppercase mb-2">Listos para recoger ({listos.length})</h2>
          <div className="space-y-2">
            {listos.map(item => (
              <div key={item.id} className="bg-green-50 dark:bg-green-900/10 border-2 border-green-300 rounded-xl p-3">
                <div className="flex justify-between">
                  <span className="font-bold">Mesa {item.mesa_numero || '—'}</span>
                  <span className="text-xs text-gray-400">{formatTime(item.created_at)}</span>
                </div>
                <div className="mt-1">
                  {(item.items || []).map((it, i) => (
                    <p key={i} className="text-sm">{it.cantidad}x {it.producto_nombre}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {enPrep.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-blue-600 uppercase mb-2">En Preparación ({enPrep.length})</h2>
          <div className="space-y-2">
            {enPrep.map(item => (
              <div key={item.id} className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 rounded-xl p-3">
                <div className="flex justify-between">
                  <span className="font-bold">Mesa {item.mesa_numero || '—'}</span>
                  <span className={`text-xs font-medium ${urgencyColor(item.urgencia)}`}>{item.urgencia}</span>
                </div>
                <div className="mt-1">
                  {(item.items || []).map((it, i) => (
                    <p key={i} className="text-sm">{it.cantidad}x {it.producto_nombre}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendientes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Pendientes ({pendientes.length})</h2>
          <div className="space-y-2">
            {pendientes.map(item => (
              <div key={item.id} className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
                <div className="flex justify-between">
                  <span className="font-bold">Mesa {item.mesa_numero || '—'}</span>
                  <span className="text-xs text-gray-400">{formatTime(item.created_at)}</span>
                </div>
                <div className="mt-1">
                  {(item.items || []).map((it, i) => (
                    <p key={i} className="text-sm">{it.cantidad}x {it.producto_nombre}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {queue.length === 0 && (
        <p className="text-center text-gray-400 py-12">No hay órdenes en cocina</p>
      )}
    </div>
  );
}
