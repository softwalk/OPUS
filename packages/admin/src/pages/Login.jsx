import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ codigo: '', password: '', tenant_slug: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.codigo, form.password, form.tenant_slug);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 mb-2">OPUS</h1>
          <p className="text-gray-500 dark:text-gray-400">Sistema POS Multi-Tenant</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-semibold mb-6 text-center">Iniciar Sesión</h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Restaurante"
              placeholder="ej: la-xola"
              value={form.tenant_slug}
              onChange={e => setForm(f => ({ ...f, tenant_slug: e.target.value }))}
              required
            />
            <Input
              label="Código de usuario"
              placeholder="ej: ADM"
              value={form.codigo}
              onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
              required
            />
            <Input
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
            <Button type="submit" loading={loading} className="w-full">
              Entrar
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          OPUS v1.0.0 — Restaurant POS SaaS Platform
        </p>
      </div>
    </div>
  );
}
