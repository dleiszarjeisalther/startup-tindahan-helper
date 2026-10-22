// src/infrastructure/storage/KeyValueStorage.ts
import { SqliteDatabase } from '../database/SqliteDatabase';
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
  loadSettings(defaultSettings: StoreSettingsState): StoreSettingsState;
  saveSettings(settings: StoreSettingsState): void;
  loadCategories(defaultCategories: string[]): string[];
  saveCategories(categories: string[]): void;
  getOwnerPinHash(): string | undefined;
  getOwnerPinSalt(): string | undefined;
  setOwnerPin(hash: string, salt: string): void;
  getPinLockoutUntil(): number;
  setPinLockoutUntil(timestamp: number): void;
  getFailedPinAttempts(): number;
  setFailedPinAttempts(count: number): void;
  getOperatingMode(): 'OWNER' | 'CASHIER';
  setOperatingMode(mode: 'OWNER' | 'CASHIER'): void;
  isStoreSecurityEnabled(): boolean;
  setStoreSecurityEnabled(enabled: boolean): void;
  isBiometricsEnabled(): boolean;
  setBiometricsEnabled(enabled: boolean): void;
  getUnlockedUntil(): number;
  setUnlockedUntil(timestamp: number): void;
  isBrownoutSaverActive(): boolean;
  setBrownoutSaverActive(active: boolean): void;
  getGcashConvenienceFee(): number;
  setGcashConvenienceFee(fee: number, enabled: boolean): void;
  isGcashConvenienceFeeEnabled(): boolean;
  getQrPhImageUri(): string | undefined;
  setQrPhImageUri(uri: string): void;
}

/**
 * Fast Synchronous Key-Value Storage (JSI-Powered Hybrid Architecture):
 *
 * Provides instantaneous, synchronous reads and writes without async bridge latency.
 * Backed by modern Expo SQLite JSI synchronous operations (runSync, getFirstSync)
 * and an active in-memory cache for instant zero-latency boot access (Language, Store Settings, Flags).
 *
 * 100% compatible with Expo Go and native builds without missing TurboModule/NitroModule crashes.
 */
class SynchronousKeyValueStorage implements IKeyValueStorage {
  private cache = new Map<string, string | number | boolean>();
  private initialized = false;

  private ensureInitialized(): void {
    if (this.initialized) return;
    this.initialized = true;

    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) return;

