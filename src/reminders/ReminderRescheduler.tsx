import { useEffect, useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { useUpcomingReminders } from './useUpcomingReminders';
import { useNotificationPermission } from './useNotificationPermission';
import { getReminderSettings, ReminderSettings, DEFAULT_REMINDER_SETTINGS } from './settingsStore';
import { rescheduleNotifications } from './notificationScheduler';

// Renders nothing — exists purely to keep local notifications in sync with
// live data. Mounted once at the root (RootNavigator), not inside any one
// tab/screen, so it keeps working regardless of which screen is focused.
export function ReminderRescheduler(): null {
  const { household } = useHousehold();
  const { granted } = useNotificationPermission();
  const [pets, setPets] = useState<Pet[]>([]);
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  useEffect(() => {
    getReminderSettings().then(setSettings);
  }, []);

  const reminders = useUpcomingReminders(pets);

  useEffect(() => {
    if (!granted) return;
    rescheduleNotifications(reminders, settings);
  }, [granted, reminders, settings]);

  return null;
}
