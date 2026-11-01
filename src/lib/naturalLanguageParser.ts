import { EventType, VenueStatus } from '../types/event';
import { CurrencyCode } from '../types/currency';
import { todayISO } from './dates';

export interface ParsedEventBrief {
  title?: string;
  eventType: EventType;
  startDate?: string;
  durationDays: number;
  locationCity?: string;
  venueStatus: VenueStatus;
  guestCount?: number;
  budgetAmount?: number;
  currency: CurrencyCode;
  priorities: string[];
  dietary: string[];
  accessibility: string[];
  style?: string;
  confidenceScore: number;
  missingFields: string[];
  extractedSummary: string;
}

/** Keeps any parsed money figure inside representable, sane bounds. */
function clampBudget(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(1_000_000_000_000, value);
}

// ── Field detectors ──────────────────────────────────────────────────────
// Each detector is a pure function of the (lower-cased) brief text so the
// parse stays deterministic and unit-testable; parseNaturalLanguageBrief
// only orchestrates them in their original order.

/** 1. Event type — first matching keyword family wins. */
function detectEventType(lower: string): EventType {
  if (lower.includes('wedding') || lower.includes('shaadi') || lower.includes('marriage') || lower.includes('sangeet') || lower.includes('mehendi')) {
    return 'wedding';
  }
  if (lower.includes('birthday') || lower.includes('bday') || lower.includes('turning')) {
    return 'birthday';
  }
  if (lower.includes('anniversary') || lower.includes('jubilee')) {
    return 'anniversary';
  }
  if (lower.includes('corporate') || lower.includes('conference') || lower.includes('summit') || lower.includes('offsite') || lower.includes('symposium')) {
    return 'corporate';
  }
  if (lower.includes('college') || lower.includes('fest') || lower.includes('hackathon') || lower.includes('cultural fest')) {
    return 'college_fest';
  }
  if (lower.includes('community') || lower.includes('diwali mela') || lower.includes('charity') || lower.includes('gala') || lower.includes('society')) {
    return 'community';
  }
  return 'wedding';
}

/** 2. Duration in days; explicit "N days" wins, then weekend / 3-day hints. */
function detectDurationDays(text: string, lower: string): number {
  const dayMatch = text.match(/(\d+)\s*[- ]?(?:day|days|diwas)/i);
  if (dayMatch) {
    return Math.min(14, Math.max(1, parseInt(dayMatch[1], 10)));
  }
  if (lower.includes('weekend')) return 2;
  if (lower.includes('3-day') || lower.includes('three days') || lower.includes('3 days')) return 3;
  return 1;
}

const GUEST_PATTERNS: RegExp[] = [
  /(\d+)\s*(?:guests|people|pax|attendees|members|invitees|persons)/i,
  /(?:for|with|hosting)\s*(\d+)/i,
  /(\d+)\s*-\s*(\d+)\s*(?:guests|people)/i,
];

/** 3. Guest count — first matching pattern defines the headcount (range → midpoint). */
function detectGuestCount(text: string): number | undefined {
  for (const pattern of GUEST_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const first = Number.parseInt(match[1], 10);
      const second = match[2] ? Number.parseInt(match[2], 10) : undefined;
      if (Number.isFinite(first)) {
        const count = second !== undefined && Number.isFinite(second)
          ? Math.round((first + second) / 2)
          : first;
        if (count >= 1) {
          return Math.min(100000, count);
        }
      }
    }
  }
  return undefined;
}

/** 4a. Currency — detected from symbols / ISO codes before any amount math. */
function detectCurrency(lower: string): CurrencyCode {
  if (lower.includes('$') || lower.includes('usd') || lower.includes('dollars')) return 'USD';
  if (lower.includes('€') || lower.includes('eur') || lower.includes('euros')) return 'EUR';
  if (lower.includes('£') || lower.includes('gbp') || lower.includes('pounds')) return 'GBP';
  if (lower.includes('aed') || lower.includes('dirham')) return 'AED';
  return 'INR';
}