    try {
      db.execSync(`
        CREATE TABLE IF NOT EXISTS app_key_values (
          key TEXT PRIMARY KEY NOT NULL,
          value_text TEXT,
          value_num REAL,
          value_bool INTEGER,
          type TEXT NOT NULL
        );
      `);

      const rows = db.getAllSync<{
        key: string;
        value_text: string | null;
        value_num: number | null;
        value_bool: number | null;
        type: string;
      }>('SELECT * FROM app_key_values');

      for (const r of rows) {
        if (r.type === 'string' && r.value_text !== null) {
          this.cache.set(r.key, r.value_text);
        } else if (r.type === 'number' && r.value_num !== null) {
          this.cache.set(r.key, r.value_num);
        } else if (r.type === 'boolean' && r.value_bool !== null) {
          this.cache.set(r.key, r.value_bool === 1);
        }
      }
    } catch (err) {
      console.warn('KeyValueStorage initialization warning:', err);
    }
  }

  public getString(key: string, defaultValue?: string): string | undefined {
    this.ensureInitialized();
    const val = this.cache.get(key);
    return typeof val === 'string' ? val : defaultValue;
  }

  public setString(key: string, value: string): void {
    this.ensureInitialized();
    this.cache.set(key, value);

    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      try {
        db.runSync(
          'INSERT OR REPLACE INTO app_key_values (key, value_text, value_num, value_bool, type) VALUES (?, ?, NULL, NULL, ?)',
          [key, value, 'string']
        );
      } catch (err) {
        console.warn('KeyValueStorage setString error:', err);
      }
    }
  }

  public getNumber(key: string, defaultValue?: number): number | undefined {
    this.ensureInitialized();
    const val = this.cache.get(key);
    return typeof val === 'number' ? val : defaultValue;
  }

  public setNumber(key: string, value: number): void {
    this.ensureInitialized();
    this.cache.set(key, value);

    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      try {
        db.runSync(
          'INSERT OR REPLACE INTO app_key_values (key, value_text, value_num, value_bool, type) VALUES (?, NULL, ?, NULL, ?)',
          [key, value, 'number']
        );
      } catch (err) {
        console.warn('KeyValueStorage setNumber error:', err);
      }
    }
  }

  public getBoolean(key: string, defaultValue?: boolean): boolean | undefined {
    this.ensureInitialized();
    const val = this.cache.get(key);
    return typeof val === 'boolean' ? val : defaultValue;
  }

  public setBoolean(key: string, value: boolean): void {
    this.ensureInitialized();
    this.cache.set(key, value);

    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      try {
        db.runSync(
          'INSERT OR REPLACE INTO app_key_values (key, value_text, value_num, value_bool, type) VALUES (?, NULL, NULL, ?, ?)',
          [key, value ? 1 : 0, 'boolean']
        );
      } catch (err) {
        console.warn('KeyValueStorage setBoolean error:', err);
      }
    }
  }

  public delete(key: string): void {
    this.ensureInitialized();
    this.cache.delete(key);

    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      try {
        db.runSync('DELETE FROM app_key_values WHERE key = ?', [key]);
      } catch (err) {
        console.warn('KeyValueStorage delete error:', err);
      }
    }
  }

  public clearAll(): void {
    this.ensureInitialized();
    this.cache.clear();

    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      try {
        db.runSync('DELETE FROM app_key_values');
      } catch (err) {
        console.warn('KeyValueStorage clearAll error:', err);
      }
    }
  }

  public getStoredLanguage(): string | undefined {
    this.ensureInitialized();
    return this.getString('setting_language');
  }

  public loadSettings(defaultSettings: StoreSettingsState): StoreSettingsState {
    this.ensureInitialized();
    const storedLang = this.getString('setting_language');
    let language = defaultSettings.language;
    if (storedLang === 'Taglish' || storedLang === 'Filipino') {
      language = 'Taglish';
    } else if (storedLang === 'English') {
      language = 'English';
    }

    return {
      storeName: this.getString('setting_store_name', defaultSettings.storeName) || defaultSettings.storeName,
      ownerTitle: 'Owner',
      address: this.getString('setting_address', defaultSettings.address) || defaultSettings.address,
      language,
      notifications: this.getBoolean('setting_notifications', defaultSettings.notifications) ?? defaultSettings.notifications,
      phoneNotifications:
        this.getBoolean('setting_phone_notifications', defaultSettings.phoneNotifications) ??
        defaultSettings.phoneNotifications,
      notificationTimes: (() => {
        const raw = this.getString('setting_notification_times');
        if (!raw) return [...defaultSettings.notificationTimes];
        try {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) && parsed.length > 0
            ? parsed.filter((time) => typeof time === 'string').slice(0, 3)
            : [...defaultSettings.notificationTimes];
        } catch {
          return [...defaultSettings.notificationTimes];
        }
      })(),
      schoolOpeningMonth: this.getNumber('setting_school_month', defaultSettings.schoolOpeningMonth) ?? defaultSettings.schoolOpeningMonth,
      wholesaleBudgetPhp: this.getNumber('setting_wholesale_budget', defaultSettings.wholesaleBudgetPhp) ?? defaultSettings.wholesaleBudgetPhp,
      gcashNumber: this.getString('setting_gcash_number', defaultSettings.gcashNumber) || defaultSettings.gcashNumber,
      gcashAccountName: this.getString('setting_gcash_account_name', defaultSettings.gcashAccountName) || defaultSettings.gcashAccountName,
      gcashQrImageUri: this.getString('setting_gcash_qr_image_uri', defaultSettings.gcashQrImageUri) || defaultSettings.gcashQrImageUri,
      tinNumber: this.getString('setting_tin_number', defaultSettings.tinNumber) || defaultSettings.tinNumber,
    };
  }

  public saveSettings(settings: StoreSettingsState): void {
    this.setString('setting_store_name', settings.storeName);
    this.setString('setting_address', settings.address);
    this.setString('setting_language', settings.language);
    this.setBoolean('setting_notifications', settings.notifications);
    this.setBoolean('setting_phone_notifications', settings.phoneNotifications);
    this.setString('setting_notification_times', JSON.stringify(settings.notificationTimes));
    this.setNumber('setting_school_month', settings.schoolOpeningMonth);
    this.setNumber('setting_wholesale_budget', settings.wholesaleBudgetPhp);
    if (settings.gcashNumber !== undefined) this.setString('setting_gcash_number', settings.gcashNumber);
    if (settings.gcashAccountName !== undefined) this.setString('setting_gcash_account_name', settings.gcashAccountName);
    if (settings.gcashQrImageUri !== undefined) this.setString('setting_gcash_qr_image_uri', settings.gcashQrImageUri);
    if (settings.tinNumber !== undefined) this.setString('setting_tin_number', settings.tinNumber);
  }

  public loadCategories(defaultCategories: string[]): string[] {
    this.ensureInitialized();
    const raw = this.getString('app_categories');
    if (!raw) return [...defaultCategories];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((c) => typeof c === 'string' && c.trim().length > 0);
      }
    } catch {
      // fallback to default
    }
    return [...defaultCategories];
  }

  public saveCategories(categories: string[]): void {
    this.setString('app_categories', JSON.stringify(categories));
  }

  public getOwnerPinHash(): string | undefined {
    this.ensureInitialized();
    return this.getString('store_owner_pin_hash');
  }

  public getOwnerPinSalt(): string | undefined {
    this.ensureInitialized();
    return this.getString('store_owner_pin_salt');
  }

  public setOwnerPin(hash: string, salt: string): void {
    this.setString('store_owner_pin_hash', hash);
    this.setString('store_owner_pin_salt', salt);
    this.setFailedPinAttempts(0);
    this.setPinLockoutUntil(0);
  }

  public getPinLockoutUntil(): number {
    this.ensureInitialized();
    return this.getNumber('store_pin_lockout_until', 0) ?? 0;
  }

  public setPinLockoutUntil(timestamp: number): void {
    this.setNumber('store_pin_lockout_until', timestamp);
  }

  public getFailedPinAttempts(): number {
    this.ensureInitialized();
    return this.getNumber('store_pin_failed_attempts', 0) ?? 0;
  }

  public setFailedPinAttempts(count: number): void {
    this.setNumber('store_pin_failed_attempts', count);
  }

  public getOperatingMode(): 'OWNER' | 'CASHIER' {
    this.ensureInitialized();
    const mode = this.getString('store_active_operating_mode');
    return mode === 'OWNER' ? 'OWNER' : 'CASHIER';
  }

  public setOperatingMode(mode: 'OWNER' | 'CASHIER'): void {
    this.setString('store_active_operating_mode', mode);
  }

  public isStoreSecurityEnabled(): boolean {
    this.ensureInitialized();
    return this.getBoolean('store_security_enabled', false) ?? false;
  }

  public setStoreSecurityEnabled(enabled: boolean): void {
    this.setBoolean('store_security_enabled', enabled);
  }

  public isBiometricsEnabled(): boolean {
    this.ensureInitialized();
    return this.getBoolean('store_biometrics_enabled', true) ?? true;
  }

  public setBiometricsEnabled(enabled: boolean): void {
    this.setBoolean('store_biometrics_enabled', enabled);
  }

  public getUnlockedUntil(): number {
    this.ensureInitialized();
    return this.getNumber('store_unlocked_until', 0) ?? 0;
  }

  public setUnlockedUntil(timestamp: number): void {
    this.setNumber('store_unlocked_until', timestamp);
  }

  public isBrownoutSaverActive(): boolean {
    this.ensureInitialized();
    return this.getBoolean('store_brownout_battery_saver', false) ?? false;
  }

  public setBrownoutSaverActive(active: boolean): void {
    this.setBoolean('store_brownout_battery_saver', active);
  }

  public getGcashConvenienceFee(): number {
    this.ensureInitialized();
    return this.getNumber('store_gcash_fee_php', 2.0) ?? 2.0;
  }

  public setGcashConvenienceFee(fee: number, enabled: boolean): void {
    this.setNumber('store_gcash_fee_php', fee);
    this.setBoolean('store_gcash_fee_enabled', enabled);
  }

  public isGcashConvenienceFeeEnabled(): boolean {
    this.ensureInitialized();
    return this.getBoolean('store_gcash_fee_enabled', false) ?? false;
  }

  public getQrPhImageUri(): string | undefined {
    this.ensureInitialized();
    return this.getString('store_qr_ph_image_uri');
  }

  public setQrPhImageUri(uri: string): void {
    this.setString('store_qr_ph_image_uri', uri);
  }
}

export const appKeyValueStorage = new SynchronousKeyValueStorage();
