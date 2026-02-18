import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from '@opus/shared/components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import BottomNav from './components/BottomNav';
import Login from './pages/Login';
import MisMesas from './pages/MisMesas';
import TomarOrden from './pages/TomarOrden';
import CocinaView from './pages/CocinaView';
import Notificaciones from './pages/Notificaciones';
import Resumen from './pages/Resumen';

function ProtectedLayout({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {children}
      <BottomNav />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/mesas" element={<ProtectedLayout><MisMesas /></ProtectedLayout>} />
      <Route path="/orden" element={<ProtectedLayout><TomarOrden /></ProtectedLayout>} />
      <Route path="/cocina" element={<ProtectedLayout><CocinaView /></ProtectedLayout>} />
      <Route path="/notificaciones" element={<ProtectedLayout><Notificaciones /></ProtectedLayout>} />
      <Route path="/resumen" element={<ProtectedLayout><Resumen /></ProtectedLayout>} />
      <Route path="/" element={<Navigate to="/mesas" replace />} />
      <Route path="*" element={<Navigate to="/mesas" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
