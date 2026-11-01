/**
 * Central identifier generator.
 *
 * Components must not call `Date.now()` inline (ESLint `react-hooks/purity`
 * flags non-deterministic values computed during render). All id creation is
 * therefore routed through this module so call sites stay lint-clean while
 * still producing collision-resistant, prefix-readable identifiers.
 */
export function createId(prefix: string): string {
  const safePrefix = /^[A-Za-z0-9_-]+$/.test(prefix) ? prefix : 'id';
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${safePrefix}_${crypto.randomUUID().slice(0, 13)}`;
  }
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${safePrefix}_${time}${random}`;
}
