import { useCallback, useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';

export function useNotificationPermission() {
  const [granted, setGranted] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setGranted(status === 'granted');
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const request = useCallback(async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setGranted(status === 'granted');
  }, []);

  return { granted, request };
}
