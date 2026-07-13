// Formatação numérica PT-BR — PRD §9.8.
// Os cálculos internos nunca usam texto formatado.

const SUFFIXES = [
  { value: 1e33, suffix: 'dec' },
  { value: 1e30, suffix: 'non' },
  { value: 1e27, suffix: 'oct' },
  { value: 1e24, suffix: 'set' },
  { value: 1e21, suffix: 'sex' },
  { value: 1e18, suffix: 'qui' },
  { value: 1e15, suffix: 'qua' },
  { value: 1e12, suffix: 'tri' },
  { value: 1e9, suffix: 'bi' },
  { value: 1e6, suffix: 'mi' },
  { value: 1e3, suffix: 'mil' },
];

function toFixedBR(n, decimals) {
  return n.toFixed(decimals).replace('.', ',');
}

// 1250 → "1,25 mil"; 1.5e6 → "1,50 mi"
export function fmtNumber(n) {
  if (!Number.isFinite(n)) return '∞';
  const neg = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs < 1000) {
    return neg + (Number.isInteger(abs) ? String(abs) : toFixedBR(abs, abs < 10 ? 2 : 1));
  }
  for (const { value, suffix } of SUFFIXES) {
    if (abs >= value) return `${neg}${toFixedBR(abs / value, 2)} ${suffix}`;
  }
  return neg + String(Math.round(abs));
}

export function fmtMoney(n) {
  return `$${fmtNumber(n)}`;
}

export function fmtRate(n) {
  return `${fmtMoney(n)}/s`;
}

export function fmtPercent(n, decimals = 0) {
  return `${toFixedBR(n * 100, decimals)}%`;
}

export function fmtInt(n) {
  return Math.round(n).toLocaleString('pt-BR');
}

// 3721s → "1h 02min"; 45s → "45s"
export function fmtDuration(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  if (m > 0) return `${m}min ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export function fmtClock(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Data local AAAA-MM-DD (para diárias e mercado)
export function localDateKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Semana local AAAA-WNN (segunda-feira como início)
export function localWeekKey(ts = Date.now()) {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // 0 = segunda
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  const jan1 = new Date(monday.getFullYear(), 0, 1);
  const week = Math.ceil(((monday - jan1) / 86400000 + 1) / 7);
  return `${monday.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
