import { useState, useEffect, useRef } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { kdsUrgencyVariant, formatDateTime } from '../lib/format';

export default function Cocina() {
  const toast = useToast();
  const { data: queue, loading, refetch } = useApi('/cocina/queue');
  const intervalRef = useRef();

  // Auto-refresh every 15 seconds
  useEffect(() => {
    intervalRef.current = setInterval(refetch, 15000);
    return () => clearInterval(intervalRef.current);
  }, [refetch]);

  const updateEstado = async (id, nuevoEstado) => {
    try {
      await api.put(`/cocina/${id}/estado`, { estado: nuevoEstado });
      toast.success(`Orden actualizada a ${nuevoEstado}`);
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  const items = queue || [];
  const pendientes = items.filter(i => i.estado === 'pendiente');
  const enPrep = items.filter(i => i.estado === 'en_preparacion');
  const listos = items.filter(i => i.estado === 'listo');

  const renderCard = (item) => (
    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold">Mesa {item.mesa_numero || '—'}</span>
        <Badge variant={kdsUrgencyVariant(item.urgencia || 'normal')}>
          {item.urgencia || 'normal'}
        </Badge>
      </div>
      <div className="space-y-1 mb-3">
        {(item.items || []).map((it, i) => (
          <div key={i} className="text-sm">
            <span className="font-medium">{it.cantidad}x</span> {it.producto_nombre}
            {it.notas && <span className="text-xs text-gray-400 ml-1">({it.notas})</span>}
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-3">{item.mesero_nombre} · {formatDateTime(item.created_at)}</p>
      <div className="flex gap-2">
        {item.estado === 'pendiente' && (
          <Button size="sm" onClick={() => updateEstado(item.id, 'en_preparacion')} className="flex-1">
            Preparar
          </Button>
        )}
        {item.estado === 'en_preparacion' && (
          <Button size="sm" variant="secondary" onClick={() => updateEstado(item.id, 'listo')} className="flex-1">
            Listo
          </Button>
        )}
        {item.estado === 'listo' && (
          <Button size="sm" variant="ghost" onClick={() => updateEstado(item.id, 'entregado')} className="flex-1">
            Entregado
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Cocina (KDS)</h1>
        <Button variant="ghost" onClick={refetch}>Actualizar</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div>
          <h2 className="text-lg font-semibold mb-3 text-yellow-600">Pendientes ({pendientes.length})</h2>
          <div className="space-y-3">{pendientes.map(renderCard)}</div>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-3 text-blue-600">En Preparación ({enPrep.length})</h2>
          <div className="space-y-3">{enPrep.map(renderCard)}</div>
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-3 text-green-600">Listos ({listos.length})</h2>
          <div className="space-y-3">{listos.map(renderCard)}</div>
        </div>
      </div>
    </div>
  );
}
