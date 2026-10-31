export type ScheduleCategory =
  | 'ceremony'
  | 'meal'
  | 'setup'
  | 'entertainment'
  | 'speech'
  | 'photo_session'
  | 'transition'
  | 'wind_down'
  | 'other';

export interface ScheduleItem {
  id: string;
  dayNumber: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  title: string;
  category: ScheduleCategory;
  location: string;
  owner: string;
  notes?: string;
  requiresBuffer?: boolean;
}

export interface ScheduleConflict {
  id: string;
  type: 'overlap' | 'insufficient_transition' | 'missing_setup' | 'excessive_gap';
  severity: 'critical' | 'warning' | 'info';
  itemIds: string[];
  description: string;
  suggestion: string;
}
