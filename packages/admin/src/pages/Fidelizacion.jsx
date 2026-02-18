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
import { formatMoney, formatNumber, loyaltyTierVariant } from '../lib/format';

export default function Fidelizacion() {
  const toast = useToast();
  const [tab, setTab] = useState('ranking');
  const { data: config, loading: loadingConfig } = useApi('/fidelizacion/config');
  const { data: ranking, loading: loadingRank, refetch } = useApi('/fidelizacion/ranking', { enabled: tab === 'ranking' });
  const [clienteId, setClienteId] = useState('');
  const [clienteData, setClienteData] = useState(null);

  const lookupCliente = async () => {
    if (!clienteId) return;
    try {
      const data = await api.get(`/fidelizacion/cliente/${clienteId}`);
      setClienteData(data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const rankColumns = [
    { key: 'nombre', label: 'Cliente' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'puntos_acumulados', label: 'Puntos', render: (v) => formatNumber(v) },
    { key: 'nivel_fidelizacion', label: 'Nivel', render: (v) => <Badge variant={loyaltyTierVariant(v)}>{v}</Badge> },
    { key: 'total_transacciones', label: 'Transacciones' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Programa de Fidelización</h1>

      {/* Config summary */}
      {config && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card><p className="text-xs text-gray-500">Puntos por peso</p><p className="text-xl font-bold">{config.puntos_por_peso}</p></Card>
          <Card><p className="text-xs text-gray-500">Mínimo para canjear</p><p className="text-xl font-bold">{formatNumber(config.puntos_canjeables_min)}</p></Card>
          <Card><p className="text-xs text-gray-500">Valor por punto</p><p className="text-xl font-bold">{formatMoney(config.valor_punto)}</p></Card>
          <Card><p className="text-xs text-gray-500">Niveles</p><p className="text-sm">Bronce({config.nivel_bronce_puntos}) Plata({config.nivel_plata_puntos}) Oro({config.nivel_oro_puntos}) Platino({config.nivel_platino_puntos})</p></Card>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {['ranking', 'buscar'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {t === 'ranking' ? 'Ranking' : 'Buscar Cliente'}
          </button>
        ))}
      </div>

      {tab === 'ranking' && (
        <Card>
          <DataTable columns={rankColumns} data={ranking || []} loading={loadingRank} total={(ranking || []).length} />
        </Card>
      )}

      {tab === 'buscar' && (
        <Card>
          <div className="flex gap-3 mb-6">
            <Input placeholder="ID del cliente" value={clienteId} onChange={e => setClienteId(e.target.value)} />
            <Button onClick={lookupCliente}>Buscar</Button>
          </div>
          {clienteData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><span className="text-sm text-gray-500">Cliente</span><p className="font-medium">{clienteData.cliente?.nombre}</p></div>
                <div><span className="text-sm text-gray-500">Puntos</span><p className="font-bold text-xl">{formatNumber(clienteData.puntos_acumulados)}</p></div>
                <div><span className="text-sm text-gray-500">Nivel</span><p><Badge variant={loyaltyTierVariant(clienteData.nivel)}>{clienteData.nivel}</Badge></p></div>
                <div><span className="text-sm text-gray-500">Transacciones</span><p>{clienteData.resumen?.total_transacciones}</p></div>
              </div>
              {clienteData.ultimas_transacciones?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Últimas transacciones</h4>
                  {clienteData.ultimas_transacciones.map((t, i) => (
                    <div key={i} className="flex justify-between py-1 text-sm border-b border-gray-100 dark:border-gray-800">
                      <span><Badge variant={t.tipo === 'acumulado' ? 'green' : 'red'}>{t.tipo}</Badge> {t.referencia}</span>
                      <span className={t.puntos > 0 ? 'text-green-600' : 'text-red-600'}>{t.puntos > 0 ? '+' : ''}{t.puntos}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
