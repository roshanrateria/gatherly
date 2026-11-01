import { Milestone } from '../types/timeline';
import { ScheduleItem } from '../types/schedule';

function formatIcsDate(dateStr: string, timeStr?: string): string {
  // dateStr is YYYY-MM-DD, timeStr is HH:MM
  const cleanDate = (dateStr || '').replace(/[^0-9]/g, '');
  if (!timeStr) {
    return cleanDate;
  }
  const cleanTime = timeStr.replace(/[^0-9]/g, '').padStart(4, '0').slice(0, 4) + '00';
  return `${cleanDate}T${cleanTime}`;
}

/** RFC 5545 §3.3.11 TEXT escaping. */
function escapeIcsText(value: string): string {
  return (value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 §3.1 content line folding: max 75 octets per line. */
function foldIcsLine(line: string): string[] {
  const encoded = new TextEncoder();
  const maxChunk = 75;
  if (encoded.encode(line).length <= maxChunk) return [line];

  const chunks: string[] = [];
  let current = '';
  let currentOctets = 0;
  for (const char of line) {
    const octets = encoded.encode(char).length;
    if (currentOctets + octets > maxChunk) {
      chunks.push(current);
      current = ' ' + char; // continuation lines start with a space
      currentOctets = 1 + octets;
    } else {
      current += char;
      currentOctets += octets;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function buildIcs(
  calendarName: string,
  prodId: string,
  eventLines: string[][]
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${prodId}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];
  eventLines.forEach((vevent) => lines.push(...vevent));
  lines.push('END:VCALENDAR');
  return lines.flatMap(foldIcsLine).join('\r\n');
}

export function generateMilestonesIcs(
  milestones: Milestone[],
  eventTitle: string
): string {
  const dtStamp = formatIcsDate(new Date().toISOString().split('T')[0], '12:00');
  const events = milestones.map((m) => [
    'BEGIN:VEVENT',
    `UID:gatherly_milestone_${m.id}@gatherly.app`,
    `DTSTAMP:${dtStamp}Z`,
    `DTSTART;VALUE=DATE:${formatIcsDate(m.dueDate)}`,
    `SUMMARY:${escapeIcsText(`[${m.category}] ${m.title}`)}`,
    `DESCRIPTION:${escapeIcsText(m.notes || m.title)}`,
    `PRIORITY:${m.priority === 'high' ? '1' : m.priority === 'medium' ? '5' : '9'}`,
    `STATUS:${m.completed ? 'COMPLETED' : 'CONFIRMED'}`,
    'END:VEVENT',
  ]);
  return buildIcs(`${eventTitle} - Milestones`, '-//Gatherly//AI Event Planner//EN', events);
}

export function generateScheduleIcs(
  items: ScheduleItem[],
  eventTitle: string
): string {
  const dtStamp = formatIcsDate(new Date().toISOString().split('T')[0], '12:00');
  const events = items.map((item) => [
    'BEGIN:VEVENT',
    `UID:gatherly_schedule_${item.id}@gatherly.app`,
    `DTSTAMP:${dtStamp}Z`,
    `DTSTART:${formatIcsDate(item.date, item.startTime)}`,
    `DTEND:${formatIcsDate(item.date, item.endTime)}`,
    `SUMMARY:${escapeIcsText(item.title)}`,
    `LOCATION:${escapeIcsText(item.location || 'Venue')}`,
    `DESCRIPTION:${escapeIcsText(`Lead Owner: ${item.owner}\\nCategory: ${item.category}\\nNotes: ${item.notes || 'Run sheet activity'}`)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
  ]);
  return buildIcs(`${eventTitle} - Day Schedule`, '-//Gatherly//Event Run Sheet//EN', events);
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
