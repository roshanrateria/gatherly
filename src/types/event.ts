import { CurrencyCode } from './currency';

export type EventType =
  | 'wedding'
  | 'birthday'
  | 'anniversary'
  | 'corporate'
  | 'college_fest'
  | 'community'
  | 'custom';

export type VenueStatus = 'secured' | 'shortlisting' | 'searching' | 'home_or_private';

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
    numberFormat: 'lakhs' | 'international';
  };
  style: string;
  priorities: string[]; // Ordered list of priorities
  requirements: SpecialRequirements;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
