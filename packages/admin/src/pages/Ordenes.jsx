import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatMoney, formatDateTime } from '../lib/format';

const tipoVariant = { qr_mesa: 'blue', delivery: 'purple', para_llevar: 'yellow' };
const estadoVariant = { pendiente: 'yellow', confirmada: 'blue', en_preparacion: 'indigo', lista: 'green', entregada: 'gray', cancelada: 'red' };

export default function Ordenes() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, loading, refetch } = useApi(`/ordenes?page=${page}&limit=50`, { deps: [page] });
  const [detail, setDetail] = useState(null);

  const updateEstado = async (id, estado) => {
    try {
      await api.put(`/ordenes/${id}/estado`, { estado });
      toast.success(`Orden actualizada a ${estado}`);
      refetch();
      setDetail(null);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const loadDetail = async (id) => {
    try {
      const result = await api.get(`/ordenes/${id}`);
      setDetail(result);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const columns = [
    { key: 'folio', label: 'Folio' },
    { key: 'tipo', label: 'Tipo', render: (v) => <Badge variant={tipoVariant[v] || 'gray'}>{v?.replace('_', ' ')}</Badge> },
    { key: 'cliente_nombre', label: 'Cliente' },
    { key: 'estado', label: 'Estado', render: (v) => <Badge variant={estadoVariant[v] || 'gray'}>{v}</Badge> },
    { key: 'total', label: 'Total', render: (v) => formatMoney(v) },
    { key: 'created_at', label: 'Fecha', render: (v) => formatDateTime(v) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Órdenes Digitales</h1>
        <Button variant="ghost" onClick={refetch}>Actualizar</Button>
      </div>
      <Card>
        <DataTable
          columns={columns}
          data={data?.ordenes || data?.data || (Array.isArray(data) ? data : [])}
          loading={loading}
          total={data?.total || 0}
          page={page}
          onPageChange={setPage}
          onRowClick={(row) => loadDetail(row.id)}
        />
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Orden ${detail?.folio || ''}`} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Tipo:</span> {detail.tipo}</div>
              <div><span className="text-gray-500">Estado:</span> <Badge variant={estadoVariant[detail.estado]}>{detail.estado}</Badge></div>
              <div><span className="text-gray-500">Cliente:</span> {detail.cliente_nombre || '—'}</div>
              <div><span className="text-gray-500">Total:</span> {formatMoney(detail.total)}</div>
            </div>
            {detail.items && (
              <div>
                <h4 className="font-medium mb-2">Items:</h4>
                {detail.items.map((it, i) => (
                  <div key={i} className="flex justify-between py-1 text-sm">
                    <span>{it.cantidad}x {it.producto_nombre}</span>
                    <span>{formatMoney(it.subtotal)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              {detail.estado === 'pendiente' && (
                <Button size="sm" onClick={() => updateEstado(detail.id, 'confirmada')}>Confirmar</Button>
              )}
              {detail.estado === 'confirmada' && (
                <Button size="sm" onClick={() => updateEstado(detail.id, 'en_preparacion')}>Preparar</Button>
              )}
              {detail.estado === 'en_preparacion' && (
                <Button size="sm" onClick={() => updateEstado(detail.id, 'lista')}>Lista</Button>
              )}
              {detail.estado === 'lista' && (
                <Button size="sm" onClick={() => updateEstado(detail.id, 'entregada')}>Entregada</Button>
              )}
              {['pendiente', 'confirmada'].includes(detail.estado) && (
                <Button size="sm" variant="danger" onClick={() => updateEstado(detail.id, 'cancelada')}>Cancelar</Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
