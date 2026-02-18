import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatMoney, formatPct, formatNumber } from '../lib/format';

export default function Costeo() {
  const toast = useToast();
  const today = new Date().toISOString().split('T')[0];
  const [tab, setTab] = useState('food-cost');
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(today);

  const { data: fcData, loading: loadFC } = useApi(
    `/costeo/food-cost?desde=${desde}&hasta=${hasta}`,
    { deps: [desde, hasta], enabled: tab === 'food-cost' }
  );

  const { data: desData, loading: loadDes } = useApi(
    `/costeo/desviaciones?desde=${desde}&hasta=${hasta}`,
    { deps: [desde, hasta], enabled: tab === 'desviaciones' }
  );

  const [recalculating, setRecalculating] = useState(false);

  const handleRecalcular = async () => {
    setRecalculating(true);
    try {
      const result = await api.post('/costeo/recalcular');
      toast.success(`${result.actualizados} costos recalculados`);
    } catch (err) { toast.error(err.message); }
    finally { setRecalculating(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Costeo</h1>
        <Button variant="secondary" onClick={handleRecalcular} loading={recalculating}>
          Recalcular Costos
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {[{ key: 'food-cost', label: 'Food Cost' }, { key: 'desviaciones', label: 'Desviaciones' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        <Input type="date" label="Desde" value={desde} onChange={e => setDesde(e.target.value)} />
        <Input type="date" label="Hasta" value={hasta} onChange={e => setHasta(e.target.value)} />
      </div>

      {tab === 'food-cost' && (loadFC ? <LoadingSpinner className="py-10" /> : fcData && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card><p className="text-xs text-gray-500">Food Cost Global</p><p className={`text-2xl font-bold ${fcData.food_cost_global > 35 ? 'text-red-600' : fcData.food_cost_global > 30 ? 'text-yellow-600' : 'text-green-600'}`}>{formatPct(fcData.food_cost_global)}</p></Card>
            <Card><p className="text-xs text-gray-500">Ingreso Total</p><p className="text-xl font-bold">{formatMoney(fcData.ingreso_total)}</p></Card>
            <Card><p className="text-xs text-gray-500">Costo Total</p><p className="text-xl font-bold">{formatMoney(fcData.costo_total)}</p></Card>
            <Card><p className="text-xs text-gray-500">Margen</p><p className="text-xl font-bold text-green-600">{formatMoney(fcData.margen_total)}</p></Card>
          </div>
          <Card title="Food Cost por Producto">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Producto</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Cant.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Ingreso</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Costo</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">FC%</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Margen</th>
                </tr></thead>
                <tbody>
                  {(fcData.productos || []).map((p, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">{p.descripcion}</td>
                      <td className="px-3 py-2 text-right">{p.cantidad_vendida}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(p.ingreso_total)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(p.costo_total)}</td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant={p.food_cost_pct > 35 ? 'red' : p.food_cost_pct > 30 ? 'yellow' : 'green'}>
                          {formatPct(p.food_cost_pct)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">{formatMoney(p.margen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ))}

      {tab === 'desviaciones' && (loadDes ? <LoadingSpinner className="py-10" /> : desData && (
        <div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Card><p className="text-xs text-gray-500">Insumos Analizados</p><p className="text-xl font-bold">{desData.total_insumos}</p></Card>
            <Card><p className="text-xs text-gray-500">Con Desviación</p><p className="text-xl font-bold text-yellow-600">{desData.con_desviacion}</p></Card>
          </div>
          <Card title="Desviaciones Teórico vs Real">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Insumo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Unidad</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Teórico</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Real</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Desv.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">%</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
                </tr></thead>
                <tbody>
                  {(desData.desviaciones || []).map((d, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">{d.insumo}</td>
                      <td className="px-3 py-2">{d.unidad}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(d.consumo_teorico)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(d.consumo_real)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(d.desviacion)}</td>
                      <td className="px-3 py-2 text-right">{formatPct(d.desviacion_pct)}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={d.status === 'normal' ? 'green' : d.status === 'exceso' ? 'red' : 'yellow'}>
                          {d.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}
