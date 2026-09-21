import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export const REMINDERS_CHANNEL_ID = 'reminders';

// Import this module once, for its side effect, from App.tsx — without a
// handler, expo-notifications delivers a notification while the app is
// foregrounded but does not present it, which would make the device
// verification checklist (trigger a notification a minute out while
// watching the app) look broken even though scheduling itself is fine.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Without a named channel, Android puts every scheduled notification in
// expo-notifications' generic fallback channel, which the user can't find
// or configure individually in system settings (no name, no per-channel
// sound/importance control). android-only: iOS has no channel concept.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}
