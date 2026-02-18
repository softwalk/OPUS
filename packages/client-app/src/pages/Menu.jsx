import { useState } from 'react';
import { useEffect } from 'react';
import api from '../lib/api';
import Header from '../components/Header';
import { formatMoney } from '../lib/format';

export default function Menu() {
  const [productos, setProductos] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [grupoActivo, setGrupoActivo] = useState('todos');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        // menu-disponible is a public endpoint — requires ?tenant=slug
        const tenantSlug = 'la-xola'; // TODO: extract from URL/config
        const menuRes = await api.get(`/stock-control/menu-disponible?tenant=${tenantSlug}`);

        // Response: { menu: { "GrupoName": [{id, clave, nombre, precio},...] }, total_disponibles, total_catalogo }
        const menuObj = menuRes?.menu || {};
        const flatProducts = [];
        const grupoSet = [];
        for (const [grupoNombre, items] of Object.entries(menuObj)) {
          grupoSet.push({ id: grupoNombre, nombre: grupoNombre });
          for (const item of items) {
            flatProducts.push({
              id: item.id,
              clave: item.clave,
              descripcion: item.nombre,
              precio_venta: item.precio,
              grupo_id: grupoNombre,
              grupo_nombre: grupoNombre,
            });
          }
        }
        setProductos(flatProducts);
        setGrupos(grupoSet);
      } catch (err) {
        console.error('Error loading menu:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = productos
    .filter(p => grupoActivo === 'todos' || p.grupo_id === grupoActivo)
    .filter(p => !search || p.descripcion?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="pb-20">
      <Header title="Menú" />

      {/* Search */}
      <div className="px-4 py-3">
        <input
          type="text"
          placeholder="Buscar platillo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm border-0 focus:ring-2 focus:ring-orange-500 outline-none"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setGrupoActivo('todos')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${grupoActivo === 'todos' ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
        >
          Todos
        </button>
        {grupos.map(g => (
          <button
            key={g.id}
            onClick={() => setGrupoActivo(g.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${grupoActivo === g.id ? 'bg-orange-500 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
          >
            {g.nombre}
          </button>
        ))}
      </div>

      {/* Products */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Cargando...</div>
      ) : (
        <div className="px-4 space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-2xl">
                🍽️
              </div>
              <div className="flex-1">
                <p className="font-semibold">{p.descripcion}</p>
                <p className="text-xs text-gray-400">{p.grupo_nombre || ''}</p>
              </div>
              <p className="font-bold text-orange-500">{formatMoney(p.precio_venta)}</p>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-8">No hay platillos disponibles</p>
          )}
        </div>
      )}
    </div>
  );
}
