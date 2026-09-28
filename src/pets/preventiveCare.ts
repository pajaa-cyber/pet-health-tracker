import { CalendarEvent, EventType } from '../types/calendarEvent';

// PetHomeScreen's "Preventive care" quick-log grid — each button is a plain
// CalendarEvent created already status: 'completed' (see eventService.ts's
// createEvent), so this history lives in the existing events collection
// rather than a new one. 'grooming' is reused from the general event-type
// list rather than duplicated as a separate preventive-care-only type.
export const PREVENTIVE_CARE_TYPES: EventType[] = ['teeth', 'bath', 'nails', 'ears', 'grooming', 'deworming', 'fleaTick'];

const DAY_MS = 24 * 60 * 60 * 1000;

// Most recent completed date per preventive-care type, for one pet.
export function lastDoneByType(events: CalendarEvent[], petId: string): Partial<Record<EventType, number>> {
  const result: Partial<Record<EventType, number>> = {};
  for (const e of events) {
    if (e.status !== 'completed') continue;
    if (!PREVENTIVE_CARE_TYPES.includes(e.type)) continue;
    if (!e.petIds.includes(petId)) continue;
    const current = result[e.type];
    if (current == null || e.date > current) {
      result[e.type] = e.date;
    }
  }
  return result;
}

export function formatLastDone(lastDoneMs: number | undefined, now: number): string {
  if (lastDoneMs == null) return 'Not logged yet';
  const days = Math.floor((now - lastDoneMs) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}