/** 4b. Budget — lakh/crore scale, then k/thousand, then a written number (must exceed 100). */
function detectBudgetAmount(text: string): number | undefined {
  const croreMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:crore|crores|cr)/i);
  if (croreMatch) return clampBudget(parseFloat(croreMatch[1]) * 10000000);

  const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lacs|lac|l)/i);
  if (lakhMatch) return clampBudget(parseFloat(lakhMatch[1]) * 100000);

  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:k|thousand)/i);
  if (kMatch) return clampBudget(parseFloat(kMatch[1]) * 1000);

  const rawNumMatch = text.match(/(?:₹|\$|€|£|aed|rs\.?|budget\s*(?:is|of)?)\s*([\d,]+)/i);
  if (rawNumMatch) {
    const num = parseFloat(rawNumMatch[1].replace(/,/g, ''));
    if (!isNaN(num) && num > 100) return clampBudget(num);
  }
  return undefined;
}

const KNOWN_CITIES = [
  'Udaipur', 'Jaipur', 'Mumbai', 'Delhi', 'Goa', 'Bengaluru', 'Bangalore', 'Chennai', 'Kolkata',
  'Hyderabad', 'Pune', 'Ahmedabad', 'Chandigarh', 'Kerala', 'Dubai', 'London', 'New York', 'Paris', 'Singapore',
];

const LOCATION_STOPWORDS = [
  'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'Weekend', 'Three',
];

