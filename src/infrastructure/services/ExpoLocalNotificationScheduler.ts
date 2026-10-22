import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import {
  ILocalNotificationScheduler,
  LocalNotificationRequest,
} from '../../application/ILocalNotificationScheduler';

const CHANNEL_ID = 'store-alerts';
const SUMMARY_KIND = 'STORE_ALERT_SUMMARY';

export class ExpoLocalNotificationScheduler implements ILocalNotificationScheduler {
  private handlerConfigured = false;

  private async loadModule(): Promise<typeof import('expo-notifications')> {
    const Notifications = await import('expo-notifications');
    if (!this.handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      this.handlerConfigured = true;
    }
    return Notifications;
  }

  private async ensureChannel(
    Notifications: typeof import('expo-notifications')
  ): Promise<void> {
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
    if (Platform.OS === 'web' || isRunningInExpoGo()) return false;
    const Notifications = await this.loadModule();
    await this.ensureChannel(Notifications);
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.status === 'granted';
  }

  public async clearSchedule(): Promise<void> {
    if (Platform.OS === 'web' || isRunningInExpoGo()) return;
    const Notifications = await this.loadModule();
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
    const Notifications = await this.loadModule();
    await this.ensureChannel(Notifications);
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const owned = scheduled.filter((item) => item.content.data?.kind === SUMMARY_KIND);
    await Promise.all(
      owned.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
    );
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
