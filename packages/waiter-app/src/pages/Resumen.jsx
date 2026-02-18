import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Resumen() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = JSON.parse(localStorage.getItem('opus_waiter_user') || '{}');

  useEffect(() => {
    api.get('/reportes/dashboard-mesero').then(setData).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    api.setToken(null);
    localStorage.removeItem('opus_waiter_user');
    navigate('/login');
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-gray-400">Cargando...</div>;

  return (
    <div className="pb-20 px-4 pt-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Resumen</h1>
          <p className="text-sm text-gray-400">{user.nombre || user.codigo} · {user.puesto}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-red-500 font-medium">Salir</button>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400">Mesas Ocupadas</p>
            <p className="text-2xl font-bold text-blue-600">{data.mesas?.ocupadas}</p>
            <p className="text-xs text-gray-400">de {data.mesas?.total}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400">Mesas Libres</p>
            <p className="text-2xl font-bold text-green-600">{data.mesas?.libres}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400">Reservadas</p>
            <p className="text-2xl font-bold text-yellow-600">{data.mesas?.reservadas}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400">Cuentas Abiertas</p>
            <p className="text-2xl font-bold">{data.cuentas_abiertas}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 col-span-2 border border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-400">KDS Pendientes</p>
            <p className="text-2xl font-bold text-orange-600">{data.kds_pendientes}</p>
            <p className="text-xs text-gray-400">ordenes en cocina</p>
          </div>
        </div>
      )}
    </div>
  );
}
