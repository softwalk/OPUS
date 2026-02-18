import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatMoney } from '../lib/format';

export default function Recetas() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, loading, refetch } = useApi(`/recetas?page=${page}&limit=50`, { deps: [page] });
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadDetail = async (productoId) => {
    setDetailLoading(true);
    try {
      const result = await api.get(`/recetas/${productoId}`);
      setDetail(result);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    { key: 'clave', label: 'Clave' },
    { key: 'descripcion', label: 'Producto' },
    { key: 'porciones', label: 'Porciones', render: (v) => v != null ? parseFloat(v) : '' },
    { key: 'costo_unitario', label: 'Costo Integrado', render: (v) => formatMoney(v) },
    { key: 'precio_venta', label: 'Precio Venta', render: (v) => formatMoney(v) },
    {
      key: 'id',
      label: '',
      render: (_, row) => (
        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); loadDetail(row.id); }}>
          Ver Receta
        </Button>
      ),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Recetas</h1>
      <Card>
        <DataTable
          columns={columns}
          data={data?.recetas || data?.data || (Array.isArray(data) ? data : [])}
          loading={loading}
          total={data?.total || 0}
          page={page}
          onPageChange={setPage}
        />
      </Card>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Receta: ${detail?.producto || ''}`} size="lg">
        {detailLoading ? (
          <LoadingSpinner className="py-8" />
        ) : detail ? (
          <div>
            <p className="text-sm text-gray-500 mb-4">
              Porciones: {detail.porciones} · Costo integrado: {formatMoney(detail.costo_integrado)}
            </p>
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Insumo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Unidad</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Costo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(detail.ingredientes || []).map((ing, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-sm">{ing.insumo_nombre || ing.descripcion}</td>
                    <td className="px-3 py-2 text-sm">{ing.cantidad}</td>
                    <td className="px-3 py-2 text-sm">{ing.unidad}</td>
                    <td className="px-3 py-2 text-sm">{formatMoney(ing.costo_unitario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
