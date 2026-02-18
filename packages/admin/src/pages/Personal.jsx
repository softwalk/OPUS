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

const puestoVariant = { mesero: 'blue', cajero: 'green', cocinero: 'yellow', subgerente: 'purple', gerente: 'red' };

export default function Personal() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const { data, loading, refetch } = useApi(`/finanzas/personal?page=${page}&limit=50`, { deps: [page] });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ codigo: '', nombre: '', puesto: 'mesero', nivel_acceso: 1, email: '', telefono: '' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/finanzas/personal', { ...form, nivel_acceso: Number(form.nivel_acceso) });
      toast.success('Personal creado');
      setModal(false);
      setForm({ codigo: '', nombre: '', puesto: 'mesero', nivel_acceso: 1, email: '', telefono: '' });
      refetch();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'codigo', label: 'Código' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'puesto', label: 'Puesto', render: (v) => <Badge variant={puestoVariant[v] || 'gray'}>{v}</Badge> },
    { key: 'nivel_acceso', label: 'Nivel' },
    { key: 'email', label: 'Email' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'activo', label: 'Estado', render: (v) => <Badge variant={v ? 'green' : 'red'}>{v ? 'Activo' : 'Inactivo'}</Badge> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Personal</h1>
        <Button onClick={() => setModal(true)}>+ Nuevo</Button>
      </div>
      <Card>
        <DataTable columns={columns} data={data?.data || []} loading={loading} total={data?.total || 0} page={page} onPageChange={setPage} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Personal">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Código" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} required />
            <Input label="Nombre" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Puesto" value={form.puesto} onChange={e => setForm(f => ({ ...f, puesto: e.target.value }))} options={[
              { value: 'mesero', label: 'Mesero' }, { value: 'cajero', label: 'Cajero' },
              { value: 'cocinero', label: 'Cocinero' }, { value: 'subgerente', label: 'Subgerente' }, { value: 'gerente', label: 'Gerente' },
            ]} />
            <Select label="Nivel Acceso" value={form.nivel_acceso} onChange={e => setForm(f => ({ ...f, nivel_acceso: e.target.value }))} options={[
              { value: '1', label: '1 - Mesero' }, { value: '2', label: '2 - Cajero' },
              { value: '3', label: '3 - Cocinero' }, { value: '5', label: '5 - Subgerente' }, { value: '9', label: '9 - Gerente' },
            ]} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="Teléfono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>Crear</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
