/** Format centavos as currency string */
export function formatMoney(centavos) {
  if (centavos == null) return '$0.00';
  return `$${(centavos / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a date string */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/** Format a datetime string */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('es-MX', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Format percentage */
export function formatPct(value) {
  if (value == null) return '0%';
  return `${value.toFixed(1)}%`;
}

/** Format number with locale */
export function formatNumber(n) {
  if (n == null) return '0';
  return Number(n).toLocaleString('es-MX');
}

/** Get badge variant for mesa status */
export function mesaStatusVariant(estado) {
  switch (estado) {
    case 'libre': return 'green';
    case 'ocupada': return 'red';
    case 'reservada': return 'blue';
    default: return 'gray';
  }
}

/** Get badge variant for cuenta status */
export function cuentaStatusVariant(estado) {
  switch (estado) {
    case 'abierta': return 'blue';
    case 'cobrada': return 'green';
    case 'cancelada': return 'red';
    default: return 'gray';
  }
}

/** Get badge variant for KDS */
export function kdsUrgencyVariant(urgency) {
  switch (urgency) {
    case 'normal': return 'green';
    case 'alerta': return 'yellow';
    case 'critico': return 'red';
    default: return 'gray';
  }
}

/** Get badge variant for loyalty tier */
export function loyaltyTierVariant(nivel) {
  switch (nivel) {
    case 'bronce': return 'yellow';
    case 'plata': return 'gray';
    case 'oro': return 'yellow';
    case 'platino': return 'purple';
    default: return 'gray';
  }
}
