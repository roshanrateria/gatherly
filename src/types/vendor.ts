export type VendorCategory =
  | 'venue'
  | 'catering'
  | 'decor'
  | 'photography'
  | 'entertainment'
  | 'transport'
  | 'security'
  | 'hair_makeup'
  | 'invitations'
  | 'priest_officiant'
  | 'audio_visual'
  | 'other';

export type BookingStatus =
  | 'researching'
  | 'contacted'
  | 'shortlisted'
  | 'quote_received'
  | 'contract_signed'
  | 'deposit_paid'
  | 'fully_paid'
  | 'declined';

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  contactPerson?: string;
  phone?: string;
  email?: string;
  website?: string;
  location?: string;
  quotedAmount: number;
  agreedCost: number;
  depositPaid: number;
  rating: number; // 1-5
  bookingStatus: BookingStatus;
  contractDate?: string;
  deliverables: string[];
  notes?: string;
  isShortlisted: boolean;
}
