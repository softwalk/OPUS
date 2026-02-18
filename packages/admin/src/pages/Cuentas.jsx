import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Select from '../components/ui/Select';
import { formatMoney, formatDateTime, cuentaStatusVariant } from '../lib/format';

export default function Cuentas() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState('');
  const { data, loading } = useApi(`/pos/cuentas?page=${page}&limit=50${estado ? `&estado=${estado}` : ''}`, { deps: [page, estado] });

  const columns = [
    { key: 'folio', label: 'Folio' },
    { key: 'mesa_numero', label: 'Mesa' },
    { key: 'mesero_nombre', label: 'Mesero' },
    { key: 'estado', label: 'Estado', render: (v) => <Badge variant={cuentaStatusVariant(v)}>{v}</Badge> },
    { key: 'total', label: 'Total', render: (v) => formatMoney(v) },
    { key: 'created_at', label: 'Fecha', render: (v) => formatDateTime(v) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Cuentas</h1>
        <Select
          value={estado}
          onChange={e => { setEstado(e.target.value); setPage(1); }}
          options={[
            { value: '', label: 'Todos los estados' },
            { value: 'abierta', label: 'Abiertas' },
            { value: 'cobrada', label: 'Cobradas' },
            { value: 'cancelada', label: 'Canceladas' },
          ]}
          className="w-48"
        />
      </div>
      <Card>
        <DataTable
          columns={columns}
          data={data?.cuentas || data?.data || (Array.isArray(data) ? data : [])}
          loading={loading}
          total={data?.total || 0}
          page={page}
          onPageChange={setPage}
          onRowClick={(row) => navigate(`/pos/cuentas/${row.id}`)}
        />
      </Card>
    </div>
  );
}
