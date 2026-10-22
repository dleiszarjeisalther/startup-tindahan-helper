import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  ILocalNotificationScheduler,
  LocalNotificationRequest,
} from '../../application/ILocalNotificationScheduler';

const CHANNEL_ID = 'store-alerts';
const SUMMARY_KIND = 'STORE_ALERT_SUMMARY';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class ExpoLocalNotificationScheduler implements ILocalNotificationScheduler {
  private async ensureChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Mga Abiso ng Tindahan',
      description: 'Low stock at overdue utang summaries',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180],
      lightColor: '#0D7A52',
    });
  }

  public async requestPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return false;
    await this.ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === 'granted';
  }

  public async clearSchedule(): Promise<void> {
    if (Platform.OS === 'web') return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const owned = scheduled.filter(
      (item) => item.content.data?.kind === SUMMARY_KIND
    );
    await Promise.all(
      owned.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
    );
  }

  public async replaceSchedule(requests: readonly LocalNotificationRequest[]): Promise<void> {
    if (Platform.OS === 'web') return;
    await this.ensureChannel();
    await this.clearSchedule();
    for (const request of requests) {
      await Notifications.scheduleNotificationAsync({
        identifier: request.id,
        content: {
          title: request.title,
          body: request.body,
          sound: false,
          data: { kind: SUMMARY_KIND, url: request.url },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: request.fireAt,
          channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
        },
      });
    }
  }
}
