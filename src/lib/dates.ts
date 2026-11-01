/**
 * Small date helpers shared by the schedule/timeline/export modules.
 *
 * Convention: every date in Gatherly state is a `YYYY-MM-DD` string,
 * navigated as UTC (ISO) days so string comparison stays valid.
 */
export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

/** Adds `days` (may be negative) to a `YYYY-MM-DD` string, guarding invalid input. */
export function addDaysISO(dateStr: string, days: number): string {
  const base = new Date(dateStr);
  if (Number.isNaN(base.getTime())) return todayISO();
  const shifted = new Date(base.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + Math.trunc(days));
  return shifted.toISOString().split('T')[0];
}

/** Days between two `YYYY-MM-DD` strings (b - a), rounded for DST safety. */
export function daysBetweenISO(a: string, b: string): number {
  const first = new Date(a);
  const second = new Date(b);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return 0;
  return Math.round((second.getTime() - first.getTime()) / (1000 * 60 * 60 * 24));
}
