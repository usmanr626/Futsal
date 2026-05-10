import {
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  requestPermission,
} from '@react-native-firebase/messaging';
import {Alert, PermissionsAndroid, Platform} from 'react-native';

import {supabase} from '../config/supabase';

async function requestAndroidNotificationPermission() {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (Number(Platform.Version) < 33) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );

  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function saveNotificationToken(userId: string, token: string) {
  const {error} = await supabase.from('notification_devices').upsert(
    {
      user_id: userId,
      platform: 'android',
      push_token: token,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    },
    {onConflict: 'user_id,push_token'},
  );

  if (error) {
    throw error;
  }
}

export function setupPushNotifications(userId: string) {
  const messaging = getMessaging();
  let mounted = true;

  async function registerToken() {
    try {
      await requestPermission(messaging);
      const hasAndroidPermission = await requestAndroidNotificationPermission();

      if (!hasAndroidPermission || !mounted) {
        return;
      }

      await registerDeviceForRemoteMessages(messaging);
      const token = await getToken(messaging);

      if (mounted && token) {
        await saveNotificationToken(userId, token);
      }
    } catch {
      // Push should not block the app. We can surface this in a settings screen later.
    }
  }

  registerToken();

  const unsubscribeTokenRefresh = onTokenRefresh(messaging, token => {
    saveNotificationToken(userId, token).catch(() => {});
  });

  const unsubscribeForegroundMessages = onMessage(messaging, message => {
    const title = message.notification?.title;
    const body = message.notification?.body;

    if (title) {
      Alert.alert(title, body);
    }
  });

  return () => {
    mounted = false;
    unsubscribeTokenRefresh();
    unsubscribeForegroundMessages();
  };
}
