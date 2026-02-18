/**
 * OPUS System Constants
 * Preserved from Compurest COBOL → Web migration
 */

// === Mesa States ===
export const MESA_ESTADOS = {
  LIBRE: 'libre',
  OCUPADA: 'ocupada',
  RESERVADA: 'reservada',
  CERRADA: 'cerrada',
};

// === Cuenta States ===
export const CUENTA_ESTADOS = {
  ABIERTA: 'abierta',
  PRECUENTA: 'precuenta',
  COBRADA: 'cobrada',
  CANCELADA: 'cancelada',
};

// === Consumo States ===
export const CONSUMO_ESTADOS = {
  ACTIVO: 'activo',
  CANCELADO: 'cancelado',
  GRATIS: 'gratis',
  CORTESIA: 'cortesia',
};

// === Product Types (from COBOL) ===
export const PRODUCTO_TIPOS = {
  INSUMO: 'insumo',
  SUBPRODUCTO: 'subproducto',
  TERMINADO: 'terminado',
};

// === Inventory Movement Types (9 types from COBOL MOVACU/MOVALM) ===
export const MOVIMIENTO_TIPOS = {
  ENTRADA_COMPRA: 'entrada_compra',
  ENTRADA_TRASPASO: 'entrada_traspaso',
  ENTRADA_PRODUCCION: 'entrada_produccion',
  ENTRADA_AJUSTE: 'entrada_ajuste',
  SALIDA_VENTA: 'salida_venta',
  SALIDA_TRASPASO: 'salida_traspaso',
  SALIDA_DESPERDICIO: 'salida_desperdicio',
  SALIDA_COPEO: 'salida_copeo',
  SALIDA_AJUSTE: 'salida_ajuste',
};

// === KDS States ===
export const COCINA_ESTADOS = {
  PENDIENTE: 'pendiente',
  EN_PREPARACION: 'en_preparacion',
  LISTO: 'listo',
  ENTREGADO: 'entregado',
};

// === KDS Urgency (configurable per tenant, defaults from Compurest) ===
export const KDS_URGENCIA = {
  NORMAL: 'normal',
  ALERTA: 'alerta',
  CRITICO: 'critico',
};

export const KDS_DEFAULTS = {
  ALERTA_MINUTOS: 8,
  CRITICO_MINUTOS: 15,
};

// === Digital Order Types ===
export const ORDEN_TIPOS = {
  QR_MESA: 'qr_mesa',
  DELIVERY: 'delivery',
  PARA_LLEVAR: 'para_llevar',
};

// === Digital Order States ===
export const ORDEN_ESTADOS = {
  PENDIENTE: 'pendiente',
  CONFIRMADA: 'confirmada',
  EN_PREPARACION: 'en_preparacion',
  LISTA: 'lista',
  EN_CAMINO: 'en_camino',
  ENTREGADA: 'entregada',
  CANCELADA: 'cancelada',
};

// === Reservation States ===
export const RESERVACION_ESTADOS = {
  PENDIENTE: 'pendiente',
  CONFIRMADA: 'confirmada',
  SENTADA: 'sentada',
  CANCELADA: 'cancelada',
  NO_SHOW: 'no_show',
};

// === Loyalty Tiers ===
export const FIDELIZACION_NIVELES = {
  BRONCE: 'bronce',
  PLATA: 'plata',
  ORO: 'oro',
  PLATINO: 'platino',
};

export const FIDELIZACION_DEFAULTS = {
  PUNTOS_POR_PESO: 0.1,
  PUNTOS_CANJEABLES_MIN: 100,
  VALOR_PUNTO: 0.5,
  NIVEL_BRONCE: 0,
  NIVEL_PLATA: 500,
  NIVEL_ORO: 2000,
  NIVEL_PLATINO: 5000,
};

// === Loyalty Transaction Types ===
export const FIDELIZACION_TIPOS = {
  ACUMULADO: 'acumulado',
  CANJEADO: 'canjeado',
  AJUSTE: 'ajuste',
  BONO: 'bono',
};

