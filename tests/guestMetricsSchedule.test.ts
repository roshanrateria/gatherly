import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  budgetBasisGuestCount,
  computeGuestMetrics,
  fallbackExpectedAttendance,
  guestEntryHeadcount,
} from '../src/lib/guestMetrics.ts';
import {
  detectScheduleConflicts,
  generateDefaultSchedule,
  recalculateScheduleForNewDate,
  timeToMinutes,
} from '../src/lib/deterministicSchedule.ts';
import { createSampleWedding } from '../src/lib/sampleEvents.ts';
import { addDaysISO, daysBetweenISO, todayISO } from '../src/lib/dates.ts';
import type { Guest, ScheduleItem } from '../src/types/index.ts';

function guest(partial: Partial<Guest>): Guest {
  return {
    id: 'g',
    name: 'Guest',
    group: 'family',
    rsvpStatus: 'pending',
    plusOnes: 0,
    dietaryNeeds: [],
    accessibilityNeeds: [],
    ...partial,
  };
}

describe('Guest metrics (single source of headcount truth)', () => {
  it('each roster entry counts 1 + plusOnes people', () => {
    assert.strictEqual(guestEntryHeadcount(guest({ plusOnes: 2 })), 3);
    assert.strictEqual(guestEntryHeadcount(guest({ plusOnes: 0 })), 1);
    assert.strictEqual(guestEntryHeadcount(guest({ plusOnes: -5 as number })), 1, 'Negative clamped');
  });

  it('computes invited / confirmed / tentative / expected attendance with the 50% weight', () => {
    const metrics = computeGuestMetrics([
      guest({ id: 'a', rsvpStatus: 'attending', plusOnes: 1 }), // 2 people
      guest({ id: 'b', rsvpStatus: 'tentative', plusOnes: 3 }), // 4 people
      guest({ id: 'c', rsvpStatus: 'declined', plusOnes: 1 }),
      guest({ id: 'd', rsvpStatus: 'pending', plusOnes: 0 }),
    ]);

    assert.strictEqual(metrics.entryCount, 4);
    assert.strictEqual(metrics.invitedHeadcount, 9);
    assert.strictEqual(metrics.confirmedHeadcount, 2);
    assert.strictEqual(metrics.tentativeHeadcount, 4);
    assert.strictEqual(metrics.declinedHeadcount, 2);
    assert.strictEqual(metrics.pendingHeadcount, 1);
    assert.strictEqual(metrics.expectedAttendance, 4, 'Confirmed 2 + round(4 * 0.5) = 4');
  });

  it('budget basis prefers roster attendance and falls back correctly', () => {
    const withRoster = {
      event: createSampleWedding().event,
      guests: [guest({ id: 'a', rsvpStatus: 'attending', plusOnes: 0 })],
    } as const;
    assert.strictEqual(budgetBasisGuestCount(withRoster), 1, 'Confirmed-only roster');

    const nobodyResponded = {
      event: { ...withRoster.event, guests: { ...withRoster.event.guests, count: 250 } },
      guests: [
        guest({ id: 'a', rsvpStatus: 'pending', plusOnes: 1 }),
        guest({ id: 'b', rsvpStatus: 'pending', plusOnes: 3 }),
        guest({ id: 'c', rsvpStatus: 'pending' }),
      ],
    };
    assert.strictEqual(budgetBasisGuestCount(nobodyResponded), 7, 'All pending → roster invited headcount, not the raw target');

    const noRoster = {
      event: { ...withRoster.event, guests: { ...withRoster.event.guests, count: 250, expectedAttendance: 238 } },
      guests: [],
    };
    assert.strictEqual(budgetBasisGuestCount(noRoster), 238);

    const noRosterNoExpectation = {
      event: { ...withRoster.event, guests: { ...withRoster.event.guests, count: 250, expectedAttendance: 0 } },
      guests: [],
    };
    assert.strictEqual(budgetBasisGuestCount(noRosterNoExpectation), 250);
  });

  it('fallback expectation provisions ~95% of the target', () => {
    assert.strictEqual(fallbackExpectedAttendance(250), Math.round(250 * 0.95));
    assert.strictEqual(fallbackExpectedAttendance(0), 0);
    assert.strictEqual(fallbackExpectedAttendance(Number.NaN), 0);
  });
});

