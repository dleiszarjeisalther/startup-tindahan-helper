// src/infrastructure/services/DatabaseBackupService.ts
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as SQLite from 'expo-sqlite';
import { SqliteDatabase } from '../database/SqliteDatabase';

export interface BackupDataPayload {
  app: string;
  formatVersion: number;
  exportedAt: string;
  storeName?: string;
  recordCounts: {
    products: number;
    sales_transactions: number;
    utang_customers: number;
    cash_drawer_adjustments: number;
    stock_movement_logs: number;
    monthly_sales_history: number;
    held_carts: number;
    shrinkage_logs: number;
    store_settings: number;
  };
  data: {
    products: Record<string, unknown>[];
    sales_transactions: Record<string, unknown>[];
    utang_customers: Record<string, unknown>[];
    cash_drawer_adjustments: Record<string, unknown>[];
    stock_movement_logs: Record<string, unknown>[];
    monthly_sales_history: Record<string, unknown>[];
    held_carts: Record<string, unknown>[];
    shrinkage_logs: Record<string, unknown>[];
    store_settings: Record<string, unknown>[];
  };
}

export interface BackupExportResult {
  success: boolean;
  filePath?: string;
  filename?: string;
  recordCounts?: BackupDataPayload['recordCounts'];
  error?: string;
}

export interface BackupRestoreResult {
  success: boolean;
  recordCounts?: BackupDataPayload['recordCounts'];
  error?: string;
}

export class DatabaseBackupService {
  private static instance: DatabaseBackupService | null = null;

  public static getInstance(): DatabaseBackupService {
    if (!DatabaseBackupService.instance) {
      DatabaseBackupService.instance = new DatabaseBackupService();
    }
    return DatabaseBackupService.instance;
  }

  /**
   * Generates a sanitized, structured JSON backup of all core database tables
   * and opens the native share dialog for the user to save it to Drive/storage.
   */
  public async exportBackup(): Promise<BackupExportResult> {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) {
      return { success: false, error: 'Database is not initialized.' };
    }

