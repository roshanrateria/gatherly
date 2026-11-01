import { DietaryNeed, Guest, GuestGroup, RsvpStatus } from '../types/guest';

/**
 * CSV utilities: RFC 4180 parsing, escaping, and spreadsheet formula-injection
 * defense for guest-list import/export.
 */

/** Quotes and escapes a single cell per RFC 4180. */
export function escapeCsvCell(value: string): string {
  const text = typeof value === 'string' ? value : String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Prefixes spreadsheet formula triggers (=, +, -, @, tab, CR) so opening the
 * export in Excel/Sheets cannot execute an injected formula.
 */
export function neutralizeCsvFormula(value: string): string {
  const text = typeof value === 'string' ? value : String(value ?? '');
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/** Minimal RFC 4180 parser: quoted cells, escaped quotes, CRLF/LF rows. */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let index = 0;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    // Drop perfectly empty trailing rows (e.g. final newline).
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      pushField();
      index += 1;
      continue;
    }
    if (char === '\r' || char === '\n') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      pushRow();
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }
  if (field !== '' || row.length > 0) pushRow();
  return rows;
}

const RSVP_STATUSES: readonly RsvpStatus[] = ['attending', 'declined', 'tentative', 'pending'];
const GROUPS: readonly GuestGroup[] = [
  'family', 'friends', 'colleagues', 'vip', 'bride_side', 'groom_side', 'community', 'general',
];
const DIETARY: readonly DietaryNeed[] = [
  'veg', 'non_veg', 'jain', 'vegan', 'halal', 'kosher', 'gluten_free', 'nut_allergy', 'none',
];

const MAX_CSV_ROWS = 2000;
const MAX_CSV_CELL = 500;

function normalizeEnum<T extends string>(raw: string, allowed: readonly T[]): T | undefined {
  const cleaned = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!cleaned) return undefined;
  return allowed.find(option => option === cleaned || option.startsWith(cleaned));
}

function cleanCell(raw: string | undefined): string {
  return (raw ?? '').replace(/^'/, '').trim().slice(0, MAX_CSV_CELL);
}

/** Maps "dietary" or "dietaryNeeds" column content to valid enum tokens. */
function parseDietary(raw: string | undefined): DietaryNeed[] {
  if (!raw) return [];
  const tokens = raw
    .split(/[;|/,]/)
    .map(token => normalizeEnum(token, DIETARY))
    .filter((token): token is DietaryNeed => Boolean(token));
  return Array.from(new Set(tokens));
}

function parsePlusOnes(raw: string | undefined): number {
  const parsed = Number.parseInt(cleanCell(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(20, parsed);
}

export interface GuestCsvResult {
  guests: Guest[];
  errors: string[];
}

export interface GuestCsvOptions {
  idFactory: (index: number) => string;
}

/**
 * Parses an uploaded CSV into guest roster entries. Header row is required;
 * unknown columns are ignored, missing optional columns get safe defaults,
 * and unrecognized enum values degrade to `general`/`pending`/[] rather than
 * entering state.
 */
export function parseGuestsCsv(text: string, options: GuestCsvOptions): GuestCsvResult {
  const errors: string[] = [];
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    return { guests: [], errors: ['CSV needs a header row and at least one guest row.'] };
  }

  const header = rows[0].map(cell => cell.trim().toLowerCase());
  const col = (...names: string[]): number =>
    header.findIndex(h => names.includes(h));

  const nameIdx = col('name', 'guest name', 'full name');
  const groupIdx = col('group', 'side', 'category');
  const rsvpIdx = col('rsvp', 'rsvp status', 'rsvpstatus');
  const plusOnesIdx = col('plus ones', 'plusones', 'guests', 'party size');
  const emailIdx = col('email');
  const phoneIdx = col('phone', 'phone number', 'contact');
  const tableIdx = col('table', 'table number');
  const notesIdx = col('notes', 'note');
  const dietaryIdx = col('dietary', 'dietary needs', 'diet');

  if (nameIdx === -1) {
    return { guests: [], errors: ['CSV must include a "Name" column.'] };
  }

  const guests: Guest[] = [];
  rows.slice(1).forEach((cells, rowIdx) => {
    const name = cleanCell(cells[nameIdx]);
    if (!name) {
      errors.push(`Row ${rowIdx + 2}: skipped (missing guest name).`);
      return;
    }
    if (guests.length >= MAX_CSV_ROWS) {
      errors.push(`Row ${rowIdx + 2}: skipped (row limit of ${MAX_CSV_ROWS} reached).`);
      return;
    }

    const rsvp = (rsvpIdx !== -1 ? normalizeEnum(cleanCell(cells[rsvpIdx]), RSVP_STATUSES) : undefined) ?? 'pending';
    const group = (groupIdx !== -1 ? normalizeEnum(cleanCell(cells[groupIdx]), GROUPS) : undefined) ?? 'general';

    guests.push({
      id: options.idFactory(rowIdx),
      name,
      email: emailIdx !== -1 ? cleanCell(cells[emailIdx]) || undefined : undefined,
      phone: phoneIdx !== -1 ? cleanCell(cells[phoneIdx]) || undefined : undefined,
      group,
      rsvpStatus: rsvp,
      plusOnes: plusOnesIdx !== -1 ? parsePlusOnes(cells[plusOnesIdx]) : 0,
      dietaryNeeds: dietaryIdx !== -1 ? parseDietary(cells[dietaryIdx]) : [],
      accessibilityNeeds: [],
      tableNumber: tableIdx !== -1 ? cleanCell(cells[tableIdx]) || undefined : undefined,
      notes: notesIdx !== -1 ? cleanCell(cells[notesIdx]) || undefined : undefined,
    });
  });

  return { guests, errors };
}

/** Builds the CSV export with formula-safe cells and stable column order. */
export function guestsToCsv(guests: Guest[]): string {
  const header = ['Name', 'Group', 'RSVP', 'Plus Ones', 'Email', 'Phone', 'Table', 'Dietary', 'Notes'];
  const lines = [header.map(escapeCsvCell).join(',')];
  guests.forEach((guest) => {
    const cells = [
      neutralizeCsvFormula(guest.name),
      neutralizeCsvFormula(guest.group),
      neutralizeCsvFormula(guest.rsvpStatus),
      String(guest.plusOnes ?? 0),
      neutralizeCsvFormula(guest.email ?? ''),
      neutralizeCsvFormula(guest.phone ?? ''),
      neutralizeCsvFormula(guest.tableNumber ?? ''),
      neutralizeCsvFormula((guest.dietaryNeeds ?? []).join('; ')),
      neutralizeCsvFormula(guest.notes ?? '').replace(/\r?\n/g, ' '),
    ];
    lines.push(cells.map(escapeCsvCell).join(','));
  });
  return lines.join('\r\n') + '\r\n';
}
