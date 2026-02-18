import { z } from 'zod';

// UUID helper — accepts any valid 8-4-4-4-12 hex pattern (PostgreSQL-compatible)
// Standard uid() requires RFC 4122 variant bits which our seed UUIDs don't have
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const uid = (msg) => z.string().regex(UUID_REGEX, msg || 'UUID invalido');

// === Auth ===
export const loginSchema = z.object({
  codigo: z.string().min(1, 'Codigo requerido'),
  password: z.string().min(1, 'Contrasena requerida'),
  tenant_slug: z.string().min(1, 'Restaurante requerido'),
});

// === POS ===
export const abrirMesaSchema = z.object({
  personas: z.number().int().min(1).default(1),
  mesero_id: uid().optional(),
});

export const consumoCreateSchema = z.object({
  cuenta_id: uid('ID de cuenta invalido'),
  producto_id: uid('ID de producto invalido'),
  cantidad: z.number().positive('Cantidad debe ser mayor a 0').default(1),
  notas: z.string().max(255).optional(),
  gerente_clave: z.string().optional(),
});

export const cobrarSchema = z.object({
  forma_pago_id: uid('Forma de pago requerida'),
  propina: z.number().int().min(0).default(0),
  cliente_id: uid().optional(),
});

// === Catalog ===
export const productoCreateSchema = z.object({
  clave: z.string().min(1).max(20),
  descripcion: z.string().min(3, 'Descripcion minimo 3 caracteres').max(200),
  grupo_id: uid().optional(),
  tipo: z.enum(['insumo', 'subproducto', 'terminado']).default('insumo'),
  unidad: z.string().max(10).default('pza'),
  precio_venta: z.number().int().min(0).default(0),
  costo_unitario: z.number().int().min(0).default(0),
  punto_reorden: z.number().min(0).default(0),
  area_produccion: z.string().max(50).optional(),
  porciones: z.number().min(1).default(1),
  bloquear_sin_stock: z.boolean().default(false),
  nivel_minimo_critico: z.number().min(0).default(5),
});

export const productoUpdateSchema = productoCreateSchema.partial();

// === Recipe ===
export const recetaCreateSchema = z.object({
  producto_id: uid(),
  insumo_id: uid(),
  cantidad: z.number().positive(),
  unidad: z.string().max(10).optional(),
});

export const elaborarSchema = z.object({
  porciones: z.number().positive().default(1),
  almacen_id: uid().optional(),
});

// === Inventory ===
export const movimientoCreateSchema = z.object({
  producto_id: uid(),
  almacen_id: uid(),
  tipo: z.enum([
    'entrada_compra', 'entrada_traspaso', 'entrada_produccion', 'entrada_ajuste',
    'salida_venta', 'salida_traspaso', 'salida_desperdicio', 'salida_copeo', 'salida_ajuste',
  ]),
  cantidad: z.number().positive(),
  costo_unitario: z.number().int().min(0).default(0),
  referencia: z.string().max(200).optional(),
});

// === Stock Control ===
export const verificarStockSchema = z.object({
  producto_id: uid(),
  cantidad: z.number().positive().default(1),
  gerente_clave: z.string().optional(),
});

export const marcar86Schema = z.object({
  producto_id: uid(),
  motivo: z.string().max(200).optional(),
  responsable: z.string().max(100).optional(),
});

// === Modificadores ===
export const modificadorCreateSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  precio_extra: z.number().int().min(0).default(0),
});

// === Kitchen ===
export const cocinaCreateSchema = z.object({
  cuenta_id: uid().optional(),
  mesa_numero: z.number().int().optional(),
  items: z.array(z.object({
    producto_nombre: z.string(),
    cantidad: z.number().positive(),
    modificadores: z.array(z.string()).default([]),
    notas: z.string().optional(),
  })).min(1, 'Items requeridos'),
  mesero_nombre: z.string().optional(),
  prioridad: z.number().int().min(0).max(1).default(0),
  area: z.string().optional(),
});

export const cocinaEstadoSchema = z.object({
  estado: z.enum(['pendiente', 'en_preparacion', 'listo', 'entregado']),
});

