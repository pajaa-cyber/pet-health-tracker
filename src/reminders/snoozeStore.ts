import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'reminderSnoozes.v1';

// Map of reminder id (UpcomingReminder.id) -> epoch millis the snooze
// expires. A snoozed reminder is excluded from the visible list and from
// scheduled notifications until `now` passes its snoozedUntil.
export async function getSnoozes(): Promise<Record<string, number>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function snoozeReminder(reminderId: string, untilMs: number): Promise<void> {
  const current = await getSnoozes();
  current[reminderId] = untilMs;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
}

export function isSnoozed(snoozes: Record<string, number>, reminderId: string, now: number): boolean {
  const until = snoozes[reminderId];
  return until != null && until > now;
}
