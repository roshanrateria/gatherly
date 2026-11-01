import { AppState, Guest } from '../types/index';

/**
 * Single source of truth for guest arithmetic.
 *
 * Each guest entry carries 1 + plusOnes people. Historical code mixed the
 * roster length (number of *entries*) with the event's *target* guest count,
 * which produced wrong per-guest budget numbers. These helpers make the
 * distinction explicit:
 *  - `invitedHeadcount` — real people on the roster (entries + plus-ones)
 *  - `confirmedHeadcount` — people marked "attending"
 *  - `expectedAttendance` — confirmed + 50% of tentative (soft commitments)
 */
export const TENTATIVE_ATTENDANCE_WEIGHT = 0.5;

/** How many real people a single roster entry represents. */
export function guestEntryHeadcount(guest: Guest): number {
  const plusOnes = Number.isFinite(guest?.plusOnes) ? guest.plusOnes : 0;
  return 1 + Math.max(0, Math.floor(plusOnes));
}

export interface GuestAttendanceMetrics {
  /** Number of roster entries (rows in the guest list). */
  entryCount: number;
  /** Total invited people including plus-ones. */
  invitedHeadcount: number;
  /** People confirmed as attending. */
  confirmedHeadcount: number;
  /** People marked tentative. */
  tentativeHeadcount: number;
  /** People who declined. */
  declinedHeadcount: number;
  /** People with no RSVP yet. */
  pendingHeadcount: number;
  /** Confirmed + weighted tentative attendance expectation. */
  expectedAttendance: number;
}

export function computeGuestMetrics(guests: Guest[]): GuestAttendanceMetrics {
  const metrics: GuestAttendanceMetrics = {
    entryCount: guests.length,
    invitedHeadcount: 0,
    confirmedHeadcount: 0,
    tentativeHeadcount: 0,
    declinedHeadcount: 0,
    pendingHeadcount: 0,
    expectedAttendance: 0,
  };

  guests.forEach((guest) => {
    const headcount = guestEntryHeadcount(guest);
    metrics.invitedHeadcount += headcount;
    switch (guest.rsvpStatus) {
      case 'attending':
        metrics.confirmedHeadcount += headcount;
        break;
      case 'tentative':
        metrics.tentativeHeadcount += headcount;
        break;
      case 'declined':
        metrics.declinedHeadcount += headcount;
        break;
      default:
        metrics.pendingHeadcount += headcount;
        break;
    }
  });

  metrics.expectedAttendance =
    metrics.confirmedHeadcount +
    Math.round(metrics.tentativeHeadcount * TENTATIVE_ATTENDANCE_WEIGHT);

  return metrics;
}

export function expectedAttendanceOf(guests: Guest[]): number {
  return computeGuestMetrics(guests).expectedAttendance;
}

/**
 * Fallback expectation used when no roster exists yet: banquet planners
 * typically provision for ~95% of the invited target.
 */
export function fallbackExpectedAttendance(targetCount: number): number {
  const count = Number.isFinite(targetCount) ? Math.max(0, Math.floor(targetCount)) : 0;
  return Math.round(count * 0.95);
}

/**
 * Canonical "expected guests" number for financial math (per-guest budget,
 * per-guest spend). Prefers roster-derived attendance; falls back to the
 * event's stored expectation and finally to the raw target count.
 */
export function budgetBasisGuestCount(
  state: Pick<AppState, 'event' | 'guests'>
): number {
  if (state.guests.length > 0) {
    const metrics = computeGuestMetrics(state.guests);
    if (metrics.expectedAttendance > 0) return Math.max(1, metrics.expectedAttendance);
    // Roster exists but nobody has RSVP'd yet: budget against everyone invited.
    return Math.max(1, metrics.invitedHeadcount);
  }
  const stored = state.event.guests.expectedAttendance;
  if (Number.isFinite(stored) && stored > 0) return Math.max(1, Math.floor(stored));
  return Math.max(1, state.event.guests.count);
}