// === Digital Orders ===
export const ordenCreateSchema = z.object({
  tipo: z.enum(['qr_mesa', 'delivery', 'para_llevar']),
  mesa_id: uid().optional(),
  cliente_nombre: z.string().max(100).optional(),
  cliente_telefono: z.string().max(20).optional(),
  direccion_entrega: z.string().max(500).optional(),
  zona_entrega_id: uid().optional(),
  items: z.array(z.object({
    producto_id: uid(),
    cantidad: z.number().positive().default(1),
    modificadores: z.array(z.string()).default([]),
    notas: z.string().max(255).optional(),
  })).min(1, 'Items requeridos'),
  notas: z.string().max(500).optional(),
  forma_pago: z.string().max(50).optional(),
});

export const reservacionCreateSchema = z.object({
  cliente_nombre: z.string().min(2).max(100),
  cliente_telefono: z.string().min(8).max(20),
  cliente_email: z.string().email().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  personas: z.number().int().min(1).max(50).default(2),
  zona_preferida_id: uid().optional(),
  notas: z.string().max(500).optional(),
});

// === Loyalty ===
export const acumularPuntosSchema = z.object({
  cliente_id: uid(),
  monto: z.number().int().positive(),
  cuenta_id: uid().optional(),
});

export const canjearPuntosSchema = z.object({
  cliente_id: uid(),
  puntos: z.number().int().positive(),
});

export const fidelizacionConfigSchema = z.object({
  puntos_por_peso: z.number().min(0),
  puntos_canjeables_min: z.number().int().min(0),
  valor_punto: z.number().min(0),
  nivel_bronce_puntos: z.number().int().min(0),
  nivel_plata_puntos: z.number().int().min(0),
  nivel_oro_puntos: z.number().int().min(0),
  nivel_platino_puntos: z.number().int().min(0),
});

// === Finance ===
export const clienteCreateSchema = z.object({
  codigo: z.string().max(20).optional(),
  nombre: z.string().min(2).max(100),
  rfc: z.string().max(13).optional(),
  direccion: z.string().max(300).optional(),
  telefono: z.string().max(20).optional(),
  email: z.string().email().optional(),
  limite_credito: z.number().int().min(0).default(0),
});

export const proveedorCreateSchema = z.object({
  codigo: z.string().max(20).optional(),
  nombre: z.string().min(2).max(100),
  rfc: z.string().max(13).optional(),
  direccion: z.string().max(300).optional(),
  telefono: z.string().max(20).optional(),
  email: z.string().email().optional(),
  contacto: z.string().max(100).optional(),
});

export const compraCreateSchema = z.object({
  proveedor_id: uid(),
  fecha_entrega: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notas: z.string().max(500).optional(),
  lineas: z.array(z.object({
    producto_id: uid(),
    cantidad: z.number().positive(),
    precio_unitario: z.number().int().positive(),
  })).min(1),
});

export const abonarSchema = z.object({
  monto: z.number().int().positive('Monto debe ser mayor a 0'),
});

export const polizaCreateSchema = z.object({
  tipo: z.enum(['ingreso', 'egreso']),
  cuenta: z.string().max(50).optional(),
  num_documento: z.string().max(50).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  descripcion: z.string().max(500).optional(),
  importe: z.number().int().positive(),
  iva: z.number().int().min(0).default(0),
  forma_pago: z.string().max(50).optional(),
  referencia: z.string().max(200).optional(),
});

// === Personal ===
export const personalCreateSchema = z.object({
  codigo: z.string().min(1).max(20),
  nombre: z.string().min(2).max(100),
  puesto: z.enum(['mesero', 'cajero', 'cocinero', 'subgerente', 'gerente']),
  nivel_acceso: z.number().int().min(1).max(9),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  telefono: z.string().max(20).optional(),
  direccion: z.string().max(300).optional(),
});

// === Delivery ===
export const zonaEntregaCreateSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  costo_envio: z.number().int().min(0).default(0),
  tiempo_estimado_min: z.number().int().min(0).optional(),
  descripcion: z.string().max(300).optional(),
});

export const zonaEntregaUpdateSchema = zonaEntregaCreateSchema.partial().extend({
  activa: z.boolean().optional(),
});

// === Catalog Grupos ===
export const grupoCreateSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  descripcion: z.string().max(300).optional(),
});

export const grupoUpdateSchema = grupoCreateSchema.partial();

// === Order Estado ===
export const ordenEstadoSchema = z.object({
  estado: z.enum(['pendiente', 'confirmada', 'en_preparacion', 'lista', 'en_camino', 'entregada', 'cancelada']),
  motivo: z.string().max(300).optional(),
});

