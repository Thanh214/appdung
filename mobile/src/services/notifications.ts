import * as Notifications from 'expo-notifications';
import type { NotificationBehavior } from 'expo-notifications';

// Hiển thị thông báo ngay cả khi app đang mở
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<NotificationBehavior> => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    // SDK 53+: dùng các cờ mới thay cho shouldShowAlert
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function configureNotifications(): Promise<void> {
  // Android cần kênh thông báo
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted ?? false;
}

export async function showAlarmNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: 'default' as any },
    trigger: null,
  });
}


