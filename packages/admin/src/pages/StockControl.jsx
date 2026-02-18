import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatNumber } from '../lib/format';

export default function StockControl() {
  const toast = useToast();
  const [tab, setTab] = useState('disponibilidad');

  const { data: disponibilidad, loading: loadD, refetch: refetchD } = useApi(
    '/stock-control/disponibilidad',
    { enabled: tab === 'disponibilidad' }
  );

  const { data: items86, loading: load86, refetch: refetch86 } = useApi(
    '/stock-control/86',
    { enabled: tab === '86' }
  );

  const toggle86 = async (productoId, isSuspended) => {
    try {
      if (isSuspended) {
        await api.delete(`/stock-control/86/${productoId}`);
        toast.success('Producto reactivado');
      } else {
        await api.post('/stock-control/86', { producto_id: productoId, motivo: 'Sin stock' });
        toast.success('Producto marcado como 86');
      }
      refetch86();
      refetchD();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const dispColumns = [
    { key: 'clave', label: 'Clave' },
    { key: 'descripcion', label: 'Producto' },
    { key: 'porciones_disponibles', label: 'Porciones Disp.', render: (v) => (
      <span className={v <= 0 ? 'text-red-500 font-bold' : v < 5 ? 'text-yellow-500 font-bold' : ''}>
        {formatNumber(v)}
      </span>
    )},
    { key: 'suspendido_86', label: 'Estado', render: (v) => (
      v ? <Badge variant="red">86</Badge> : <Badge variant="green">OK</Badge>
    )},
  ];

  const columns86 = [
    { key: 'clave', label: 'Clave' },
    { key: 'descripcion', label: 'Producto' },
    { key: 'motivo_86', label: 'Motivo' },
    { key: 'responsable_86', label: 'Responsable' },
    { key: 'id', label: '', render: (_, row) => (
      <Button size="sm" variant="ghost" onClick={() => toggle86(row.id, true)}>Reactivar</Button>
    )},
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Stock Control</h1>

      <div className="flex gap-2 mb-4">
        {['disponibilidad', '86'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
          >
            {t === '86' ? 'Platos 86' : 'Disponibilidad'}
          </button>
        ))}
      </div>

      <Card>
        {tab === 'disponibilidad' ? (
          <DataTable columns={dispColumns} data={disponibilidad?.productos || (Array.isArray(disponibilidad) ? disponibilidad : [])} loading={loadD} total={(disponibilidad?.productos || []).length} />
        ) : (
          <DataTable columns={columns86} data={Array.isArray(items86) ? items86 : (items86?.data || [])} loading={load86} total={(Array.isArray(items86) ? items86 : (items86?.data || [])).length} emptyMessage="No hay productos 86" />
        )}
      </Card>
    </div>
  );
}
