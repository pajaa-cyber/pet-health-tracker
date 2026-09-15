import * as Notifications from 'expo-notifications';
import { UpcomingReminder } from './computeUpcoming';
import { ReminderSettings } from './settingsStore';
import { computeNotificationTime } from './notificationTiming';

// Cancels every previously scheduled reminder notification and reschedules
// from scratch against the current reminder list — simplest correct way to
// satisfy "recomputed and rescheduled whenever the data changes" without a
// separate diffing/cancellation-tracking mechanism.
export async function rescheduleNotifications(reminders: UpcomingReminder[], settings: ReminderSettings): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  for (const reminder of reminders) {
    const trigger = computeNotificationTime(reminder, settings, now);
    if (trigger == null) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: reminder.petName,
        body: `${reminder.label} is coming up`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
    });
  }
}
