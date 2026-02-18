import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatMoney, formatNumber } from '../lib/format';

export default function ReporteVentas() {
  const today = new Date().toISOString().split('T')[0];
  const [tipo, setTipo] = useState('dia');
  const [fecha, setFecha] = useState(today);
  const [desde, setDesde] = useState(today);
  const [hasta, setHasta] = useState(today);

  const { data: dataDia, loading: loadDia } = useApi(
    `/reportes/ventas-dia?fecha=${fecha}`,
    { deps: [fecha], enabled: tipo === 'dia' }
  );

  const { data: dataPeriodo, loading: loadPer } = useApi(
    `/reportes/ventas-periodo?desde=${desde}&hasta=${hasta}`,
    { deps: [desde, hasta], enabled: tipo === 'periodo' }
  );

  const { data: dataMesero, loading: loadMes } = useApi(
    `/reportes/ventas-mesero?desde=${desde}&hasta=${hasta}`,
    { deps: [desde, hasta], enabled: tipo === 'mesero' }
  );

  const { data: dataProducto, loading: loadProd } = useApi(
    `/reportes/ventas-producto?desde=${desde}&hasta=${hasta}`,
    { deps: [desde, hasta], enabled: tipo === 'producto' }
  );

  const { data: dataHora, loading: loadHora } = useApi(
    `/reportes/ventas-hora?desde=${desde}&hasta=${hasta}`,
    { deps: [desde, hasta], enabled: tipo === 'hora' }
  );

  const tabs = [
    { key: 'dia', label: 'Del Día' },
    { key: 'periodo', label: 'Por Periodo' },
    { key: 'mesero', label: 'Por Mesero' },
    { key: 'producto', label: 'Por Producto' },
    { key: 'hora', label: 'Por Hora' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reportes de Ventas</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTipo(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tipo === t.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mb-6">
        {tipo === 'dia' ? (
          <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        ) : (
          <>
            <Input type="date" label="Desde" value={desde} onChange={e => setDesde(e.target.value)} />
            <Input type="date" label="Hasta" value={hasta} onChange={e => setHasta(e.target.value)} />
          </>
        )}
      </div>

      {/* Ventas del Día */}
      {tipo === 'dia' && (loadDia ? <LoadingSpinner className="py-10" /> : dataDia?.resumen && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card><p className="text-xs text-gray-500">Venta Total</p><p className="text-xl font-bold">{formatMoney(dataDia.resumen.venta_total)}</p></Card>
            <Card><p className="text-xs text-gray-500">Cuentas</p><p className="text-xl font-bold">{dataDia.resumen.total_cuentas}</p></Card>
            <Card><p className="text-xs text-gray-500">Ticket Promedio</p><p className="text-xl font-bold">{formatMoney(dataDia.resumen.ticket_promedio)}</p></Card>
            <Card><p className="text-xs text-gray-500">Propinas</p><p className="text-xl font-bold">{formatMoney(dataDia.resumen.propina_total)}</p></Card>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card title="Por Forma de Pago">
              {(dataDia.por_forma_pago || []).map((fp, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <span>{fp.forma_pago}</span>
                  <span className="font-semibold">{formatMoney(fp.monto)} <span className="text-xs text-gray-400">({fp.num_cuentas})</span></span>
                </div>
              ))}
            </Card>
            <Card title="Top Productos">
              {(dataDia.top_productos || []).map((p, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <span>{p.descripcion} <span className="text-xs text-gray-400">x{p.cantidad_vendida}</span></span>
                  <span className="font-semibold">{formatMoney(p.importe_total)}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      ))}

      {/* Por Periodo */}
      {tipo === 'periodo' && (loadPer ? <LoadingSpinner className="py-10" /> : dataPeriodo && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card><p className="text-xs text-gray-500">Venta Total</p><p className="text-xl font-bold">{formatMoney(dataPeriodo.totales?.venta_total)}</p></Card>
            <Card><p className="text-xs text-gray-500">Cuentas</p><p className="text-xl font-bold">{dataPeriodo.totales?.total_cuentas}</p></Card>
            <Card><p className="text-xs text-gray-500">Ticket Promedio</p><p className="text-xl font-bold">{formatMoney(dataPeriodo.totales?.ticket_promedio)}</p></Card>
            <Card><p className="text-xs text-gray-500">Propinas</p><p className="text-xl font-bold">{formatMoney(dataPeriodo.totales?.propina_total)}</p></Card>
          </div>
          <Card title="Ventas por Día">
            {(dataPeriodo.por_dia || []).map((d, i) => (
              <div key={i} className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0 text-sm">
                <span>{d.fecha}</span>
                <span>{d.total_cuentas} cuentas</span>
                <span className="font-semibold">{formatMoney(d.venta_total)}</span>
              </div>
            ))}
          </Card>
        </div>
      ))}

      {/* Por Mesero */}
      {tipo === 'mesero' && (loadMes ? <LoadingSpinner className="py-10" /> : dataMesero && (
        <Card title="Ventas por Mesero">
          {(dataMesero.meseros || []).map((m, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div>
                <p className="font-medium">{m.mesero} <span className="text-xs text-gray-400">({m.codigo})</span></p>
                <p className="text-xs text-gray-400">{m.total_cuentas} cuentas · {m.dias_trabajados} días</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{formatMoney(m.venta_total)}</p>
                <p className="text-xs text-gray-400">Propinas: {formatMoney(m.propina_total)}</p>
              </div>
            </div>
          ))}
        </Card>
      ))}

      {/* Por Producto */}
      {tipo === 'producto' && (loadProd ? <LoadingSpinner className="py-10" /> : dataProducto && (
        <Card title="Ventas por Producto">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Producto</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Grupo</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Cant.</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Ingreso</th>
              </tr></thead>
              <tbody>
                {(dataProducto.productos || []).map((p, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2">{p.descripcion} <span className="text-xs text-gray-400">({p.clave})</span></td>
                    <td className="px-3 py-2 text-gray-500">{p.grupo || '—'}</td>
                    <td className="px-3 py-2 text-right">{p.cantidad_vendida}</td>
                    <td className="px-3 py-2 text-right font-semibold">{formatMoney(p.ingreso_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {/* Por Hora */}
      {tipo === 'hora' && (loadHora ? <LoadingSpinner className="py-10" /> : dataHora && (
        <Card title="Ventas por Hora del Día">
          <div className="space-y-2">
            {(dataHora.por_hora || []).map((h, i) => {
              const maxVenta = Math.max(...(dataHora.por_hora || []).map(x => x.venta_total || 1));
              const pct = maxVenta > 0 ? (h.venta_total / maxVenta) * 100 : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-12 text-sm text-right text-gray-500">{String(h.hora).padStart(2, '0')}:00</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-6 overflow-hidden">
                    <div className="bg-primary-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-24 text-sm text-right font-medium">{formatMoney(h.venta_total)}</span>
                  <span className="w-16 text-xs text-gray-400">{h.total_cuentas} ctas</span>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}
