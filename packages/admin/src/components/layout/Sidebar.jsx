import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { section: 'POS' },
  { label: 'Mesas', path: '/pos/mesas', icon: '🪑' },
  { label: 'Cuentas', path: '/pos/cuentas', icon: '🧾' },
  { section: 'Catálogo' },
  { label: 'Productos', path: '/productos', icon: '📦' },
  { label: 'Recetas', path: '/recetas', icon: '📋' },
  { section: 'Inventario' },
  { label: 'Existencias', path: '/inventario', icon: '📊' },
  { label: 'Stock Control', path: '/stock-control', icon: '⚠️' },
  { section: 'Cocina' },
  { label: 'KDS', path: '/cocina', icon: '👨‍🍳' },
  { section: 'Órdenes' },
  { label: 'Órdenes', path: '/ordenes', icon: '📱' },
  { label: 'Reservaciones', path: '/reservaciones', icon: '📅' },
  { section: 'Lealtad' },
  { label: 'Fidelización', path: '/fidelizacion', icon: '⭐' },
  { section: 'Finanzas' },
  { label: 'Clientes', path: '/clientes', icon: '👥' },
  { label: 'Proveedores', path: '/proveedores', icon: '🏭' },
  { label: 'Compras', path: '/compras', icon: '🛒' },
  { label: 'CxC / CxP', path: '/finanzas', icon: '💰' },
  { label: 'Pólizas', path: '/polizas', icon: '📄' },
  { label: 'Facturación', path: '/facturacion', icon: '🧾' },
  { section: 'Equipo' },
  { label: 'Personal', path: '/personal', icon: '👤' },
  { section: 'Reportes' },
  { label: 'Ventas', path: '/reportes/ventas', icon: '📈' },
  { label: 'Costeo', path: '/costeo', icon: '💲' },
  { label: 'Comparativo', path: '/reportes/comparativo', icon: '📊' },
  { label: 'Auditoría', path: '/auditoria', icon: '🔍' },
  { section: 'Sistema' },
  { label: 'Tablas', path: '/tablas', icon: '⚙️' },
];

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 
          transform transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto`}
      >
        <div className="flex flex-col h-full">
          {/* Brand */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-200 dark:border-gray-800">
            <span className="text-2xl font-bold text-primary-600">OPUS</span>
            <span className="text-xs text-gray-400 mt-1">Admin</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
            {navItems.map((item, i) => {
              if (item.section) {
                return (
                  <div key={i} className="pt-4 pb-1 px-3">
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      {item.section}
                    </span>
                  </div>
                );
              }
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`
                  }
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-3">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            >
              {dark ? '☀️' : '🌙'} {dark ? 'Modo claro' : 'Modo oscuro'}
            </button>

            {/* User info */}
            {user && (
              <div className="flex items-center gap-3 px-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-bold text-primary-600">
                  {user.codigo?.[0] || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user.nombre || user.codigo}</p>
                  <p className="text-xs text-gray-400 capitalize">{user.puesto}</p>
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
            >
              🚪 Cerrar sesión
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
