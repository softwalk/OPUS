/**
 * OPUS Money Utilities
 * All monetary values are stored as integers (centavos).
 * $120.00 = 12000 centavos
 */

/**
 * Convert a display amount to centavos
 * @param {number} amount - Amount in display format (e.g. 120.00)
 * @returns {number} Amount in centavos (e.g. 12000)
 */
export function toCents(amount) {
  return Math.round(amount * 100);
}

/**
 * Convert centavos to display amount
 * @param {number} cents - Amount in centavos (e.g. 12000)
 * @returns {number} Amount in display format (e.g. 120.00)
 */
export function fromCents(cents) {
  return cents / 100;
}

/**
 * Format centavos as a currency string
 * @param {number} cents - Amount in centavos
 * @param {string} [currency='MXN'] - Currency code
 * @returns {string} Formatted string (e.g. "$120.00")
 */
export function formatMoney(cents, currency = 'MXN') {
  const amount = fromCents(cents);
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format centavos as compact string (no currency symbol)
 * @param {number} cents - Amount in centavos
 * @returns {string} Formatted string (e.g. "120.00")
 */
export function formatMoneyCompact(cents) {
  return fromCents(cents).toFixed(2);
}

/**
 * Calculate IVA (tax) from subtotal
 * @param {number} subtotalCents - Subtotal in centavos
 * @param {number} ivaPct - IVA percentage (e.g. 16)
 * @returns {number} IVA amount in centavos
 */
export function calculateIva(subtotalCents, ivaPct = 16) {
  return Math.round(subtotalCents * ivaPct / 100);
}

/**
 * Calculate total from subtotal + IVA
 * @param {number} subtotalCents - Subtotal in centavos
 * @param {number} ivaPct - IVA percentage
 * @returns {{ subtotal: number, iva: number, total: number }}
 */
export function calculateTotal(subtotalCents, ivaPct = 16) {
  const iva = calculateIva(subtotalCents, ivaPct);
  return {
    subtotal: subtotalCents,
    iva,
    total: subtotalCents + iva,
  };
}
