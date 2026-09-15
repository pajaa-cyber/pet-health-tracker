export type EventType = 'medical' | 'grooming' | 'fitness' | 'food' | 'potty' | 'behaviour' | 'symptom' | 'other';
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
