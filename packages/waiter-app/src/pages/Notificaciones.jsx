import { useState, useEffect } from 'react';
import api from '../lib/api';

export default function Notificaciones() {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Placeholder — in production this would use WebSocket
    setNotifs([
      { id: 1, tipo: 'cocina', mensaje: 'Mesa 5 - Orden lista', tiempo: 'Hace 2 min' },
      { id: 2, tipo: 'stock', mensaje: 'Tequila Reposado - Stock bajo', tiempo: 'Hace 15 min' },
    ]);
    setLoading(false);
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">Cargando...</div>;

  return (
    <div className="pb-20 px-4 pt-4">
      <h1 className="text-xl font-bold mb-4">Notificaciones</h1>
      {notifs.length === 0 ? (
        <p className="text-center text-gray-400 py-12">Sin notificaciones</p>
      ) : (
        <div className="space-y-2">
          {notifs.map(n => (
            <div key={n.id} className={`rounded-xl p-4 ${n.tipo === 'cocina' ? 'bg-green-50 dark:bg-green-900/10 border border-green-200' : 'bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200'}`}>
              <p className="font-medium text-sm">{n.mensaje}</p>
              <p className="text-xs text-gray-400 mt-1">{n.tiempo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
