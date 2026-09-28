export type EventType =
  | 'medical' | 'grooming' | 'fitness' | 'food' | 'potty' | 'behaviour' | 'symptom' | 'other'
  // Preventive-care quick-log types (PetHomeScreen's "Preventive care" grid) — each
  // one is a plain CalendarEvent created already status: 'completed', so the
  // existing events collection is the only place this history lives.
  | 'teeth' | 'bath' | 'nails' | 'ears' | 'deworming' | 'fleaTick';
export type EventStatus = 'upcoming' | 'completed' | 'skipped';

export interface CalendarEvent {
  id: string;
  householdId: string;
  petIds: string[]; // one or more — one vet trip covering two pets is a single entry under both
  type: EventType;
  title: string;
  notes: string;
  date: number; // epoch millis
  status: EventStatus;
}
