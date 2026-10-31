export type GuestGroup =
  | 'family'
  | 'friends'
  | 'colleagues'
  | 'vip'
  | 'bride_side'
  | 'groom_side'
  | 'community'
  | 'general';

export type RsvpStatus = 'attending' | 'declined' | 'tentative' | 'pending';

export type DietaryNeed =
  | 'veg'
  | 'non_veg'
  | 'jain'
  | 'vegan'
  | 'halal'
  | 'kosher'
  | 'gluten_free'
  | 'nut_allergy'
  | 'none';

export type AccessibilityNeed =
  | 'wheelchair'
  | 'ground_floor'
  | 'elderly_assistance'
  | 'child_friendly'
  | 'sign_language'
  | 'none';

export interface Guest {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  group: GuestGroup;
  rsvpStatus: RsvpStatus;
  plusOnes: number;
  dietaryNeeds: DietaryNeed[];
  accessibilityNeeds: AccessibilityNeed[];
  tableNumber?: string;
  notes?: string;
}

export interface GuestSummary {
  totalInvited: number;
  attending: number;
  declined: number;
  tentative: number;
  pending: number;
  totalExpectedAttendance: number; // attending + plus-ones + 50% tentative
  dietaryBreakdown: Record<string, number>;
  accessibilityCount: number;
}
