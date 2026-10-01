/** Formata uma data ISO (aaaa-mm-dd) como dd/mm/aaaa sem depender de fuso horário. */
export function formatDate(iso: string | undefined): string {
  if (!iso) return 'sem data';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Formata minutos desde 00:00 como HH:MM. */
export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatRange(start: number, end: number): string {
  return `${formatTime(start)} às ${formatTime(end)}`;
}

/** Datas ISO podem ser comparadas como texto. Itens que vencem no próprio dia ainda valem. */
export function isExpired(expiry: string | undefined, referenceDate: string | undefined): boolean {
  if (!expiry || !referenceDate) return false;
  return expiry < referenceDate;
}
