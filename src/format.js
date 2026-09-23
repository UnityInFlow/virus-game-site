const numberFormat = new Intl.NumberFormat('en-US');

export const number = (value) => numberFormat.format(value);

export function ageFrom(now, at) {
  const seconds = Math.round((now - at) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 90) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

/** An ISO-8601 instant at the beginning of a tick id, or null. */
export function isoPrefix(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})/);
  if (!match) return null;
  const at = Date.parse(match[0]);
  return Number.isNaN(at) ? null : at;
}

export function generatedAt(response, latest) {
  const header = response.headers.get('Last-Modified');
  if (header) {
    const at = Date.parse(header);
    if (!Number.isNaN(at)) return { at, source: 'last-modified' };
  }
  const at = isoPrefix(latest.generatedAt);
  return at === null ? null : { at, source: 'generatedAt' };
}
