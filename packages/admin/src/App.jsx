import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@opus/shared/components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/layout/Layout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Mesas from './pages/Mesas';
import Cuentas from './pages/Cuentas';
import CuentaDetalle from './pages/CuentaDetalle';
import Productos from './pages/Productos';
import Recetas from './pages/Recetas';
import Inventario from './pages/Inventario';
import StockControl from './pages/StockControl';
import Cocina from './pages/Cocina';
import Ordenes from './pages/Ordenes';
import Reservaciones from './pages/Reservaciones';
import Fidelizacion from './pages/Fidelizacion';
import Clientes from './pages/Clientes';
import Proveedores from './pages/Proveedores';
import Compras from './pages/Compras';
import Finanzas from './pages/Finanzas';
import Polizas from './pages/Polizas';
import Facturacion from './pages/Facturacion';
import Personal from './pages/Personal';
import ReporteVentas from './pages/ReporteVentas';
import Costeo from './pages/Costeo';
import Comparativo from './pages/Comparativo';
import Auditoria from './pages/Auditoria';
import Tablas from './pages/Tablas';

function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<Login />} />

              {/* Protected — All inside Layout */}
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                {/* Dashboard */}
                <Route path="/dashboard" element={<Dashboard />} />

                {/* POS */}
                <Route path="/pos/mesas" element={<Mesas />} />
                <Route path="/pos/cuentas" element={<Cuentas />} />
                <Route path="/pos/cuentas/:id" element={<CuentaDetalle />} />

                {/* Catálogo */}
                <Route path="/productos" element={<Productos />} />
                <Route path="/recetas" element={<Recetas />} />

                {/* Inventario */}
                <Route path="/inventario" element={<Inventario />} />
                <Route path="/stock-control" element={<StockControl />} />

                {/* Cocina */}
                <Route path="/cocina" element={<Cocina />} />

                {/* Órdenes Digitales */}
                <Route path="/ordenes" element={<Ordenes />} />
                <Route path="/reservaciones" element={<Reservaciones />} />

                {/* Fidelización */}
                <Route path="/fidelizacion" element={<Fidelizacion />} />

                {/* Finanzas */}
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/proveedores" element={<Proveedores />} />
                <Route path="/compras" element={<Compras />} />
                <Route path="/finanzas" element={<Finanzas />} />
                <Route path="/polizas" element={<Polizas />} />
                <Route path="/facturacion" element={<Facturacion />} />

                {/* Personal */}
                <Route path="/personal" element={<Personal />} />

                {/* Reportes */}
                <Route path="/reportes/ventas" element={<ReporteVentas />} />
                <Route path="/costeo" element={<Costeo />} />
                <Route path="/reportes/comparativo" element={<Comparativo />} />
                <Route path="/auditoria" element={<Auditoria />} />

                {/* Sistema */}
                <Route path="/tablas" element={<Tablas />} />
              </Route>

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
