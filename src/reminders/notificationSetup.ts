import * as Notifications from 'expo-notifications';

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
