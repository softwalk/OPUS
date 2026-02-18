import { useApi } from '../hooks/useApi';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatMoney, formatNumber } from '../lib/format';

function KpiCard({ label, value, sub, variant }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, error } = useApi('/reportes/dashboard');

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;
  if (error) return <div className="text-red-500 text-center py-10">{error}</div>;
  if (!data) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KpiCard label="Ventas Hoy" value={formatMoney(data.ventas_hoy?.total)} sub={`${data.ventas_hoy?.cuentas || 0} cuentas`} />
        <KpiCard label="Ventas del Mes" value={formatMoney(data.ventas_mes?.total)} sub={`${data.ventas_mes?.cuentas || 0} cuentas`} />
        <KpiCard label="Mesas" value={`${data.mesas?.ocupadas || 0} / ${data.mesas?.total || 0}`} sub="ocupadas / total" />
        <KpiCard label="Cuentas Abiertas" value={formatNumber(data.cuentas_abiertas)} />
        <KpiCard label="KDS Pendientes" value={formatNumber(data.kds_pendientes)} />
        <KpiCard label="Productos 86" value={formatNumber(data.productos_86)} />
        <KpiCard label="Órdenes Digitales" value={formatNumber(data.ordenes_digitales_pendientes)} sub="pendientes" />
      </div>
    </div>
  );
}