// === Staff Roles (nivel_acceso hierarchy from COBOL) ===
export const ROLES = {
  MESERO: { puesto: 'mesero', nivel: 1 },
  CAJERO: { puesto: 'cajero', nivel: 2 },
  COCINERO: { puesto: 'cocinero', nivel: 3 },
  SUBGERENTE: { puesto: 'subgerente', nivel: 5 },
  GERENTE: { puesto: 'gerente', nivel: 9 },
  SUPERADMIN: { puesto: 'superadmin', nivel: 99 },
};

// === Finance ===
export const POLIZA_TIPOS = {
  INGRESO: 'ingreso',
  EGRESO: 'egreso',
};

export const CXC_ESTADOS = {
  PENDIENTE: 'pendiente',
  PAGADA: 'pagada',
  CANCELADA: 'cancelada',
};

export const OC_ESTADOS = {
  PENDIENTE: 'pendiente',
  RECIBIDA: 'recibida',
  CANCELADA: 'cancelada',
};

// === Audit Types ===
export const AUDITORIA_TIPOS = {
  APERTURA_MESA: 'apertura_mesa',
  CIERRE_MESA: 'cierre_mesa',
  COBRO: 'cobro',
  CANCELACION_CONSUMO: 'cancelacion_consumo',
  CANCELACION_CUENTA: 'cancelacion_cuenta',
  MOVIMIENTO_INVENTARIO: 'movimiento_inventario',
  ELABORACION: 'elaboracion',
  MARCAR_86: 'marcar_86',
  DESMARCAR_86: 'desmarcar_86',
  SOBREGIRO: 'sobregiro',
  CORTE_CAJA: 'corte_caja',
  RECEPCION_COMPRA: 'recepcion_compra',
  CREACION_PRODUCTO: 'creacion_producto',
  MODIFICACION_PRODUCTO: 'modificacion_producto',
  CREACION_PERSONAL: 'creacion_personal',
  CANJE_PUNTOS: 'canje_puntos',
};

// === Notification Types ===
export const NOTIFICACION_TIPOS = {
  MESERO: 'mesero',
  COCINA: 'cocina',
  GERENTE: 'gerente',
  CLIENTE: 'cliente',
};

// === Tenant Config Defaults ===
export const TENANT_DEFAULTS = {
  IVA_PORCENTAJE: 16,
  SERVICIO_PORCENTAJE: 0,
  TIMEZONE: 'America/Mexico_City',
  MONEDA: 'MXN',
  MAX_ALMACENES: 8,
};

// === WebSocket Event Types ===
export const WS_EVENTS = {
  KDS_NEW: 'kds:new',
  KDS_UPDATE: 'kds:update',
  STOCK_UPDATE: 'stock:update',
  STOCK_86: 'stock:86',
  MESA_UPDATE: 'mesa:update',
  ORDEN_NUEVA: 'orden:nueva',
  ORDEN_ESTADO: 'orden:estado',
  NOTIFICACION_MESERO: 'notificacion:mesero',
  NOTIFICACION_COCINA: 'notificacion:cocina',
  NOTIFICACION_GERENTE: 'notificacion:gerente',
};

// === Error Codes ===
export const ERROR_CODES = {
  // Auth
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_INSUFFICIENT_ROLE: 'AUTH_INSUFFICIENT_ROLE',
  AUTH_NO_TOKEN: 'AUTH_NO_TOKEN',
  // Tenant
  TENANT_NOT_FOUND: 'TENANT_NOT_FOUND',
  TENANT_INACTIVE: 'TENANT_INACTIVE',
  // POS
  POS_MESA_OCCUPIED: 'POS_MESA_OCCUPIED',
  POS_CUENTA_NOT_FOUND: 'POS_CUENTA_NOT_FOUND',
  POS_ALREADY_COBRADA: 'POS_ALREADY_COBRADA',
  // Stock
  STOCK_INSUFFICIENT: 'STOCK_INSUFFICIENT',
  STOCK_86_SUSPENDED: 'STOCK_86_SUSPENDED',
  STOCK_REQUIRES_OVERRIDE: 'STOCK_REQUIRES_OVERRIDE',
  // General
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
};

// === Stock Check Results ===
export const STOCK_CHECK_MOTIVOS = {
  SUSPENDIDO_86: 'suspendido_86',
  SIN_STOCK: 'sin_stock',
  CLAVE_INVALIDA: 'clave_invalida',
};
