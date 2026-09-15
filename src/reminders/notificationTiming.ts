import { UpcomingReminder } from './computeUpcoming';
import { ReminderSettings } from './settingsStore';

const DAY_MS = 24 * 60 * 60 * 1000;

// Returns the epoch millis a local notification should fire at for this
// reminder, or null if it shouldn't be scheduled at all — either it's
// already overdue (nothing to remind "in advance" of; overdue items only
// surface in the in-app list), or the computed trigger time has already
// passed by the time this runs.
export function computeNotificationTime(reminder: UpcomingReminder, settings: ReminderSettings, now: number): number | null {
  if (reminder.overdue) return null;
  const targetDay = new Date(reminder.dueDate - settings.leadDays * DAY_MS);
  const trigger = new Date(
    targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate(),
    settings.hour, settings.minute, 0, 0
  ).getTime();
  return trigger > now ? trigger : null;
}
