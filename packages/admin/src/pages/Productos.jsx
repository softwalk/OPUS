import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import { formatMoney } from '../lib/format';

const tipoVariant = { insumo: 'blue', subproducto: 'yellow', terminado: 'green' };

export default function Productos() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, loading, refetch } = useApi(`/productos?page=${page}&limit=50${search ? `&search=${search}` : ''}`, { deps: [page, search] });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ clave: '', descripcion: '', tipo: 'terminado', precio_venta: '', costo_unitario: '', unidad: 'pza' });
  const [saving, setSaving] = useState(false);

  const columns = [
    { key: 'clave', label: 'Clave' },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'tipo', label: 'Tipo', render: (v) => <Badge variant={tipoVariant[v] || 'gray'}>{v}</Badge> },
    { key: 'precio_venta', label: 'Precio', render: (v) => formatMoney(v) },
    { key: 'costo_unitario', label: 'Costo', render: (v) => formatMoney(v) },
    { key: 'unidad', label: 'Unidad' },
    { key: 'suspendido_86', label: '86', render: (v) => v ? <Badge variant="red">86</Badge> : null },
  ];

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/productos', {
        ...form,
        precio_venta: Math.round(Number(form.precio_venta) * 100),
        costo_unitario: Math.round(Number(form.costo_unitario) * 100),
      });
      toast.success('Producto creado');
      setModal(false);
      setForm({ clave: '', descripcion: '', tipo: 'terminado', precio_venta: '', costo_unitario: '', unidad: 'pza' });
      refetch();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Productos</h1>
        <div className="flex gap-3">
          <Input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <Button onClick={() => setModal(true)}>+ Nuevo</Button>
        </div>
      </div>
      <Card>
        <DataTable
          columns={columns}
          data={data?.productos || data?.data || []}
          loading={loading}
          total={data?.total || 0}
          page={page}
          onPageChange={setPage}
        />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Producto">
        <div className="space-y-4">
          <Input label="Clave" value={form.clave} onChange={e => setForm(f => ({ ...f, clave: e.target.value }))} required />
          <Input label="Descripción" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} required />
          <Select label="Tipo" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} options={[
            { value: 'insumo', label: 'Insumo' }, { value: 'subproducto', label: 'Subproducto' }, { value: 'terminado', label: 'Terminado' },
          ]} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Precio ($)" type="number" step="0.01" value={form.precio_venta} onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))} />
            <Input label="Costo ($)" type="number" step="0.01" value={form.costo_unitario} onChange={e => setForm(f => ({ ...f, costo_unitario: e.target.value }))} />
          </div>
          <Input label="Unidad" value={form.unidad} onChange={e => setForm(f => ({ ...f, unidad: e.target.value }))} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>Crear</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
