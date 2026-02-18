import { useState, useEffect, useCallback } from 'react';
import { useCliente } from '../context/ClienteContext';
import Header from '../components/Header';

const API_BASE = '/api/v1';

export default function Reservar() {
  const { cliente, isLoggedIn, tenantSlug } = useCliente();

  const [form, setForm] = useState({
    cliente_nombre: '', cliente_telefono: '', fecha: '', hora: '', personas: 2, notas: '',
  });
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Availability state
  const [slots, setSlots] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [config, setConfig] = useState(null);

  // Prefill from saved profile when logged in
  useEffect(() => {
    if (isLoggedIn && cliente) {
      setForm(f => ({
        ...f,
        cliente_nombre: f.cliente_nombre || cliente.nombre || '',
        cliente_telefono: f.cliente_telefono || cliente.telefono || '',
      }));
    }
  }, [isLoggedIn, cliente]);

  // Fetch availability when date or personas change
  const fetchDisponibilidad = useCallback(async (fecha, personas) => {
    if (!fecha || !personas) return;
    setLoadingSlots(true);
    try {
      const res = await fetch(
        `${API_BASE}/clientes/reservar/disponibilidad?tenant_slug=${tenantSlug}&fecha=${fecha}&personas=${personas}`
      );
      const data = await res.json();
      if (res.ok) {
        setSlots(data.slots || []);
        setConfig(data.config || null);
      } else {
        setSlots([]);
      }
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    if (form.fecha && form.personas) {
      fetchDisponibilidad(form.fecha, form.personas);
    }
  }, [form.fecha, form.personas, fetchDisponibilidad]);

  const selectedSlot = slots?.find(s => s.hora === form.hora);
  const isSlotAvailable = selectedSlot?.disponible ?? true;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (slots && form.hora && !isSlotAvailable) {
      setError('El horario seleccionado no tiene mesas disponibles. Elige otro horario.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/clientes/reservar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tenant_slug: tenantSlug,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.alternativas?.length > 0) {
          setError(
            `${data.error?.message || 'No hay disponibilidad'}. Horarios disponibles: ${data.alternativas.map(a => a.hora).join(', ')}`
          );
        } else {
          setError(data.error?.message || 'Error al reservar');
        }
        return;
      }

      setSuccess(data);
    } catch (err) {
      setError(err.message || 'Error de conexion');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="pb-20">
        <Header title="Reservar" />
        <div className="px-6 py-12 text-center">
          <span className="text-5xl mb-4 block">&#127881;</span>
          <h2 className="text-xl font-bold mb-2">Reservacion Exitosa</h2>
          <p className="text-gray-500 mb-1">Te esperamos el {form.fecha} a las {form.hora}</p>
          <p className="text-gray-400 text-sm">{form.personas} personas</p>

          {success.mesa_numero && (
            <div className="mt-4 inline-block bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">Mesa asignada</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">Mesa {success.mesa_numero}</p>
            </div>
          )}

          {success.codigo_confirmacion && (
            <div className="mt-3">
              <p className="text-sm text-gray-500">Codigo de confirmacion</p>
              <p className="text-lg font-mono font-bold text-orange-600">{success.codigo_confirmacion}</p>
            </div>
          )}

          {success.config && (
            <p className="mt-3 text-xs text-gray-400">
              Tu mesa estara reservada por {success.config.duracion_horas}h.
              Tolerancia de llegada: {success.config.tolerancia_min} minutos.
            </p>
          )}

          <button onClick={() => {
            setSuccess(null);
            setForm(f => ({ ...f, fecha: '', hora: '', personas: 2, notas: '' }));
            setSlots(null);
          }}
            className="mt-6 px-6 py-2 bg-orange-500 text-white rounded-full font-medium">
            Nueva Reservacion
          </button>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="pb-20">
      <Header title="Reservar Mesa" />
      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-4">
        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg text-sm">{error}</div>}

        {isLoggedIn && cliente?.nombre && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg text-sm text-orange-700 dark:text-orange-300">
            <span>&#128100;</span>
            <span>Reservando como <strong>{cliente.nombre}</strong></span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input required value={form.cliente_nombre} onChange={e => setForm(f => ({ ...f, cliente_nombre: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Telefono</label>
          <input required type="tel" value={form.cliente_telefono} onChange={e => setForm(f => ({ ...f, cliente_telefono: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Personas</label>
          <input type="number" min="1" max="50" value={form.personas} onChange={e => setForm(f => ({ ...f, personas: Number(e.target.value) }))}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Fecha</label>
          <input required type="date" min={today} value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value, hora: '' }))}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
        </div>

        {/* Availability grid */}
        {form.fecha && (
          <div>
            <label className="block text-sm font-medium mb-2">Selecciona Horario</label>
            {loadingSlots && (
              <div className="text-center py-4 text-sm text-gray-400">Verificando disponibilidad...</div>
            )}
            {!loadingSlots && slots && slots.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {slots.map(slot => (
                  <button
                    key={slot.hora}
                    type="button"
                    disabled={!slot.disponible}
                    onClick={() => setForm(f => ({ ...f, hora: slot.hora }))}
                    className={`p-2 rounded-lg text-center text-sm border transition-all
                      ${!slot.disponible
                        ? 'border-gray-200 bg-gray-100 dark:bg-gray-800 dark:border-gray-700 text-gray-400 cursor-not-allowed line-through'
                        : form.hora === slot.hora
                          ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 ring-2 ring-orange-500 font-bold'
                          : 'border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800 hover:border-green-400'
                      }`}
                  >
                    <p className="font-mono">{slot.hora}</p>
                    <p className="text-[10px] mt-0.5">
                      {slot.disponible
                        ? `${slot.mesas_disponibles} mesa${slot.mesas_disponibles > 1 ? 's' : ''}`
                        : 'lleno'}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {!loadingSlots && slots && slots.length === 0 && (
              <p className="text-sm text-gray-400 py-2">No hay horarios disponibles para esta fecha</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Notas (opcional)</label>
          <textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2}
            placeholder="Cumpleanos, silla alta, alergias..."
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm" />
        </div>

        {config && (
          <div className="text-xs text-gray-400 text-center">
            Reservaciones de {config.duracionHoras}h | Tolerancia: {config.toleranciaMin} min
          </div>
        )}

        <button type="submit" disabled={loading || !form.hora || (slots && !isSlotAvailable)}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-semibold disabled:opacity-50 transition-colors">
          {loading ? 'Reservando...' : 'Confirmar Reservacion'}
        </button>
      </form>
    </div>
  );
}