    try {
      // 1. Read all tables
      const products = db.getAllSync<Record<string, unknown>>('SELECT * FROM products');
      const sales = db.getAllSync<Record<string, unknown>>('SELECT * FROM sales_transactions');
      const utang = db.getAllSync<Record<string, unknown>>('SELECT * FROM utang_customers');
      const adjustments = db.getAllSync<Record<string, unknown>>(
        'SELECT * FROM cash_drawer_adjustments'
      );
      const stockMovements = db.getAllSync<Record<string, unknown>>(
        'SELECT * FROM stock_movement_logs'
      );
      const monthlyHistory = db.getAllSync<Record<string, unknown>>(
        'SELECT * FROM monthly_sales_history'
      );
      const heldCarts = db.getAllSync<Record<string, unknown>>('SELECT * FROM held_carts');
      const shrinkage = db.getAllSync<Record<string, unknown>>('SELECT * FROM shrinkage_logs');
      const settingsRows = db.getAllSync<Record<string, unknown>>('SELECT * FROM store_settings');

      // Sanitize settings: remove any secret fields if present
      const sanitizedSettings = settingsRows.map((s) => {
        const copy = { ...s };
        delete copy.owner_pin_hash;
        delete copy.backup_pin;
        delete copy.secret;
        return copy;
      });

      const recordCounts = {
        products: products.length,
        sales_transactions: sales.length,
        utang_customers: utang.length,
        cash_drawer_adjustments: adjustments.length,
        stock_movement_logs: stockMovements.length,
        monthly_sales_history: monthlyHistory.length,
        held_carts: heldCarts.length,
        shrinkage_logs: shrinkage.length,
        store_settings: sanitizedSettings.length,
      };

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
      const filename = `tindahan_backup_${dateStr}_${timeStr}.json`;
      const filePath = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ''}${filename}`;

      const payload: BackupDataPayload = {
        app: 'Startup Tindahan Helper',
        formatVersion: 1,
        exportedAt: now.toISOString(),
        storeName: (sanitizedSettings[0]?.store_name as string) || "Juan's Store",
        recordCounts,
        data: {
          products,
          sales_transactions: sales,
          utang_customers: utang,
          cash_drawer_adjustments: adjustments,
          stock_movement_logs: stockMovements,
          monthly_sales_history: monthlyHistory,
          held_carts: heldCarts,
          shrinkage_logs: shrinkage,
          store_settings: sanitizedSettings,
        },
      };

      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/json',
          dialogTitle: 'I-save o I-share ang Tindahan Backup',
          UTI: 'public.json',
        });
      }

      return {
        success: true,
        filePath,
        filename,
        recordCounts,
      };
    } catch (err) {
      console.error('[BackupService] Export error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Nabigong i-export ang backup.',
      };
    }
  }

  /**
   * Prompts the user to pick a backup file and safely restores its contents
   * inside an atomic SQLite transaction.
   */
  public async pickAndRestoreBackup(
    onSuccessRehydrate?: () => void
  ): Promise<BackupRestoreResult> {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) {
      return { success: false, error: 'Database is not initialized.' };
    }

    try {
      const pickResult = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (pickResult.canceled || !pickResult.assets || pickResult.assets.length === 0) {
        return { success: false, error: 'Kinansela ang pagpili ng backup file.' };
      }

      const file = pickResult.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return {
          success: false,
          error: 'Hindi mabasa ang file. Siguraduhing valid na JSON backup file ito.',
        };
      }

      // Validate schema
      const payload = parsed as Partial<BackupDataPayload>;
      if (!payload || typeof payload !== 'object' || !payload.data) {
        return {
          success: false,
          error: 'Hindi tugma ang backup file format (walang valid na data payload).',
        };
      }

      if (payload.app !== 'Startup Tindahan Helper') {
        return {
          success: false,
          error: 'Hindi ito galing sa Startup Tindahan Helper na application.',
        };
      }

      const { data } = payload;
      if (!Array.isArray(data.products) || !Array.isArray(data.sales_transactions)) {
        return {
          success: false,
          error: 'Kulang o corrupted ang mahahalagang talaan (paninda o benta) sa backup.',
        };
      }

      // Execute restoration inside an atomic transaction
      db.withTransactionSync(() => {
        // 1. Products
        db.runSync('DELETE FROM products');
        for (const p of data.products) {
          const params: SQLite.SQLiteBindValue[] = [
            String(p.id ?? ''),
            String(p.name ?? ''),
            String(p.category ?? ''),
            String(p.barcode ?? ''),
            String(p.barcode_source ?? 'CAMERA_SCAN'),
            Number(p.base_stock_count ?? 0),
            Number(p.ordinary_low_stock_threshold ?? 5),
            Number(p.unit_cost_php ?? 0),
            typeof p.selling_tiers_json === 'string'
              ? p.selling_tiers_json
              : JSON.stringify(p.selling_tiers_json || []),
            Number(p.quarantine_stock_count ?? 0),
            Number(p.out_of_stock_days ?? 0),
            typeof p.visual_json === 'string' ? p.visual_json : JSON.stringify(p.visual_json || {}),
            p.image_uri ? String(p.image_uri) : null,
            Number(p.default_price_php ?? 0),
            String(p.unit_of_measure ?? 'pc'),
            p.expiry_date ? String(p.expiry_date) : null,
          ];
          db.runSync(
            `INSERT INTO products (
              id, name, category, barcode, barcode_source, base_stock_count,
              ordinary_low_stock_threshold, unit_cost_php, selling_tiers_json,
              quarantine_stock_count, out_of_stock_days, visual_json, image_uri,
              default_price_php, unit_of_measure, expiry_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params
          );
        }

        // 2. Sales Transactions
        db.runSync('DELETE FROM sales_transactions');
        for (const s of data.sales_transactions) {
          const params: SQLite.SQLiteBindValue[] = [
            String(s.id ?? ''),
            String(s.time_label ?? ''),
            String(s.date_label ?? ''),
            Number(s.total_php ?? 0),
            String(s.formatted_total ?? '₱0.00'),
            Number(s.amount_tendered_php ?? 0),
            Number(s.change_due_php ?? 0),
            s.gcash_ref ? String(s.gcash_ref) : null,
            s.payment_reference ? String(s.payment_reference) : null,
            Number(s.convenience_fee_php ?? 0),
            Number(s.refunded_php ?? 0),
            Number(s.item_count ?? 0),
            String(s.tender_type ?? 'CASH'),
            s.customer_name ? String(s.customer_name) : null,
            s.is_one_time_bulk_order ? 1 : 0,
            String(s.status ?? 'COMPLETED'),
            s.void_or_return_note ? String(s.void_or_return_note) : null,
            typeof s.items_json === 'string' ? s.items_json : JSON.stringify(s.items_json || []),
            Number(s.sort_order ?? 0),
            String(s.transaction_type ?? 'SALE'),
          ];
          db.runSync(
            `INSERT INTO sales_transactions (
              id, time_label, date_label, total_php, formatted_total,
              amount_tendered_php, change_due_php, gcash_ref, payment_reference,
              convenience_fee_php, refunded_php, item_count, tender_type,
              customer_name, is_one_time_bulk_order, status, void_or_return_note,
              items_json, sort_order, transaction_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            params
          );
        }

        // 3. Utang Customers
        if (Array.isArray(data.utang_customers)) {
          db.runSync('DELETE FROM utang_customers');
          for (const u of data.utang_customers) {
            const params: SQLite.SQLiteBindValue[] = [
              String(u.id ?? ''),
              String(u.name ?? ''),
              Number(u.balance_php ?? 0),
              Number(u.credit_limit_php ?? 500),
              String(u.last_updated ?? new Date().toISOString()),
            ];
            db.runSync(
              `INSERT INTO utang_customers (id, name, balance_php, credit_limit_php, last_updated)
               VALUES (?, ?, ?, ?, ?)`,
              params
            );
          }
        }

        // 4. Cash Drawer Adjustments
        if (Array.isArray(data.cash_drawer_adjustments)) {
          db.runSync('DELETE FROM cash_drawer_adjustments');
          for (const a of data.cash_drawer_adjustments) {
            const params: SQLite.SQLiteBindValue[] = [
              String(a.id ?? ''),
              String(a.type ?? 'PANUKLI'),
              Number(a.amount_php ?? 0),
              String(a.category ?? 'Panukli'),
              a.note ? String(a.note) : null,
              Number(a.timestamp_ms ?? Date.now()),
              String(a.date_label ?? ''),
              String(a.time_label ?? ''),
            ];
            db.runSync(
              `INSERT INTO cash_drawer_adjustments (
                id, type, amount_php, category, note, timestamp_ms, date_label, time_label
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              params
            );
          }
        }

        // 5. Stock Movement Logs
        if (Array.isArray(data.stock_movement_logs)) {
          db.runSync('DELETE FROM stock_movement_logs');
          for (const m of data.stock_movement_logs) {
            const params: SQLite.SQLiteBindValue[] = [
              String(m.id ?? ''),
              String(m.product_id ?? ''),
              String(m.product_name ?? ''),
              String(m.movement_type ?? 'RESTOCK'),
              Number(m.quantity_delta ?? 0),
              Number(m.previous_stock ?? 0),
              Number(m.resulting_stock ?? 0),
              Number(m.unit_cost_php ?? 0),
              m.reason ? String(m.reason) : null,
              m.reference_id ? String(m.reference_id) : null,
              String(m.created_at ?? new Date().toISOString()),
            ];
            db.runSync(
              `INSERT INTO stock_movement_logs (
                id, product_id, product_name, movement_type, quantity_delta,
                previous_stock, resulting_stock, unit_cost_php, reason, reference_id, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              params
            );
          }
        }

        // 6. Monthly Sales History
        if (Array.isArray(data.monthly_sales_history)) {
          db.runSync('DELETE FROM monthly_sales_history');
          for (const h of data.monthly_sales_history) {
            const params: SQLite.SQLiteBindValue[] = [
              String(h.id ?? ''),
              String(h.product_id ?? ''),
              Number(h.year ?? new Date().getFullYear()),
              Number(h.month ?? new Date().getMonth() + 1),
              Number(h.gross_units_sold ?? 0),
              Number(h.voided_units ?? 0),
              Number(h.returned_changed_mind_units ?? 0),
              Number(h.out_of_stock_days ?? 0),
              Number(h.total_days_in_month ?? 30),
            ];
            db.runSync(
              `INSERT INTO monthly_sales_history (
                id, product_id, year, month, gross_units_sold,
                voided_units, returned_changed_mind_units, out_of_stock_days, total_days_in_month
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              params
            );
          }
        }

        // 7. Store Settings
        if (Array.isArray(data.store_settings) && data.store_settings.length > 0) {
          const s = data.store_settings[0];
          const params: SQLite.SQLiteBindValue[] = [
            String(s.store_name ?? "Juan's Store"),
            String(s.owner_title ?? 'Owner'),
            String(s.address ?? 'Store Address'),
            String(s.language ?? 'Taglish'),
            Number(s.notifications ?? 1),
            Number(s.school_opening_month ?? 7),
            Number(s.wholesale_budget_php ?? 3000),
          ];
          db.runSync(
            `INSERT OR REPLACE INTO store_settings (
              id, store_name, owner_title, address, language,
              notifications, school_opening_month, wholesale_budget_php
            ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
            params
          );
        }
      });

      if (onSuccessRehydrate) {
        onSuccessRehydrate();
      }

      return {
        success: true,
        recordCounts: payload.recordCounts,
      };
    } catch (err) {
      console.error('[BackupService] Restore error:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Nabigong i-restore ang backup file.',
      };
    }
  }
}

export const databaseBackupService = DatabaseBackupService.getInstance();
