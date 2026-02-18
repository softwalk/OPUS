import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ codigo: '', password: '', tenant_slug: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/auth/login', form);
      api.setToken(data.token);
      localStorage.setItem('opus_waiter_user', JSON.stringify(data.user));
      navigate('/mesas');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">OPUS</h1>
          <p className="text-gray-400">App Mesero</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          {error && <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Restaurante</label>
              <input required placeholder="ej: la-xola" value={form.tenant_slug} onChange={e => setForm(f => ({ ...f, tenant_slug: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Código</label>
              <input required value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contraseña</label>
              <input required type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:opacity-50">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
