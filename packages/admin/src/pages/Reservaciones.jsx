import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { formatDate } from '../lib/format';

const estadoVariant = {
  pendiente: 'yellow',
  confirmada: 'blue',
  sentada: 'green',
  cancelada: 'red',
  no_show: 'gray',
};

export default function Reservaciones() {
  const toast = useToast();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const { data, loading, refetch } = useApi(`/reservaciones?fecha=${fecha}&page=${page}&limit=50`, { deps: [page, fecha] });

  // Availability data
  const [disponibilidad, setDisponibilidad] = useState(null);
  const [showDispo, setShowDispo] = useState(false);
  const [dispoPersonas, setDispoPersonas] = useState(2);

  // Seat modal
  const [sentarModal, setSentarModal] = useState(null);

  // Process no-shows
  const [processing, setProcessing] = useState(false);

  const fetchDisponibilidad = async () => {
    try {
      const result = await api.get(`/reservaciones/disponibilidad?fecha=${fecha}&personas=${dispoPersonas}`);
      setDisponibilidad(result);
      setShowDispo(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const updateEstado = async (id, estado, extra = {}) => {
    try {
      const result = await api.put(`/reservaciones/${id}/estado`, { estado, ...extra });
      toast.success(`Reservacion ${estado}`);
      refetch();

      // If seated and cuenta was created, navigate to it
      if (estado === 'sentada' && result.cuenta?.id) {
        navigate(`/pos/cuentas/${result.cuenta.id}`);
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleProcessNoShows = async () => {
    setProcessing(true);
    try {
      const result = await api.post('/reservaciones/process-no-shows');
      const total = (result.no_shows?.processed || 0) + (result.expired?.processed || 0);
      if (total > 0) {
        toast.success(`${total} reservaciones procesadas (no-show/expiradas)`);
        refetch();
      } else {
        toast.info('No hay reservaciones pendientes de procesar');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const columns = [
    { key: 'hora', label: 'Hora', render: (v) => <span className="font-mono font-bold">{v?.slice(0, 5)}</span> },
    { key: 'cliente_nombre', label: 'Cliente' },
    { key: 'cliente_telefono', label: 'Tel' },
    { key: 'personas', label: 'Pers.' },
    { key: 'mesa_numero', label: 'Mesa', render: (v) => v ? <Badge variant="blue">Mesa {v}</Badge> : <span className="text-gray-400">sin asignar</span> },
    { key: 'estado', label: 'Estado', render: (v) => <Badge variant={estadoVariant[v] || 'gray'}>{v}</Badge> },
    { key: 'codigo_confirmacion', label: 'Codigo', render: (v) => <span className="font-mono text-xs">{v}</span> },
    { key: 'id', label: 'Acciones', render: (_, row) => (
      <div className="flex gap-1 flex-wrap">
        {row.estado === 'pendiente' && (
          <>
            <Button size="sm" onClick={() => updateEstado(row.id, 'confirmada')}>Confirmar</Button>
            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => updateEstado(row.id, 'cancelada')}>Cancelar</Button>
          </>
        )}
        {row.estado === 'confirmada' && (
          <>
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setSentarModal(row)}>Sentar</Button>
            <Button size="sm" variant="ghost" className="text-gray-500" onClick={() => updateEstado(row.id, 'no_show')}>No Show</Button>
            <Button size="sm" variant="ghost" className="text-red-500" onClick={() => updateEstado(row.id, 'cancelada')}>Cancelar</Button>
          </>
        )}
      </div>
    )},
  ];

  const reservaciones = data?.reservaciones || data?.data || (Array.isArray(data) ? data : []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Reservaciones</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            type="date"
            value={fecha}
            onChange={e => { setFecha(e.target.value); setPage(1); }}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          />
          <Button variant="secondary" size="sm" onClick={fetchDisponibilidad}>
            Disponibilidad
          </Button>
          <Button variant="ghost" size="sm" onClick={handleProcessNoShows} loading={processing}>
            Procesar No-Shows
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {['pendiente', 'confirmada', 'sentada', 'cancelada', 'no_show'].map(est => {
          const count = reservaciones.filter(r => r.estado === est).length;
          return (
            <div key={est} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-center">
              <Badge variant={estadoVariant[est]} className="mb-1">{est}</Badge>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          );
        })}
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={reservaciones}
          loading={loading}
          total={data?.total || 0}
          page={page}
          onPageChange={setPage}
        />
      </Card>

      {/* Disponibilidad Modal */}
      <Modal open={showDispo} onClose={() => setShowDispo(false)} title={`Disponibilidad — ${fecha}`}>
        {disponibilidad && (
          <div className="space-y-4">
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-xs text-gray-500">Personas</label>
                <input
                  type="number"
                  min="1"
                  value={dispoPersonas}
                  onChange={e => setDispoPersonas(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                />
              </div>
              <Button size="sm" onClick={fetchDisponibilidad}>Buscar</Button>
            </div>

            <p className="text-sm text-gray-500">
              {disponibilidad.total_mesas_aptas} mesas con capacidad para {disponibilidad.personas}+ personas
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-80 overflow-y-auto">
              {(disponibilidad.slots || []).map(slot => (
                <div
                  key={slot.hora}
                  className={`p-2 rounded-lg text-center text-sm border
                    ${slot.disponible
                      ? 'border-green-300 bg-green-50 dark:bg-green-900/10 dark:border-green-800'
                      : 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 opacity-60'
                    }`}
                >
                  <p className="font-mono font-bold">{slot.hora}</p>
                  <p className="text-xs mt-0.5">
                    {slot.mesas_disponibles}/{slot.mesas_total}
                  </p>
                  {slot.disponible && (
                    <span className="text-[10px] text-green-600 dark:text-green-400">disponible</span>
                  )}
                  {!slot.disponible && (
                    <span className="text-[10px] text-red-500">lleno</span>
                  )}
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-400">
              Config: {disponibilidad.config?.duracionHoras}h por reservacion,
              {' '}{disponibilidad.config?.toleranciaMin}min tolerancia,
              {' '}{disponibilidad.config?.horarioInicio}–{disponibilidad.config?.horarioFin}
            </div>
          </div>
        )}
      </Modal>

      {/* Sentar Modal */}
      <Modal open={!!sentarModal} onClose={() => setSentarModal(null)} title="Sentar Cliente">
        {sentarModal && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <p className="text-sm text-gray-500">Cliente</p>
              <p className="font-bold text-lg">{sentarModal.cliente_nombre}</p>
              <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                <div>
                  <span className="text-gray-500">Hora:</span>
                  <p>{sentarModal.hora?.slice(0, 5)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Personas:</span>
                  <p>{sentarModal.personas}</p>
                </div>
                <div>
                  <span className="text-gray-500">Mesa asignada:</span>
                  <p className="font-bold">{sentarModal.mesa_numero ? `Mesa ${sentarModal.mesa_numero}` : 'Sin asignar'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Codigo:</span>
                  <p className="font-mono">{sentarModal.codigo_confirmacion}</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Al sentar al cliente, la mesa pasara a "ocupada" y se abrira una nueva cuenta automaticamente.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setSentarModal(null)}>Cancelar</Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                updateEstado(sentarModal.id, 'sentada', {
                  mesa_id: sentarModal.mesa_id,
                  personas: sentarModal.personas,
                });
                setSentarModal(null);
              }}>
                Sentar y Abrir Cuenta
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
