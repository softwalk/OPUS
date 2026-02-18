import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatMoney, mesaStatusVariant } from '../lib/format';

export default function Mesas() {
  const { data: mesas, loading, refetch } = useApi('/pos/mesas');
  const toast = useToast();
  const navigate = useNavigate();
  const [modal, setModal] = useState(null);
  const [personas, setPersonas] = useState(1);
  const [opening, setOpening] = useState(false);

  // Reservation timeline for today
  const [timeline, setTimeline] = useState(null);
  const [reservaModal, setReservaModal] = useState(null);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const data = await api.get(`/reservaciones/mesas-timeline?fecha=${today}`);
        setTimeline(data);
      } catch { /* non-critical */ }
    };
    fetchTimeline();
  }, []);

  const handleAbrir = async () => {
    setOpening(true);
    try {
      const result = await api.post(`/pos/mesas/${modal.id}/abrir`, { personas: Number(personas) });
      toast.success(`Mesa ${modal.numero} abierta`);
      setModal(null);
      refetch();
      if (result.cuenta?.id) navigate(`/pos/cuentas/${result.cuenta.id}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setOpening(false);
    }
  };

  // Find reservations for a specific mesa from the timeline
  const getReservacionesMesa = (mesaId) => {
    if (!timeline?.mesas) return [];
    const m = timeline.mesas.find(tm => tm.id === mesaId);
    return m?.reservaciones || [];
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mesas</h1>
        <div className="flex gap-2">
          {timeline && (
            <span className="text-sm text-gray-500 self-center">
              {timeline.total_reservaciones} reservaciones hoy
            </span>
          )}
          <Button variant="ghost" onClick={refetch}>Actualizar</Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-300 inline-block" /> Libre</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-300 inline-block" /> Ocupada</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-300 inline-block" /> Reservada</span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {(mesas || []).map(mesa => {
          const reservaciones = getReservacionesMesa(mesa.id);
          const nextReserva = reservaciones.find(r => r.estado === 'confirmada' || r.estado === 'pendiente');

          return (
            <button
              key={mesa.id}
              onClick={() => {
                if (mesa.estado === 'libre') {
                  setModal(mesa);
                  setPersonas(1);
                } else if (mesa.estado === 'reservada' && nextReserva) {
                  setReservaModal({ mesa, reservacion: nextReserva });
                } else if (mesa.cuenta_id) {
                  navigate(`/pos/cuentas/${mesa.cuenta_id}`);
                }
              }}
              className={`relative p-4 rounded-xl border-2 text-center transition-all hover:scale-105
                ${mesa.estado === 'libre' ? 'border-green-300 bg-green-50 dark:bg-green-900/10 dark:border-green-800' : ''}
                ${mesa.estado === 'ocupada' ? 'border-red-300 bg-red-50 dark:bg-red-900/10 dark:border-red-800' : ''}
                ${mesa.estado === 'reservada' ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800' : ''}
              `}
            >
              <p className="text-2xl font-bold">{mesa.numero}</p>
              <Badge variant={mesaStatusVariant(mesa.estado)} className="mt-1">
                {mesa.estado}
              </Badge>
              {mesa.estado === 'ocupada' && mesa.total != null && (
                <p className="text-xs mt-1 font-medium">{formatMoney(mesa.total)}</p>
              )}
              {/* Show mesero name on occupied mesas */}
              {mesa.mesero_nombre && mesa.estado === 'ocupada' && (
                <p className="text-[10px] mt-0.5 text-gray-500 dark:text-gray-400 truncate">{mesa.mesero_nombre}</p>
              )}
              {/* Show next reservation info on reserved/libre mesas */}
              {nextReserva && (
                <div className="mt-1 text-[10px] leading-tight text-blue-600 dark:text-blue-400">
                  <p>{nextReserva.hora?.slice(0, 5)}</p>
                  <p className="truncate">{nextReserva.cliente_nombre}</p>
                </div>
              )}
              {/* Dot indicator for mesas with future reservations (even if libre now) */}
              {reservaciones.length > 0 && mesa.estado === 'libre' && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" title="Tiene reservaciones" />
              )}
            </button>
          );
        })}
      </div>

      {/* Abrir Mesa Modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={`Abrir Mesa ${modal?.numero}`}>
        <div className="space-y-4">
          <Input
            label="Numero de personas"
            type="number"
            min="1"
            value={personas}
            onChange={e => setPersonas(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setModal(null)}>Cancelar</Button>
            <Button onClick={handleAbrir} loading={opening}>Abrir Mesa</Button>
          </div>
        </div>
      </Modal>

      {/* Reserved Mesa Info Modal */}
      <Modal open={!!reservaModal} onClose={() => setReservaModal(null)} title={`Mesa ${reservaModal?.mesa?.numero} — Reservada`}>
        {reservaModal?.reservacion && (
          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Cliente:</span>
                  <p className="font-medium">{reservaModal.reservacion.cliente_nombre}</p>
                </div>
                <div>
                  <span className="text-gray-500">Hora:</span>
                  <p className="font-medium">{reservaModal.reservacion.hora?.slice(0, 5)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Personas:</span>
                  <p className="font-medium">{reservaModal.reservacion.personas}</p>
                </div>
                <div>
                  <span className="text-gray-500">Tel:</span>
                  <p className="font-medium">{reservaModal.reservacion.cliente_telefono || '—'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Codigo:</span>
                  <p className="font-mono font-bold text-blue-600">{reservaModal.reservacion.codigo_confirmacion}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setReservaModal(null)}>Cerrar</Button>
              <Button onClick={() => {
                navigate('/reservaciones');
                setReservaModal(null);
              }}>Ver Reservaciones</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
