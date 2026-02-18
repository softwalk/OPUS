import { Link } from 'react-router-dom';
import { useCliente } from '../context/ClienteContext';

export default function Home() {
  const { isLoggedIn, cliente } = useCliente();

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-6 py-10 text-center">
        <h1 className="text-3xl font-bold mb-1">
          {isLoggedIn && cliente?.nombre ? `Hola, ${cliente.nombre.split(' ')[0]}` : 'Bienvenido'}
        </h1>
        <p className="text-orange-100">Explora nuestro menu y haz tu pedido</p>
      </div>

      {/* Quick Actions */}
      <div className="px-4 -mt-6">
        <div className="grid grid-cols-2 gap-3">
          {/* PEDIR — primary action */}
          <Link to="/pedir" className="col-span-2 bg-orange-500 rounded-xl shadow-lg p-5 text-center hover:shadow-xl transition-shadow text-white">
            <span className="text-3xl mb-2 block">🍽️</span>
            <p className="font-bold text-lg">Hacer Pedido</p>
            <p className="text-xs text-orange-100">En mesa, a domicilio o para llevar</p>
          </Link>

          <Link to="/menu" className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 text-center hover:shadow-xl transition-shadow">
            <span className="text-3xl mb-2 block">📋</span>
            <p className="font-semibold">Ver Menu</p>
            <p className="text-xs text-gray-400">Explora los platos</p>
          </Link>
          <Link to="/reservar" className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 text-center hover:shadow-xl transition-shadow">
            <span className="text-3xl mb-2 block">📅</span>
            <p className="font-semibold">Reservar</p>
            <p className="text-xs text-gray-400">Mesa para hoy</p>
          </Link>
          <Link to="/pedir?modo=delivery" className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 text-center hover:shadow-xl transition-shadow">
            <span className="text-3xl mb-2 block">🛵</span>
            <p className="font-semibold">Delivery</p>
            <p className="text-xs text-gray-400">A domicilio</p>
          </Link>
          <Link to="/mi-cuenta" className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 text-center hover:shadow-xl transition-shadow">
            <span className="text-3xl mb-2 block">⭐</span>
            <p className="font-semibold">Mis Puntos</p>
            <p className="text-xs text-gray-400">Programa de lealtad</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
