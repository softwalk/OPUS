import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';

export default function Proveedores() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, loading, refetch } = useApi(`/finanzas/proveedores?page=${page}&limit=50${search ? `&search=${search}` : ''}`, { deps: [page, search] });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', contacto: '', telefono: '', email: '', rfc: '', direccion: '' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/finanzas/proveedores', form);
      toast.success('Proveedor creado');
      setModal(false);
      setForm({ nombre: '', contacto: '', telefono: '', email: '', rfc: '', direccion: '' });
      refetch();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'codigo', label: 'Código' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'contacto', label: 'Contacto' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'email', label: 'Email' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Proveedores</h1>
        <div className="flex gap-3">
          <Input placeholder="Buscar..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <Button onClick={() => setModal(true)}>+ Nuevo</Button>
        </div>
      </div>
      <Card>
        <DataTable columns={columns} data={data?.data || []} loading={loading} total={data?.total || 0} page={page} onPageChange={setPage} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Proveedor">
        <div className="space-y-4">
          <Input label="Nombre" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contacto" value={form.contacto} onChange={e => setForm(f => ({ ...f, contacto: e.target.value }))} />
            <Input label="Teléfono" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input label="RFC" value={form.rfc} onChange={e => setForm(f => ({ ...f, rfc: e.target.value }))} />
          </div>
          <Input label="Dirección" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>Crear</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
