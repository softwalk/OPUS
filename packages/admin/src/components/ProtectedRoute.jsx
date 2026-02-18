import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './ui/LoadingSpinner';

export default function ProtectedRoute({ children, minLevel = 0 }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (minLevel > 0 && user.nivel_acceso < minLevel) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-2">Acceso Denegado</h2>
          <p className="text-gray-500">No tienes permisos suficientes para esta sección.</p>
        </div>
      </div>
    );
  }

  return children;
}
