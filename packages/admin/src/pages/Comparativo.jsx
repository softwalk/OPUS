import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatMoney, formatPct } from '../lib/format';

export default function Comparativo() {
  const [p1Desde, setP1Desde] = useState('');
  const [p1Hasta, setP1Hasta] = useState('');
  const [p2Desde, setP2Desde] = useState('');
  const [p2Hasta, setP2Hasta] = useState('');
  const [enabled, setEnabled] = useState(false);

  const { data, loading } = useApi(
    `/reportes/comparativo?p1_desde=${p1Desde}&p1_hasta=${p1Hasta}&p2_desde=${p2Desde}&p2_hasta=${p2Hasta}`,
    { deps: [p1Desde, p1Hasta, p2Desde, p2Hasta], enabled }
  );

  const handleCompare = () => {
    if (p1Desde && p1Hasta && p2Desde && p2Hasta) setEnabled(true);
  };

  const renderVariation = (pct) => {
    const variant = pct > 0 ? 'green' : pct < 0 ? 'red' : 'gray';
    return <Badge variant={variant}>{pct > 0 ? '+' : ''}{formatPct(pct)}</Badge>;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Comparativo de Periodos</h1>

      <Card className="mb-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium mb-2">Periodo 1 (Actual)</h3>
            <div className="flex gap-3">
              <Input type="date" label="Desde" value={p1Desde} onChange={e => { setP1Desde(e.target.value); setEnabled(false); }} />
              <Input type="date" label="Hasta" value={p1Hasta} onChange={e => { setP1Hasta(e.target.value); setEnabled(false); }} />
            </div>
          </div>
          <div>
            <h3 className="font-medium mb-2">Periodo 2 (Anterior)</h3>
            <div className="flex gap-3">
              <Input type="date" label="Desde" value={p2Desde} onChange={e => { setP2Desde(e.target.value); setEnabled(false); }} />
              <Input type="date" label="Hasta" value={p2Hasta} onChange={e => { setP2Hasta(e.target.value); setEnabled(false); }} />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={handleCompare}>Comparar</Button>
        </div>
      </Card>

      {loading && <LoadingSpinner className="py-10" />}

      {data && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-500 mb-1">Venta Total</p>
            <p className="text-xl font-bold">{formatMoney(data.periodo_1?.venta_total)}</p>
            <p className="text-sm text-gray-400">vs {formatMoney(data.periodo_2?.venta_total)}</p>
            <div className="mt-2">{renderVariation(data.variaciones?.venta_total_pct)}</div>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 mb-1">Total Cuentas</p>
            <p className="text-xl font-bold">{data.periodo_1?.total_cuentas}</p>
            <p className="text-sm text-gray-400">vs {data.periodo_2?.total_cuentas}</p>
            <div className="mt-2">{renderVariation(data.variaciones?.total_cuentas_pct)}</div>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 mb-1">Ticket Promedio</p>
            <p className="text-xl font-bold">{formatMoney(data.periodo_1?.ticket_promedio)}</p>
            <p className="text-sm text-gray-400">vs {formatMoney(data.periodo_2?.ticket_promedio)}</p>
            <div className="mt-2">{renderVariation(data.variaciones?.ticket_promedio_pct)}</div>
          </Card>
        </div>
      )}
    </div>
  );
}
