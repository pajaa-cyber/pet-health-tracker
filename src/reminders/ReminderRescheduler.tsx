import { useEffect, useRef, useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets, activePets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { useUpcomingReminders } from './useUpcomingReminders';
import { useNotificationPermission } from './useNotificationPermission';
import { getReminderSettings } from './settingsStore';
import { getSnoozes, isSnoozed } from './snoozeStore';
import { rescheduleNotifications } from './notificationScheduler';

// Renders nothing — exists purely to keep local notifications in sync with
// live data. Mounted once at the root (RootNavigator), not inside any one
// tab/screen, so it keeps working regardless of which screen is focused.
export function ReminderRescheduler(): null {
  const { household } = useHousehold();
  const { granted } = useNotificationPermission();
  const [pets, setPets] = useState<Pet[]>([]);
  // Distinguishes "haven't heard from Firestore yet" from "household
  // genuinely has zero active pets" — without this, the reschedule effect
  // below would run once with pets:[] before any real data loads and
  // wipe every notification left over from the previous session.
  const [petsLoaded, setPetsLoaded] = useState(false);
  // Bumped on every effect run; a run whose token no longer matches when
  // its async work finishes was superseded by a newer run and must not
  // write — this is what prevents two overlapping runs from interleaving
  // their cancel-all/reschedule calls and leaving stale data scheduled.
  const runToken = useRef(0);
  // Firestore's onSnapshot listeners (one per pet per collection, see
  // useUpcomingReminders) re-announce their current data on every
  // reconnect — most visibly when the app returns to the foreground,
  // which is exactly when someone is checking whether a notification
  // fired. Each announcement gives `pets`/the per-collection state a new
  // object reference even when the content is unchanged, which recomputes
  // `reminders` and re-fires the effect below. Without this guard, that
  // re-fire calls cancelAllScheduledNotificationsAsync() and rebuilds
  // every alarm from scratch for no reason — if it happens to land at or
  // after a reminder's trigger time, the alarm the OS was about to
  // deliver gets cancelled and, since its recomputed trigger is now in
  // the past, never rescheduled. Skipping a cycle whose outcome would be
  // identical to the last one actually scheduled avoids that entirely.
  const lastScheduledKey = useRef<string | null>(null);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, (all) => {
      setPets(activePets(all));
      setPetsLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household?.id]);

  const reminders = useUpcomingReminders(pets);

  // Settings and snoozes are fetched fresh here (never cached in state)
  // so that a save from ReminderSettingsScreen — which only writes to
  // AsyncStorage and has no way to notify this already-mounted component
  // — is never overwritten by a stale copy the next time this effect
  // re-fires on unrelated data changes.
  useEffect(() => {
    if (!granted || !petsLoaded) return;
    const token = ++runToken.current;
    (async () => {
      const [settings, snoozes] = await Promise.all([getReminderSettings(), getSnoozes()]);
      if (token !== runToken.current) return;
      const now = Date.now();
      const visibleReminders = reminders.filter((r) => !isSnoozed(snoozes, r.id, now));
      if (token !== runToken.current) return;
      const key = JSON.stringify({
        settings,
        reminders: visibleReminders.map((r) => `${r.id}:${r.dueDate}`),
      });
      if (key === lastScheduledKey.current) return;
      lastScheduledKey.current = key;
      await rescheduleNotifications(visibleReminders, settings);
    })();
  }, [granted, petsLoaded, reminders]);

  return null;
}
