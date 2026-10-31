import { ScheduleItem, ScheduleConflict, ScheduleCategory } from '../types/schedule';
import { EventType } from '../types/event';

function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
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
      const curStart = timeToMinutes(current.startTime);
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

export function generateDefaultSchedule(
  eventType: EventType,
  startDateStr: string,
  durationDays: number
): ScheduleItem[] {
  const items: ScheduleItem[] = [];

  const addDay = (dateStr: string, daysToAdd: number): string => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + daysToAdd);
    return d.toISOString().split('T')[0];
  };

  if (eventType === 'wedding') {
    if (durationDays >= 3) {
      // Day 1: Welcome & Sangeet / Mehendi
      items.push(
        { id: 'sch_w1_1', dayNumber: 1, date: startDateStr, startTime: '15:00', endTime: '18:00', durationMinutes: 180, title: 'Mehendi & High Tea Carnival', category: 'ceremony', location: 'Poolside Lawn', owner: 'Bridal Coordinator' },
        { id: 'sch_w1_2', dayNumber: 1, date: startDateStr, startTime: '18:15', endTime: '19:15', durationMinutes: 60, title: 'Soundcheck & Technical Cue Rehearsal', category: 'setup', location: 'Grand Ballroom', owner: 'AV Lead & DJ' },
        { id: 'sch_w1_3', dayNumber: 1, date: startDateStr, startTime: '19:30', endTime: '23:30', durationMinutes: 240, title: 'Sangeet Gala, Performances & Dinner', category: 'entertainment', location: 'Grand Ballroom', owner: 'Emcee & Choreographer' }
      );
      // Day 2: Haldi & Sacred Wedding Ceremony
      const day2Date = addDay(startDateStr, 1);
      items.push(
        { id: 'sch_w2_1', dayNumber: 2, date: day2Date, startTime: '10:00', endTime: '12:30', durationMinutes: 150, title: 'Haldi Ceremony & Dhol Celebration', category: 'ceremony', location: 'Courtyard Garden', owner: 'Family Elders' },
        { id: 'sch_w2_2', dayNumber: 2, date: day2Date, startTime: '12:45', endTime: '14:30', durationMinutes: 105, title: 'Traditional Luncheon Feast', category: 'meal', location: 'Dining Pavilion', owner: 'Catering Lead' },
        { id: 'sch_w2_3', dayNumber: 2, date: day2Date, startTime: '16:30', endTime: '17:30', durationMinutes: 60, title: 'Baraat Procession Assembly', category: 'ceremony', location: 'Palace Main Gate', owner: 'Groom Coordinator' },
        { id: 'sch_w2_4', dayNumber: 2, date: day2Date, startTime: '17:45', endTime: '20:30', durationMinutes: 165, title: 'Varmala & Vedic Wedding Pheras', category: 'ceremony', location: 'Mandap Amphitheatre', owner: 'Officiant / Priest' },
        { id: 'sch_w2_5', dayNumber: 2, date: day2Date, startTime: '20:45', endTime: '23:00', durationMinutes: 135, title: 'Royal Wedding Banquet Dinner', category: 'meal', location: 'Dining Pavilion', owner: 'Catering Lead' }
      );
      // Day 3: Reception
      const day3Date = addDay(startDateStr, 2);
      items.push(
        { id: 'sch_w3_1', dayNumber: 3, date: day3Date, startTime: '17:00', endTime: '18:30', durationMinutes: 90, title: 'Couple Sunset Photo Session', category: 'photo_session', location: 'Heritage Verandah', owner: 'Lead Photographer' },
        { id: 'sch_w3_2', dayNumber: 3, date: day3Date, startTime: '19:00', endTime: '23:30', durationMinutes: 270, title: 'Grand Reception Dinner & Live Symphony', category: 'entertainment', location: 'Crystal Ballroom', owner: 'Event Lead' }
      );
    } else {
      // 1 or 2 day wedding
      items.push(
        { id: 'sch_w_s1', dayNumber: 1, date: startDateStr, startTime: '10:00', endTime: '11:30', durationMinutes: 90, title: 'Vendor Arrival, Stage & Mandap Setup', category: 'setup', location: 'Main Banquet Hall', owner: 'Decor Team' },
        { id: 'sch_w_s2', dayNumber: 1, date: startDateStr, startTime: '11:45', endTime: '13:00', durationMinutes: 75, title: 'Baraat & Welcoming of Guests', category: 'ceremony', location: 'Entrance Lawn', owner: 'Family Hosts' },
        { id: 'sch_w_s3', dayNumber: 1, date: startDateStr, startTime: '13:15', endTime: '15:15', durationMinutes: 120, title: 'Wedding Ceremony & Exchange of Vows', category: 'ceremony', location: 'Main Mandap / Altar', owner: 'Officiant' },
        { id: 'sch_w_s4', dayNumber: 1, date: startDateStr, startTime: '15:30', endTime: '17:30', durationMinutes: 120, title: 'Family Photography & High Tea', category: 'photo_session', location: 'Lobby Lounge', owner: 'Photographer' },
        { id: 'sch_w_s5', dayNumber: 1, date: startDateStr, startTime: '19:00', endTime: '23:00', durationMinutes: 240, title: 'Reception Dinner & Musical Evening', category: 'meal', location: 'Grand Ballroom', owner: 'Event Coordinator' }
      );
    }
  } else if (eventType === 'corporate') {
    items.push(
      { id: 'sch_c_1', dayNumber: 1, date: startDateStr, startTime: '08:00', endTime: '09:00', durationMinutes: 60, title: 'Registration, Delegate Badging & Breakfast', category: 'meal', location: 'Convention Foyer', owner: 'Registration Desk' },
      { id: 'sch_c_2', dayNumber: 1, date: startDateStr, startTime: '09:15', endTime: '10:30', durationMinutes: 75, title: 'Opening Keynote & Leadership Address', category: 'speech', location: 'Plenary Auditorium', owner: 'AV Lead & Moderator' },
      { id: 'sch_c_3', dayNumber: 1, date: startDateStr, startTime: '10:45', endTime: '12:45', durationMinutes: 120, title: 'Panel Discussions & Track Breakouts', category: 'ceremony', location: 'Halls A & B', owner: 'Session Chairs' },
      { id: 'sch_c_4', dayNumber: 1, date: startDateStr, startTime: '13:00', endTime: '14:15', durationMinutes: 75, title: 'Executive Networking Luncheon', category: 'meal', location: 'Dining Pavilion', owner: 'Catering Lead' },
      { id: 'sch_c_5', dayNumber: 1, date: startDateStr, startTime: '14:30', endTime: '17:00', durationMinutes: 150, title: 'Product Demos, Workshops & Fireside Chat', category: 'entertainment', location: 'Plenary Auditorium', owner: 'Tech Lead' },
      { id: 'sch_c_6', dayNumber: 1, date: startDateStr, startTime: '18:00', endTime: '21:30', durationMinutes: 210, title: 'Cocktail Reception & Awards Gala', category: 'meal', location: 'Rooftop Lounge', owner: 'Events Chair' }
    );
  } else {
    // Birthday / Anniversary / Community
    items.push(
      { id: 'sch_b_1', dayNumber: 1, date: startDateStr, startTime: '15:30', endTime: '17:00', durationMinutes: 90, title: 'Venue Styling, Balloon Installation & Cake Delivery', category: 'setup', location: 'Celebration Hall', owner: 'Decor & Bakery Lead' },
      { id: 'sch_b_2', dayNumber: 1, date: startDateStr, startTime: '17:30', endTime: '18:30', durationMinutes: 60, title: 'Guest Arrival, Welcome Mocktails & Photobooth', category: 'photo_session', location: 'Foyer / Lounge', owner: 'Host' },
      { id: 'sch_b_3', dayNumber: 1, date: startDateStr, startTime: '18:45', endTime: '19:45', durationMinutes: 60, title: 'Interactive Games, Magician & Family Toasts', category: 'entertainment', location: 'Center Stage', owner: 'Party Host / Emcee' },
      { id: 'sch_b_4', dayNumber: 1, date: startDateStr, startTime: '20:00', endTime: '20:30', durationMinutes: 30, title: 'Cake Cutting Ceremony & Speeches', category: 'ceremony', location: 'Center Stage', owner: 'Host & Honoree' },
      { id: 'sch_b_5', dayNumber: 1, date: startDateStr, startTime: '20:45', endTime: '23:00', durationMinutes: 135, title: 'Gourmet Buffet Dinner & Dance Floor DJ', category: 'meal', location: 'Celebration Hall', owner: 'Catering & DJ' }
    );
  }

  return items;
}
