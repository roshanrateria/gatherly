import { CurrencyCode, NumberFormat } from './currency';

export type EventType =
  | 'wedding'
  | 'birthday'
  | 'anniversary'
  | 'corporate'
  | 'college_fest'
  | 'community'
  | 'custom';

export type VenueStatus = 'secured' | 'shortlisting' | 'searching' | 'home_or_private';

/** Runtime list of every `EventType` value for type-safe coercion of untrusted storage.
 * Mirrors the CURRENCY_CONFIGS codes / VENUE_STATUSES validated-union pattern. */
export const EVENT_TYPES: readonly EventType[] = [
  'wedding',
  'birthday',
  'anniversary',
  'corporate',
  'college_fest',
  'community',
  'custom',
];

export interface SpecialRequirements {
  dietary: string[];
  accessibility: string[];
  culturalTradition?: string;
  customRequests?: string;
  leadTimeMonths?: number;
}

export interface EventDetails {
  id: string;
  title: string;
  type: EventType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  durationDays: number;
  location: {
    city: string;
    venueName?: string;
    venueStatus: VenueStatus;
    country: string;
  };
  guests: {
    count: number;
    bufferPercent: number; // e.g., 10%
    expectedAttendance: number;
  };
  budget: {
    total: number;
    currency: CurrencyCode;
    numberFormat: NumberFormat;
  };
  style: string;
  priorities: string[]; // Ordered list of priorities
  requirements: SpecialRequirements;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
