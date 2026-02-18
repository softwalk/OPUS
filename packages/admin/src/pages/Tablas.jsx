import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import Card from '../components/ui/Card';
import LoadingSpinner from '../components/ui/LoadingSpinner';

export default function Tablas() {
  const [tab, setTab] = useState('zonas');

  const { data: zonas, loading: loadZ } = useApi('/pos/zonas', { enabled: tab === 'zonas' });
  const { data: formasPago, loading: loadFP } = useApi('/pos/formas-pago', { enabled: tab === 'formas_pago' });
  const { data: turnos, loading: loadT } = useApi('/pos/turnos', { enabled: tab === 'turnos' });
  const { data: almacenes, loading: loadA } = useApi('/inventario/almacenes', { enabled: tab === 'almacenes' });
  const { data: grupos, loading: loadG } = useApi('/productos/grupos', { enabled: tab === 'grupos' });

  const tabs = [
    { key: 'zonas', label: 'Zonas' },
    { key: 'formas_pago', label: 'Formas de Pago' },
    { key: 'turnos', label: 'Turnos' },
    { key: 'almacenes', label: 'Almacenes' },
    { key: 'grupos', label: 'Grupos' },
  ];

  const renderTable = (items, cols) => {
    if (!items || items.length === 0) return <p className="text-gray-400 text-center py-6">Sin datos</p>;
    return (
      <table className="min-w-full text-sm">
        <thead><tr className="border-b border-gray-200 dark:border-gray-700">
          {cols.map(c => <th key={c.key} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{c.label}</th>)}
        </tr></thead>
        <tbody>
          {items.map((row, i) => (
            <tr key={row.id || i} className="border-b border-gray-100 dark:border-gray-800">
              {cols.map(c => <td key={c.key} className="px-4 py-2">{c.render ? c.render(row[c.key], row) : row[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const isLoading = tab === 'zonas' ? loadZ : tab === 'formas_pago' ? loadFP : tab === 'turnos' ? loadT : tab === 'almacenes' ? loadA : loadG;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tablas del Sistema</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t.key ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        {isLoading ? <LoadingSpinner className="py-10" /> : (
          <>
            {tab === 'zonas' && renderTable(zonas, [{ key: 'nombre', label: 'Nombre' }, { key: 'descripcion', label: 'Descripción' }])}
            {tab === 'formas_pago' && renderTable(formasPago, [{ key: 'clave', label: 'Clave' }, { key: 'nombre', label: 'Nombre' }])}
            {tab === 'turnos' && renderTable(turnos, [{ key: 'nombre', label: 'Nombre' }, { key: 'hora_inicio', label: 'Inicio' }, { key: 'hora_fin', label: 'Fin' }])}
            {tab === 'almacenes' && renderTable(almacenes, [{ key: 'numero', label: '#' }, { key: 'nombre', label: 'Nombre' }, { key: 'descripcion', label: 'Descripción' }])}
            {tab === 'grupos' && renderTable(grupos, [{ key: 'nombre', label: 'Nombre' }, { key: 'descripcion', label: 'Descripción' }])}
          </>
        )}
      </Card>
    </div>
  );
}
