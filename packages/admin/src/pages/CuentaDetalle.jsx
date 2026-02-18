import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useToast } from '../components/ui/Toast';
import api from '../lib/api';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { formatMoney, formatDateTime, cuentaStatusVariant } from '../lib/format';

export default function CuentaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: cuenta, loading, refetch } = useApi(`/pos/cuentas/${id}`);
  const { data: productosResp } = useApi('/productos?limit=100');
  const [addModal, setAddModal] = useState(false);
  const [cobrarModal, setCobrarModal] = useState(false);
  const [search, setSearch] = useState('');
  const [propina, setPropina] = useState(0);
  const [formaPagoId, setFormaPagoId] = useState('');
  const [formasPago, setFormasPago] = useState([]);
  const [processing, setProcessing] = useState(false);

  const loadFormasPago = async () => {
    try {
      const data = await api.get('/pos/formas-pago');
      setFormasPago(data || []);
      if (data?.length > 0) setFormaPagoId(data[0].id);
    } catch {}
  };

  const addConsumo = async (productoId) => {
    try {
      await api.post('/pos/consumos', {
        cuenta_id: id,
        producto_id: productoId,
        cantidad: 1,
      });
      toast.success('Producto agregado');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const cancelConsumo = async (consumoId) => {
    try {
      await api.delete(`/pos/consumos/${consumoId}`);
      toast.success('Consumo cancelado');
      refetch();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCobrar = async () => {
    if (!formaPagoId) return toast.error('Selecciona forma de pago');
    setProcessing(true);
    try {
      await api.post(`/pos/cuentas/${id}/cobrar`, {
        forma_pago_id: formaPagoId,
        propina: Number(propina) * 100,
      });
      toast.success('Cuenta cobrada exitosamente');
      setCobrarModal(false);
      navigate('/pos/mesas');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" size="lg" />;
  if (!cuenta) return <div className="text-center py-10 text-gray-500">Cuenta no encontrada</div>;

  const allProducts = productosResp?.productos || productosResp?.data || (Array.isArray(productosResp) ? productosResp : []);
  const filteredProducts = allProducts.filter(p =>
    p.tipo === 'terminado' && (
      p.descripcion?.toLowerCase().includes(search.toLowerCase()) || p.clave?.toLowerCase().includes(search.toLowerCase())
    )
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Cuenta #{cuenta.folio || id.slice(0,8)}</h1>
          <p className="text-sm text-gray-500">Mesa {cuenta.mesa_numero} · {formatDateTime(cuenta.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={cuentaStatusVariant(cuenta.estado)} className="text-sm px-3 py-1">
            {cuenta.estado}
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Consumos */}
        <div className="lg:col-span-2">
          <Card title="Consumos" action={
            cuenta.estado === 'abierta' && <Button size="sm" onClick={() => setAddModal(true)}>+ Agregar</Button>
          }>
            {(cuenta.consumos || []).length === 0 ? (
              <p className="text-gray-400 text-center py-6">Sin consumos</p>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {(cuenta.consumos || []).map(c => (
                  <div key={c.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{c.producto_nombre || c.producto_id}</p>
                      <p className="text-sm text-gray-400">{c.cantidad} x {formatMoney(c.precio_unitario)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{formatMoney(c.importe)}</span>
                      {cuenta.estado === 'abierta' && (
                        <button onClick={() => cancelConsumo(c.id)} className="text-red-500 text-xs hover:underline">
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Totals */}
        <div>
          <Card title="Resumen">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatMoney(cuenta.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">IVA</span>
                <span>{formatMoney(cuenta.iva)}</span>
              </div>
              {cuenta.propina > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Propina</span>
                  <span>{formatMoney(cuenta.propina)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-gray-700 pt-3">
                <span>Total</span>
                <span>{formatMoney(cuenta.total)}</span>
              </div>

              {cuenta.estado === 'abierta' && (
                <Button className="w-full mt-4" onClick={() => { loadFormasPago(); setCobrarModal(true); }}>
                  Cobrar
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Add Product Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Agregar Producto" size="lg">
        <Input placeholder="Buscar producto..." value={search} onChange={e => setSearch(e.target.value)} className="mb-4" />
        <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          {filteredProducts.slice(0, 30).map(p => (
            <button
              key={p.id}
              onClick={() => { addConsumo(p.id); }}
              className="w-full flex items-center justify-between py-2 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
            >
              <div className="text-left">
                <p className="font-medium">{p.descripcion}</p>
                <p className="text-xs text-gray-400">{p.clave}</p>
              </div>
              <span className="font-semibold text-primary-600">{formatMoney(p.precio_venta)}</span>
            </button>
          ))}
        </div>
      </Modal>

      {/* Cobrar Modal */}
      <Modal open={cobrarModal} onClose={() => setCobrarModal(false)} title="Cobrar Cuenta">
        <div className="space-y-4">
          <div className="text-center text-3xl font-bold">{formatMoney(cuenta.total)}</div>
          <div>
            <label className="block text-sm font-medium mb-1">Forma de Pago</label>
            <select
              value={formaPagoId}
              onChange={e => setFormaPagoId(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
            >
              {formasPago.map(fp => (
                <option key={fp.id} value={fp.id}>{fp.nombre}</option>
              ))}
            </select>
          </div>
          <Input
            label="Propina ($)"
            type="number"
            min="0"
            step="0.01"
            value={propina}
            onChange={e => setPropina(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCobrarModal(false)}>Cancelar</Button>
            <Button onClick={handleCobrar} loading={processing}>Confirmar Cobro</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
