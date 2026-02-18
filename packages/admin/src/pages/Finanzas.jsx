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
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatMoney, formatDate } from '../lib/format';

const estadoVariant = { pendiente: 'yellow', parcial: 'blue', pagada: 'green', vencida: 'red' };

export default function Finanzas() {
  const toast = useToast();
  const [tab, setTab] = useState('cxc');
  const [page, setPage] = useState(1);
  const { data: dashboard, loading: loadingDash } = useApi('/finanzas/dashboard');
  const { data: cxcData, loading: loadingCxc, refetch: refetchCxc } = useApi(`/finanzas/cxc?page=${page}&limit=50`, { deps: [page], enabled: tab === 'cxc' });
  const { data: cxpData, loading: loadingCxp, refetch: refetchCxp } = useApi(`/finanzas/cxp?page=${page}&limit=50`, { deps: [page], enabled: tab === 'cxp' });
  const [abonarModal, setAbonarModal] = useState(null);
  const [montoAbono, setMontoAbono] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleAbonar = async () => {
    if (!montoAbono || Number(montoAbono) <= 0) return toast.error('Monto inválido');
    setProcessing(true);
    try {
      const endpoint = tab === 'cxc' ? `/finanzas/cxc/${abonarModal.id}/abonar` : `/finanzas/cxp/${abonarModal.id}/abonar`;
      await api.put(endpoint, { monto: Math.round(Number(montoAbono) * 100) });
      toast.success('Abono registrado');
      setAbonarModal(null);
      setMontoAbono('');
      tab === 'cxc' ? refetchCxc() : refetchCxp();
    } catch (err) { toast.error(err.message); }
    finally { setProcessing(false); }
  };

  const cxcColumns = [
    { key: 'cliente_nombre', label: 'Cliente' },
    { key: 'concepto', label: 'Concepto' },
    { key: 'monto', label: 'Monto', render: (v) => formatMoney(v) },
    { key: 'saldo', label: 'Saldo', render: (v) => formatMoney(v) },
    { key: 'estado', label: 'Estado', render: (v) => <Badge variant={estadoVariant[v] || 'gray'}>{v}</Badge> },
    { key: 'fecha_vencimiento', label: 'Vence', render: (v) => formatDate(v) },
    { key: 'id', label: '', render: (_, row) => row.estado !== 'pagada' ? (
      <Button size="sm" variant="ghost" onClick={() => { setAbonarModal(row); setMontoAbono(''); }}>Abonar</Button>
    ) : null },
  ];

  const cxpColumns = [
    { key: 'proveedor_nombre', label: 'Proveedor' },
    { key: 'concepto', label: 'Concepto' },
    { key: 'monto', label: 'Monto', render: (v) => formatMoney(v) },
    { key: 'saldo', label: 'Saldo', render: (v) => formatMoney(v) },
    { key: 'estado', label: 'Estado', render: (v) => <Badge variant={estadoVariant[v] || 'gray'}>{v}</Badge> },
    { key: 'fecha_vencimiento', label: 'Vence', render: (v) => formatDate(v) },
    { key: 'id', label: '', render: (_, row) => row.estado !== 'pagada' ? (
      <Button size="sm" variant="ghost" onClick={() => { setAbonarModal(row); setMontoAbono(''); }}>Pagar</Button>
    ) : null },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Finanzas</h1>

      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card><p className="text-xs text-gray-500">CxC Pendiente</p><p className="text-xl font-bold text-blue-600">{formatMoney(dashboard.cuentas_cobrar?.saldo_total)}</p><p className="text-xs text-gray-400">{dashboard.cuentas_cobrar?.total_cuentas} cuentas</p></Card>
          <Card><p className="text-xs text-gray-500">CxP Pendiente</p><p className="text-xl font-bold text-red-600">{formatMoney(dashboard.cuentas_pagar?.saldo_total)}</p><p className="text-xs text-gray-400">{dashboard.cuentas_pagar?.total_cuentas} cuentas</p></Card>
          <Card><p className="text-xs text-gray-500">Ingresos del Mes</p><p className="text-xl font-bold text-green-600">{formatMoney(dashboard.polizas_mes?.ingresos)}</p></Card>
          <Card><p className="text-xs text-gray-500">Egresos del Mes</p><p className="text-xl font-bold text-red-500">{formatMoney(dashboard.polizas_mes?.egresos)}</p></Card>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {['cxc', 'cxp'].map(t => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {t === 'cxc' ? 'Cuentas por Cobrar' : 'Cuentas por Pagar'}
          </button>
        ))}
      </div>

      <Card>
        {tab === 'cxc' ? (
          <DataTable columns={cxcColumns} data={cxcData?.data || []} loading={loadingCxc} total={cxcData?.total || 0} page={page} onPageChange={setPage} />
        ) : (
          <DataTable columns={cxpColumns} data={cxpData?.data || []} loading={loadingCxp} total={cxpData?.total || 0} page={page} onPageChange={setPage} />
        )}
      </Card>

      <Modal open={!!abonarModal} onClose={() => setAbonarModal(null)} title={tab === 'cxc' ? 'Registrar Abono' : 'Registrar Pago'}>
        {abonarModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Saldo pendiente: <strong>{formatMoney(abonarModal.saldo)}</strong></p>
            <Input label="Monto ($)" type="number" step="0.01" min="0.01" value={montoAbono} onChange={e => setMontoAbono(e.target.value)} />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setAbonarModal(null)}>Cancelar</Button>
              <Button onClick={handleAbonar} loading={processing}>Confirmar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
