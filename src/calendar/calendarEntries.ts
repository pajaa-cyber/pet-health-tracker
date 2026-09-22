// PURE MODULE — no imports from @react-native-firebase/*, react, react-native,
// or anything under src/navigation or src/components. Merges Plan 5's
// computeUpcoming() output with hand-entered calendar events into one
// displayable list. `now` is always an explicit parameter — never read
// internally — so every function here stays deterministic and unit-testable.
import { UpcomingReminder, startOfDay } from '../reminders/computeUpcoming';
import { CalendarEvent } from '../types/calendarEvent';

export type CalendarEntrySource = 'reminder' | 'event';

export interface CalendarEntry {
  id: string; // `reminder:${reminder.id}` or `event:${event.id}` — stable across recomputation
  source: CalendarEntrySource;
  petIds: string[];
  label: string;
  date: number; // epoch millis
  overdue: boolean;
  completed: boolean; // events only — a reminder never reports completed, it disappears/advances instead
  skipped: boolean; // events only — a skipped reminder is cleared by reminderActions.ts, not flagged
  reminder: UpcomingReminder | null;
  event: CalendarEvent | null;
}

export function mergeCalendarEntries(reminders: UpcomingReminder[], events: CalendarEvent[], now: number): CalendarEntry[] {
  const reminderEntries: CalendarEntry[] = reminders.map((r) => ({
    id: `reminder:${r.id}`,
    source: 'reminder',
    petIds: [r.petId],
    label: r.label,
    date: r.dueDate,
    overdue: r.overdue,
    completed: false,
    skipped: false,
    reminder: r,
    event: null,
  }));

  const eventEntries: CalendarEntry[] = events.map((e) => ({
    id: `event:${e.id}`,
    source: 'event',
    petIds: e.petIds,
    label: e.title,
    date: e.date,
    // Only an *upcoming* event can be overdue — one already marked done or
    // skipped is resolved, not late. Compared by calendar day, the same
    // lesson Plan 5's on-device verification already paid for once.
    overdue: e.status === 'upcoming' && startOfDay(e.date) < startOfDay(now),
    completed: e.status === 'completed',
    skipped: e.status === 'skipped',
    reminder: null,
    event: e,
  }));

  return [...reminderEntries, ...eventEntries].sort((a, b) => a.date - b.date);
}

// Advances by exactly one calendar day, via Date field arithmetic rather
// than a fixed 24h millisecond offset — DST-safe. A fixed-offset add drifts
// by an hour across a DST transition (lands on the wrong hour, or in the
// fall-back case doesn't even advance the date), which desyncs WeekView/
// MonthView's day cells and entriesForDay's window from real calendar days.
export function addDays(ms: number, n: number): number {
  const d = new Date(startOfDay(ms));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

export function entriesForDay(entries: CalendarEntry[], dayStart: number): CalendarEntry[] {
  const dayEnd = addDays(dayStart, 1);
  return entries.filter((e) => e.date >= dayStart && e.date < dayEnd);
}

export function entriesForPet(entries: CalendarEntry[], petId: string | 'all'): CalendarEntry[] {
  if (petId === 'all') return entries;
  return entries.filter((e) => e.petIds.includes(petId));
}

export function overdueEntries(entries: CalendarEntry[]): CalendarEntry[] {
  return entries.filter((e) => e.overdue);
}

// The distinct calendar days (as startOfDay() timestamps) within
// [rangeStart, rangeEndExclusive) that have at least one entry, mapped to the
// deduped pet ids with an entry that day (first-seen order) — WeekView/
// MonthView use this to render up to one coloured dot per pet, per day cell.
export function daysWithEntries(entries: CalendarEntry[], rangeStart: number, rangeEndExclusive: number): Map<number, string[]> {
  const days = new Map<number, string[]>();
  for (const e of entries) {
    if (e.date < rangeStart || e.date >= rangeEndExclusive) continue;
    const day = startOfDay(e.date);
    const existing = days.get(day) ?? [];
    for (const petId of e.petIds) {
      if (!existing.includes(petId)) existing.push(petId);
    }
    days.set(day, existing);
  }
  return days;
}

export function startOfWeek(date: number): number {
  const d = new Date(startOfDay(date));
  d.setDate(d.getDate() - d.getDay()); // getDay(): 0 = Sunday
  return d.getTime();
}

export function startOfMonth(date: number): number {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
