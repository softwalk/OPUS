import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import { formatMoney, formatNumber, formatDateTime } from '../lib/format';

export default function Inventario() {
  const [tab, setTab] = useState('existencias');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const { data: existencias, loading: loadingEx } = useApi(
    `/inventario/existencias?page=${page}&limit=50${search ? `&search=${search}` : ''}`,
    { deps: [page, search], enabled: tab === 'existencias' }
  );

  const { data: movimientos, loading: loadingMov } = useApi(
    `/inventario/movimientos?page=${page}&limit=50`,
    { deps: [page], enabled: tab === 'movimientos' }
  );

  const exColumns = [
    { key: 'clave', label: 'Clave' },
    { key: 'descripcion', label: 'Producto' },
    { key: 'almacen_nombre', label: 'Almacén' },
    { key: 'cantidad', label: 'Cantidad', render: (v) => formatNumber(v) },
    { key: 'costo_unitario', label: 'Costo Unit.', render: (v) => formatMoney(v) },
  ];

  const movColumns = [
    { key: 'producto_nombre', label: 'Producto' },
    { key: 'almacen_nombre', label: 'Almacén' },
    { key: 'tipo', label: 'Tipo', render: (v) => {
      const isEntrada = v?.startsWith('entrada');
      return <Badge variant={isEntrada ? 'green' : 'red'}>{v?.replace('_', ' ')}</Badge>;
    }},
    { key: 'cantidad', label: 'Cant.', render: (v) => formatNumber(v) },
    { key: 'costo_unitario', label: 'Costo', render: (v) => formatMoney(v) },
    { key: 'referencia', label: 'Referencia' },
    { key: 'created_at', label: 'Fecha', render: (v) => formatDateTime(v) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Inventario</h1>
        <Input placeholder="Buscar producto..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-60" />
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setTab('existencias'); setPage(1); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'existencias' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
        >
          Existencias
        </button>
        <button
          onClick={() => { setTab('movimientos'); setPage(1); }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'movimientos' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
        >
          Movimientos
        </button>
      </div>

      <Card>
        {tab === 'existencias' ? (
          <DataTable columns={exColumns} data={existencias?.existencias || existencias?.data || (Array.isArray(existencias) ? existencias : [])} loading={loadingEx} total={existencias?.total || (Array.isArray(existencias) ? existencias.length : 0)} page={page} onPageChange={setPage} />
        ) : (
          <DataTable columns={movColumns} data={movimientos?.movimientos || movimientos?.data || (Array.isArray(movimientos) ? movimientos : [])} loading={loadingMov} total={movimientos?.total || (Array.isArray(movimientos) ? movimientos.length : 0)} page={page} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}
