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
import { formatMoney, formatDateTime } from '../lib/format';

export default function Polizas() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [tipo, setTipo] = useState('');
  const { data, loading, refetch } = useApi(`/finanzas/polizas?page=${page}&limit=50${tipo ? `&tipo=${tipo}` : ''}`, { deps: [page, tipo] });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ tipo: 'ingreso', descripcion: '', importe: '', referencia: '' });
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await api.post('/finanzas/polizas', {
        ...form,
        importe: Math.round(Number(form.importe) * 100),
      });
      toast.success('Póliza creada');
      setModal(false);
      setForm({ tipo: 'ingreso', descripcion: '', importe: '', referencia: '' });
      refetch();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const columns = [
    { key: 'tipo', label: 'Tipo', render: (v) => <Badge variant={v === 'ingreso' ? 'green' : 'red'}>{v}</Badge> },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'importe', label: 'Importe', render: (v) => formatMoney(v) },
    { key: 'referencia', label: 'Referencia' },
    { key: 'created_at', label: 'Fecha', render: (v) => formatDateTime(v) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Pólizas</h1>
        <div className="flex gap-3">
          <Select value={tipo} onChange={e => { setTipo(e.target.value); setPage(1); }} options={[
            { value: '', label: 'Todos' }, { value: 'ingreso', label: 'Ingresos' }, { value: 'egreso', label: 'Egresos' },
          ]} className="w-40" />
          <Button onClick={() => setModal(true)}>+ Nueva</Button>
        </div>
      </div>

      {data?.resumen && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card><p className="text-xs text-gray-500">Ingresos</p><p className="text-lg font-bold text-green-600">{formatMoney(data.resumen.total_ingresos)}</p></Card>
          <Card><p className="text-xs text-gray-500">Egresos</p><p className="text-lg font-bold text-red-600">{formatMoney(data.resumen.total_egresos)}</p></Card>
          <Card><p className="text-xs text-gray-500">Balance</p><p className={`text-lg font-bold ${data.resumen.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(data.resumen.balance)}</p></Card>
        </div>
      )}

      <Card>
        <DataTable columns={columns} data={data?.data || []} loading={loading} total={data?.total || 0} page={page} onPageChange={setPage} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Nueva Póliza">
        <div className="space-y-4">
          <Select label="Tipo" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} options={[
            { value: 'ingreso', label: 'Ingreso' }, { value: 'egreso', label: 'Egreso' },
          ]} />
          <Input label="Descripción" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          <Input label="Importe ($)" type="number" step="0.01" value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} required />
          <Input label="Referencia" value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving}>Crear</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
