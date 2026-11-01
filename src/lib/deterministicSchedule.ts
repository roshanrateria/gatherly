import { ScheduleItem, ScheduleConflict, ScheduleCategory } from '../types/schedule';
import { EventType } from '../types/event';
import { addDaysISO } from './dates';

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  const h = Number.isFinite(hours) ? hours : 0;
  const m = Number.isFinite(minutes) ? minutes : 0;
  return h * 60 + m;
}

export function detectScheduleConflicts(items: ScheduleItem[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];

  // Group by dayNumber
  const daysMap = new Map<number, ScheduleItem[]>();
  items.forEach((item) => {
    const list = daysMap.get(item.dayNumber) || [];
    list.push(item);
    daysMap.set(item.dayNumber, list);
  });

  daysMap.forEach((dayItems, dayNum) => {
    // Sort items chronologically
    const sorted = [...dayItems].sort(
      (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const curEnd = timeToMinutes(current.endTime);

      // Check 1: Direct overlap with subsequent item
      if (i + 1 < sorted.length) {
        const next = sorted[i + 1];
        const nextStart = timeToMinutes(next.startTime);

        if (curEnd > nextStart) {
          conflicts.push({
            id: `conflict_overlap_${current.id}_${next.id}`,
            type: 'overlap',
            severity: 'critical',
            itemIds: [current.id, next.id],
            description: `Day ${dayNum}: "${current.title}" (${current.startTime}-${current.endTime}) overlaps with "${next.title}" (${next.startTime}-${next.endTime}) by ${curEnd - nextStart} minutes.`,
            suggestion: `Adjust "${next.title}" start time to at least ${current.endTime} or reduce "${current.title}" duration.`,
          });
        } else if (
          curEnd < nextStart &&
          nextStart - curEnd < 15 &&
          current.location.trim().toLowerCase() !== next.location.trim().toLowerCase()
        ) {
          // Check 2: Unrealistic transit (< 15 mins between different locations)
          conflicts.push({
            id: `conflict_transit_${current.id}_${next.id}`,
            type: 'insufficient_transition',
            severity: 'warning',
            itemIds: [current.id, next.id],
            description: `Day ${dayNum}: Only ${nextStart - curEnd} mins buffer between "${current.title}" at ${current.location} and "${next.title}" at ${next.location}.`,
            suggestion: `Add at least 15-20 minutes transition time for guest movement between distinct venues.`,
          });
        } else if (curEnd < nextStart && nextStart - curEnd > 180) {
          // Check 3: Excessive dead gap (> 3 hours)
          conflicts.push({
            id: `conflict_gap_${current.id}_${next.id}`,
            type: 'excessive_gap',
            severity: 'info',
            itemIds: [current.id, next.id],
            description: `Day ${dayNum}: Noticeable gap of ${Math.round((nextStart - curEnd) / 60)} hours between "${current.title}" and "${next.title}".`,
            suggestion: `Consider scheduling an informal refreshment station, photo lounge, or guest hospitality suite.`,
          });
        }
      }

      // Check 4: Missing setup / soundcheck buffer before major performances
      if (
        (current.category === 'entertainment' || current.title.toLowerCase().includes('live band') || current.title.toLowerCase().includes('sangeet')) &&
        i === 0
      ) {
        conflicts.push({
          id: `conflict_setup_${current.id}`,
          type: 'missing_setup',
          severity: 'warning',
          itemIds: [current.id],
          description: `Day ${dayNum}: "${current.title}" starts without any prior scheduled soundcheck or technical setup block.`,
          suggestion: `Add a 45-60 minute "Soundcheck & Stage Preparation" activity before guest arrival.`,
        });
      }
    }
  });

  return conflicts;
}

/**
 * Blueprint for generated run sheets. `durationMinutes` is derived from the
 * start/end times at build time so a template can never drift out of sync.
 */
interface BlueprintItem {
  id: string;
  dayNumber: number;
  startTime: string;
  endTime: string;
  title: string;
  category: ScheduleCategory;
  location: string;
  owner: string;
  notes?: string;
}

function blueprintDuration(item: Pick<BlueprintItem, 'startTime' | 'endTime'>): number {
  const duration = timeToMinutes(item.endTime) - timeToMinutes(item.startTime);
  return duration > 0 ? duration : 60;
}

const WEDDING_1_DAY: BlueprintItem[] = [
  { id: 'sch_w_s1', dayNumber: 1, startTime: '10:00', endTime: '11:30', title: 'Vendor Arrival, Stage & Mandap Setup', category: 'setup', location: 'Main Banquet Hall', owner: 'Decor Team' },
  { id: 'sch_w_s2', dayNumber: 1, startTime: '11:45', endTime: '13:00', title: 'Baraat & Welcoming of Guests', category: 'ceremony', location: 'Entrance Lawn', owner: 'Family Hosts' },
  { id: 'sch_w_s3', dayNumber: 1, startTime: '13:15', endTime: '15:15', title: 'Wedding Ceremony & Exchange of Vows', category: 'ceremony', location: 'Main Mandap / Altar', owner: 'Officiant' },
  { id: 'sch_w_s4', dayNumber: 1, startTime: '15:30', endTime: '17:30', title: 'Family Photography & High Tea', category: 'photo_session', location: 'Lobby Lounge', owner: 'Photographer' },
  { id: 'sch_w_s5', dayNumber: 1, startTime: '19:00', endTime: '23:00', title: 'Reception Dinner & Musical Evening', category: 'meal', location: 'Grand Ballroom', owner: 'Event Coordinator' },
];

const WEDDING_2_DAYS: BlueprintItem[] = [
  // Day 1: celebrations eve — Mehendi, soundcheck & Sangeet
  { id: 'sch_w2d_1', dayNumber: 1, startTime: '15:00', endTime: '18:00', title: 'Mehendi & High Tea Carnival', category: 'ceremony', location: 'Poolside Lawn', owner: 'Bridal Coordinator' },
  { id: 'sch_w2d_2', dayNumber: 1, startTime: '18:15', endTime: '19:15', title: 'Soundcheck & Technical Cue Rehearsal', category: 'setup', location: 'Grand Ballroom', owner: 'AV Lead & DJ' },
  { id: 'sch_w2d_3', dayNumber: 1, startTime: '19:30', endTime: '23:30', title: 'Sangeet Gala, Performances & Dinner', category: 'entertainment', location: 'Grand Ballroom', owner: 'Emcee & Choreographer' },
  // Day 2: the wedding itself — Haldi, Pheras & Reception
  { id: 'sch_w2d_4', dayNumber: 2, startTime: '10:00', endTime: '12:00', title: 'Haldi Ceremony & Family Blessings', category: 'ceremony', location: 'Courtyard Garden', owner: 'Family Elders' },
  { id: 'sch_w2d_5', dayNumber: 2, startTime: '12:15', endTime: '13:45', title: 'Traditional Luncheon Feast', category: 'meal', location: 'Dining Pavilion', owner: 'Catering Lead' },
  { id: 'sch_w2d_6', dayNumber: 2, startTime: '16:00', endTime: '17:00', title: 'Baraat Assembly & Guest Welcoming', category: 'ceremony', location: 'Palace Main Gate', owner: 'Groom Coordinator' },
  { id: 'sch_w2d_7', dayNumber: 2, startTime: '17:15', endTime: '19:45', title: 'Varmala & Vedic Wedding Pheras', category: 'ceremony', location: 'Mandap Amphitheatre', owner: 'Officiant / Priest' },
  { id: 'sch_w2d_8', dayNumber: 2, startTime: '20:00', endTime: '23:30', title: 'Grand Reception Dinner & Entertainment', category: 'meal', location: 'Crystal Ballroom', owner: 'Event Lead' },
];

const WEDDING_3_DAYS: BlueprintItem[] = [
  // Day 1: Welcome & Sangeet / Mehendi
  { id: 'sch_w1_1', dayNumber: 1, startTime: '15:00', endTime: '18:00', title: 'Mehendi & High Tea Carnival', category: 'ceremony', location: 'Poolside Lawn', owner: 'Bridal Coordinator' },
  { id: 'sch_w1_2', dayNumber: 1, startTime: '18:15', endTime: '19:15', title: 'Soundcheck & Technical Cue Rehearsal', category: 'setup', location: 'Grand Ballroom', owner: 'AV Lead & DJ' },
  { id: 'sch_w1_3', dayNumber: 1, startTime: '19:30', endTime: '23:30', title: 'Sangeet Gala, Performances & Dinner', category: 'entertainment', location: 'Grand Ballroom', owner: 'Emcee & Choreographer' },
  // Day 2: Haldi & Sacred Wedding Ceremony
  { id: 'sch_w2_1', dayNumber: 2, startTime: '10:00', endTime: '12:30', title: 'Haldi Ceremony & Dhol Celebration', category: 'ceremony', location: 'Courtyard Garden', owner: 'Family Elders' },
  { id: 'sch_w2_2', dayNumber: 2, startTime: '12:45', endTime: '14:30', title: 'Traditional Luncheon Feast', category: 'meal', location: 'Dining Pavilion', owner: 'Catering Lead' },
  { id: 'sch_w2_3', dayNumber: 2, startTime: '16:30', endTime: '17:30', title: 'Baraat Procession Assembly', category: 'ceremony', location: 'Palace Main Gate', owner: 'Groom Coordinator' },
  { id: 'sch_w2_4', dayNumber: 2, startTime: '17:45', endTime: '20:30', title: 'Varmala & Vedic Wedding Pheras', category: 'ceremony', location: 'Mandap Amphitheatre', owner: 'Officiant / Priest' },
  { id: 'sch_w2_5', dayNumber: 2, startTime: '20:45', endTime: '23:00', title: 'Royal Wedding Banquet Dinner', category: 'meal', location: 'Dining Pavilion', owner: 'Catering Lead' },
  // Day 3: Reception
  { id: 'sch_w3_1', dayNumber: 3, startTime: '17:00', endTime: '18:30', title: 'Couple Sunset Photo Session', category: 'photo_session', location: 'Heritage Verandah', owner: 'Lead Photographer' },
  { id: 'sch_w3_2', dayNumber: 3, startTime: '19:00', endTime: '23:30', title: 'Grand Reception Dinner & Live Symphony', category: 'entertainment', location: 'Crystal Ballroom', owner: 'Event Lead' },
];

const CORPORATE_1_DAY: BlueprintItem[] = [
  { id: 'sch_c_1', dayNumber: 1, startTime: '08:00', endTime: '09:00', title: 'Registration, Delegate Badging & Breakfast', category: 'meal', location: 'Convention Foyer', owner: 'Registration Desk' },
  { id: 'sch_c_2', dayNumber: 1, startTime: '09:15', endTime: '10:30', title: 'Opening Keynote & Leadership Address', category: 'speech', location: 'Plenary Auditorium', owner: 'AV Lead & Moderator' },
  { id: 'sch_c_3', dayNumber: 1, startTime: '10:45', endTime: '12:45', title: 'Panel Discussions & Track Breakouts', category: 'ceremony', location: 'Halls A & B', owner: 'Session Chairs' },
  { id: 'sch_c_4', dayNumber: 1, startTime: '13:00', endTime: '14:15', title: 'Executive Networking Luncheon', category: 'meal', location: 'Dining Pavilion', owner: 'Catering Lead' },
  { id: 'sch_c_5', dayNumber: 1, startTime: '14:30', endTime: '17:00', title: 'Product Demos, Workshops & Fireside Chat', category: 'entertainment', location: 'Plenary Auditorium', owner: 'Tech Lead' },
  { id: 'sch_c_6', dayNumber: 1, startTime: '18:00', endTime: '21:30', title: 'Cocktail Reception & Awards Gala', category: 'meal', location: 'Rooftop Lounge', owner: 'Events Chair' },
];

const SINGLE_DAY_GENERIC: BlueprintItem[] = [
  { id: 'sch_b_1', dayNumber: 1, startTime: '15:30', endTime: '17:00', title: 'Venue Styling, Balloon Installation & Cake Delivery', category: 'setup', location: 'Celebration Hall', owner: 'Decor & Bakery Lead' },
  { id: 'sch_b_2', dayNumber: 1, startTime: '17:30', endTime: '18:30', title: 'Guest Arrival, Welcome Mocktails & Photobooth', category: 'photo_session', location: 'Foyer / Lounge', owner: 'Host' },
  { id: 'sch_b_3', dayNumber: 1, startTime: '18:45', endTime: '19:45', title: 'Interactive Games, Magician & Family Toasts', category: 'entertainment', location: 'Center Stage', owner: 'Party Host / Emcee' },
  { id: 'sch_b_4', dayNumber: 1, startTime: '20:00', endTime: '20:30', title: 'Cake Cutting Ceremony & Speeches', category: 'ceremony', location: 'Center Stage', owner: 'Host & Honoree' },
  { id: 'sch_b_5', dayNumber: 1, startTime: '20:45', endTime: '23:00', title: 'Gourmet Buffet Dinner & Dance Floor DJ', category: 'meal', location: 'Celebration Hall', owner: 'Catering & DJ' },
];

/** Relaxed continuation template for every day a blueprint does not cover. */
const CONTINUATION_DAY: BlueprintItem[] = [
  { id: 'sch_ext_brunch', dayNumber: 0, startTime: '11:00', endTime: '13:30', title: 'Relaxed Guest Brunch & Informal Photoshoot', category: 'meal', location: 'Garden Lounge', owner: 'Host' },
  { id: 'sch_ext_leisure', dayNumber: 0, startTime: '14:00', endTime: '18:00', title: 'Leisure Time, Local Excursions & Recharge', category: 'wind_down', location: 'Guest Suites', owner: 'Guest Coordinator' },
  { id: 'sch_ext_dinner', dayNumber: 0, startTime: '19:30', endTime: '22:30', title: 'Informal Family Dinner & Farewell Round', category: 'meal', location: 'Dining Hall', owner: 'Catering Lead' },
];

const CONTINUATION_DAY_CORPORATE: BlueprintItem[] = [
  { id: 'sch_extc_workshops', dayNumber: 0, startTime: '09:30', endTime: '12:30', title: 'Hands-On Workshops & Partner Breakouts', category: 'entertainment', location: 'Halls C & D', owner: 'Session Chairs' },
  { id: 'sch_extc_lunch', dayNumber: 0, startTime: '12:45', endTime: '14:00', title: 'Networking Lunch with Speakers', category: 'meal', location: 'Dining Pavilion', owner: 'Catering Lead' },
  { id: 'sch_extc_townhall', dayNumber: 0, startTime: '14:15', endTime: '16:00', title: 'Closing Townhall, Q&A & Next-Year Outlook', category: 'speech', location: 'Plenary Auditorium', owner: 'Events Chair' },
  { id: 'sch_extc_dinner', dayNumber: 0, startTime: '19:00', endTime: '22:00', title: 'Offsite Team Dinner', category: 'meal', location: 'Rooftop Lounge', owner: 'Events Lead' },
];

function pickBlueprint(eventType: EventType, durationDays: number): BlueprintItem[] {
  const days = Math.max(1, durationDays);
  switch (eventType) {
    case 'wedding':
      if (days >= 3) return WEDDING_3_DAYS;
      if (days === 2) return WEDDING_2_DAYS;
      return WEDDING_1_DAY;
    case 'corporate':
      return CORPORATE_1_DAY;
    default:
      return SINGLE_DAY_GENERIC;
  }
}

function continuationBlueprint(eventType: EventType): BlueprintItem[] {
  return eventType === 'corporate' ? CONTINUATION_DAY_CORPORATE : CONTINUATION_DAY;
}

function toItem(blueprint: BlueprintItem, date: string, isContinuationDay: boolean): ScheduleItem {
  return {
    // Continuation days repeat the same template entries for every uncovered day,
    // so generated ids are day-scoped to stay unique across the event.
    id: isContinuationDay ? `${blueprint.id}_d${blueprint.dayNumber}` : blueprint.id,
    dayNumber: blueprint.dayNumber,
    date,
    startTime: blueprint.startTime,
    endTime: blueprint.endTime,
    durationMinutes: blueprintDuration(blueprint),
    title: blueprint.title,
    category: blueprint.category,
    location: blueprint.location,
    owner: blueprint.owner,
    ...(blueprint.notes ? { notes: blueprint.notes } : {}),
  };
}

export function generateDefaultSchedule(
  eventType: EventType,
  startDateStr: string,
  durationDays: number
): ScheduleItem[] {
  const totalDays = Math.max(1, Math.min(30, Math.round(durationDays)));
  const blueprint = pickBlueprint(eventType, totalDays);
  const coveredDays = new Set(blueprint.map(item => item.dayNumber));
  const continuation = continuationBlueprint(eventType);
  const items: ScheduleItem[] = [];

  const pushDay = (dayNumber: number, date: string): void => {
    const dayBlueprint = coveredDays.has(dayNumber)
      ? blueprint.filter(item => item.dayNumber === dayNumber)
      : continuation;
    dayBlueprint.forEach((entry) => {
      items.push(toItem({ ...entry, dayNumber }, date, !coveredDays.has(dayNumber)));
    });
  };

  for (let day = 1; day <= totalDays; day++) {
    pushDay(day, addDaysISO(startDateStr, day - 1));
  }

  return items;
}

/**
 * Re-dates existing schedule items onto a new event date, preserving each
 * item's day offset and trimming activities beyond the event duration.
 */
export function recalculateScheduleForNewDate(
  items: ScheduleItem[],
  newStartDate: string,
  durationDays?: number
): ScheduleItem[] {
  const maxDay = durationDays !== undefined ? Math.max(1, Math.round(durationDays)) : undefined;
  return items
    .filter(item => maxDay === undefined || item.dayNumber <= maxDay)
    .map((item) => ({
      ...item,
      date: addDaysISO(newStartDate, item.dayNumber - 1),
    }));
}