/** 5. City — known-city list first, then a conservative "in / at" fallback. */
function detectCity(text: string): string | undefined {
  for (const city of KNOWN_CITIES) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(text)) {
      return city;
    }
  }
  const locMatch = text.match(/(?:in|at|around)\s+([A-Z][a-zA-Z\s]{2,15})(?:,|\.|\s+for|\s+with|\s+in|$)/);
  if (locMatch && locMatch[1]) {
    const candidate = locMatch[1].trim();
    if (!LOCATION_STOPWORDS.includes(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

/** 6. Venue status — booked → shortlisting → home → default 'searching'. */
function detectVenueStatus(lower: string): VenueStatus {
  if (lower.includes('venue booked') || lower.includes('venue confirmed') || lower.includes('secured venue') || lower.includes('resort booked')) {
    return 'secured';
  }
  if (lower.includes('shortlisting') || lower.includes('looking at 2-3 venues')) {
    return 'shortlisting';
  }
  if (lower.includes('at home') || lower.includes('private lawn') || lower.includes('our house')) {
    return 'home_or_private';
  }
  return 'searching';
}

/** 7. Priorities — every matching theme is kept; empty result falls back to defaults. */
function detectPriorities(lower: string): string[] {
  const priorities: string[] = [];
  if (lower.includes('photo') || lower.includes('camera') || lower.includes('cinematography')) {
    priorities.push('Photography & Video');
  }
  if (lower.includes('food') || lower.includes('catering') || lower.includes('cuisine') || lower.includes('menu')) {
    priorities.push('Catering & Hospitality');
  }
  if (lower.includes('decor') || lower.includes('flower') || lower.includes('floral') || lower.includes('aesthetic')) {
    priorities.push('Decor & Atmosphere');
  }
  if (lower.includes('entertainment') || lower.includes('dj') || lower.includes('music') || lower.includes('dance')) {
    priorities.push('Music & Entertainment');
  }
  if (lower.includes('venue') || lower.includes('stay') || lower.includes('rooms') || lower.includes('comfort')) {
    priorities.push('Venue & Guest Comfort');
  }
  if (priorities.length === 0) {
    priorities.push('Food & Hospitality', 'Venue & Comfort', 'Decor & Atmosphere');
  }
  return priorities;
}

/** 8. Dietary constraints. */
function detectDietary(lower: string): string[] {
  const dietary: string[] = [];
  if (lower.includes('pure veg') || lower.includes('strictly veg') || lower.includes('vegetarian')) dietary.push('Pure Vegetarian');
  if (lower.includes('jain')) dietary.push('Jain (No Root Veg / Onion / Garlic)');
  if (lower.includes('halal')) dietary.push('Halal Certified');
  if (lower.includes('vegan')) dietary.push('Vegan Options');
  if (lower.includes('gluten free') || lower.includes('gluten-free')) dietary.push('Gluten Free');
  if (lower.includes('nut allergy') || lower.includes('peanut')) dietary.push('Nut Allergy Protocol');
  return dietary;
}

/** 9. Accessibility needs. */
function detectAccessibility(lower: string): string[] {
  const accessibility: string[] = [];
  if (lower.includes('wheelchair') || lower.includes('ramp') || lower.includes('grandparents') || lower.includes('elderly')) {
    accessibility.push('Wheelchair Accessible & Ramp Entrance');
  }
  if (lower.includes('ground floor') || lower.includes('elevator')) {
    accessibility.push('Ground Floor Rooms / Elevator Access');
  }
  return accessibility;
}

const MONTH_NUMERALS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  january: '01', february: '02', march: '03', april: '04', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

const MONTH_REGEX = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/i;

/** 10. Start date from a month (optionally with year); yearless months resolve to the upcoming occurrence. */
function detectStartDate(text: string): string | undefined {
  const mMatch = text.match(MONTH_REGEX);
  if (!mMatch) return undefined;

  const monthNum = MONTH_NUMERALS[mMatch[1].toLowerCase()] || '11';
  const currentYear = new Date().getFullYear();
  const candidateYear = Number.parseInt(mMatch[2] || `${currentYear}`, 10);
  const isoCandidate = `${candidateYear}-${monthNum}-15`;
  const todayStr = todayISO();
  return isoCandidate >= todayStr ? isoCandidate : `${candidateYear + 1}-${monthNum}-15`;
}

// ── Orchestration ────────────────────────────────────────────────────────

export function parseNaturalLanguageBrief(text: string): ParsedEventBrief {
  const lower = text.toLowerCase();

  const eventType = detectEventType(lower);
  const durationDays = detectDurationDays(text, lower);
  const guestCount = detectGuestCount(text);
  const currency = detectCurrency(lower);
  const budgetAmount = detectBudgetAmount(text);
  const locationCity = detectCity(text);
  const venueStatus = detectVenueStatus(lower);
  const priorities = detectPriorities(lower);
  const dietary = detectDietary(lower);
  const accessibility = detectAccessibility(lower);
  const startDate = detectStartDate(text);

  // Missing fields determination
  const missingFields: string[] = [];
  if (!startDate) missingFields.push('Exact event date');
  if (!locationCity) missingFields.push('City / Location');
  if (!guestCount) missingFields.push('Estimated guest count');
  if (!budgetAmount) missingFields.push('Target budget');

  const title = `${locationCity ? locationCity + ' ' : ''}${eventType.charAt(0).toUpperCase() + eventType.slice(1).replace('_', ' ')} Celebration`;

  let confidenceScore = 100;
  if (!startDate) confidenceScore -= 20;
  if (!locationCity) confidenceScore -= 20;
  if (!guestCount) confidenceScore -= 20;
  if (!budgetAmount) confidenceScore -= 20;

  const summary = `Detected ${eventType.toUpperCase()} for ~${guestCount || 100} guests in ${locationCity || 'unspecified city'}, target budget: ${budgetAmount ? budgetAmount.toLocaleString() + ' ' + currency : 'open'}. Duration: ${durationDays} day(s).`;

  return {
    title,
    eventType,
    startDate,
    durationDays,
    locationCity,
    venueStatus,
    guestCount,
    budgetAmount,
    currency,
    priorities,
    dietary,
    accessibility,
    confidenceScore: Math.max(20, confidenceScore),
    missingFields,
    extractedSummary: summary,
  };
}