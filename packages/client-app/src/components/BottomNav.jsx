import { NavLink } from 'react-router-dom';

const tabs = [
  { path: '/', icon: '🏠', label: 'Inicio' },
  { path: '/pedir', icon: '🍽️', label: 'Pedir' },
  { path: '/menu', icon: '📋', label: 'Menu' },
  { path: '/reservar', icon: '📅', label: 'Reservar' },
  { path: '/mi-cuenta', icon: '👤', label: 'Cuenta' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-50 safe-area-bottom">
      <div className="flex justify-around py-2">
        {tabs.map(tab => (
          <NavLink
            key={tab.path}
            to={tab.path}
            end={tab.path === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-xs font-medium
              ${isActive ? 'text-orange-500' : 'text-gray-400'}`
            }
          >
            <span className="text-xl">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
