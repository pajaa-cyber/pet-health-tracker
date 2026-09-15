import { useEffect, useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { useUpcomingReminders } from './useUpcomingReminders';
import { useNotificationPermission } from './useNotificationPermission';
import { getReminderSettings } from './settingsStore';
import { rescheduleNotifications } from './notificationScheduler';

// Renders nothing — exists purely to keep local notifications in sync with
// live data. Mounted once at the root (RootNavigator), not inside any one
// tab/screen, so it keeps working regardless of which screen is focused.
export function ReminderRescheduler(): null {
  const { household } = useHousehold();
  const { granted } = useNotificationPermission();
  const [pets, setPets] = useState<Pet[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => setPets(activePets(all)));
  }, [household]);

  const reminders = useUpcomingReminders(pets);

  // Settings are fetched fresh here (never cached in state) so that a save
  // from ReminderSettingsScreen — which only writes to AsyncStorage and has
  // no way to notify this already-mounted component — is never overwritten
  // by a stale copy the next time this effect re-fires on unrelated data
  // changes.
  useEffect(() => {
    if (!granted) return;
    getReminderSettings().then((settings) => rescheduleNotifications(reminders, settings));
  }, [granted, reminders]);

  return null;
}
