/**
 * OPUS Money Utilities
 * All monetary values are stored as integers (centavos).
 * $120.00 = 12000 centavos
 */

/**
 * Convert a display amount to centavos.
 * Uses string-based rounding to avoid floating-point precision issues.
 * e.g. toCents(19.99) === 1999 (not 1998 or 2000)
 *
 * @param {number|string} amount - Amount in display format (e.g. 120.00)
 * @returns {number} Amount in centavos (e.g. 12000)
 */
export function toCents(amount) {
  if (amount == null || isNaN(amount)) return 0;
  // Convert to string with 2 decimal places to avoid floating-point drift
  // e.g. 0.1 + 0.2 = 0.30000000000000004 → "0.30" → 30
  const str = Number(amount).toFixed(2);
  const [whole, frac = '00'] = str.split('.');
  const sign = str.startsWith('-') ? -1 : 1;
  const absWhole = whole.replace('-', '');
  return sign * (parseInt(absWhole, 10) * 100 + parseInt(frac.padEnd(2, '0').slice(0, 2), 10));
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
