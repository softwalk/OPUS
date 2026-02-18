import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ClienteProvider } from './context/ClienteContext';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Pedir from './pages/Pedir';
import Reservar from './pages/Reservar';
import Delivery from './pages/Delivery';
import MiCuenta from './pages/MiCuenta';

function App() {
  return (
    <ClienteProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/pedir" element={<Pedir />} />
            <Route path="/reservar" element={<Reservar />} />
            <Route path="/delivery" element={<Delivery />} />
            <Route path="/mi-cuenta" element={<MiCuenta />} />
          </Routes>
          <BottomNav />
        </div>
      </BrowserRouter>
    </ClienteProvider>
  );
}

export default App;
