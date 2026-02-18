import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { formatMoney, formatDate } from '../lib/format';

const estadoVariant = { pendiente: 'yellow', recibida: 'green', cancelada: 'red' };

export default function Compras() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, loading, refetch } = useApi(`/finanzas/compras?page=${page}&limit=50`, { deps: [page] });
  const [detail, setDetail] = useState(null);

  const loadDetail = async (id) => {
    try {
      const result = await api.get(`/finanzas/compras/${id}`);
      setDetail(result);
    } catch (err) { toast.error(err.message); }
  };

  const recibirOC = async (id) => {
    try {
      await api.put(`/finanzas/compras/${id}/recibir`, { almacen_id: detail?.lineas?.[0]?.almacen_id });
      toast.success('OC recibida');
      setDetail(null);
      refetch();
    } catch (err) { toast.error(err.message); }
  };

  const columns = [
    { key: 'folio', label: 'Folio' },
    { key: 'proveedor_nombre', label: 'Proveedor' },
    { key: 'estado', label: 'Estado', render: (v) => <Badge variant={estadoVariant[v] || 'gray'}>{v}</Badge> },
    { key: 'total', label: 'Total', render: (v) => formatMoney(v) },
    { key: 'total_lineas', label: 'Líneas' },
    { key: 'fecha_entrega', label: 'Entrega', render: (v) => formatDate(v) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Órdenes de Compra</h1>
      <Card>
        <DataTable columns={columns} data={data?.data || []} loading={loading} total={data?.total || 0} page={page} onPageChange={setPage}
          onRowClick={(row) => loadDetail(row.id)} />
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`OC ${detail?.folio || ''}`} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Proveedor:</span> {detail.proveedor_nombre}</div>
              <div><span className="text-gray-500">Estado:</span> <Badge variant={estadoVariant[detail.estado]}>{detail.estado}</Badge></div>
              <div><span className="text-gray-500">Total:</span> {formatMoney(detail.total)}</div>
              <div><span className="text-gray-500">Entrega:</span> {formatDate(detail.fecha_entrega)}</div>
            </div>
            {detail.lineas && (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead><tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Producto</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Cant.</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">P. Unit.</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Subtotal</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {detail.lineas.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">{l.producto_nombre}</td>
                      <td className="px-3 py-2">{l.cantidad}</td>
                      <td className="px-3 py-2">{formatMoney(l.precio_unitario)}</td>
                      <td className="px-3 py-2">{formatMoney(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {detail.estado === 'pendiente' && (
              <div className="flex justify-end gap-2">
                <Button variant="danger" size="sm" onClick={async () => {
                  try { await api.put(`/finanzas/compras/${detail.id}/cancelar`); toast.success('OC cancelada'); setDetail(null); refetch(); }
                  catch (err) { toast.error(err.message); }
                }}>Cancelar OC</Button>
                <Button size="sm" onClick={() => recibirOC(detail.id)}>Recibir OC</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
