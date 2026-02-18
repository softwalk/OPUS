import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Input from '../components/ui/Input';
import { formatDateTime } from '../lib/format';

export default function Auditoria() {
  const [page, setPage] = useState(1);
  const [tabla, setTabla] = useState('');
  const [usuario, setUsuario] = useState('');
  const { data, loading } = useApi(
    `/reportes/auditoria?page=${page}&limit=50${tabla ? `&tabla=${tabla}` : ''}${usuario ? `&usuario=${usuario}` : ''}`,
    { deps: [page, tabla, usuario] }
  );

  const columns = [
    { key: 'entidad', label: 'Tabla' },
    { key: 'tipo', label: 'Acción' },
    { key: 'usuario', label: 'Usuario' },
    { key: 'descripcion', label: 'Descripción', render: (v) => v?.length > 50 ? v.slice(0, 50) + '...' : v },
    { key: 'ip', label: 'IP' },
    { key: 'created_at', label: 'Fecha', render: (v) => formatDateTime(v) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Auditoría</h1>
        <div className="flex gap-3">
          <Input placeholder="Tabla..." value={tabla} onChange={e => { setTabla(e.target.value); setPage(1); }} className="w-40" />
          <Input placeholder="Usuario..." value={usuario} onChange={e => { setUsuario(e.target.value); setPage(1); }} className="w-40" />
        </div>
      </div>
      <Card>
        <DataTable columns={columns} data={data?.data || []} loading={loading} total={data?.total || 0} page={page} onPageChange={setPage} />
      </Card>
    </div>
  );
}
