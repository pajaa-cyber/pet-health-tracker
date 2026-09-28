import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'reminderSnoozes.v1';

// A snooze is scoped to the reminder's due date at the moment it was set,
// not just its id. Reminder ids (`${type}:${sourceId}`) are stable across
// a re-date — a vaccine that gets a new nextDueDate keeps the same id — so
// without recording which due date was actually snoozed, an old snooze
// would silently keep suppressing a reminder that now means a completely
// different date. Storing dueDate lets isSnoozed() self-invalidate a stale
// entry instead of needing a separate pruning pass.
export interface SnoozeEntry {
  untilMs: number;
  dueDate: number;
}

// Map of reminder id (UpcomingReminder.id) -> snooze entry. A snoozed
// reminder is excluded from the visible list and from scheduled
// notifications until `now` passes its snoozedUntil, but only as long as
// its current dueDate still matches the one it was snoozed at.
export async function getSnoozes(): Promise<Record<string, SnoozeEntry>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function snoozeReminder(reminderId: string, untilMs: number, dueDate: number): Promise<void> {
  const current = await getSnoozes();
  current[reminderId] = { untilMs, dueDate };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function isSnoozed(snoozes: Record<string, SnoozeEntry>, reminderId: string, dueDate: number, now: number): boolean {
  const entry = snoozes[reminderId];
  if (!entry || entry.dueDate !== dueDate) return false;
  return entry.untilMs > now;
}
