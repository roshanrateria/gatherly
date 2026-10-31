import { Milestone } from '../types/timeline';
import { ScheduleItem } from '../types/schedule';

function formatIcsDate(dateStr: string, timeStr?: string): string {
  // dateStr is YYYY-MM-DD, timeStr is HH:MM
  const cleanDate = dateStr.replace(/-/g, '');
  if (!timeStr) {
    return cleanDate;
  }
  const cleanTime = timeStr.replace(/:/g, '') + '00';
  return `${cleanDate}T${cleanTime}`;
}

export function generateMilestonesIcs(
  milestones: Milestone[],
  eventTitle: string
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gatherly//AI Event Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${eventTitle} - Milestones`,
  ];

  milestones.forEach((m) => {
    const dt = formatIcsDate(m.dueDate);
    lines.push(
      'BEGIN:VEVENT',
      `UID:gatherly_milestone_${m.id}@gatherly.app`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString().split('T')[0], '12:00')}Z`,
      `DTSTART;VALUE=DATE:${dt}`,
      `SUMMARY:[${m.category}] ${m.title}`,
      `DESCRIPTION:${(m.notes || m.title).replace(/\n/g, '\\n')}`,
      `PRIORITY:${m.priority === 'high' ? '1' : m.priority === 'medium' ? '5' : '9'}`,
      `STATUS:${m.completed ? 'COMPLETED' : 'CONFIRMED'}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function generateScheduleIcs(
  items: ScheduleItem[],
  eventTitle: string
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gatherly//Event Run Sheet//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${eventTitle} - Day Schedule`,
  ];

  items.forEach((item) => {
    const startDt = formatIcsDate(item.date, item.startTime);
    const endDt = formatIcsDate(item.date, item.endTime);

    lines.push(
      'BEGIN:VEVENT',
      `UID:gatherly_schedule_${item.id}@gatherly.app`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString().split('T')[0], '12:00')}Z`,
      `DTSTART:${startDt}`,
      `DTEND:${endDt}`,
      `SUMMARY:${item.title}`,
      `LOCATION:${item.location || 'Venue'}`,
      `DESCRIPTION:Lead Owner: ${item.owner}\\nCategory: ${item.category}\\nNotes: ${(item.notes || 'Run sheet activity').replace(/\n/g, '\\n')}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.ics') ? filename : `${filename}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
