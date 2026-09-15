import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ReminderSettings {
  leadDays: number; // how many days before the due date to notify
  hour: number; // 0-23, local device time
  minute: number; // 0-59
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { leadDays: 1, hour: 9, minute: 0 };

const STORAGE_KEY = 'reminderSettings.v1';

export async function getReminderSettings(): Promise<ReminderSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_REMINDER_SETTINGS;
  try {
    return { ...DEFAULT_REMINDER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_REMINDER_SETTINGS;
  }
}

export async function setReminderSettings(settings: ReminderSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
