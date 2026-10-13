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

  public loadSettings(defaultSettings: StoreSettingsState): StoreSettingsState {
    this.ensureInitialized();
    const langRaw = this.getString('setting_language', defaultSettings.language);
    const language = langRaw === 'Taglish' ? 'Taglish' : 'English';

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

  public saveSettings(settings: StoreSettingsState): void {
    this.setString('setting_store_name', settings.storeName);
    this.setString('setting_address', settings.address);
    this.setString('setting_language', settings.language);
    this.setBoolean('setting_notifications', settings.notifications);
    this.setNumber('setting_school_month', settings.schoolOpeningMonth);
    this.setNumber('setting_wholesale_budget', settings.wholesaleBudgetPhp);
  }
}

export const appKeyValueStorage = new SynchronousKeyValueStorage();