describe('Deterministic schedule generation (2-day wedding etc.)', () => {
  it('generates a two-day wedding run sheet with days 1 and 2 covered', () => {
    const schedule = generateDefaultSchedule('wedding', '2026-11-20', 2);
    assert.ok(schedule.length > 6, `Substantial sheet: ${schedule.length}`);
    const days = new Set(schedule.map(item => item.dayNumber));
    assert.ok(days.has(1), 'Day 1 covered');
    assert.ok(days.has(2), 'Day 2 covered (continuation blueprint)');
    for (const item of schedule) {
      assert.strictEqual(item.date, item.dayNumber === 1 ? '2026-11-20' : '2026-11-21');
      assert.ok(/\d{2}:\d{2}/.test(item.startTime), 'Times are HH:MM');
      assert.ok(item.durationMinutes > 0);
    }
  });

  it('continuation-only days exist for every day of multi-day events', () => {
    const schedule = generateDefaultSchedule('wedding', '2026-11-20', 3);
    const days = new Set(schedule.map(item => item.dayNumber));
    assert.ok(days.has(3), 'Day 3 gets its own activities, not dead dates');

    const corporate = generateDefaultSchedule('corporate', '2026-12-01', 2);
    assert.ok(new Set(corporate.map(i => i.dayNumber)).has(2), 'Corporate 2-day also has day 2');
  });

  it('recalculateScheduleForNewDate shifts dates and trims over-length days', () => {
    const schedule = generateDefaultSchedule('wedding', '2026-11-20', 3);
    const rescheduled = recalculateScheduleForNewDate(schedule, '2026-12-25', 2);
    for (const item of rescheduled) {
      assert.ok(item.dayNumber <= 2, 'Day-3 items dropped for a 2-day event');
      assert.strictEqual(item.date, addDaysISO('2026-12-25', item.dayNumber - 1));
    }
    // Without a duration, dates shift but nothing drops.
    const shifted = recalculateScheduleForNewDate(schedule, '2026-01-05');
    assert.strictEqual(shifted.length, schedule.length);
  });

  it('conflict detection and NaN-safe time math keep working', () => {
    const items: ScheduleItem[] = [
      { id: 's1', dayNumber: 1, date: '2026-11-20', title: 'Venue Setup', category: 'setup', startTime: '17:00', endTime: '20:00', durationMinutes: 180, location: 'Lawn 1', owner: '' },
      { id: 's2', dayNumber: 1, date: '2026-11-20', title: 'Welcome Dinner', category: 'meal', startTime: '18:30', endTime: '21:00', durationMinutes: 150, location: 'Ballroom', owner: '' },
    ];
    const conflicts = detectScheduleConflicts(items);
    assert.strictEqual(conflicts.length, 1, 'One overlap pair');
    assert.strictEqual(conflicts[0].type, 'overlap');
    assert.deepStrictEqual(conflicts[0].itemIds, ['s1', 's2']);

    assert.strictEqual(timeToMinutes('14:30'), 870);
    assert.strictEqual(timeToMinutes('garbage'), 0, 'NaN-guard returns 0 rather than NaN');
  });
});

describe('Date helpers (ISO-local, no TZ drift)', () => {
  it('addDaysISO crosses month boundaries correctly', () => {
    assert.strictEqual(addDaysISO('2026-01-31', 1), '2026-02-01');
    assert.strictEqual(addDaysISO('2026-11-30', 1), '2026-12-01');
    assert.strictEqual(addDaysISO('2027-01-31', -1), '2027-01-30');
  });

  it('daysBetweenISO counts calendar days', () => {
    assert.strictEqual(daysBetweenISO('2026-01-01', '2026-01-02'), 1);
    assert.strictEqual(daysBetweenISO('2026-03-15', '2026-02-15'), -28);
    assert.strictEqual(daysBetweenISO('2026-05-10', '2026-05-10'), 0);
  });

  it('todayISO returns a YYYY-MM-DD string', () => {
    assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  });
});
