import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import { formatMoney, formatDateTime } from '../lib/format';

export default function Facturacion() {
  const [page, setPage] = useState(1);
  const { data, loading } = useApi(`/finanzas/facturas?page=${page}&limit=50`, { deps: [page] });

  const columns = [
    { key: 'folio', label: 'Folio' },
    { key: 'cliente_nombre', label: 'Cliente' },
    { key: 'subtotal', label: 'Subtotal', render: (v) => formatMoney(v) },
    { key: 'iva', label: 'IVA', render: (v) => formatMoney(v) },
    { key: 'total', label: 'Total', render: (v) => formatMoney(v) },
    { key: 'created_at', label: 'Fecha', render: (v) => formatDateTime(v) },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Facturación</h1>
      <Card>
        <DataTable columns={columns} data={data?.data || []} loading={loading} total={data?.total || 0} page={page} onPageChange={setPage} />
      </Card>
    </div>
  );
}
