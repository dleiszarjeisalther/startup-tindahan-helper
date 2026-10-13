// src/infrastructure/storage/KeyValueStorage.ts
import { createMMKV, type MMKV } from 'react-native-mmkv';
import { StoreSettingsState } from '../../application/TindahanStoreService';

export interface IKeyValueStorage {
  getString(key: string, defaultValue?: string): string | undefined;
  setString(key: string, value: string): void;
  getNumber(key: string, defaultValue?: number): number | undefined;
  setNumber(key: string, value: number): void;
  getBoolean(key: string, defaultValue?: boolean): boolean | undefined;
  setBoolean(key: string, value: boolean): void;
  delete(key: string): void;
  clearAll(): void;
}

/**
 * Hybrid Production Architecture:
 * react-native-mmkv delivers instant, synchronous JSI-based key-value access
 * for store settings, cashier language preference, notifications, and app flags (~30x faster than AsyncStorage).
 *
 * Includes graceful safe fallback for unit testing / web / restricted environments.
 */
class MmkvKeyValueStorage implements IKeyValueStorage {
  private mmkv: MMKV | null = null;
  private memoryMap = new Map<string, string | number | boolean>();

  constructor() {
    try {
      this.mmkv = createMMKV({
        id: 'tindahan-settings-storage',
      });
    } catch (err) {
      // In web or restricted unit test runners, MMKV JSI native module may be unavailable
      console.warn('MMKV JSI init note: Operating in resilient in-memory mode.', err);
      this.mmkv = null;
    }
  }

  public getString(key: string, defaultValue?: string): string | undefined {
    if (this.mmkv) {
      try {
        const val = this.mmkv.getString(key);
        return val !== undefined ? val : defaultValue;
      } catch {
        // Fallback to memoryMap
      }
    }
    const mem = this.memoryMap.get(key);
    return typeof mem === 'string' ? mem : defaultValue;
  }

  public setString(key: string, value: string): void {
    this.memoryMap.set(key, value);
    if (this.mmkv) {
      try {
        this.mmkv.set(key, value);
      } catch {
        // Safe no-op on native write fail
      }
    }
  }

  public getNumber(key: string, defaultValue?: number): number | undefined {
    if (this.mmkv) {
      try {
        const val = this.mmkv.getNumber(key);
        return Number.isFinite(val) ? val : defaultValue;
      } catch {
        // Fallback to memoryMap
      }
    }
    const mem = this.memoryMap.get(key);
    return typeof mem === 'number' ? mem : defaultValue;
  }

  public setNumber(key: string, value: number): void {
    this.memoryMap.set(key, value);
    if (this.mmkv) {
      try {
        this.mmkv.set(key, value);
      } catch {
        // Safe no-op
      }
    }
  }

  public getBoolean(key: string, defaultValue?: boolean): boolean | undefined {
    if (this.mmkv) {
      try {
        const val = this.mmkv.getBoolean(key);
        return val !== undefined ? val : defaultValue;
      } catch {
        // Fallback to memoryMap
      }
    }
    const mem = this.memoryMap.get(key);
    return typeof mem === 'boolean' ? mem : defaultValue;
  }

  public setBoolean(key: string, value: boolean): void {
    this.memoryMap.set(key, value);
    if (this.mmkv) {
      try {
        this.mmkv.set(key, value);
      } catch {
        // Safe no-op
      }
    }
  }

  public delete(key: string): void {
    this.memoryMap.delete(key);
    if (this.mmkv) {
      try {
        this.mmkv.remove(key);
      } catch {
        // Safe no-op
      }
    }
  }

  public clearAll(): void {
    this.memoryMap.clear();
    if (this.mmkv) {
      try {
        this.mmkv.clearAll();
      } catch {
        // Safe no-op
      }
    }
  }

  /**
   * Helper: Synchronously loads persisted settings directly from MMKV
   */
  public loadSettings(defaultSettings: StoreSettingsState): StoreSettingsState {
    const languageRaw = this.getString('setting_language', defaultSettings.language);
    const language = languageRaw === 'Taglish' ? 'Taglish' : 'English';

    return {
      storeName: this.getString('setting_store_name', defaultSettings.storeName) || defaultSettings.storeName,
      ownerTitle: 'Owner',
      address: this.getString('setting_address', defaultSettings.address) || defaultSettings.address,
      language,
      notifications: this.getBoolean('setting_notifications', defaultSettings.notifications) ?? defaultSettings.notifications,
      schoolOpeningMonth: this.getNumber('setting_school_month', defaultSettings.schoolOpeningMonth) ?? defaultSettings.schoolOpeningMonth,
      wholesaleBudgetPhp: this.getNumber('setting_wholesale_budget', defaultSettings.wholesaleBudgetPhp) ?? defaultSettings.wholesaleBudgetPhp,
    };
  }

  /**
   * Helper: Synchronously persists settings into MMKV JSI
   */
  public saveSettings(settings: StoreSettingsState): void {
    this.setString('setting_store_name', settings.storeName);
    this.setString('setting_address', settings.address);
    this.setString('setting_language', settings.language);
    this.setBoolean('setting_notifications', settings.notifications);
    this.setNumber('setting_school_month', settings.schoolOpeningMonth);
    this.setNumber('setting_wholesale_budget', settings.wholesaleBudgetPhp);
  }
}

export const appKeyValueStorage = new MmkvKeyValueStorage();
