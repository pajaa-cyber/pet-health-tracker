import { UpcomingReminder } from './computeUpcoming';
import { ReminderSettings } from './settingsStore';
import { addDays } from '../calendar/calendarEntries';

// Returns the epoch millis a local notification should fire at for this
// reminder, or null if it shouldn't be scheduled at all — either it's
// already overdue (nothing to remind "in advance" of; overdue items only
// surface in the in-app list), or the computed trigger time has already
// passed by the time this runs.
export function computeNotificationTime(reminder: UpcomingReminder, settings: ReminderSettings, now: number): number | null {
  if (reminder.overdue) return null;
  // addDays() (calendarEntries.ts), not `dueDate - leadDays * DAY_MS` — a
  // raw millisecond subtraction crosses a DST transition at a different
  // offset than the calendar day it's meant to land on, which could pick
  // the wrong calendar day (and therefore fire a day early or late) for a
  // reminder due close to midnight, twice a year. addDays() does the
  // subtraction via setDate() on a local Date, immune to that.
  const targetDay = new Date(addDays(reminder.dueDate, -settings.leadDays));
  const trigger = new Date(
    targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(),
    settings.hour, settings.minute, 0, 0
  ).getTime();
  return trigger > now ? trigger : null;
}
