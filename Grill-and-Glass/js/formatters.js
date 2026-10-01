function cryptoId() {
  return `x${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function num(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function whole(value, min = 0, max = Number.MAX_SAFE_INTEGER) {
  return Math.round(num(value, min, max));
}

function decimal(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(num(value) * factor) / factor;
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function fmt(value, max = 2) {
  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: max }).format(Number(value) || 0);
}

function euro(value) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
}

function esc(value) {
  const element = document.createElement('div');
  element.textContent = value ?? '';
  return element.innerHTML;
}
