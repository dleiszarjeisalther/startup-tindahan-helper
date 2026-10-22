export interface LocalNotificationRequest {
  id: string;
  fireAt: Date;
  title: string;
  body: string;
  url: '/notifications';
}

export interface ILocalNotificationScheduler {
  requestPermission(): Promise<boolean>;
  replaceSchedule(requests: readonly LocalNotificationRequest[]): Promise<void>;
  clearSchedule(): Promise<void>;
}
