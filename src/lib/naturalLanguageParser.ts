import { EventType, VenueStatus } from '../types/event';
import { CurrencyCode } from '../types/currency';

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

export function parseNaturalLanguageBrief(text: string): ParsedEventBrief {
  const lower = text.toLowerCase();

  // 1. Detect Event Type
  let eventType: EventType = 'wedding';
  if (lower.includes('wedding') || lower.includes('shaadi') || lower.includes('marriage') || lower.includes('sangeet') || lower.includes('mehendi')) {
    eventType = 'wedding';
  } else if (lower.includes('birthday') || lower.includes('bday') || lower.includes('turning')) {
    eventType = 'birthday';
  } else if (lower.includes('anniversary') || lower.includes('jubilee')) {
    eventType = 'anniversary';
  } else if (lower.includes('corporate') || lower.includes('conference') || lower.includes('summit') || lower.includes('offsite') || lower.includes('symposium')) {
    eventType = 'corporate';
  } else if (lower.includes('college') || lower.includes('fest') || lower.includes('hackathon') || lower.includes('cultural fest')) {
    eventType = 'college_fest';
  } else if (lower.includes('community') || lower.includes('diwali mela') || lower.includes('charity') || lower.includes('gala') || lower.includes('society')) {
    eventType = 'community';
  }

  // 2. Detect Duration Days
  let durationDays = 1;
  const dayMatch = text.match(/(\d+)\s*[- ]?(?:day|days|diwas)/i);
  if (dayMatch) {
    durationDays = Math.min(14, Math.max(1, parseInt(dayMatch[1], 10)));
  } else if (lower.includes('weekend')) {
    durationDays = 2;
  } else if (lower.includes('3-day') || lower.includes('three days') || lower.includes('3 days')) {
    durationDays = 3;
  }

  // 3. Detect Guests
  let guestCount: number | undefined;
  const guestPatterns = [
    /(\d+)\s*(?:guests|people|pax|attendees|members|invitees|persons)/i,
    /(?:for|with|hosting)\s*(\d+)/i,
    /(\d+)\s*-\s*(\d+)\s*(?:guests|people)/i,
  ];

  for (const pattern of guestPatterns) {
    const match = text.match(pattern);
    if (match) {
      const first = Number.parseInt(match[1], 10);
      const second = match[2] ? Number.parseInt(match[2], 10) : undefined;
      if (Number.isFinite(first)) {
        const count = second !== undefined && Number.isFinite(second)
          ? Math.round((first + second) / 2)
          : first;
        if (count >= 1) {
          guestCount = Math.min(100000, count);
          break;
        }
      }
    }
  }

  // 4. Detect Currency & Budget
  let currency: CurrencyCode = 'INR';
  let budgetAmount: number | undefined;

  if (lower.includes('$') || lower.includes('usd') || lower.includes('dollars')) {
    currency = 'USD';
  } else if (lower.includes('€') || lower.includes('eur') || lower.includes('euros')) {
    currency = 'EUR';
  } else if (lower.includes('£') || lower.includes('gbp') || lower.includes('pounds')) {
    currency = 'GBP';
  } else if (lower.includes('aed') || lower.includes('dirham')) {
    currency = 'AED';
  }

  // Parse Indian Lakhs / Crores: e.g. "45 lakhs", "1.5 crore", "₹30,00,000", "50k", "$20,000"
  const lakhMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lakhs|lacs|lac|l)/i);
  const croreMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:crore|crores|cr)/i);
  const kMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:k|thousand)/i);
  const rawNumMatch = text.match(/(?:₹|\$|€|£|aed|rs\.?|budget\s*(?:is|of)?)\s*([\d,]+)/i);

  if (croreMatch) {
    budgetAmount = clampBudget(parseFloat(croreMatch[1]) * 10000000);
  } else if (lakhMatch) {
    budgetAmount = clampBudget(parseFloat(lakhMatch[1]) * 100000);
  } else if (kMatch) {
    budgetAmount = clampBudget(parseFloat(kMatch[1]) * 1000);
  } else if (rawNumMatch) {
    const clean = rawNumMatch[1].replace(/,/g, '');
    const num = parseFloat(clean);
    if (!isNaN(num) && num > 100) {
      budgetAmount = clampBudget(num);
    }
  }

  // 5. Detect Location / City
  let locationCity: string | undefined;
  const commonCities = [
    'Udaipur', 'Jaipur', 'Mumbai', 'Delhi', 'Goa', 'Bengaluru', 'Bangalore', 'Chennai', 'Kolkata',
    'Hyderabad', 'Pune', 'Ahmedabad', 'Chandigarh', 'Kerala', 'Dubai', 'London', 'New York', 'Paris', 'Singapore'
  ];

  for (const city of commonCities) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(text)) {
      locationCity = city;
      break;
    }
  }

  if (!locationCity) {
    const locMatch = text.match(/(?:in|at|around)\s+([A-Z][a-zA-Z\s]{2,15})(?:,|\.|\s+for|\s+with|\s+in|$)/);
    if (locMatch && locMatch[1]) {
      const candidate = locMatch[1].trim();
      if (!['November', 'December', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'Weekend', 'Three'].includes(candidate)) {
        locationCity = candidate;
      }
    }
  }

  // 6. Venue Status
  let venueStatus: VenueStatus = 'searching';
  if (lower.includes('venue booked') || lower.includes('venue confirmed') || lower.includes('secured venue') || lower.includes('resort booked')) {
    venueStatus = 'secured';
  } else if (lower.includes('shortlisting') || lower.includes('looking at 2-3 venues')) {
    venueStatus = 'shortlisting';
  } else if (lower.includes('at home') || lower.includes('private lawn') || lower.includes('our house')) {
    venueStatus = 'home_or_private';
  }

  // 7. Priorities
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

  // 8. Dietary Requirements
  const dietary: string[] = [];
  if (lower.includes('pure veg') || lower.includes('strictly veg') || lower.includes('vegetarian')) dietary.push('Pure Vegetarian');
  if (lower.includes('jain')) dietary.push('Jain (No Root Veg / Onion / Garlic)');
  if (lower.includes('halal')) dietary.push('Halal Certified');
  if (lower.includes('vegan')) dietary.push('Vegan Options');
  if (lower.includes('gluten free') || lower.includes('gluten-free')) dietary.push('Gluten Free');
  if (lower.includes('nut allergy') || lower.includes('peanut')) dietary.push('Nut Allergy Protocol');

  // 9. Accessibility
  const accessibility: string[] = [];
  if (lower.includes('wheelchair') || lower.includes('ramp') || lower.includes('grandparents') || lower.includes('elderly')) {
    accessibility.push('Wheelchair Accessible & Ramp Entrance');
  }
  if (lower.includes('ground floor') || lower.includes('elevator')) {
    accessibility.push('Ground Floor Rooms / Elevator Access');
  }

  // 10. Date parsing
  let startDate: string | undefined;
  const monthNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  const monthRegex = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/i;
  const mMatch = text.match(monthRegex);
  if (mMatch) {
    const monthKey = mMatch[1].toLowerCase();
    const monthNum = monthNames[monthKey] || '11';
    const currentYear = new Date().getFullYear();
    const candidateYear = Number.parseInt(mMatch[2] || `${currentYear}`, 10);
    const isoCandidate = `${candidateYear}-${monthNum}-15`;
    // Without an explicit year, assume the upcoming occurrence of that month.
    startDate = isoCandidate >= new Date().toISOString().split('T')[0]
      ? isoCandidate
      : `${candidateYear + 1}-${monthNum}-15`;
  }

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