// === Factura ===
export const facturaCreateSchema = z.object({
  cliente_id: uid().optional(),
  cuenta_id: uid().optional(),
  subtotal: z.number().int().min(0),
  iva: z.number().int().min(0),
  total: z.number().int().positive('Total debe ser mayor a 0'),
});

// === Client Update (partial of create) ===
export const clienteUpdateSchema = clienteCreateSchema.partial();

// === Proveedor Update (partial of create) ===
export const proveedorUpdateSchema = proveedorCreateSchema.partial();

// === Asistencia ===
export const asistenciaSchema = z.object({
  personal_id: uid('ID de personal invalido'),
  tipo: z.enum(['entrada', 'salida']),
});

// === Client Login (public) ===
export const clienteLoginSchema = z.object({
  telefono: z.string().min(8, 'Telefono minimo 8 caracteres').max(20),
  nombre: z.string().max(100).optional(),
  tenant_slug: z.string().min(1, 'Slug del restaurante requerido'),
});

// === Public Order (client-app) ===
export const clientePedirSchema = z.object({
  tenant_slug: z.string().min(1, 'Slug del restaurante requerido'),
  tipo: z.enum(['qr_mesa', 'delivery', 'para_llevar']),
  mesa_id: uid().optional(),
  mesa_numero: z.number().int().optional(),
  cliente_nombre: z.string().max(100).optional(),
  cliente_telefono: z.string().max(20).optional(),
  direccion_entrega: z.string().max(500).optional(),
  zona_entrega_id: uid().optional(),
  items: z.array(z.object({
    producto_id: uid(),
    cantidad: z.number().positive().default(1),
    modificadores: z.array(z.string()).default([]),
    notas: z.string().max(255).optional(),
  })).min(1, 'Al menos un item es requerido'),
  notas: z.string().max(500).optional(),
  forma_pago: z.string().max(50).optional(),
});

// === Public Reservation (client-app) ===
export const clienteReservarSchema = z.object({
  tenant_slug: z.string().min(1, 'Slug del restaurante requerido'),
  cliente_nombre: z.string().min(2).max(100),
  cliente_telefono: z.string().min(8).max(20).optional(),
  cliente_email: z.string().email().optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  personas: z.number().int().min(1).max(50).default(2),
  zona_preferida_id: uid().optional(),
  notas: z.string().max(500).optional(),
});

// === Calificacion ===
export const calificacionSchema = z.object({
  orden_id: uid().optional(),
  puntuacion: z.number().int().min(1).max(5),
  comentario: z.string().max(500).optional(),
  cliente_nombre: z.string().max(100).optional(),
});

// === QR Generate ===
export const qrGenerateSchema = z.object({
  mesa_id: uid('ID de mesa invalido'),
});

// === BOM Explosion ===
export const explosionBOMSchema = z.object({
  producto_id: uid('ID de producto invalido'),
  porciones: z.number().positive().default(1),
});

// === Inventory Transfer ===
export const traspasoSchema = z.object({
  producto_id: uid('ID de producto invalido'),
  de_almacen_id: uid('Almacen origen invalido'),
  a_almacen_id: uid('Almacen destino invalido'),
  cantidad: z.number().positive('Cantidad debe ser mayor a 0'),
});

// === Inventory Adjustment ===
export const ajusteSchema = z.object({
  producto_id: uid('ID de producto invalido'),
  almacen_id: uid('ID de almacen invalido'),
  cantidad_real: z.number().min(0, 'Cantidad real no puede ser negativa'),
});

// === Personal Update (partial of create, without password) ===
export const personalUpdateSchema = z.object({
  codigo: z.string().min(1).max(20).optional(),
  nombre: z.string().min(2).max(100).optional(),
  puesto: z.enum(['mesero', 'cajero', 'cocinero', 'subgerente', 'gerente']).optional(),
  nivel_acceso: z.number().int().min(1).max(9).optional(),
  email: z.string().email().optional(),
  telefono: z.string().max(20).optional(),
  direccion: z.string().max(300).optional(),
  activo: z.boolean().optional(),
});

// === Reservacion Estado ===
export const reservacionEstadoSchema = z.object({
  estado: z.enum(['confirmada', 'sentada', 'completada', 'cancelada', 'no_show']),
  mesa_id: uid().optional(),
  personas: z.number().int().min(1).optional(),
});

// === Generic Query Params ===
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const dateRangeSchema = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
