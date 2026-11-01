import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  escapeCsvCell,
  guestsToCsv,
  neutralizeCsvFormula,
  parseCsvRows,
  parseGuestsCsv,
} from '../src/lib/csv.ts';
import type { Guest } from '../src/types/index.ts';

describe('RFC 4180 CSV parsing', () => {
  it('handles quoted cells, embedded quotes, CRLF and LF rows', () => {
    const rows = parseCsvRows(
      ' Name , Group , RSVP \r\n' +
        '"She said, ""hello""",family,attending\n' +
        'Solo User, friends, pending'
    );
    assert.strictEqual(rows.length, 3);
    assert.deepStrictEqual(rows[1], ['She said, "hello"', 'family', 'attending']);
    assert.deepStrictEqual(rows[2], ['Solo User', ' friends', ' pending']);
  });

  it('preserves a leading apostrophe round trip (neutralized export cells)', () => {
    const rows = parseCsvRows('Name,Notes\nAarav,\'= sûred\n');
    assert.deepStrictEqual(rows[0], ['Name', 'Notes']);
    assert.deepStrictEqual(rows[1], ['Aarav', "'= sûred"]);
  });

  it('drops trailing empty rows', () => {
    const rows = parseCsvRows('a,b\r\n1,2\r\n\r\n');
    assert.strictEqual(rows.length, 2);
  });
});

describe('Spreadsheet formula-injection defense', () => {
  it('escapes rule characters (=, +, -, @, tab, CR)', () => {
    assert.strictEqual(escapeCsvCell('plain'), 'plain');
    assert.strictEqual(escapeCsvCell('has,comma'), '"has,comma"');
    assert.strictEqual(escapeCsvCell('quote"inside'), '"quote""inside"');

    assert.strictEqual(neutralizeCsvFormula('=1+1'), "'=1+1");
    assert.strictEqual(neutralizeCsvFormula('+SUM(A1)'), "'+SUM(A1)");
    assert.strictEqual(neutralizeCsvFormula('-cmd|danger'), "'-cmd|danger");
    assert.strictEqual(neutralizeCsvFormula('@cmd'), "'@cmd");
    assert.strictEqual(
      neutralizeCsvFormula('2026-11-20'),
      '2026-11-20',
      'Interior dash untouched — only leading formula triggers are neutralized'
    );
    assert.strictEqual(neutralizeCsvFormula('Normal text'), 'Normal text');
  });
});

describe('Guest CSV import', () => {
  it('parses a full round trip: export → import → same people', () => {
    const guests: Guest[] = [
      {
        id: 'g1', name: 'Aarav "Bhai" Verma', group: 'family', rsvpStatus: 'attending', plusOnes: 2,
        email: 'aarav@example.com', phone: '+91 98200', dietaryNeeds: ['veg', 'jain'],
        accessibilityNeeds: [], tableNumber: 'Table 2', notes: 'Groom cousin, needs, commas',
      },
      {
        id: 'g2', name: '=HYPERLINK("http://evil")', group: 'friends', rsvpStatus: 'tentative', plusOnes: 0,
        dietaryNeeds: [], accessibilityNeeds: [],
      },
    ];

    const csv = guestsToCsv(guests);
    const imported = parseGuestsCsv(csv, { idFactory: i => `tmp_${i}` });

    assert.strictEqual(imported.errors.length, 0, `No errors: ${imported.errors.join('; ')}`);
    assert.strictEqual(imported.guests.length, 2);
    assert.strictEqual(imported.guests[0].name, 'Aarav "Bhai" Verma', 'Quoted cell round-trips');

    // Round-trip of numeric fields
    assert.strictEqual(imported.guests[0].plusOnes, 2);
    assert.strictEqual(imported.guests[0].rsvpStatus, 'attending');
    assert.deepStrictEqual(imported.guests[0].dietaryNeeds, ['veg', 'jain']);

    // Formula-injection cell is neutralized on export; the leading apostrophe
    // is an export convention stripped back off on re-import, so the value
    // round-trips as inert text instead of an executable formula.
    assert.strictEqual(imported.guests[1].name, '=HYPERLINK("http://evil")');
  });

  it('rejects headerless content and rows without a Name column', () => {
    assert.deepStrictEqual(parseGuestsCsv('just one line', { idFactory: i => `i${i}` }).guests, []);
    assert.match(
      parseGuestsCsv('Group,RSVP\nfamily,attending', { idFactory: i => `i${i}` }).errors[0],
      /"Name"/
    );
  });

  it('skips empty-name rows but keeps the rest', () => {
    const csv = [
      'Name,Group,RSVP,Plus Ones',
      'Ravi Sharma,friends,attending,1',
      ' ,family,pending,0',
      'Meera Patel,family,declined,',
    ].join('\n');

    const imported = parseGuestsCsv(csv, { idFactory: i => `i${i}` });
    assert.strictEqual(imported.guests.length, 2);
    assert.strictEqual(imported.errors.length, 1);
    assert.match(imported.errors[0], /Row 3/);
    assert.strictEqual(imported.guests[0].plusOnes, 1);
    assert.strictEqual(imported.guests[1].group, 'family');
    assert.strictEqual(imported.guests[1].rsvpStatus, 'declined');
  });

  it('normalizes enum values defensively (no junk in state)', () => {
    const csv = 'Name,Group,RSVP,Plus Ones,Phone,Email,Dietary,Table,Notes\n' +
      'Evil && <script>, mythical_ninja, maybe, 999, `<x>`, not-an-email, spicy; VEG, Room α, notes\n' +
      'Priya,friends,attending,0,,, , Table 1, ';
    const imported = parseGuestsCsv(csv, { idFactory: i => `i${i}` });

    assert.strictEqual(imported.guests.length, 2);
    assert.strictEqual(imported.guests[0].group, 'general', 'Unknown group falls back');
    assert.strictEqual(imported.guests[0].rsvpStatus, 'pending', 'Unknown RSVP falls back');
    assert.deepStrictEqual(imported.guests[0].dietaryNeeds, ['veg'], 'Only valid dietary tokens are kept');
    assert.strictEqual(imported.guests[0].plusOnes, 20, 'Plus ones capped at 20');
    assert.strictEqual(imported.guests[0].email, 'not-an-email', 'Kept as inert text (rendered via React, never innerHTML)');
  });
});
