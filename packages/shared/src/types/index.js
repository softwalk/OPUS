/**
 * OPUS Type Definitions
 * Using JSDoc for type safety without TypeScript compilation step
 */

/**
 * @typedef {'free' | 'pro' | 'enterprise'} TenantPlan
 */

/**
 * @typedef {Object} TenantConfig
 * @property {number} iva_porcentaje - Tax percentage (default 16)
 * @property {number} servicio_porcentaje - Service charge percentage
 * @property {string} timezone - IANA timezone
 * @property {string} moneda - Currency code (MXN)
 * @property {number} kds_alerta_min - KDS alert threshold in minutes
 * @property {number} kds_critico_min - KDS critical threshold in minutes
 * @property {number} max_almacenes - Maximum warehouses
 */

/**
 * @typedef {Object} Tenant
 * @property {string} id - UUID
 * @property {string} slug - URL-safe identifier
 * @property {string} nombre - Restaurant name
 * @property {TenantPlan} plan
 * @property {TenantConfig} config
 * @property {boolean} activo
 * @property {string} created_at - ISO 8601
 */

/**
 * @typedef {'mesero' | 'cajero' | 'cocinero' | 'subgerente' | 'gerente' | 'superadmin'} Puesto
 */

/**
 * @typedef {Object} User
 * @property {string} id - UUID
 * @property {string} tenant_id - UUID
 * @property {string} codigo - Staff code
 * @property {string} nombre
 * @property {string|null} email
 * @property {Puesto} puesto
 * @property {number} nivel_acceso - 1-99
 * @property {boolean} activo
 * @property {string} created_at
 */

/**
 * @typedef {'libre' | 'ocupada' | 'reservada' | 'cerrada'} MesaEstado
 */

/**
 * @typedef {Object} Mesa
 * @property {string} id
 * @property {string} tenant_id
 * @property {number} numero
 * @property {string} zona_id
 * @property {number} capacidad
 * @property {MesaEstado} estado
 * @property {string|null} mesero_id
 * @property {number} personas
 * @property {string|null} abierta_en
 */

/**
 * @typedef {'abierta' | 'precuenta' | 'cobrada' | 'cancelada'} CuentaEstado
 */

/**
 * @typedef {Object} Cuenta
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} mesa_id
 * @property {string|null} folio
 * @property {string|null} mesero_id
 * @property {string|null} cliente_id
 * @property {number} personas
 * @property {number} subtotal - centavos
 * @property {number} iva - centavos
 * @property {number} total - centavos
 * @property {number} propina - centavos
 * @property {CuentaEstado} estado
 * @property {string|null} forma_pago_id
 * @property {string} abierta_en
 * @property {string|null} cerrada_en
 */

/**
 * @typedef {'activo' | 'cancelado' | 'gratis' | 'cortesia'} ConsumoEstado
 */

/**
 * @typedef {Object} Consumo
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} cuenta_id
 * @property {string} producto_id
 * @property {number} cantidad
 * @property {number} precio_unitario - centavos
 * @property {number} importe - centavos
 * @property {ConsumoEstado} estado
 * @property {string} created_at
 */

/**
 * @typedef {'insumo' | 'subproducto' | 'terminado'} ProductoTipo
 */

/**
 * @typedef {Object} Producto
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} clave
 * @property {string} descripcion
 * @property {string|null} grupo_id
 * @property {ProductoTipo} tipo
 * @property {string} unidad
 * @property {number} precio_venta - centavos
 * @property {number} costo_unitario - centavos
 * @property {number} costo_integrado - centavos
 * @property {number} punto_reorden
 * @property {boolean} suspendido_86
 * @property {boolean} bloquear_sin_stock
 * @property {number} nivel_minimo_critico
 * @property {boolean} activo
 */

/**
 * @typedef {Object} Receta
 * @property {string} id
 * @property {string} tenant_id
 * @property {string} producto_id
 * @property {string} insumo_id
 * @property {number} cantidad
 * @property {string|null} unidad
 */

/**
 * @typedef {Object} StockCheckResult
 * @property {boolean} puede_vender
 * @property {string} [motivo]
 * @property {string} [mensaje]
 * @property {Array<{insumo: string, stock_actual: number, necesario: number, faltante: number, unidad: string}>} [faltantes]
 * @property {boolean} [requiere_autorizacion]
 * @property {boolean} [sobregiro]
 * @property {boolean} [warning]
 */

/**
 * @typedef {'pendiente' | 'en_preparacion' | 'listo' | 'entregado'} CocinaEstado
 * @typedef {'normal' | 'alerta' | 'critico'} UrgenciaNivel
 */

/**
 * @typedef {'qr_mesa' | 'delivery' | 'para_llevar'} OrdenTipo
 * @typedef {'pendiente' | 'confirmada' | 'en_preparacion' | 'lista' | 'en_camino' | 'entregada' | 'cancelada'} OrdenEstado
 */

/**
 * @typedef {'bronce' | 'plata' | 'oro' | 'platino'} NivelFidelizacion
 * @typedef {'acumulado' | 'canjeado' | 'ajuste' | 'bono'} FidelizacionTipo
 */

// Export empty object to make this a module
export {};
