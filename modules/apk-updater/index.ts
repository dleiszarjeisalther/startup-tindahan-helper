import { requireOptionalNativeModule } from 'expo-modules-core';
import type { EventSubscription } from 'expo-modules-core';

export interface InstalledApp {
  version: string;
  code: number;
}

export interface DownloadProgressEvent {
  fraction: number;
}

export interface ApkUpdaterNativeModule {
  installed(): Promise<InstalledApp>;
  clean(): Promise<void>;
  download(url: string, hash: string, version: number, size: number): Promise<void>;
  install(hash: string, version: number, size: number): Promise<'permission' | 'installer'>;
  addListener(eventName: 'progress', listener: (event: DownloadProgressEvent) => void): EventSubscription;
  removeListener(eventName: 'progress', listener: (event: DownloadProgressEvent) => void): void;
}

export const ApkUpdater = requireOptionalNativeModule<ApkUpdaterNativeModule>('ApkUpdater');

export default ApkUpdater;
