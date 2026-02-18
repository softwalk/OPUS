export function formatMoney(centavos) {
  if (centavos == null) return '$0.00';
  return `$${(centavos / 100).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
