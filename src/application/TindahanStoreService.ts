// src/application/TindahanStoreService.ts
import { ProductDTO, SellingUnitTier } from '../domain/entities/Product';
import { Money } from '../domain/value-objects/Money';
import { IProductRepository } from '../domain/repositories/IProductRepository';
import {
  AddProductCommand,
  AddProductResult,
  ProductOnboardingService,
} from './ProductOnboardingService';
import { SqliteDatabase } from '../infrastructure/database/SqliteDatabase';
import { MonthlySalesRecord } from '../domain/strategies/SeasonalForecastEngine';
import { appKeyValueStorage } from '../infrastructure/storage/KeyValueStorage';
import {
  PinSecurityEngine,
  PinVerificationOutcome,
} from '../domain/services/PinSecurityEngine';
import { databaseBackupService } from '../infrastructure/services/DatabaseBackupService';
import { StoreAlert, StoreAlertPolicy } from '../domain/services/StoreAlertPolicy';
import {
  ILocalNotificationScheduler,
  LocalNotificationRequest,
} from './ILocalNotificationScheduler';

export interface CartItemDTO {
  cartKey?: string;
  productId: string;
  name: string;
  unit?: 'piece' | 'bundle' | 'pack' | 'box' | 'case';
  unitMultiplier?: number;
  baseUnitsDeducted?: number;
  unitPricePhp: number;
  formattedUnitPrice: string;
  quantity: number;
  lineTotalPhp: number;
  formattedLineTotal: string;
  bundleApplied: boolean;
  unitOfMeasure?: 'pc' | 'kg';
  formattedQuantity?: string;
}

export interface CartSummaryDTO {
  items: CartItemDTO[];
  totalCount: number;
  subtotalPhp: number;
  formattedSubtotal: string;
  discountPhp: number;
  formattedDiscount: string;
  exchangeCreditPhp: number;
  formattedExchangeCredit: string;
  exchangeSourceReceiptId?: string | null;
  totalPhp: number;
  formattedTotal: string;
  hasParkedCart: boolean;
  lastRemovedItem: { productId: string; name: string; qty: number } | null;
}

export type ReturnDisposition = 'SELLABLE' | 'DAMAGED_QUARANTINE';
export type ReturnResolution = 'CASH_REFUND' | 'EXCHANGE_CREDIT' | 'UTANG_DEDUCTION';
export type PaymentTenderType = 'CASH' | 'GCASH' | 'UTANG' | 'SPLIT';

export interface AddToCartResult {
  success: boolean;
  fellBackToPiece?: boolean;
  originalUnit?: string;
  unitAdded: 'piece' | 'bundle' | 'pack' | 'box' | 'case';
  remainingStock: number;
  addedQty: number;
}

export interface SaleLineItemRecord {
  productId: string;
  name: string;
  quantity: number;
  returnedQty: number;
  unitPricePaidPhp: number;
  lineTotalPhp: number;
  unitCostPhp?: number;
  unitOfMeasure?: 'pc' | 'kg';
  formattedQuantity?: string;
}

export type CashAdjustmentType = 'PANUKLI' | 'GASTOS';

export interface DateRangeFilter {
  startMs: number;
  endMs: number;
  label: string;
}

export interface CashDrawerAdjustmentRecord {
  id: string;
  type: CashAdjustmentType;
  amountPhp: number;
  category: string;
  note?: string;
  timestampMs: number;
  dateLabel: string;
  timeLabel: string;
}

export interface TopSellingItemRecord {
  productId: string;
  name: string;
  unitsSold: number;
  revenuePhp: number;
  currentStock: number;
  isOutOfStock: boolean;
  isLowStock: boolean;
}

export interface DaySalesBucket {
  dayLabel: string;
  dateLabel: string;
  totalSalesPhp: number;
  isPeak: boolean;
}

export interface HeldCartRecord {
  id: string;
  customerName: string;
  totalPhp: number;
  totalCount: number;
  items: CartItemDTO[];
  createdAtMs: number;
  timeLabel: string;
}

export interface SaleTransactionRecord {
  id: string;
  timeLabel: string;
  dateLabel: string;
  timestampMs?: number;
  totalPhp: number;
  formattedTotal: string;
  amountTenderedPhp: number;
  changeDuePhp: number;
  gcashRef?: string;
  paymentReference?: string;
  convenienceFeePhp?: number;
  refundedPhp: number;
  itemCount: number;
  tenderType: PaymentTenderType;
  customerName?: string;
  isOneTimeBulkOrder?: boolean;
  status: 'COMPLETED' | 'PARTIAL_RETURN' | 'REFUNDED' | 'VOIDED';
  voidOrReturnNote?: string;
  items: SaleLineItemRecord[];
  transactionType?: 'SALE' | 'UTANG_PAYMENT';
  costPhp?: number;
  tuboPhp?: number;
  profitMarginPercent?: number;
  markupPercent?: number;
}

export interface UtangCustomerRecord {
  id: string;
  name: string;
  balancePhp: number;
  creditLimitPhp: number;
  lastUpdated: string;
  dueDate?: string;
  debtStartedAt?: string;
}

export interface StoreSettingsState {
  storeName: string;
  ownerTitle: 'Owner';
  address: string;
  language: 'English' | 'Taglish' | 'Filipino';
  notifications: boolean;
  phoneNotifications: boolean;
  notificationTimes: string[];
  schoolOpeningMonth: number;
  wholesaleBudgetPhp: number;
  gcashNumber?: string;
  gcashAccountName?: string;
  gcashQrImageUri?: string;
  tinNumber?: string;
}

export const DEFAULT_CATEGORIES: string[] = ['Snacks', 'Beverages', 'Groceries', 'School Supplies'];

export type StockMovementType =
  | 'RESTOCK'
  | 'SALE'
  | 'HOME_USE'
  | 'DAMAGED_EXPIRED'
  | 'UNPACK_TINGI'
  | 'RETURN'
  | 'PRODUCT_ADD'
  | 'PRODUCT_EDIT';

export interface StockMovementRecord {
  id: string;
  productId: string;
  productName: string;
  movementType: StockMovementType;
  quantityDelta: number;
  previousStock: number;
  resultingStock: number;
  unitCostPhp: number;
  reason?: string;
  referenceId?: string;
  createdAt: string;
}

export interface StoreSnapshot {
  revision: number;
  cartRevision: number;
  isSqliteActive: boolean;
  operatingMode: 'OWNER' | 'CASHIER';
  isStoreSecurityEnabled: boolean;
  isStoreLocked: boolean;
  unlockedUntil: number;
  isBrownoutSaverActive: boolean;
  hasOwnerPinSet: boolean;
  pinLockoutUntil: number | null;
  products: ProductDTO[];
  cartSummary: CartSummaryDTO;
  heldCarts: HeldCartRecord[];
  transactions: SaleTransactionRecord[];
  settings: StoreSettingsState;
  utangCustomers: UtangCustomerRecord[];
  categories: string[];
  cashDrawerAdjustments: CashDrawerAdjustmentRecord[];
  stockMovements: StockMovementRecord[];
  activeAlerts: StoreAlert[];
  unreadAlertCount: number;
  notificationPreferences: {
    inAppEnabled: boolean;
    phoneEnabled: boolean;
    dailyTimes: string[];
  };
  notificationScheduleError: string | null;
}

type Listener = () => void;

export class TindahanStoreService {
  private listeners = new Set<Listener>();
  private readonly instanceId = `store_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  private version = 0;
  private cartRevision = 0;
  private snapshot!: StoreSnapshot;
  private isCompletingSale = false;
  private activeAlerts: StoreAlert[] = [];
  private readAlertIds = new Set<string>();
  private notificationScheduleError: string | null = null;
  private notificationSyncSignature = '';

  private cartMap = new Map<string, number>();
  private parkedCartMap: Map<string, number> | null = null;
  private heldCarts: HeldCartRecord[] = [];
  private lastRemovedItem: { productId: string; name: string; qty: number } | null = null;
  private discountPhp = 0;
  private exchangeCreditPhp = 0;
  private exchangeSourceReceiptId: string | null = null;

  private transactions: SaleTransactionRecord[] = [];
  private utangCustomers: UtangCustomerRecord[] = [];
  private monthlyHistoryMap = new Map<string, MonthlySalesRecord[]>();
  private settings: StoreSettingsState = {
    storeName: "Juan's Store",
    ownerTitle: 'Owner',
    address: 'Enter Store Address',
    language: 'English',
    notifications: true,
    phoneNotifications: false,
    notificationTimes: ['07:00'],
    schoolOpeningMonth: 7,
    wholesaleBudgetPhp: 3000,
  };
  private shrinkageLog: {
    id: string;
    productName: string;
    qty: number;
    reason: string;
    timestamp: string;
  }[] = [];
  private categories: string[] = DEFAULT_CATEGORIES;
  private cashDrawerAdjustments: CashDrawerAdjustmentRecord[] = [];
  private stockMovements: StockMovementRecord[] = [];
  private operatingMode: 'OWNER' | 'CASHIER' = 'OWNER';
  private unlockedUntil = appKeyValueStorage.getUnlockedUntil();
  private isBrownoutSaverActive = false;

  constructor(
    private readonly productRepo: IProductRepository,
    public readonly onboardingService: ProductOnboardingService,
    private readonly notificationScheduler?: ILocalNotificationScheduler
  ) {
    this.operatingMode = appKeyValueStorage.getOperatingMode();
    this.isBrownoutSaverActive = appKeyValueStorage.isBrownoutSaverActive();
    try {
      const storedReadIds = JSON.parse(appKeyValueStorage.getString('notification_read_ids', '[]') ?? '[]');
      if (Array.isArray(storedReadIds)) {
        this.readAlertIds = new Set(storedReadIds.filter((id) => typeof id === 'string'));
      }
    } catch {
      this.readAlertIds = new Set();
    }
    this.hydrateAllFromSqlite(true);
    this.refreshAlertState();
    this.snapshot = this.createSnapshot();
    void this.syncNotificationSchedule(true);
    this.trace('initialized');
  }

  public get isSqliteActive(): boolean {
    return SqliteDatabase.getInstance().isPersistentSqliteActive;
  }

  private hydrateAllFromSqlite(replaceCart = false): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) {
      // Do not wipe in-memory collections if SQLite is not open; keep active memory
      return;
    }

    try {
      // 0. Hydrate Products from SQLite
      const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
      if (typeof repo.hydrateFromSqlite === 'function') {
        repo.hydrateFromSqlite();
      }

      // 1. Hydrate Cart. Explicit refreshes treat SQLite as the source of truth,
      // including an empty table after another screen cleared the active sale.
      if (replaceCart || this.cartMap.size === 0) {
        const cartRows = db.getAllSync<{ product_id: string; quantity: number }>(
          'SELECT * FROM cart_items'
        );
        const validProductIds = new Set(this.readProducts().map((p) => p.id));
        const hydratedCart = new Map<string, number>();
        for (const r of cartRows) {
          if (r.quantity > 0) {
            const rawId = r.product_id.includes('__') ? r.product_id.split('__')[0] : r.product_id;
            if (validProductIds.size === 0 || validProductIds.has(rawId)) {
              hydratedCart.set(r.product_id, r.quantity);
            }
          }
        }
        this.cartMap = hydratedCart;
      }

      // 1b. Hydrate Held Carts from SQLite
      try {
        const heldRows = db.getAllSync<{
          id: string;
          customer_name: string;
          total_php: number;
          total_count: number;
          items_json: string;
          created_at_ms: number;
          time_label: string;
        }>('SELECT * FROM held_carts ORDER BY created_at_ms DESC');
        this.heldCarts = heldRows.map((r) => {
          let items: CartItemDTO[] = [];
          try {
            items = JSON.parse(r.items_json);
          } catch {
            items = [];
          }
          return {
            id: r.id,
            customerName: r.customer_name,
            totalPhp: Number(r.total_php) || 0,
            totalCount: Number(r.total_count) || 0,
            items,
            createdAtMs: Number(r.created_at_ms) || Date.now(),
            timeLabel: r.time_label || 'Just now',
          };
        });
      } catch (err) {
        console.warn('Error hydrating held_carts:', err);
      }

      // 2. Hydrate Sales Transactions (No hardcoded seed transactions)
      const txRows = db.getAllSync<{
        id: string;
        time_label: string;
        date_label: string;
        total_php: number;
        formatted_total: string;
        amount_tendered_php: number;
        change_due_php: number;
        gcash_ref: string | null;
        payment_reference?: string | null;
        convenience_fee_php?: number | null;
        refunded_php: number;
        item_count: number;
        tender_type: PaymentTenderType;
        customer_name: string | null;
        is_one_time_bulk_order: number;
        status: SaleTransactionRecord['status'];
        void_or_return_note: string | null;
        items_json: string;
        sort_order: number;
        transaction_type?: 'SALE' | 'UTANG_PAYMENT';
      }>('SELECT * FROM sales_transactions ORDER BY sort_order DESC');

      this.transactions = txRows.map((r) => ({
        id: r.id,
        timeLabel: r.time_label,
        dateLabel: r.date_label,
        timestampMs: r.sort_order || Date.now(),
        totalPhp: r.total_php,
        formattedTotal: r.formatted_total,
        amountTenderedPhp: r.amount_tendered_php,
        changeDuePhp: r.change_due_php,
        gcashRef: r.gcash_ref ?? undefined,
        paymentReference: r.payment_reference ?? r.gcash_ref ?? undefined,
        convenienceFeePhp: Number(r.convenience_fee_php) || 0,
        refundedPhp: r.refunded_php,
        itemCount: r.item_count,
        tenderType: r.tender_type,
        customerName: r.customer_name ?? undefined,
        isOneTimeBulkOrder: r.is_one_time_bulk_order === 1,
        status: r.status,
        voidOrReturnNote: r.void_or_return_note ?? undefined,
        items: JSON.parse(r.items_json),
        transactionType: (r.transaction_type as 'SALE' | 'UTANG_PAYMENT') || 'SALE',
      }));

      // 3. Hydrate Utang Customers (No hardcoded seed customers)
      const custRows = db.getAllSync<{
        id: string;
        name: string;
        balance_php: number;
        credit_limit_php: number;
        last_updated: string;
        due_date: string | null;
        debt_started_at: string | null;
      }>('SELECT * FROM utang_customers ORDER BY rowid DESC');

      this.utangCustomers = custRows.map((c) => ({
        id: c.id,
        name: c.name,
        balancePhp: c.balance_php,
        creditLimitPhp: c.credit_limit_php,
        lastUpdated: c.last_updated,
        dueDate: c.due_date ?? undefined,
        debtStartedAt: c.debt_started_at ?? new Date(0).toISOString(),
      }));

      // 4. Hydrate Store Settings & Categories (Synchronous Key-Value Storage)
      this.categories = appKeyValueStorage.loadCategories(DEFAULT_CATEGORIES);
      const mmkvSettings = appKeyValueStorage.loadSettings(this.settings);
      this.settings = mmkvSettings;

      const settingsRow = db.getFirstSync<{
        store_name: string;
        address: string;
        language: 'English' | 'Taglish' | 'Filipino';
        notifications: number;
        school_opening_month: number;
        wholesale_budget_php: number;
      }>('SELECT * FROM store_settings WHERE id = 1');

      if (settingsRow) {
        const storedLang = appKeyValueStorage.getStoredLanguage();
        const resolvedLanguage: 'English' | 'Taglish' | 'Filipino' =
          (storedLang as 'English' | 'Taglish' | 'Filipino') ||
          (settingsRow.language as 'English' | 'Taglish' | 'Filipino') ||
          'English';

        this.settings = {
          storeName: mmkvSettings.storeName || settingsRow.store_name,
          ownerTitle: 'Owner',
          address: mmkvSettings.address || settingsRow.address,
          language: resolvedLanguage,
          notifications: mmkvSettings.notifications,
          phoneNotifications: mmkvSettings.phoneNotifications,
          notificationTimes: mmkvSettings.notificationTimes,
          schoolOpeningMonth: mmkvSettings.schoolOpeningMonth,
          wholesaleBudgetPhp: mmkvSettings.wholesaleBudgetPhp,
          gcashNumber: mmkvSettings.gcashNumber,
          gcashAccountName: mmkvSettings.gcashAccountName,
          gcashQrImageUri: mmkvSettings.gcashQrImageUri,
          tinNumber: mmkvSettings.tinNumber,
        };
        appKeyValueStorage.saveSettings(this.settings);
      } else {
        this.persistSettingsToSqlite();
      }

      // 5. Hydrate Shrinkage Logs
      const shkRows = db.getAllSync<{
        id: string;
        product_name: string;
        qty: number;
        reason: string;
        timestamp: string;
      }>('SELECT * FROM shrinkage_logs ORDER BY rowid DESC');
      this.shrinkageLog = shkRows.map((s) => ({
        id: s.id,
        productName: s.product_name,
        qty: s.qty,
        reason: s.reason,
        timestamp: s.timestamp,
      }));

      // 6. Hydrate Monthly Sales History for Seasonal Product Forecast
      let histRows = db.getAllSync<{
        id: string;
        product_id: string;
        year: number;
        month: number;
        gross_units_sold: number;
        voided_units: number;
        returned_changed_mind_units: number;
        out_of_stock_days: number;
        total_days_in_month: number;
      }>('SELECT * FROM monthly_sales_history ORDER BY year ASC, month ASC');

      // Auto-backfill monthly_sales_history from past POS sale_items if table is empty
      if (histRows.length === 0) {
        try {
          const itemAggs = db.getAllSync<{
            product_id: string;
            year: number;
            month: number;
            total_qty: number;
          }>(
            `SELECT si.product_id,
                    CAST(strftime('%Y', t.created_at) AS INTEGER) AS year,
                    CAST(strftime('%m', t.created_at) AS INTEGER) AS month,
                    ROUND(SUM(si.quantity), 3) AS total_qty
             FROM sale_items si
             JOIN transactions t ON si.transaction_id = t.id
             WHERE t.is_voided = 0
             GROUP BY si.product_id, year, month`
          );

          for (const agg of itemAggs) {
            if (agg.year && agg.month && agg.total_qty > 0) {
              const rowId = `msh_${agg.product_id}_${agg.year}_${agg.month}`;
              db.runSync(
                `INSERT OR REPLACE INTO monthly_sales_history (
                  id, product_id, year, month, gross_units_sold,
                  voided_units, returned_changed_mind_units, out_of_stock_days, total_days_in_month
                ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 30)`,
                [rowId, agg.product_id, agg.year, agg.month, agg.total_qty]
              );
            }
          }

          if (itemAggs.length > 0) {
            histRows = db.getAllSync<{
              id: string;
              product_id: string;
              year: number;
              month: number;
              gross_units_sold: number;
              voided_units: number;
              returned_changed_mind_units: number;
              out_of_stock_days: number;
              total_days_in_month: number;
            }>('SELECT * FROM monthly_sales_history ORDER BY year ASC, month ASC');
          }
        } catch {
          // Non-fatal if tables do not exist yet on fresh migration
        }
      }

      this.monthlyHistoryMap = new Map();
      for (const h of histRows) {
        const list = this.monthlyHistoryMap.get(h.product_id) ?? [];
        list.push({
          year: h.year,
          month: h.month,
          grossUnitsSold: h.gross_units_sold,
          voidedUnits: h.voided_units,
          returnedChangedMindUnits: h.returned_changed_mind_units,
          outOfStockDays: h.out_of_stock_days,
          totalDaysInMonth: h.total_days_in_month,
        });
        this.monthlyHistoryMap.set(h.product_id, list);
      }

      // 7. Hydrate Cash Drawer Adjustments (Panukli & Gastos)
      try {
        const adjRows = db.getAllSync<{
          id: string;
          type: CashAdjustmentType;
          amount_php: number;
          category: string;
          note: string | null;
          timestamp_ms: number;
          date_label: string;
          time_label: string;
        }>('SELECT * FROM cash_drawer_adjustments ORDER BY timestamp_ms DESC');
        this.cashDrawerAdjustments = adjRows.map((a) => ({
          id: a.id,
          type: a.type,
          amountPhp: a.amount_php,
          category: a.category,
          note: a.note ?? undefined,
          timestampMs: a.timestamp_ms,
          dateLabel: a.date_label,
          timeLabel: a.time_label,
        }));
      } catch {
        this.cashDrawerAdjustments = [];
      }

      // 8. Hydrate Stock Movement Logs
      try {
        let movRows = db.getAllSync<{
          id: string;
          product_id: string;
          product_name: string;
          movement_type: string;
          quantity_delta: number;
          previous_stock: number;
          resulting_stock: number;
          unit_cost_php: number;
          reason: string | null;
          reference_id: string | null;
          created_at: string;
        }>('SELECT * FROM stock_movement_logs ORDER BY created_at DESC, rowid DESC LIMIT 300');

        if (movRows.length === 0) {
          try {
            const pastSales = db.getAllSync<{
              product_id: string;
              product_name: string;
              quantity: number;
              cost_php: number;
              tx_id: string;
              created_at: string;
            }>(`
              SELECT si.product_id,
                     COALESCE(p.name, si.product_id) as product_name,
                     si.quantity,
                     ROUND(si.cost_centavos / 100.0, 2) as cost_php,
                     t.id as tx_id,
                     t.created_at
              FROM sale_items si
              JOIN transactions t ON si.transaction_id = t.id
              LEFT JOIN products p ON si.product_id = p.id
              WHERE t.is_voided = 0
              ORDER BY t.created_at DESC
              LIMIT 150
            `);

            for (const sale of pastSales) {
              const movId = `mov_backfill_${sale.tx_id}_${sale.product_id}`;
              db.runSync(`
                INSERT OR IGNORE INTO stock_movement_logs (
                  id, product_id, product_name, movement_type, quantity_delta,
                  previous_stock, resulting_stock, unit_cost_php, reason, reference_id, created_at
                ) VALUES (?, ?, ?, 'SALE', ?, 0, 0, ?, ?, ?, ?)
              `, [
                movId,
                sale.product_id,
                sale.product_name,
                -sale.quantity,
                sale.cost_php || 0,
                `POS Sale (${sale.tx_id})`,
                sale.tx_id,
                sale.created_at
              ]);
            }

            movRows = db.getAllSync('SELECT * FROM stock_movement_logs ORDER BY created_at DESC, rowid DESC LIMIT 300');
          } catch {
            // Non-fatal if tables do not exist yet on fresh migration
          }
        }

        this.stockMovements = movRows.map((r) => ({
          id: r.id,
          productId: r.product_id,
          productName: r.product_name,
          movementType: (r.movement_type as StockMovementRecord['movementType']) || 'SALE',
          quantityDelta: r.quantity_delta,
          previousStock: r.previous_stock,
          resultingStock: r.resulting_stock,
          unitCostPhp: r.unit_cost_php,
          reason: r.reason ?? undefined,
          referenceId: r.reference_id ?? undefined,
          createdAt: r.created_at,
        }));
      } catch {
        this.stockMovements = [];
      }
    } catch (err) {
      console.warn('Error hydrating store state from SQLite:', err);
    }
  }

  private persistCartItemToSqlite(productIdOrKey: string, quantity: number): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) return;
    if (quantity > 0) {
      db.runSync(
        'INSERT OR REPLACE INTO cart_items (product_id, quantity) VALUES (?, ?)',
        [productIdOrKey, quantity]
      );
    } else {
      db.runSync('DELETE FROM cart_items WHERE product_id = ?', [productIdOrKey]);
    }
    this.trace('cart item persisted', { productIdOrKey, quantity });
  }

  private persistCartToSqlite(cart: ReadonlyMap<string, number> = this.cartMap): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) return;
    db.withTransactionSync(() => {
      db.runSync('DELETE FROM cart_items');
      for (const [productId, qty] of cart.entries()) {
        if (qty > 0) {
          db.runSync('INSERT INTO cart_items (product_id, quantity) VALUES (?, ?)', [
            productId,
            qty,
          ]);
        }
      }
    });
    this.trace('cart persisted', { count: this.countCart(cart) });
  }

  private persistTransactionToSqlite(
    tx: SaleTransactionRecord,
    sortOrder?: number
  ): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) return;
    const finalSortOrder = sortOrder ?? tx.timestampMs ?? Date.now();
    db.runSync(
      `INSERT OR REPLACE INTO sales_transactions (
        id, time_label, date_label, total_php, formatted_total,
        amount_tendered_php, change_due_php, gcash_ref,
        refunded_php, item_count, tender_type, customer_name,
        is_one_time_bulk_order, status, void_or_return_note, items_json, sort_order,
        transaction_type, payment_reference, convenience_fee_php
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        tx.timeLabel,
        tx.dateLabel,
        tx.totalPhp,
        tx.formattedTotal,
        tx.amountTenderedPhp,
        tx.changeDuePhp,
        tx.gcashRef ?? null,
        tx.refundedPhp,
        tx.itemCount,
        tx.tenderType,
        tx.customerName ?? null,
        tx.isOneTimeBulkOrder ? 1 : 0,
        tx.status,
        tx.voidOrReturnNote ?? null,
        JSON.stringify(tx.items),
        finalSortOrder,
        tx.transactionType ?? 'SALE',
        tx.paymentReference ?? tx.gcashRef ?? null,
        tx.convenienceFeePhp ?? 0,
      ]
    );
  }

  private persistCustomerToSqlite(c: UtangCustomerRecord): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) return;
    db.runSync(
      `INSERT OR REPLACE INTO utang_customers
       (id, name, balance_php, credit_limit_php, last_updated, due_date, debt_started_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id,
        c.name,
        c.balancePhp,
        c.creditLimitPhp,
        c.lastUpdated,
        c.dueDate ?? null,
        c.debtStartedAt ?? new Date().toISOString(),
      ]
    );
  }

  private persistSettingsToSqlite(): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) return;
    db.runSync(
      `INSERT OR REPLACE INTO store_settings (
        id, store_name, owner_title, address, language,
        notifications, school_opening_month, wholesale_budget_php
      ) VALUES (1, ?, 'Owner', ?, ?, ?, ?, ?)`,
      [
        this.settings.storeName,
        this.settings.address,
        this.settings.language,
        this.settings.notifications ? 1 : 0,
        this.settings.schoolOpeningMonth,
        this.settings.wholesaleBudgetPhp,
      ]
    );
  }

  public getVersion(): number {
    return this.version;
  }

  public getSnapshot(): StoreSnapshot {
    return this.snapshot;
  }

  private countCart(cart: ReadonlyMap<string, number> = this.cartMap): number {
    let count = 0;
    for (const quantity of cart.values()) count += quantity;
    return count;
  }

  private trace(event: string, details?: Record<string, unknown>): void {
    if (!__DEV__) return;
    console.debug('[TindahanStore]', {
      event,
      instanceId: this.instanceId,
      revision: this.version,
      cartRevision: this.cartRevision,
      cartCount: this.countCart(),
      ...details,
    });
  }

  private createSnapshot(): StoreSnapshot {
    const products = this.readProducts();
    const cartSummary = this.calculateCartSummary(products);
    return Object.freeze({
      revision: this.version,
      cartRevision: this.cartRevision,
      isSqliteActive: this.isSqliteActive,
      operatingMode: this.isStoreUnlocked() ? 'OWNER' : 'CASHIER',
      isStoreSecurityEnabled: appKeyValueStorage.isStoreSecurityEnabled(),
      isStoreLocked: !this.isStoreUnlocked(),
      unlockedUntil: this.unlockedUntil,
      isBrownoutSaverActive: this.isBrownoutSaverActive,
      hasOwnerPinSet: !!appKeyValueStorage.getOwnerPinHash(),
      pinLockoutUntil: appKeyValueStorage.getPinLockoutUntil(),
      products: Object.freeze([...products]) as ProductDTO[],
      cartSummary: Object.freeze({
        ...cartSummary,
        items: Object.freeze([...cartSummary.items]) as CartItemDTO[],
      }),
      heldCarts: Object.freeze(
        this.heldCarts.map((c) => ({
          ...c,
          items: [...c.items],
        }))
      ) as HeldCartRecord[],
      transactions: Object.freeze(this.transactions.map((tx) => ({
        ...tx,
        items: [...tx.items],
      }))) as SaleTransactionRecord[],
      settings: Object.freeze({ ...this.settings }),
      utangCustomers: Object.freeze(this.utangCustomers.map((customer) => ({ ...customer }))) as UtangCustomerRecord[],
      categories: Object.freeze([...this.categories]) as string[],
      cashDrawerAdjustments: Object.freeze(
        this.cashDrawerAdjustments.map((adj) => ({ ...adj }))
      ) as CashDrawerAdjustmentRecord[],
      stockMovements: Object.freeze(
        this.stockMovements.map((mov) => ({ ...mov }))
      ) as StockMovementRecord[],
      activeAlerts: Object.freeze(this.activeAlerts.map((alert) => ({ ...alert }))) as StoreAlert[],
      unreadAlertCount: this.settings.notifications
        ? this.activeAlerts.filter((alert) => !alert.isRead).length
        : 0,
      notificationPreferences: Object.freeze({
        inAppEnabled: this.settings.notifications,
        phoneEnabled: this.settings.phoneNotifications,
        dailyTimes: Object.freeze([...this.settings.notificationTimes]) as string[],
      }),
      notificationScheduleError: this.notificationScheduleError,
    });
  }

  private evaluateAlerts(now = new Date()): StoreAlert[] {
    return StoreAlertPolicy.evaluate({
      now,
      readAlertIds: this.readAlertIds,
      products: this.readProducts().map((product) => ({
        id: product.id,
        name: product.name,
        stockCount: product.stockCount,
        lowStockThreshold: product.ordinaryLowStockThreshold,
      })),
      utangCustomers: this.utangCustomers.map((customer) => ({
        id: customer.id,
        name: customer.name,
        balanceCentavos: Money.fromPhp(customer.balancePhp).centavos,
        dueDate: customer.dueDate,
        debtStartedAt: customer.debtStartedAt ?? new Date(0).toISOString(),
      })),
    });
  }

  private refreshAlertState(): void {
    const nextAlerts = this.evaluateAlerts();
    const activeIds = new Set(nextAlerts.map((alert) => alert.id));
    const prunedReadIds = new Set([...this.readAlertIds].filter((id) => activeIds.has(id)));
    if (prunedReadIds.size !== this.readAlertIds.size) {
      this.readAlertIds = prunedReadIds;
      appKeyValueStorage.setString('notification_read_ids', JSON.stringify([...prunedReadIds]));
    }
    this.activeAlerts = nextAlerts.map((alert) => ({
      ...alert,
      isRead: prunedReadIds.has(alert.id),
    }));
  }

  private buildNotificationRequests(): LocalNotificationRequest[] {
    const requests: LocalNotificationRequest[] = [];
    const now = new Date();
    const times = this.settings.notificationTimes.slice(0, 3);
    for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
      for (const time of times) {
        const [hours, minutes] = time.split(':').map(Number);
        const fireAt = new Date(now);
        fireAt.setDate(now.getDate() + dayOffset);
        fireAt.setHours(hours, minutes, 0, 0);
        if (fireAt.getTime() <= now.getTime()) continue;
        const alerts = this.evaluateAlerts(fireAt);
        if (alerts.length === 0) continue;
        const stockCount = alerts.filter((alert) => alert.kind === 'LOW_STOCK').length;
        const overdue = alerts.filter((alert) => alert.kind === 'OVERDUE_UTANG');
        const total = overdue.reduce(
          (sum, alert) => sum.add(Money.fromCentavos(alert.balanceCentavos ?? 0)),
          Money.zero()
        );
        const parts: string[] = [];
        if (stockCount > 0) parts.push(`${stockCount} produktong kailangang i-restock`);
        if (overdue.length > 0) {
          parts.push(`${overdue.length} overdue na utang (${total.format()})`);
        }
        requests.push({
          id: `store-summary-${fireAt.getTime()}`,
          fireAt,
          title: 'Abiso ng Tindahan',
          body: `May ${parts.join(' at ')}.`,
          url: '/notifications',
        });
      }
    }
    return requests;
  }

  private publishSchedulerStatus(): void {
    this.version++;
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private async syncNotificationSchedule(force = false): Promise<void> {
    if (!this.notificationScheduler) return;
    const signature = JSON.stringify({
      enabled: this.settings.phoneNotifications,
      times: this.settings.notificationTimes,
      products: this.readProducts().map((p) => [p.id, p.stockCount, p.ordinaryLowStockThreshold]),
      debts: this.utangCustomers.map((c) => [c.id, c.balancePhp, c.dueDate, c.debtStartedAt]),
    });
    if (!force && signature === this.notificationSyncSignature) return;
    this.notificationSyncSignature = signature;
    try {
      if (this.settings.phoneNotifications) {
        await this.notificationScheduler.replaceSchedule(this.buildNotificationRequests());
      } else {
        await this.notificationScheduler.clearSchedule();
      }
      if (this.notificationScheduleError) {
        this.notificationScheduleError = null;
        this.publishSchedulerStatus();
      }
    } catch (error) {
      if (!this.settings.phoneNotifications) {
        this.notificationScheduleError = null;
        return;
      }
      this.notificationScheduleError =
        error instanceof Error ? error.message : 'Hindi ma-schedule ang phone notifications.';
      this.publishSchedulerStatus();
    }
  }

  public recordStockMovement(params: {
    productId: string;
    productName: string;
    movementType: StockMovementRecord['movementType'];
    quantityDelta: number;
    previousStock: number;
    resultingStock: number;
    unitCostPhp?: number;
    reason?: string;
    referenceId?: string;
  }): void {
    const db = SqliteDatabase.getInstance().rawDb;
    const nowIso = new Date().toISOString();
    const id = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const record: StockMovementRecord = {
      id,
      productId: params.productId,
      productName: params.productName,
      movementType: params.movementType,
      quantityDelta: params.quantityDelta,
      previousStock: params.previousStock,
      resultingStock: params.resultingStock,
      unitCostPhp: params.unitCostPhp ?? 0,
      reason: params.reason,
      referenceId: params.referenceId,
      createdAt: nowIso,
    };

    this.stockMovements.unshift(record);
    if (this.stockMovements.length > 500) {
      this.stockMovements.pop();
    }

    if (db) {
      try {
        db.runSync(
          `INSERT INTO stock_movement_logs (
            id, product_id, product_name, movement_type, quantity_delta,
            previous_stock, resulting_stock, unit_cost_php, reason, reference_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
          [
            record.id,
            record.productId,
            record.productName,
            record.movementType,
            record.quantityDelta,
            record.previousStock,
            record.resultingStock,
            record.unitCostPhp,
            record.reason ?? null,
            record.referenceId ?? null,
          ]
        );
      } catch (err) {
        console.warn('Failed to insert stock movement log:', err);
      }
    }
  }

  public refreshFromSqlite(): void {
    const previousCart = JSON.stringify([...this.cartMap.entries()]);
    const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
    if (typeof repo.hydrateFromSqlite === 'function') {
      repo.hydrateFromSqlite();
    }
    this.hydrateAllFromSqlite(true);
    if (previousCart !== JSON.stringify([...this.cartMap.entries()])) this.cartRevision++;
    this.notify();
  }

  public clearAllDatabaseData(): void {
    SqliteDatabase.getInstance().clearAllTablesForReset();
    this.cartMap.clear();
    this.parkedCartMap = null;
    this.heldCarts = [];
    this.lastRemovedItem = null;
    this.discountPhp = 0;
    this.exchangeCreditPhp = 0;
    this.exchangeSourceReceiptId = null;
    this.transactions = [];
    this.utangCustomers = [];
    this.monthlyHistoryMap.clear();
    this.cashDrawerAdjustments = [];
    this.stockMovements = [];
    const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
    if (repo.hydrateFromSqlite) {
      repo.hydrateFromSqlite();
    }
    this.hydrateAllFromSqlite(true);
    this.notify();
  }

  /**
   * Safely exports all database records to a structured JSON file and triggers sharing.
   */
  public async exportDatabaseBackup() {
    return databaseBackupService.exportBackup();
  }

  /**
   * Prompts user to pick a valid backup and atomically restores it.
   */
  public async restoreDatabaseBackup() {
    const res = await databaseBackupService.pickAndRestoreBackup(() => {
      const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
      if (repo.hydrateFromSqlite) {
        repo.hydrateFromSqlite();
      }
      this.hydrateAllFromSqlite(true);
      this.version++;
      this.notify();
    });
    return res;
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.version++;
    this.refreshAlertState();
    this.snapshot = this.createSnapshot();
    this.trace('published', { subscribers: this.listeners.size });
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.warn('Store subscriber callback warning:', err);
      }
    });
    void this.syncNotificationSchedule();
  }

  private notifyCartOnly(): void {
    this.version++;
    const cartSummary = this.calculateCartSummary(
      this.snapshot?.products ? this.snapshot.products : this.readProducts()
    );
    this.snapshot = Object.freeze({
      ...this.snapshot,
      revision: this.version,
      cartRevision: this.cartRevision,
      cartSummary: Object.freeze({
        ...cartSummary,
        items: Object.freeze([...cartSummary.items]) as CartItemDTO[],
      }),
    });
    this.trace('published-cart-only', { subscribers: this.listeners.size });
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.warn('Store subscriber callback warning:', err);
      }
    });
  }

  /**
   * Adds a new product directly into the SQLite database and notifies all active screens.
   */
  public async addProductToDatabase(cmd: AddProductCommand): Promise<AddProductResult> {
    const result = await this.onboardingService.registerNewProduct(cmd);
    if (result.status === 'CREATED') {
      const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
      if (repo.hydrateFromSqlite) {
        repo.hydrateFromSqlite();
      }
      this.recordStockMovement({
        productId: result.product.id,
        productName: result.product.name,
        movementType: 'PRODUCT_ADD',
        quantityDelta: cmd.initialStock,
        previousStock: 0,
        resultingStock: cmd.initialStock,
        unitCostPhp: result.product.unitCostPhp,
        reason:
          cmd.initialStock > 0
            ? `Bagong Rehistro (Simulang Stock: ${cmd.initialStock})`
            : 'Bagong Rehistro sa Tindahan',
      });
      this.notify();
    }
    return result;
  }

  /**
   * Queries Open Food Facts for automated product name and photo autofill.
   */
  public async lookupOnlineCatalog(barcode: string) {
    return this.onboardingService.lookupOnlineCatalog(barcode);
  }

  /**
   * Deletes a product from the SQLite database and removes it from any active cart.
   */
  public async deleteProductFromDatabase(productId: string): Promise<void> {
    if (this.isCompletingSale) throw new Error('Sale is currently being completed. Please wait.');
    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      db.withTransactionSync(() => {
        db.runSync('DELETE FROM products WHERE id = ?', [productId]);
        db.runSync('DELETE FROM cart_items WHERE product_id = ? OR product_id LIKE ?', [productId, `${productId}__%`]);
        db.runSync('DELETE FROM monthly_sales_history WHERE product_id = ?', [productId]);
      });
      const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
      repo.hydrateFromSqlite?.();
    } else {
      await this.productRepo.deleteById(productId);
    }
    const nextCart = new Map(this.cartMap);
    for (const k of nextCart.keys()) {
      if (k === productId || k.startsWith(`${productId}__`)) {
        nextCart.delete(k);
      }
    }
    this.cartMap = nextCart;
    this.monthlyHistoryMap.delete(productId);
    this.cartRevision++;
    this.notify();
  }

  /**
   * Updates a product's photo in SQLite and refreshes all screens.
   */
  public async updateProductImage(productId: string, imageUri: string): Promise<void> {
    const all = await this.productRepo.getAll();
    const prod = all.find((p) => p.id === productId);
    if (!prod) return;
    await this.productRepo.save(prod.withImage(imageUri));
    this.notify();
  }

  /**
   * Updates a product's name, price, stock, or threshold in SQLite and refreshes all screens.
   */
  public async updateProductDetails(
    productId: string,
    updates: {
      name?: string;
      category?: string;
      pricePhp?: number;
      unitCostPhp?: number;
      baseStockCount?: number;
      lowStockThreshold?: number;
      unitOfMeasure?: 'pc' | 'kg';
      expiryDate?: string | null;
      sellingTiers?: SellingUnitTier[];
    }
  ): Promise<void> {
    const all = await this.productRepo.getAll();
    const prod = all.find((p) => p.id === productId);
    if (!prod) return;
    const updated = prod.updateDetails(updates);
    await this.productRepo.save(updated);

    const changes: string[] = [];
    if (updates.name && updates.name !== prod.name) changes.push(`Pangalan (${prod.name} ➔ ${updates.name})`);
    if (updates.pricePhp !== undefined && updates.pricePhp !== prod.defaultPricePhp) changes.push(`Presyo (₱${prod.defaultPricePhp} ➔ ₱${updates.pricePhp})`);
    if (updates.unitCostPhp !== undefined && updates.unitCostPhp !== prod.unitCostPhp) changes.push(`Puhunan (₱${prod.unitCostPhp} ➔ ₱${updates.unitCostPhp})`);
    if (updates.baseStockCount !== undefined && updates.baseStockCount !== prod.baseStockCount) changes.push(`Stock (${prod.baseStockCount} ➔ ${updates.baseStockCount})`);
    if (updates.lowStockThreshold !== undefined && updates.lowStockThreshold !== prod.toDTO().ordinaryLowStockThreshold) {
      changes.push(`Threshold (${prod.toDTO().ordinaryLowStockThreshold} ➔ ${updates.lowStockThreshold})`);
    }

    this.recordStockMovement({
      productId: prod.id,
      productName: updates.name || prod.name,
      movementType: 'PRODUCT_EDIT',
      quantityDelta: updates.baseStockCount !== undefined ? updates.baseStockCount - prod.baseStockCount : 0,
      previousStock: prod.baseStockCount,
      resultingStock: updates.baseStockCount ?? prod.baseStockCount,
      unitCostPhp: updates.unitCostPhp ?? prod.unitCostPhp,
      reason: changes.length > 0 ? changes.join('; ') : 'In-update ang mga detalye ng produkto',
    });

    this.notify();
  }

  /**
   * Adds a new category to the store and persists it.
   */
  public addCategory(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (this.categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return;
    this.categories = [...this.categories, trimmed];
    appKeyValueStorage.saveCategories(this.categories);
    this.notify();
  }

  /**
   * Renames an existing category across the store and updates all associated products.
   */
  public async updateCategory(oldName: string, newName: string): Promise<void> {
    const trimmedNew = newName.trim();
    if (!trimmedNew || oldName === trimmedNew) return;

    this.categories = this.categories.map((c) => (c === oldName ? trimmedNew : c));
    appKeyValueStorage.saveCategories(this.categories);

    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      db.runSync('UPDATE products SET category = ? WHERE category = ?', [trimmedNew, oldName]);
      const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
      repo.hydrateFromSqlite?.();
    } else {
      const all = await this.productRepo.getAll();
      for (const prod of all) {
        if (prod.category === oldName) {
          await this.productRepo.save(prod.updateDetails({ category: trimmedNew }));
        }
      }
    }
    this.notify();
  }

  /**
   * Deletes a category and reassigns its products to a fallback category.
   */
  public async deleteCategory(categoryName: string, fallbackCategory?: string): Promise<void> {
    if (this.categories.length <= 1) {
      throw new Error('At least one category must remain.');
    }
    const filtered = this.categories.filter((c) => c !== categoryName);
    const fallback =
      fallbackCategory && filtered.includes(fallbackCategory) ? fallbackCategory : filtered[0];
    this.categories = filtered;
    appKeyValueStorage.saveCategories(this.categories);

    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      db.runSync('UPDATE products SET category = ? WHERE category = ?', [fallback, categoryName]);
      const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
      repo.hydrateFromSqlite?.();
    } else {
      const all = await this.productRepo.getAll();
      for (const prod of all) {
        if (prod.category === categoryName) {
          await this.productRepo.save(prod.updateDetails({ category: fallback }));
        }
      }
    }
    this.notify();
  }

  public getProductsSnapshot(): ProductDTO[] {
    return [...this.snapshot.products];
  }

  private readProducts(): ProductDTO[] {
    return (this.productRepo as { getInitialDTOs?: () => ProductDTO[] }).getInitialDTOs
      ? (this.productRepo as unknown as { getInitialDTOs: () => ProductDTO[] }).getInitialDTOs()
      : [];
  }

  public getCartItems(): CartItemDTO[] {
    return [...this.snapshot.cartSummary.items];
  }

  private calculateCartItems(products: ProductDTO[] = this.readProducts()): CartItemDTO[] {
    const items: CartItemDTO[] = [];
    for (const [cartKey, qty] of this.cartMap.entries()) {
      if (qty <= 0) {
        continue;
      }
      let productId = cartKey;
      let unit: 'piece' | 'bundle' | 'pack' | 'box' | 'case' = 'piece';
      if (cartKey.includes('__')) {
        const parts = cartKey.split('__');
        productId = parts[0];
        unit = (parts[1] as 'piece' | 'bundle' | 'pack' | 'box' | 'case') || 'piece';
      }
      const p = products.find((prod) => prod.id === productId);
      if (!p) {
        continue;
      }
      const tier = p.sellingTiers?.find((t) => t.unitName === unit);
      let unitMultiplier = 1;
      let unitPricePhp = p.defaultPricePhp;

      if (tier && tier.baseUnitMultiplier && tier.baseUnitMultiplier > 0) {
        unitMultiplier = tier.baseUnitMultiplier;
        unitPricePhp = Number(tier.unitPricePhp) > 0 ? Number(tier.unitPricePhp) : p.defaultPricePhp * unitMultiplier;
      } else if (unit === 'pack' || unit === 'bundle') {
        // Auto-computed pack tier for products registered as tingi
        unitMultiplier = 10;
        unitPricePhp = Math.round(p.defaultPricePhp * 10 * 100) / 100;
      }

      const isKg = p.unitOfMeasure === 'kg';
      const totalCentavos = Math.round(unitPricePhp * 100 * qty);
      const lineTotalPhp = totalCentavos / 100;
      const baseUnitsDeducted = Number((qty * unitMultiplier).toFixed(3));
      const formattedQuantity = isKg
        ? `${Number(qty.toFixed(3))} kg`
        : `${Math.floor(qty)} ${unit !== 'piece' ? unit : qty > 1 ? 'pcs' : 'pc'}`;

      items.push({
        cartKey,
        productId: p.id,
        name: p.name,
        unit,
        unitMultiplier,
        baseUnitsDeducted,
        unitPricePhp,
        formattedUnitPrice: Money.fromPhp(unitPricePhp).format(),
        quantity: qty,
        lineTotalPhp,
        formattedLineTotal: Money.fromCentavos(totalCentavos).format(),
        bundleApplied: false,
        unitOfMeasure: p.unitOfMeasure ?? 'pc',
        formattedQuantity,
      });
    }

    return items;
  }

  public getCartSummary(): CartSummaryDTO {
    return this.snapshot.cartSummary;
  }

  private calculateCartSummary(products: ProductDTO[] = this.readProducts()): CartSummaryDTO {
    const items = this.calculateCartItems(products);
    const totalCount = items.reduce(
      (sum, i) => sum + (i.unitOfMeasure === 'kg' ? (i.quantity > 0 ? 1 : 0) : i.quantity),
      0
    );
    const subtotalPhp = items.reduce((sum, i) => sum + i.lineTotalPhp, 0);
    const netTotalPhp = Math.max(0, subtotalPhp - this.discountPhp - this.exchangeCreditPhp);

    return {
      items,
      totalCount,
      subtotalPhp,
      formattedSubtotal: Money.fromPhp(subtotalPhp).format(),
      discountPhp: this.discountPhp,
      formattedDiscount: Money.fromPhp(this.discountPhp).format(),
      exchangeCreditPhp: this.exchangeCreditPhp,
      formattedExchangeCredit: Money.fromPhp(this.exchangeCreditPhp).format(),
      exchangeSourceReceiptId: this.exchangeSourceReceiptId,
      totalPhp: netTotalPhp,
      formattedTotal: Money.fromPhp(netTotalPhp).format(),
      hasParkedCart: this.heldCarts.length > 0 || (this.parkedCartMap !== null && this.parkedCartMap.size > 0),
      lastRemovedItem: this.lastRemovedItem,
    };
  }

  public addToCart(
    productIdOrKey: string,
    deltaQty = 1,
    unit: 'piece' | 'bundle' | 'pack' | 'box' | 'case' = 'piece'
  ): AddToCartResult {
    if (this.isCompletingSale) {
      throw new Error('Sale is currently being completed. Please wait.');
    }

    let productId = productIdOrKey;
    let selectedUnit = unit;
    if (productIdOrKey.includes('__')) {
      const parts = productIdOrKey.split('__');
      productId = parts[0];
      selectedUnit = (parts[1] as 'piece' | 'bundle' | 'pack' | 'box' | 'case') || unit;
    }

    const prod = this.snapshot?.products?.find((p) => p.id === productId);
    if (!prod) {
      throw new Error('Product not found in catalog.');
    }

    let tier = prod.sellingTiers?.find((t) => t.unitName === selectedUnit);
    let unitMultiplier = 1;
    if (tier?.baseUnitMultiplier && tier.baseUnitMultiplier > 0) {
      unitMultiplier = tier.baseUnitMultiplier;
    } else if (selectedUnit === 'pack' || selectedUnit === 'bundle') {
      unitMultiplier = 10;
    }

    const isKg = prod.unitOfMeasure === 'kg';
    let cartKey = selectedUnit === 'piece' ? productId : `${productId}__${selectedUnit}`;
    const nextCart = new Map(this.cartMap);
    let current = this.cartMap.get(cartKey) ?? 0;
    let rawNext = current + deltaQty;
    let next = isKg
      ? Math.max(0, Math.round(rawNext * 1000) / 1000)
      : Math.max(0, Math.floor(rawNext));

    let fellBackToPiece = false;
    const originalUnit = selectedUnit;
    let finalAddedQty = deltaQty;

    // Calculate total base units that would be occupied by this product in the cart
    if (deltaQty > 0) {
      if (prod.stockCount <= 0) {
        throw new Error(`Out of Stock — ${prod.name} is currently unavailable.`);
      }

      // Calculate how many base units other cart items of this product occupy
      let otherBaseUnits = 0;
      for (const [k, q] of this.cartMap.entries()) {
        let kProdId = k;
        let kUnit = 'piece';
        if (k.includes('__')) {
          const parts = k.split('__');
          kProdId = parts[0];
          kUnit = parts[1];
        }
        if (kProdId === productId && k !== cartKey) {
          const kTier = prod.sellingTiers?.find((t) => t.unitName === kUnit);
          const kMultiplier =
            kTier?.baseUnitMultiplier && kTier.baseUnitMultiplier > 0
              ? kTier.baseUnitMultiplier
              : (kUnit === 'pack' || kUnit === 'bundle') ? 10 : 1;
          otherBaseUnits += q * kMultiplier;
        }
      }

      const availableForThisKey = Math.max(0, prod.stockCount - otherBaseUnits);
      const neededBaseUnits = next * unitMultiplier;

      if (neededBaseUnits > availableForThisKey) {
        // Insufficient stock for the requested unit tier
        if (selectedUnit !== 'piece') {
          // AUTO-FALLBACK: If pack/box/bundle cannot be fulfilled, check if we can add as 'piece'
          const currentTotalUsed = otherBaseUnits + current * unitMultiplier;
          const remainingBaseUnits = Math.max(0, prod.stockCount - currentTotalUsed);

          if (remainingBaseUnits >= 1) {
            // Auto fallback to piece
            fellBackToPiece = true;
            selectedUnit = 'piece';
            tier = prod.sellingTiers?.find((t) => t.unitName === 'piece');
            unitMultiplier = 1;
            cartKey = productId;

            const currentPiece = this.cartMap.get(cartKey) ?? 0;
            const pieceAddQty = Math.min(Math.max(1, deltaQty), remainingBaseUnits);
            finalAddedQty = pieceAddQty;
            current = currentPiece;
            rawNext = currentPiece + pieceAddQty;
            next = isKg
              ? Math.max(0, Math.round(rawNext * 1000) / 1000)
              : Math.max(0, Math.floor(rawNext));
          } else {
            throw new Error(`Insufficient Stock — Only ${prod.formattedStock} available.`);
          }
        } else {
          throw new Error(`Insufficient Stock — Only ${prod.formattedStock} available.`);
        }
      }
    }

    let nextLastRemoved = this.lastRemovedItem;
    if (next === 0) {
      if (prod && current > 0) {
        nextLastRemoved = { productId: cartKey, name: prod.name, qty: current };
      }
      nextCart.delete(cartKey);
    } else {
      nextCart.set(cartKey, next);
      nextLastRemoved = null;
    }
    this.persistCartItemToSqlite(cartKey, next);
    this.cartMap = nextCart;
    this.lastRemovedItem = nextLastRemoved;
    this.cartRevision++;
    this.notifyCartOnly();

    return {
      success: true,
      fellBackToPiece,
      originalUnit,
      unitAdded: selectedUnit,
      remainingStock: prod.stockCount,
      addedQty: finalAddedQty,
    };
  }

  /**
   * Sets the explicit quantity for an item in the cart.
   */
  public setCartItemQuantity(
    productIdOrKey: string,
    quantity: number,
    unit: 'piece' | 'bundle' | 'pack' | 'box' | 'case' = 'piece'
  ): void {
    if (this.isCompletingSale) {
      throw new Error('Sale is currently being completed. Please wait.');
    }

    let productId = productIdOrKey;
    let selectedUnit = unit;
    if (productIdOrKey.includes('__')) {
      const parts = productIdOrKey.split('__');
      productId = parts[0];
      selectedUnit = (parts[1] as 'piece' | 'bundle' | 'pack' | 'box' | 'case') || unit;
    }

    const prod = this.snapshot?.products?.find((p) => p.id === productId);
    if (!prod) {
      throw new Error('Product not found in catalog.');
    }

    const tier = prod.sellingTiers?.find((t) => t.unitName === selectedUnit);
    let unitMultiplier = 1;
    if (tier?.baseUnitMultiplier && tier.baseUnitMultiplier > 0) {
      unitMultiplier = tier.baseUnitMultiplier;
    } else if (selectedUnit === 'pack' || selectedUnit === 'bundle') {
      unitMultiplier = 10;
    }

    const isKg = prod.unitOfMeasure === 'kg';
    const targetQty = isKg
      ? Math.max(0, Math.round((Number.isFinite(quantity) ? quantity : 0) * 1000) / 1000)
      : Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));

    const cartKey = selectedUnit === 'piece' ? productId : `${productId}__${selectedUnit}`;

    if (targetQty > 0) {
      let totalBaseUnits = 0;
      for (const [k, q] of this.cartMap.entries()) {
        let kProdId = k;
        let kUnit = 'piece';
        if (k.includes('__')) {
          const parts = k.split('__');
          kProdId = parts[0];
          kUnit = parts[1];
        }
        if (kProdId === productId) {
          if (k === cartKey) {
            totalBaseUnits += targetQty * unitMultiplier;
          } else {
            const kTier = prod.sellingTiers?.find((t) => t.unitName === kUnit);
            const kMultiplier =
              kTier?.baseUnitMultiplier && kTier.baseUnitMultiplier > 0
                ? kTier.baseUnitMultiplier
                : (kUnit === 'pack' || kUnit === 'bundle') ? 10 : 1;
            totalBaseUnits += q * kMultiplier;
          }
        }
      }
      if (!this.cartMap.has(cartKey)) {
        totalBaseUnits += targetQty * unitMultiplier;
      }

      if (totalBaseUnits > prod.stockCount) {
        throw new Error(`Insufficient Stock — Only ${prod.formattedStock} available.`);
      }
    }

    const nextCart = new Map(this.cartMap);
    const current = this.cartMap.get(cartKey) ?? 0;
    let nextLastRemoved = this.lastRemovedItem;

    if (targetQty === 0) {
      if (prod && current > 0) {
        nextLastRemoved = { productId: cartKey, name: prod.name, qty: current };
      }
      nextCart.delete(cartKey);
    } else {
      nextCart.set(cartKey, targetQty);
      nextLastRemoved = null;
    }

    this.persistCartItemToSqlite(cartKey, targetQty);
    this.cartMap = nextCart;
    this.lastRemovedItem = nextLastRemoved;
    this.cartRevision++;
    this.notifyCartOnly();
  }

  public undoRemoveCartItem(): void {
    if (!this.lastRemovedItem) return;
    if (this.isCompletingSale) throw new Error('Sale is currently being completed. Please wait.');
    const nextCart = new Map(this.cartMap);
    nextCart.set(this.lastRemovedItem.productId, this.lastRemovedItem.qty);
    this.persistCartItemToSqlite(this.lastRemovedItem.productId, this.lastRemovedItem.qty);
    this.cartMap = nextCart;
    this.lastRemovedItem = null;
    this.cartRevision++;
    this.notifyCartOnly();
  }

  public setDiscountPhp(discount: number): void {
    this.discountPhp = Math.max(0, Number.isFinite(discount) ? discount : 0);
    this.notify();
  }

  public clearCart(): void {
    if (this.isCompletingSale) throw new Error('Sale is currently being completed. Please wait.');
    const nextCart = new Map<string, number>();
    this.persistCartToSqlite(nextCart);
    this.cartMap = nextCart;
    this.discountPhp = 0;
    this.exchangeCreditPhp = 0;
    this.exchangeSourceReceiptId = null;
    this.lastRemovedItem = null;
    this.cartRevision++;
    this.notifyCartOnly();
  }

  public cancelExchangeCredit(options?: { undoReceiptReturn?: boolean }): void {
    if (this.isCompletingSale) throw new Error('Sale is currently being completed. Please wait.');
    const currentCredit = this.exchangeCreditPhp;
    const sourceReceiptId = this.exchangeSourceReceiptId;

    if (options?.undoReceiptReturn && sourceReceiptId) {
      const tx = this.transactions.find((t) => t.id === sourceReceiptId);
      if (tx && tx.status !== 'VOIDED') {
        tx.refundedPhp = Math.max(0, tx.refundedPhp - currentCredit);
        const allItemsReturned = tx.items.every((i) => i.returnedQty >= i.quantity);
        const someItemsReturned = tx.items.some((i) => i.returnedQty > 0);
        tx.status = allItemsReturned ? 'REFUNDED' : someItemsReturned ? 'PARTIAL_RETURN' : 'COMPLETED';
        this.persistTransactionToSqlite(tx);
      }
    }

    this.exchangeCreditPhp = 0;
    this.exchangeSourceReceiptId = null;
    this.cartRevision++;
    this.notifyCartOnly();
  }

  public parkCurrentCart(customerName?: string): HeldCartRecord | null {
    if (this.cartMap.size === 0) return null;
    if (this.isCompletingSale) throw new Error('Sale is currently being completed. Please wait.');

    const products = this.readProducts();
    const currentSummary = this.calculateCartSummary(products);
    const now = new Date();
    const hours = now.getHours();
    const mins = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hr12 = hours % 12 || 12;
    const timeLabel = `${hr12}:${mins} ${ampm}`;
    const name = customerName?.trim() || `Customer #${this.heldCarts.length + 1}`;

    const heldCart: HeldCartRecord = {
      id: `HELD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      customerName: name,
      totalPhp: currentSummary.totalPhp,
      totalCount: currentSummary.totalCount,
      items: currentSummary.items.map((i) => ({ ...i })),
      createdAtMs: now.getTime(),
      timeLabel,
    };

    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      db.runSync(
        `INSERT INTO held_carts (id, customer_name, total_php, total_count, items_json, created_at_ms, time_label)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          heldCart.id,
          heldCart.customerName,
          heldCart.totalPhp,
          heldCart.totalCount,
          JSON.stringify(heldCart.items),
          heldCart.createdAtMs,
          heldCart.timeLabel,
        ]
      );
    }

    this.heldCarts.unshift(heldCart);
    this.parkedCartMap = null;
    this.cartMap.clear();
    this.persistCartToSqlite(new Map());
    this.discountPhp = 0;
    this.exchangeCreditPhp = 0;
    this.exchangeSourceReceiptId = null;
    this.lastRemovedItem = null;
    this.cartRevision++;
    this.notify();
    return heldCart;
  }

  public restoreHeldCart(heldCartId: string): void {
    if (this.isCompletingSale) throw new Error('Sale is currently being completed. Please wait.');
    const idx = this.heldCarts.findIndex((c) => c.id === heldCartId);
    if (idx === -1) return;

    const [target] = this.heldCarts.splice(idx, 1);
    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      try {
        db.runSync('DELETE FROM held_carts WHERE id = ?', [heldCartId]);
      } catch (err) {
        console.warn('Failed to delete restored held_cart from SQLite:', err);
      }
    }

    const nextCart = new Map<string, number>();
    for (const item of target.items) {
      nextCart.set(item.productId, (nextCart.get(item.productId) ?? 0) + item.quantity);
    }
    this.persistCartToSqlite(nextCart);
    this.cartMap = nextCart;
    this.discountPhp = 0;
    this.cartRevision++;
    this.notify();
  }

  public deleteHeldCart(heldCartId: string): void {
    if (this.isCompletingSale) throw new Error('Sale is currently being completed. Please wait.');
    const idx = this.heldCarts.findIndex((c) => c.id === heldCartId);
    if (idx === -1) return;

    this.heldCarts.splice(idx, 1);
    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      try {
        db.runSync('DELETE FROM held_carts WHERE id = ?', [heldCartId]);
      } catch (err) {
        console.warn('Failed to delete held_cart from SQLite:', err);
      }
    }
    this.cartRevision++;
    this.notify();
  }

  public restoreParkedCart(): void {
    if (this.isCompletingSale) throw new Error('Sale is currently being completed. Please wait.');
    if (this.heldCarts.length > 0) {
      this.restoreHeldCart(this.heldCarts[0].id);
      return;
    }
    if (!this.parkedCartMap) return;
    const nextCart = new Map(this.parkedCartMap);
    this.persistCartToSqlite(nextCart);
    this.cartMap = nextCart;
    this.parkedCartMap = null;
    this.cartRevision++;
    this.notify();
  }

  public async completeSale(options: {
    tenderType: PaymentTenderType;
    amountTenderedPhp: number;
    expectedCartRevision: number;
    gcashRef?: string;
    paymentReference?: string;
    convenienceFeePhp?: number;
    customerName?: string;
    chargeShortfallToUtang?: boolean;
    isOneTimeBulkOrder?: boolean;
  }): Promise<SaleTransactionRecord> {
    if (this.isCompletingSale) throw new Error('This sale is already being completed.');
    if (options.expectedCartRevision !== this.cartRevision) {
      throw new Error('The cart changed before payment was saved. Please review the current cart and try again.');
    }
    const summary = this.snapshot.cartSummary;
    if (summary.items.length === 0) {
      throw new Error('This sale was already cleared. Add an item before completing payment.');
    }

    const { tenderType, amountTenderedPhp } = options;

    // POS-07B Underpayment Guard: Validate User-Input Payment Amount
    if (
      (tenderType === 'CASH' || tenderType === 'GCASH') &&
      amountTenderedPhp < summary.totalPhp &&
      !options.chargeShortfallToUtang
    ) {
      const deficit = summary.totalPhp - amountTenderedPhp;
      throw new Error(
        `Payment amount (₱${amountTenderedPhp.toFixed(
          2
        )}) is less than Total Due (${summary.formattedTotal}). Short by ₱${deficit.toFixed(
          2
        )}. Please input full payment or select Utang.`
      );
    }

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    const shortfallPhp = Math.max(0, summary.totalPhp - amountTenderedPhp);
    const utangAmountToRecord =
      tenderType === 'UTANG'
        ? summary.totalPhp
        : options.chargeShortfallToUtang
        ? shortfallPhp
        : 0;

    const changeDuePhp =
      tenderType === 'CASH' && amountTenderedPhp > summary.totalPhp
        ? Number((amountTenderedPhp - summary.totalPhp).toFixed(2))
        : 0;

    const hours = now.getHours();
    const mins = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hr12 = String(hours % 12 || 12).padStart(2, '0');
    const dateLabel = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const txTime = now.getTime();
    let txCostAccum = 0;
    const saleItems = summary.items.map((i) => {
      const prod = this.snapshot.products.find((p) => p.id === i.productId);
      const unitPrice = i.quantity > 0 ? Number((i.lineTotalPhp / i.quantity).toFixed(2)) : 0;
      let unitCost = prod ? prod.unitCostPhp : 0;
      // Guard against wholesale/pack cost mistakenly entered as unit cost:
      // If recorded unit cost is >= retail unit price, fall back to Auto 75% rule
      if (unitPrice > 0 && (unitCost <= 0 || unitCost >= unitPrice)) {
        unitCost = Number(Math.max(0.5, unitPrice * 0.75).toFixed(2));
      }
      txCostAccum += unitCost * i.quantity;
      return {
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        returnedQty: 0,
        unitPricePaidPhp: unitPrice,
        lineTotalPhp: i.lineTotalPhp,
        unitCostPhp: unitCost,
        unitOfMeasure: i.unitOfMeasure,
        formattedQuantity: i.formattedQuantity,
      };
    });
    const txCostPhp = Number(txCostAccum.toFixed(2));
    const txTuboPhp = Number(Math.max(0, summary.totalPhp - txCostPhp).toFixed(2));
    const txMarginPercent =
      summary.totalPhp > 0
        ? Number(((txTuboPhp / summary.totalPhp) * 100).toFixed(1))
        : 0;
    const txMarkupPercent =
      txCostPhp > 0 ? Number(((txTuboPhp / txCostPhp) * 100).toFixed(1)) : 0;

    const newTx: SaleTransactionRecord = {
      id: `OR-${curYear}-${String(1 + this.transactions.length).padStart(4, '0')}`,
      timeLabel: `${hr12}:${mins} ${ampm}`,
      dateLabel,
      timestampMs: txTime,
      totalPhp: summary.totalPhp,
      formattedTotal: summary.formattedTotal,
      amountTenderedPhp,
      changeDuePhp,
      gcashRef: options.gcashRef ?? options.paymentReference,
      paymentReference: options.paymentReference ?? options.gcashRef,
      convenienceFeePhp: options.convenienceFeePhp ?? 0,
      refundedPhp: 0,
      itemCount: summary.totalCount,
      tenderType: options.chargeShortfallToUtang && shortfallPhp > 0 ? 'SPLIT' : tenderType,
      customerName: options.customerName?.trim() || undefined,
      isOneTimeBulkOrder: options.isOneTimeBulkOrder,
      status: 'COMPLETED',
      transactionType: 'SALE',
      voidOrReturnNote: this.exchangeSourceReceiptId
        ? `Exchange applied from ${this.exchangeSourceReceiptId}`
        : undefined,
      items: saleItems,
      costPhp: txCostPhp,
      tuboPhp: txTuboPhp,
      profitMarginPercent: txMarginPercent,
      markupPercent: txMarkupPercent,
    };

    const db = SqliteDatabase.getInstance().rawDb;
    this.isCompletingSale = true;
    this.trace('complete sale started', { expectedCartRevision: options.expectedCartRevision });
    try {
      if (db) {
        db.withTransactionSync(() => {
          // Group required base units by productId across all cart lines
          const requiredBaseMap = new Map<
            string,
            { name: string; totalBaseUnits: number; unitCostPhp: number }
          >();
          for (const item of summary.items) {
            const mult = item.unitMultiplier && item.unitMultiplier > 0 ? item.unitMultiplier : 1;
            const itemBaseUnits = item.baseUnitsDeducted ?? Number((item.quantity * mult).toFixed(3));
            const existing = requiredBaseMap.get(item.productId);
            if (existing) {
              existing.totalBaseUnits = Number(
                (existing.totalBaseUnits + itemBaseUnits).toFixed(3)
              );
            } else {
              const lineRecord = saleItems.find((s) => s.productId === item.productId);
              requiredBaseMap.set(item.productId, {
                name: item.name,
                totalBaseUnits: itemBaseUnits,
                unitCostPhp: lineRecord?.unitCostPhp ?? 0,
              });
            }
          }

          // Validate and deduct atomic base units per product
          for (const [prodId, req] of requiredBaseMap.entries()) {
            const row = db.getFirstSync<{ base_stock_count: number }>(
              'SELECT base_stock_count FROM products WHERE id = ?',
              [prodId]
            );
            if (!row) throw new Error(`${req.name} is no longer in inventory.`);
            if (row.base_stock_count < req.totalBaseUnits) {
              throw new Error(
                `Insufficient Stock — Only ${row.base_stock_count} available for ${req.name}.`
              );
            }
            db.runSync(
              'UPDATE products SET base_stock_count = ROUND(base_stock_count - ?, 3) WHERE id = ?',
              [req.totalBaseUnits, prodId]
            );
            const prevStock = row.base_stock_count;
            const resStock = Number((prevStock - req.totalBaseUnits).toFixed(3));
            const movementId = `mov_${txTime}_${prodId}`;
            db.runSync(
              `INSERT INTO stock_movement_logs (
                id, product_id, product_name, movement_type, quantity_delta,
                previous_stock, resulting_stock, unit_cost_php, reason, reference_id, created_at
              ) VALUES (?, ?, ?, 'SALE', ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))`,
              [
                movementId,
                prodId,
                req.name,
                -req.totalBaseUnits,
                prevStock,
                resStock,
                req.unitCostPhp,
                `POS Sale (${newTx.id})`,
                newTx.id,
              ]
            );
            if (!options.isOneTimeBulkOrder) {
              const historyId = `msh_${prodId}_${curYear}_${curMonth}`;
              db.runSync(
                `INSERT INTO monthly_sales_history (
                  id, product_id, year, month, gross_units_sold,
                  voided_units, returned_changed_mind_units, out_of_stock_days, total_days_in_month
                ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 30)
                ON CONFLICT(id) DO UPDATE SET
                  gross_units_sold = gross_units_sold + excluded.gross_units_sold`,
                [historyId, prodId, curYear, curMonth, req.totalBaseUnits]
              );
            }
          }

          if (utangAmountToRecord > 0 && options.customerName?.trim()) {
            const cleanName = options.customerName.trim();
            const existing = this.utangCustomers.find(
              (customer) => customer.name.toLowerCase() === cleanName.toLowerCase()
            );
            const customer: UtangCustomerRecord = existing
              ? {
                  ...existing,
                  balancePhp: existing.balancePhp + utangAmountToRecord,
                  lastUpdated: 'Just now',
                  debtStartedAt:
                    existing.balancePhp <= 0 ? now.toISOString() : existing.debtStartedAt,
                }
              : {
                  id: `cust_${txTime}`,
                  name: cleanName,
                  balancePhp: utangAmountToRecord,
                  creditLimitPhp: 500,
                  lastUpdated: 'Just now',
                  debtStartedAt: now.toISOString(),
                };
            db.runSync(
              `INSERT OR REPLACE INTO utang_customers
                (id, name, balance_php, credit_limit_php, last_updated, due_date, debt_started_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                customer.id,
                customer.name,
                customer.balancePhp,
                customer.creditLimitPhp,
                customer.lastUpdated,
                customer.dueDate ?? null,
                customer.debtStartedAt ?? now.toISOString(),
              ]
            );
          }

          this.persistTransactionToSqlite(newTx, txTime);
          db.runSync('DELETE FROM cart_items');
        });

        const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
        repo.hydrateFromSqlite?.();
        this.hydrateAllFromSqlite(true);
      } else {
        const allProducts = await this.productRepo.getAll();
        for (const item of summary.items) {
          const product = allProducts.find((candidate) => candidate.id === item.productId);
          if (!product) throw new Error(`${item.name} is no longer in inventory.`);
          await this.productRepo.save(product.adjustStock(-item.quantity));
          this.recordStockMovement({
            productId: item.productId,
            productName: item.name,
            movementType: 'SALE',
            quantityDelta: -item.quantity,
            previousStock: product.baseStockCount,
            resultingStock: product.baseStockCount - item.quantity,
            unitCostPhp: product.unitCostPhp,
            reason: `POS Sale (${newTx.id})`,
            referenceId: newTx.id,
          });
          if (!options.isOneTimeBulkOrder) {
            this.recordMonthlySaleIncrement(item.productId, curYear, curMonth, item.quantity);
          }
        }
        if (utangAmountToRecord > 0 && options.customerName?.trim()) {
          const cleanName = options.customerName.trim();
          const existing = this.utangCustomers.find(
            (customer) => customer.name.toLowerCase() === cleanName.toLowerCase()
          );
          if (existing) {
            if (existing.balancePhp <= 0) existing.debtStartedAt = now.toISOString();
            existing.balancePhp += utangAmountToRecord;
            existing.lastUpdated = 'Just now';
          } else {
            this.utangCustomers.unshift({
              id: `cust_${txTime}`,
              name: cleanName,
              balancePhp: utangAmountToRecord,
              creditLimitPhp: 500,
              lastUpdated: 'Just now',
              debtStartedAt: now.toISOString(),
            });
          }
        }
        this.transactions.unshift(newTx);
      }

      this.cartMap.clear();
      this.discountPhp = 0;
      this.exchangeCreditPhp = 0;
      this.exchangeSourceReceiptId = null;
      this.lastRemovedItem = null;
      this.cartRevision++;
      this.notify();
      this.trace('complete sale committed', { transactionId: newTx.id });
      return newTx;
    } catch (error) {
      this.trace('complete sale failed', {
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      this.isCompletingSale = false;
    }
  }

  public getTransactionsSnapshot(): SaleTransactionRecord[] {
    return [...this.snapshot.transactions];
  }

  public getSalesSummary(
    periodOrRange: 'Daily' | 'Weekly' | 'Monthly' | DateRangeFilter = 'Daily'
  ) {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    const isCustomRange = typeof periodOrRange === 'object' && periodOrRange !== null;
    const customRange = isCustomRange ? (periodOrRange as DateRangeFilter) : null;
    const period = isCustomRange ? 'Custom' : (periodOrRange as 'Daily' | 'Weekly' | 'Monthly');
    const periodLabel = customRange ? customRange.label : period;

    const matchesPeriod = (txMs: number): boolean => {
      if (!Number.isFinite(txMs) || isNaN(txMs)) {
        return true;
      }
      if (isCustomRange && customRange) {
        return txMs >= customRange.startMs && txMs <= customRange.endMs;
      }
      const d = new Date(txMs);

      if (period === 'Daily') {
        return (
          d.getFullYear() === todayYear &&
          d.getMonth() === todayMonth &&
          d.getDate() === todayDate
        );
      }
      if (period === 'Weekly') {
        const diffMs = now.getTime() - txMs;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays < 7;
      }
      // Monthly
      return d.getFullYear() === todayYear && d.getMonth() === todayMonth;
    };

    const periodTxs = this.transactions.filter((tx) => {
      const txMs = tx.timestampMs ?? new Date(tx.dateLabel).getTime();
      return matchesPeriod(txMs);
    });
    const activePeriodTxs = periodTxs.filter((t) => t.status !== 'VOIDED');
    const voidedTxs = periodTxs.filter((t) => t.status === 'VOIDED');
    const totalVoidedPhp = Number(
      voidedTxs.reduce((sum, t) => sum + t.totalPhp, 0).toFixed(2)
    );

    // Separate Sales vs Utang Collections
    const activeSales = activePeriodTxs.filter((t) => t.transactionType !== 'UTANG_PAYMENT');
    const activePayments = activePeriodTxs.filter((t) => t.transactionType === 'UTANG_PAYMENT');

    // 1. Gross Sales: Merchandise sold in this period, net of refunds.
    // Excludes debt collections so we never double-count revenue!
    const totalSalesPhp = Number(
      activeSales
        .reduce((sum, t) => sum + Math.max(0, t.totalPhp - t.refundedPhp), 0)
        .toFixed(2)
    );
    const totalItems = activeSales.reduce((sum, t) => sum + t.itemCount, 0);

    // Cost of Goods Sold (COGS / Puhunan) & Markup (Tubo / Gross Profit)
    const productsMap = new Map(
      (this.snapshot?.products ?? this.readProducts()).map((p) => [p.id, p])
    );

    // Helper to resolve an item's unit cost with protection against legacy corrupted/bundle costs:
    // If unit cost was never entered (0) or was mistakenly entered as whole bundle price (unitCost >= unitPrice),
    // heal it dynamically using the catalog or the store's Auto 75% fallback rule.
    const resolveItemCost = (
      itemUnitCost: number | undefined,
      unitPrice: number,
      prodUnitCost?: number
    ): number => {
      if (unitPrice <= 0) return 0;
      // 1. Valid individual unit cost stored on the item (strictly less than selling price)
      if (itemUnitCost !== undefined && itemUnitCost > 0 && itemUnitCost < unitPrice) {
        return itemUnitCost;
      }
      // 2. Valid individual unit cost updated in product catalog
      if (prodUnitCost !== undefined && prodUnitCost > 0 && prodUnitCost < unitPrice) {
        return prodUnitCost;
      }
      // 3. Auto 75% standard retail fallback (cost estimated at 75% of price, e.g. 25% margin)
      return Number(Math.max(0.5, unitPrice * 0.75).toFixed(2));
    };

    let totalCostAccum = 0;
    let totalTuboAccum = 0;
    for (const sale of activeSales) {
      let saleCost = 0;
      for (const item of sale.items) {
        const netQty = Math.max(0, item.quantity - item.returnedQty);
        if (netQty <= 0) continue;
        const prod = productsMap.get(item.productId);
        const unitPrice =
          item.unitPricePaidPhp > 0
            ? item.unitPricePaidPhp
            : item.quantity > 0
            ? Number((item.lineTotalPhp / item.quantity).toFixed(2))
            : 0;
        const unitCost = resolveItemCost(item.unitCostPhp, unitPrice, prod?.unitCostPhp);
        saleCost += unitCost * netQty;
      }
      const netSalePhp = Math.max(0, sale.totalPhp - sale.refundedPhp);
      sale.costPhp = Number(saleCost.toFixed(2));
      sale.tuboPhp = Number(Math.max(0, netSalePhp - sale.costPhp).toFixed(2));
      sale.profitMarginPercent =
        netSalePhp > 0
          ? Number(((sale.tuboPhp / netSalePhp) * 100).toFixed(1))
          : 0;
      sale.markupPercent =
        sale.costPhp > 0
          ? Number(((sale.tuboPhp / sale.costPhp) * 100).toFixed(1))
          : 0;

      totalCostAccum += sale.costPhp;
      totalTuboAccum += sale.tuboPhp;
    }

    for (const tx of periodTxs) {
      if (tx.transactionType === 'UTANG_PAYMENT') {
        tx.costPhp = 0;
        tx.tuboPhp = 0;
        tx.profitMarginPercent = 0;
        tx.markupPercent = 0;
      } else {
        let saleCost = 0;
        for (const item of tx.items) {
          const netQty = Math.max(0, item.quantity - item.returnedQty);
          if (netQty <= 0) continue;
          const prod = productsMap.get(item.productId);
          const unitPrice =
            item.unitPricePaidPhp > 0
              ? item.unitPricePaidPhp
              : item.quantity > 0
              ? Number((item.lineTotalPhp / item.quantity).toFixed(2))
              : 0;
          const unitCost = resolveItemCost(item.unitCostPhp, unitPrice, prod?.unitCostPhp);
          saleCost += unitCost * netQty;
        }
        const netSalePhp = Math.max(0, tx.totalPhp - tx.refundedPhp);
        tx.costPhp = Number(saleCost.toFixed(2));
        tx.tuboPhp = Number(Math.max(0, netSalePhp - tx.costPhp).toFixed(2));
        tx.profitMarginPercent =
          netSalePhp > 0
            ? Number(((tx.tuboPhp / netSalePhp) * 100).toFixed(1))
            : 0;
        tx.markupPercent =
          tx.costPhp > 0
            ? Number(((tx.tuboPhp / tx.costPhp) * 100).toFixed(1))
            : 0;
      }
    }

    const totalCostPhp = Number(totalCostAccum.toFixed(2));
    const tuboPhp = Number(totalTuboAccum.toFixed(2));
    const profitMarginPercent =
      totalSalesPhp > 0
        ? Number(((tuboPhp / totalSalesPhp) * 100).toFixed(1))
        : 0;
    const markupPercent =
      totalCostPhp > 0
        ? Number(((tuboPhp / totalCostPhp) * 100).toFixed(1))
        : 0;

    // 2. Utang collections (Koleksyon)
    const utangCollectedPhp = Number(
      activePayments.reduce((sum, t) => sum + t.totalPhp, 0).toFixed(2)
    );
    const utangCashCollectedPhp = Number(
      activePayments
        .filter((t) => t.tenderType === 'CASH')
        .reduce((sum, t) => sum + t.totalPhp, 0)
        .toFixed(2)
    );
    const utangGcashCollectedPhp = Number(
      activePayments
        .filter((t) => t.tenderType === 'GCASH')
        .reduce((sum, t) => sum + t.totalPhp, 0)
        .toFixed(2)
    );

    // 3. Cash Sales (Cash received for merchandise sold)
    const cashSalesPhp = Number(
      activeSales
        .filter((t) => t.tenderType === 'CASH')
        .reduce((sum, t) => sum + Math.max(0, t.totalPhp - t.refundedPhp), 0)
        .toFixed(2)
    );

    // 4. GCash Sales
    const gcashSalesPhp = Number(
      activeSales
        .filter((t) => t.tenderType === 'GCASH')
        .reduce((sum, t) => sum + Math.max(0, t.totalPhp - t.refundedPhp), 0)
        .toFixed(2)
    );

    // 5. Utang Credit Issued in period (Ipina-utang na paninda)
    const utangCreditIssuedPhp = Number(
      activeSales
        .filter((t) => t.tenderType === 'UTANG')
        .reduce((sum, t) => sum + Math.max(0, t.totalPhp - t.refundedPhp), 0)
        .toFixed(2)
    );

    // 6. Cash Drawer Adjustments (Panukli & Gastos)
    const periodAdjustments = this.cashDrawerAdjustments.filter((adj) =>
      matchesPeriod(adj.timestampMs)
    );
    const panukliTotalPhp = Number(
      periodAdjustments
        .filter((a) => a.type === 'PANUKLI')
        .reduce((sum, a) => sum + a.amountPhp, 0)
        .toFixed(2)
    );
    const gastosTotalPhp = Number(
      periodAdjustments
        .filter((a) => a.type === 'GASTOS')
        .reduce((sum, a) => sum + a.amountPhp, 0)
        .toFixed(2)
    );

    // Cash in Drawer (Pera sa Kahon / Cash on Hand)
    // Starting Float (Panukli) + Cash Sales + Utang Cash Collected - Gastos
    const cashInDrawerPhp = Number(
      Math.max(
        0,
        panukliTotalPhp + cashSalesPhp + utangCashCollectedPhp - gastosTotalPhp
      ).toFixed(2)
    );

    // 7. GCash Total
    const gcashTotalPhp = Number(
      (gcashSalesPhp + utangGcashCollectedPhp).toFixed(2)
    );

    // 8. Top-Moving Products (Mabenta)
    const itemSalesMap = new Map<
      string,
      { name: string; unitsSold: number; revenuePhp: number }
    >();
    for (const sale of activeSales) {
      for (const item of sale.items) {
        const netQty = Math.max(0, item.quantity - item.returnedQty);
        if (netQty > 0) {
          const existing = itemSalesMap.get(item.productId) ?? {
            name: item.name,
            unitsSold: 0,
            revenuePhp: 0,
          };
          existing.unitsSold += netQty;
          existing.revenuePhp += item.lineTotalPhp;
          itemSalesMap.set(item.productId, existing);
        }
      }
    }

    const topSellingProducts: TopSellingItemRecord[] = Array.from(
      itemSalesMap.entries()
    )
      .map(([productId, data]) => {
        const prod = productsMap.get(productId);
        const currentStock = prod ? prod.stockCount : 0;
        return {
          productId,
          name: data.name,
          unitsSold: data.unitsSold,
          revenuePhp: Number(data.revenuePhp.toFixed(2)),
          currentStock,
          isOutOfStock: currentStock <= 0,
          isLowStock: prod ? currentStock <= prod.effectiveLowStockThreshold : false,
        };
      })
      .sort((a, b) => b.unitsSold - a.unitsSold);

    // 9. Day Buckets (Mini visual bar chart)
    const dayBuckets: DaySalesBucket[] = [];
    if (period === 'Weekly') {
      const dayNames = ['Lin', 'Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab'];
      for (let i = 6; i >= 0; i--) {
        const target = new Date(now.getTime() - i * 86400000);
        const dayLabel = dayNames[target.getDay()];
        const dateLabel = target.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        const daySales = activeSales
          .filter((s) => {
            const ms = s.timestampMs ?? new Date(s.dateLabel).getTime();
            const d = new Date(ms);
            return (
              d.getFullYear() === target.getFullYear() &&
              d.getMonth() === target.getMonth() &&
              d.getDate() === target.getDate()
            );
          })
          .reduce(
            (sum, s) => sum + Math.max(0, s.totalPhp - s.refundedPhp),
            0
          );
        dayBuckets.push({
          dayLabel,
          dateLabel,
          totalSalesPhp: Number(daySales.toFixed(2)),
          isPeak: false,
        });
      }
    } else if (period === 'Monthly') {
      const daysInCurrentMonth = new Date(todayYear, todayMonth + 1, 0).getDate();
      for (let d = 1; d <= daysInCurrentMonth; d++) {
        const target = new Date(todayYear, todayMonth, d);
        const dayLabel = `${d}`;
        const dateLabel = target.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        });
        const daySales = activeSales
          .filter((s) => {
            const ms = s.timestampMs ?? new Date(s.dateLabel).getTime();
            const dt = new Date(ms);
            return (
              dt.getFullYear() === todayYear &&
              dt.getMonth() === todayMonth &&
              dt.getDate() === d
            );
          })
          .reduce(
            (sum, s) => sum + Math.max(0, s.totalPhp - s.refundedPhp),
            0
          );
        dayBuckets.push({
          dayLabel,
          dateLabel,
          totalSalesPhp: Number(daySales.toFixed(2)),
          isPeak: false,
        });
      }
    }

    const maxSales = Math.max(0, ...dayBuckets.map((b) => b.totalSalesPhp));
    if (maxSales > 0) {
      dayBuckets.forEach((b) => {
        if (b.totalSalesPhp === maxSales) {
          b.isPeak = true;
        }
      });
    }

    // 10. Yesterday Comparison (for Daily view)
    const yesterdayDate = new Date(now.getTime() - 86400000);
    const yesterdaySales = Number(
      this.transactions
        .filter(
          (tx) => tx.status !== 'VOIDED' && tx.transactionType !== 'UTANG_PAYMENT'
        )
        .filter((tx) => {
          const ms = tx.timestampMs ?? new Date(tx.dateLabel).getTime();
          const d = new Date(ms);
          return (
            d.getFullYear() === yesterdayDate.getFullYear() &&
            d.getMonth() === yesterdayDate.getMonth() &&
            d.getDate() === yesterdayDate.getDate()
          );
        })
        .reduce((sum, s) => sum + Math.max(0, s.totalPhp - s.refundedPhp), 0)
        .toFixed(2)
    );

    let dayOverDayDiffPercent: number | null = null;
    if (yesterdaySales > 0) {
      dayOverDayDiffPercent = Number(
        (((totalSalesPhp - yesterdaySales) / yesterdaySales) * 100).toFixed(1)
      );
    } else if (totalSalesPhp > 0) {
      dayOverDayDiffPercent = 100;
    }

    const totalCashInflowPhp = Number((cashSalesPhp + utangCashCollectedPhp).toFixed(2));
    const totalDigitalInflowPhp = Number((gcashSalesPhp + utangGcashCollectedPhp).toFixed(2));
    const grandTotalOperatingInflowPhp = Number((totalCashInflowPhp + totalDigitalInflowPhp).toFixed(2));
    const averageSpendPerReceiptPhp =
      activeSales.length > 0 ? Number((totalSalesPhp / activeSales.length).toFixed(2)) : 0;

    return {
      period,
      periodLabel,
      isCustomRange,
      customRange,
      totalSalesPhp,
      formattedTotalSales: Money.fromPhp(totalSalesPhp).format(),
      totalCostPhp,
      formattedTotalCost: Money.fromPhp(totalCostPhp).format(),
      tuboPhp,
      formattedTubo: Money.fromPhp(tuboPhp).format(),
      profitMarginPercent,
      markupPercent,
      formattedMarkup: `${markupPercent}%`,
      utangCollectedPhp,
      formattedUtangCollected: Money.fromPhp(utangCollectedPhp).format(),
      cashInDrawerPhp,
      formattedCashInDrawer: Money.fromPhp(cashInDrawerPhp).format(),
      startingCashPhp: panukliTotalPhp,
      formattedStartingCash: Money.fromPhp(panukliTotalPhp).format(),
      gastosPhp: gastosTotalPhp,
      formattedGastos: Money.fromPhp(gastosTotalPhp).format(),
      cashSalesPhp,
      formattedCashSales: Money.fromPhp(cashSalesPhp).format(),
      gcashSalesPhp,
      formattedGcashSales: Money.fromPhp(gcashSalesPhp).format(),
      utangCashCollectedPhp,
      formattedUtangCashCollected: Money.fromPhp(utangCashCollectedPhp).format(),
      utangGcashCollectedPhp,
      formattedUtangGcashCollected: Money.fromPhp(utangGcashCollectedPhp).format(),
      totalCashInflowPhp,
      formattedTotalCashInflow: Money.fromPhp(totalCashInflowPhp).format(),
      totalDigitalInflowPhp,
      formattedTotalDigitalInflow: Money.fromPhp(totalDigitalInflowPhp).format(),
      grandTotalOperatingInflowPhp,
      formattedGrandTotalOperatingInflow: Money.fromPhp(grandTotalOperatingInflowPhp).format(),
      averageSpendPerReceiptPhp,
      formattedAverageSpend: Money.fromPhp(averageSpendPerReceiptPhp).format(),
      gcashTotalPhp,
      formattedGcashTotal: Money.fromPhp(gcashTotalPhp).format(),
      utangCreditIssuedPhp,
      formattedUtangCreditIssued: Money.fromPhp(utangCreditIssuedPhp).format(),
      totalItems,
      totalTransactions: activePeriodTxs.length,
      totalSaleTransactions: activeSales.length,
      totalPaymentTransactions: activePayments.length,
      totalVoidedTransactions: voidedTxs.length,
      totalVoidedPhp,
      formattedTotalVoided: Money.fromPhp(totalVoidedPhp).format(),
      yesterdaySalesPhp: yesterdaySales,
      formattedYesterdaySales: Money.fromPhp(yesterdaySales).format(),
      dayOverDayDiffPercent,
      dayBuckets,
      topSellingProducts,
      periodAdjustments,
      transactions: periodTxs,
      allTransactions: [...this.transactions],
      shrinkageLog: [...this.shrinkageLog],
    };
  }

  public async voidEntireTransaction(txId: string, reason: string): Promise<void> {
    const tx = this.transactions.find((t) => t.id === txId);
    if (!tx || tx.status === 'VOIDED') return;

    if (tx.transactionType === 'UTANG_PAYMENT') {
      if (tx.customerName) {
        const cust = this.utangCustomers.find(
          (c) => c.name.toLowerCase() === tx.customerName!.toLowerCase()
        );
        if (cust) {
          cust.balancePhp += tx.totalPhp;
          cust.lastUpdated = 'Voided payment';
          this.persistCustomerToSqlite(cust);
        }
      }
      tx.status = 'VOIDED';
      tx.voidOrReturnNote = `Voided Bayad Utang (${reason})`;
      this.persistTransactionToSqlite(tx);
      this.notify();
      return;
    }

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    const allProducts = await this.productRepo.getAll();
    for (const item of tx.items) {
      const remainingQty = item.quantity - item.returnedQty;
      if (remainingQty > 0) {
        const prod = allProducts.find((p) => p.id === item.productId);
        if (prod) {
          const prevStock = prod.baseStockCount;
          await this.productRepo.save(prod.adjustStock(remainingQty));
          this.recordStockMovement({
            productId: item.productId,
            productName: item.name,
            movementType: 'RETURN',
            quantityDelta: remainingQty,
            previousStock: prevStock,
            resultingStock: prevStock + remainingQty,
            unitCostPhp: item.unitCostPhp ?? 0,
            reason: `Restocked from Voided Receipt (${tx.id})`,
            referenceId: tx.id,
          });
        }
        if (!tx.isOneTimeBulkOrder) {
          this.recordMonthlyReturnIncrement(
            item.productId,
            curYear,
            curMonth,
            remainingQty,
            true
          );
        }
      }
    }

    if (tx.tenderType === 'UTANG' && tx.customerName) {
      const cust = this.utangCustomers.find(
        (c) => c.name.toLowerCase() === tx.customerName!.toLowerCase()
      );
      if (cust) {
        const unrefundedNet = Math.max(0, tx.totalPhp - tx.refundedPhp);
        cust.balancePhp = Math.max(0, cust.balancePhp - unrefundedNet);
        cust.lastUpdated = 'Voided utang sale';
        this.persistCustomerToSqlite(cust);
      }
    }

    tx.status = 'VOIDED';
    tx.voidOrReturnNote = `Voided by Owner (${reason})`;
    this.persistTransactionToSqlite(tx);
    this.notify();
  }

  public async processReturnOrExchange(params: {
    txId: string;
    productId: string;
    returnQty: number;
    reason: string;
    disposition: ReturnDisposition;
    resolution: ReturnResolution;
  }): Promise<{ creditPhp: number }> {
    const tx = this.transactions.find((t) => t.id === params.txId);
    if (!tx || tx.status === 'VOIDED') {
      throw new Error('Transaction not available for return.');
    }
    if (tx.transactionType === 'UTANG_PAYMENT') {
      throw new Error('Hindi maaaring mag-return sa tala ng bayad-utang.');
    }

    // Safety guard: Restrict returns on Utang sales from cash refunds
    if (tx.tenderType === 'UTANG' && params.resolution === 'CASH_REFUND') {
      throw new Error(
        'Bawal mag-cash refund sa item na binili sa utang. Piliin ang Bawas Utang (UTANG_DEDUCTION) o Exchange Credit.'
      );
    }

    const line = tx.items.find((i) => i.productId === params.productId);
    if (!line) {
      throw new Error('Item not found in original receipt.');
    }

    const maxReturnable = line.quantity - line.returnedQty;
    const qty = Math.min(maxReturnable, Math.max(1, params.returnQty));
    if (qty <= 0) {
      throw new Error('All units of this item have already been returned.');
    }

    const refundAmountPhp = Number((line.unitPricePaidPhp * qty).toFixed(2));
    line.returnedQty += qty;
    tx.refundedPhp += refundAmountPhp;
    tx.itemCount = Math.max(0, tx.itemCount - qty);

    const allReturned = tx.items.every((i) => i.returnedQty >= i.quantity);
    tx.status = allReturned ? 'REFUNDED' : 'PARTIAL_RETURN';
    tx.voidOrReturnNote = `Returned ${qty}x ${line.name} (${
      params.disposition === 'SELLABLE' ? 'Restocked Sellable' : 'Quarantined Damaged'
    } • ${params.reason})`;

    const allProducts = await this.productRepo.getAll();
    const prod = allProducts.find((p) => p.id === params.productId);
    const db = SqliteDatabase.getInstance().rawDb;

    if (prod) {
      const prevStock = prod.baseStockCount;
      if (params.disposition === 'SELLABLE') {
        await this.productRepo.save(prod.adjustStock(qty));
        this.recordStockMovement({
          productId: prod.id,
          productName: prod.name,
          movementType: 'RETURN',
          quantityDelta: qty,
          previousStock: prevStock,
          resultingStock: prevStock + qty,
          unitCostPhp: prod.unitCostPhp,
          reason: `Customer Return Restocked (${params.reason})`,
          referenceId: params.txId,
        });
      } else {
        await this.productRepo.save(prod.addQuarantineStock(qty, false));
        const shk = {
          id: `shk_${Date.now()}`,
          productName: prod.name,
          qty,
          reason: `Customer Return (${params.reason})`,
          timestamp: 'Just now',
        };
        this.shrinkageLog.unshift(shk);
        if (db) {
          db.runSync(
            'INSERT INTO shrinkage_logs (id, product_name, qty, reason, timestamp) VALUES (?, ?, ?, ?, ?)',
            [shk.id, shk.productName, shk.qty, shk.reason, shk.timestamp]
          );
        }
        this.recordStockMovement({
          productId: prod.id,
          productName: prod.name,
          movementType: 'DAMAGED_EXPIRED',
          quantityDelta: -qty,
          previousStock: prevStock,
          resultingStock: Math.max(0, prevStock - qty),
          unitCostPhp: prod.unitCostPhp,
          reason: `Customer Return Damaged (${params.reason})`,
          referenceId: params.txId,
        });
      }
    }

    // Seasonal Forecast Engine tracking
    const now = new Date();
    this.recordMonthlyReturnIncrement(
      params.productId,
      now.getFullYear(),
      now.getMonth() + 1,
      qty,
      params.disposition === 'DAMAGED_QUARANTINE'
    );

    if (params.resolution === 'EXCHANGE_CREDIT') {
      this.exchangeCreditPhp += refundAmountPhp;
      this.exchangeSourceReceiptId = tx.id;
    } else if (params.resolution === 'UTANG_DEDUCTION' && tx.customerName) {
      const cust = this.utangCustomers.find(
        (c) => c.name.toLowerCase() === tx.customerName!.toLowerCase()
      );
      if (cust) {
        cust.balancePhp = Math.max(0, cust.balancePhp - refundAmountPhp);
        cust.lastUpdated = 'Bawas Utang (Return)';
        this.persistCustomerToSqlite(cust);
      }
    }

    this.persistTransactionToSqlite(tx);
    this.notify();
    return { creditPhp: refundAmountPhp };
  }

  public async adjustInventoryStock(params: {
    productId: string;
    mode: 'RESTOCK' | 'HOME_USE' | 'DAMAGED_EXPIRED' | 'UNPACK_TINGI';
    quantity: number;
    reason?: string;
  }): Promise<void> {
    const allProducts = await this.productRepo.getAll();
    const prod = allProducts.find((p) => p.id === params.productId);
    if (!prod) return;

    const qty = Math.max(1, params.quantity);
    const prevStock = prod.baseStockCount;
    const db = SqliteDatabase.getInstance().rawDb;

    if (params.mode === 'RESTOCK') {
      await this.productRepo.save(prod.adjustStock(qty));
      this.recordStockMovement({
        productId: prod.id,
        productName: prod.name,
        movementType: 'RESTOCK',
        quantityDelta: qty,
        previousStock: prevStock,
        resultingStock: prevStock + qty,
        unitCostPhp: prod.unitCostPhp,
        reason: params.reason || 'Store Inventory Restock',
      });
    } else if (params.mode === 'UNPACK_TINGI') {
      const tingiQty = qty * 10;
      await this.productRepo.save(prod.adjustStock(tingiQty));
      this.recordStockMovement({
        productId: prod.id,
        productName: prod.name,
        movementType: 'UNPACK_TINGI',
        quantityDelta: tingiQty,
        previousStock: prevStock,
        resultingStock: prevStock + tingiQty,
        unitCostPhp: prod.unitCostPhp,
        reason: params.reason || `Unpacked ${qty} pack(s) into tingi pieces`,
      });
    } else if (params.mode === 'HOME_USE') {
      await this.productRepo.save(prod.adjustStock(-qty));
      const shk = {
        id: `shk_${Date.now()}`,
        productName: prod.name,
        qty,
        reason: params.reason || 'Owner / Household Consumption (Sariling Gamit)',
        timestamp: 'Just now',
      };
      this.shrinkageLog.unshift(shk);
      if (db) {
        db.runSync(
          'INSERT INTO shrinkage_logs (id, product_name, qty, reason, timestamp) VALUES (?, ?, ?, ?, ?)',
          [shk.id, shk.productName, shk.qty, shk.reason, shk.timestamp]
        );
      }
      this.recordStockMovement({
        productId: prod.id,
        productName: prod.name,
        movementType: 'HOME_USE',
        quantityDelta: -qty,
        previousStock: prevStock,
        resultingStock: Math.max(0, prevStock - qty),
        unitCostPhp: prod.unitCostPhp,
        reason: params.reason || 'Owner / Household Consumption (Sariling Gamit)',
      });
    } else if (params.mode === 'DAMAGED_EXPIRED') {
      await this.productRepo.save(prod.addQuarantineStock(qty, true));
      const shk = {
        id: `shk_${Date.now()}`,
        productName: prod.name,
        qty,
        reason: params.reason || 'Shelf Expired / Damaged (Moved to Quarantine)',
        timestamp: 'Just now',
      };
      this.shrinkageLog.unshift(shk);
      if (db) {
        db.runSync(
          'INSERT INTO shrinkage_logs (id, product_name, qty, reason, timestamp) VALUES (?, ?, ?, ?, ?)',
          [shk.id, shk.productName, shk.qty, shk.reason, shk.timestamp]
        );
      }
      this.recordStockMovement({
        productId: prod.id,
        productName: prod.name,
        movementType: 'DAMAGED_EXPIRED',
        quantityDelta: -qty,
        previousStock: prevStock,
        resultingStock: Math.max(0, prevStock - qty),
        unitCostPhp: prod.unitCostPhp,
        reason: params.reason || 'Shelf Expired / Damaged (Moved to Quarantine)',
      });
    }
    this.notify();
  }

  public getUtangCustomers(): UtangCustomerRecord[] {
    return [...this.snapshot.utangCustomers];
  }

  public addUtangCustomer(
    name: string,
    creditLimitPhp = 500,
    initialBalancePhp = 0,
    dueDate?: string
  ): void {
    const clean = name.trim();
    if (!clean) return;
    const existing = this.utangCustomers.find(
      (c) => c.name.toLowerCase() === clean.toLowerCase()
    );
    if (existing) {
      if (existing.balancePhp <= 0 && initialBalancePhp > 0) {
        existing.debtStartedAt = new Date().toISOString();
      }
      existing.creditLimitPhp = creditLimitPhp;
      existing.balancePhp += Math.max(0, initialBalancePhp);
      existing.dueDate = dueDate || existing.dueDate;
      existing.lastUpdated = 'Updated just now';
      this.persistCustomerToSqlite(existing);
      this.notify();
      return;
    }

    const newCust: UtangCustomerRecord = {
      id: `cust_${Date.now()}`,
      name: clean,
      balancePhp: Math.max(0, initialBalancePhp),
      creditLimitPhp: Math.max(50, creditLimitPhp),
      lastUpdated: 'Added just now',
      dueDate: dueDate || undefined,
      debtStartedAt: new Date().toISOString(),
    };
    this.utangCustomers.unshift(newCust);
    this.persistCustomerToSqlite(newCust);
    this.notify();
  }

  public updateUtangCustomer(
    customerId: string,
    updates: { name?: string; creditLimitPhp?: number; dueDate?: string | null }
  ): void {
    const cust = this.utangCustomers.find((c) => c.id === customerId);
    if (!cust) return;
    if (updates.name && updates.name.trim()) {
      cust.name = updates.name.trim();
    }
    if (updates.creditLimitPhp !== undefined && updates.creditLimitPhp >= 0) {
      cust.creditLimitPhp = updates.creditLimitPhp;
    }
    if (updates.dueDate !== undefined) {
      cust.dueDate = updates.dueDate || undefined;
    }
    cust.lastUpdated = 'Updated just now';
    this.persistCustomerToSqlite(cust);
    this.notify();
  }

  public addManualUtangEntry(
    customerId: string,
    amountPhp: number,
    note?: string
  ): void {
    const cust = this.utangCustomers.find((c) => c.id === customerId);
    if (!cust || amountPhp <= 0) return;
    if (cust.balancePhp <= 0) cust.debtStartedAt = new Date().toISOString();
    cust.balancePhp += amountPhp;
    cust.lastUpdated = 'Bagong Utang just now';
    this.persistCustomerToSqlite(cust);

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curDay = String(now.getDate()).padStart(2, '0');
    const hours = now.getHours();
    const mins = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hr12 = hours % 12 || 12;
    const timeLabel = `${hr12}:${mins} ${ampm}`;
    const dateLabel = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const entryNote = note?.trim() || 'Manual Utang Entry';

    const utangTx: SaleTransactionRecord = {
      id: `UTG-${curYear}${curMonth}${curDay}-${String(1 + this.transactions.length).padStart(4, '0')}`,
      timeLabel,
      dateLabel,
      timestampMs: now.getTime(),
      totalPhp: amountPhp,
      formattedTotal: Money.fromPhp(amountPhp).format(),
      amountTenderedPhp: 0,
      changeDuePhp: 0,
      refundedPhp: 0,
      itemCount: 1,
      tenderType: 'UTANG',
      customerName: cust.name,
      status: 'COMPLETED',
      transactionType: 'SALE',
      voidOrReturnNote: entryNote,
      items: [
        {
          productId: 'manual_credit',
          name: entryNote,
          quantity: 1,
          returnedQty: 0,
          unitPricePaidPhp: amountPhp,
          lineTotalPhp: amountPhp,
          unitCostPhp: amountPhp,
        },
      ],
    };

    this.transactions.unshift(utangTx);
    this.persistTransactionToSqlite(utangTx);
    this.notify();
  }

  public deleteUtangCustomer(customerId: string): void {
    this.utangCustomers = this.utangCustomers.filter((c) => c.id !== customerId);
    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      db.runSync('DELETE FROM utang_customers WHERE id = ?', [customerId]);
    }
    this.notify();
  }

  public recordUtangPayment(
    customerId: string,
    amountPhp: number,
    paymentMethod: PaymentTenderType = 'CASH'
  ): void {
    const cust = this.utangCustomers.find((c) => c.id === customerId);
    if (!cust || amountPhp <= 0) return;

    const actualPayment = Math.min(amountPhp, cust.balancePhp > 0 ? cust.balancePhp : amountPhp);
    cust.balancePhp = Math.max(0, cust.balancePhp - actualPayment);
    cust.lastUpdated = 'Bayad just now';
    if (cust.balancePhp <= 0) cust.dueDate = undefined;

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const curDay = String(now.getDate()).padStart(2, '0');
    const hours = now.getHours();
    const mins = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hr12 = hours % 12 || 12;
    const timeLabel = `${hr12}:${mins} ${ampm}`;
    const dateLabel = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const txTime = now.getTime();

    const payTx: SaleTransactionRecord = {
      id: `PAY-${curYear}${curMonth}${curDay}-${String(1 + this.transactions.length).padStart(4, '0')}`,
      timeLabel,
      dateLabel,
      timestampMs: txTime,
      totalPhp: actualPayment,
      formattedTotal: Money.fromPhp(actualPayment).format(),
      amountTenderedPhp: actualPayment,
      changeDuePhp: 0,
      refundedPhp: 0,
      itemCount: 0,
      tenderType: paymentMethod,
      customerName: cust.name,
      status: 'COMPLETED',
      transactionType: 'UTANG_PAYMENT',
      items: [],
      voidOrReturnNote: `Bayad sa Utang (${cust.name})`,
    };

    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      db.withTransactionSync(() => {
        db.runSync(
          `INSERT OR REPLACE INTO utang_customers
           (id, name, balance_php, credit_limit_php, last_updated, due_date, debt_started_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            cust.id,
            cust.name,
            cust.balancePhp,
            cust.creditLimitPhp,
            cust.lastUpdated,
            cust.dueDate ?? null,
            cust.debtStartedAt ?? now.toISOString(),
          ]
        );
        this.persistTransactionToSqlite(payTx, txTime);
      });
    } else {
      this.persistCustomerToSqlite(cust);
    }

    this.transactions.unshift(payTx);
    this.notify();
    this.trace('recorded utang payment', { customerId, amount: actualPayment });
  }

  public getCashAdjustments(): CashDrawerAdjustmentRecord[] {
    return [...this.snapshot.cashDrawerAdjustments];
  }

  /**
   * Manually updates the cash-in-drawer balance by recording a separate
   * audited adjustment without modifying historical sales or inventory.
   */
  public setCashInDrawer(newAmountPhp: number, note?: string): CashDrawerAdjustmentRecord | null {
    const target = Number(newAmountPhp);
    if (!Number.isFinite(target) || target < 0) {
      throw new Error('Invalid cash amount. Balance cannot be negative.');
    }
    const currentDrawer = this.getSalesSummary('Daily').cashInDrawerPhp;
    const delta = Number((target - currentDrawer).toFixed(2));
    if (Math.abs(delta) < 0.01) {
      return null;
    }
    const type: CashAdjustmentType = delta > 0 ? 'PANUKLI' : 'GASTOS';
    const absAmount = Math.abs(delta);
    const category = 'Bilang sa Kaha';
    const auditNote =
      note?.trim() ||
      `Manual drawer balance update from ₱${currentDrawer.toFixed(2)} to ₱${target.toFixed(2)}`;
    this.addCashAdjustment(type, absAmount, category, auditNote);
    return this.cashDrawerAdjustments[0] ?? null;
  }

  public addCashAdjustment(
    type: CashAdjustmentType,
    amountPhp: number,
    category: string,
    note?: string
  ): void {
    const val = Number(amountPhp);
    if (!Number.isFinite(val) || val <= 0) return;
    const cleanCategory = category.trim() || (type === 'PANUKLI' ? 'Panukli' : 'Gastos');
    const now = new Date();
    const hours = now.getHours();
    const mins = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hr12 = hours % 12 || 12;
    const timeLabel = `${hr12}:${mins} ${ampm}`;
    const dateLabel = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timestampMs = now.getTime();

    const record: CashDrawerAdjustmentRecord = {
      id: `adj_${timestampMs}_${Math.random().toString(36).slice(2, 6)}`,
      type,
      amountPhp: Number(val.toFixed(2)),
      category: cleanCategory,
      note: note?.trim() || undefined,
      timestampMs,
      dateLabel,
      timeLabel,
    };

    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      try {
        db.runSync(
          `INSERT INTO cash_drawer_adjustments (id, type, amount_php, category, note, timestamp_ms, date_label, time_label)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.id,
            record.type,
            record.amountPhp,
            record.category,
            record.note ?? null,
            record.timestampMs,
            record.dateLabel,
            record.timeLabel,
          ]
        );
      } catch (err) {
        console.warn('Failed to persist cash adjustment to SQLite:', err);
      }
    }

    this.cashDrawerAdjustments.unshift(record);
    this.notify();
  }

  public deleteCashAdjustment(adjustmentId: string): void {
    this.cashDrawerAdjustments = this.cashDrawerAdjustments.filter((a) => a.id !== adjustmentId);
    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      try {
        db.runSync('DELETE FROM cash_drawer_adjustments WHERE id = ?', [adjustmentId]);
      } catch (err) {
        console.warn('Failed to delete cash adjustment from SQLite:', err);
      }
    }
    this.notify();
  }

  private recordMonthlyReturnIncrement(
    productId: string,
    year: number,
    month: number,
    unitsReturned: number,
    isDamagedOrVoid: boolean
  ): void {
    const db = SqliteDatabase.getInstance().rawDb;
    const historyId = `msh_${productId}_${year}_${month}`;
    if (db) {
      if (isDamagedOrVoid) {
        db.runSync(
          `INSERT INTO monthly_sales_history (
            id, product_id, year, month, gross_units_sold,
            voided_units, returned_changed_mind_units, out_of_stock_days, total_days_in_month
          ) VALUES (?, ?, ?, ?, 0, ?, 0, 0, 30)
          ON CONFLICT(id) DO UPDATE SET
            voided_units = voided_units + excluded.voided_units`,
          [historyId, productId, year, month, unitsReturned]
        );
      } else {
        db.runSync(
          `INSERT INTO monthly_sales_history (
            id, product_id, year, month, gross_units_sold,
            voided_units, returned_changed_mind_units, out_of_stock_days, total_days_in_month
          ) VALUES (?, ?, ?, ?, 0, 0, ?, 0, 30)
          ON CONFLICT(id) DO UPDATE SET
            returned_changed_mind_units = returned_changed_mind_units + excluded.returned_changed_mind_units`,
          [historyId, productId, year, month, unitsReturned]
        );
      }
    }

    const list = this.monthlyHistoryMap.get(productId) ?? [];
    let existing = list.find((r) => r.year === year && r.month === month);
    if (!existing) {
      existing = {
        year,
        month,
        grossUnitsSold: 0,
        voidedUnits: 0,
        returnedChangedMindUnits: 0,
        outOfStockDays: 0,
        totalDaysInMonth: 30,
      };
      list.push(existing);
      this.monthlyHistoryMap.set(productId, list);
    }
    if (isDamagedOrVoid) {
      existing.voidedUnits += unitsReturned;
    } else {
      existing.returnedChangedMindUnits += unitsReturned;
    }
  }

  private recordMonthlySaleIncrement(
    productId: string,
    year: number,
    month: number,
    unitsSold: number
  ): void {
    const list = this.monthlyHistoryMap.get(productId) ?? [];
    const existing = list.find((r) => r.year === year && r.month === month);
    if (existing) {
      existing.grossUnitsSold += unitsSold;
      this.persistMonthlyHistoryRow(productId, existing);
    } else {
      const rec: MonthlySalesRecord = {
        year,
        month,
        grossUnitsSold: unitsSold,
        voidedUnits: 0,
        returnedChangedMindUnits: 0,
        outOfStockDays: 0,
        totalDaysInMonth: 30,
      };
      list.push(rec);
      this.monthlyHistoryMap.set(productId, list);
      this.persistMonthlyHistoryRow(productId, rec);
    }
  }

  public addOrUpdateMonthlySalesRecord(
    productId: string,
    record: MonthlySalesRecord
  ): void {
    const list = this.monthlyHistoryMap.get(productId) ?? [];
    const idx = list.findIndex(
      (r) => r.year === record.year && r.month === record.month
    );
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.push(record);
      list.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
    }
    this.monthlyHistoryMap.set(productId, list);
    this.persistMonthlyHistoryRow(productId, record);
    this.notify();
  }

  private persistMonthlyHistoryRow(
    productId: string,
    record: MonthlySalesRecord
  ): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) return;
    const rowId = `msh_${productId}_${record.year}_${record.month}`;
    db.runSync(
      `INSERT OR REPLACE INTO monthly_sales_history (
        id, product_id, year, month, gross_units_sold,
        voided_units, returned_changed_mind_units, out_of_stock_days, total_days_in_month
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rowId,
        productId,
        record.year,
        record.month,
        record.grossUnitsSold,
        record.voidedUnits,
        record.returnedChangedMindUnits,
        record.outOfStockDays,
        record.totalDaysInMonth,
      ]
    );
  }

  public getMonthlySalesHistory(productId: string): MonthlySalesRecord[] {
    return [...(this.monthlyHistoryMap.get(productId) ?? [])];
  }

  public getSettings(): StoreSettingsState {
    return { ...this.snapshot.settings };
  }

  public updateSettings(partial: Partial<StoreSettingsState>): void {
    const notificationTimes = partial.notificationTimes
      ? [...new Set(partial.notificationTimes)]
          .filter((time) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
          .sort()
          .slice(0, 3)
      : this.settings.notificationTimes;
    this.settings = {
      ...this.settings,
      ...partial,
      notificationTimes: notificationTimes.length > 0 ? notificationTimes : ['07:00'],
      ownerTitle: 'Owner',
    };
    appKeyValueStorage.saveSettings(this.settings);
    this.persistSettingsToSqlite();
    this.notify();
  }

  public async setPhoneNotificationsEnabled(enabled: boolean): Promise<boolean> {
    if (!this.notificationScheduler) return false;
    if (enabled) {
      const granted = await this.notificationScheduler.requestPermission();
      if (!granted) {
        this.notificationScheduleError =
          'Hindi pinayagan ang phone notifications. Buksan ang permission sa phone settings.';
        this.publishSchedulerStatus();
        return false;
      }
    }
    this.updateSettings({ phoneNotifications: enabled });
    await this.syncNotificationSchedule();
    return true;
  }

  public markAlertRead(alertId: string): void {
    if (!this.activeAlerts.some((alert) => alert.id === alertId)) return;
    this.readAlertIds.add(alertId);
    appKeyValueStorage.setString('notification_read_ids', JSON.stringify([...this.readAlertIds]));
    this.notify();
  }

  public markAllAlertsRead(): void {
    this.activeAlerts.forEach((alert) => this.readAlertIds.add(alert.id));
    appKeyValueStorage.setString('notification_read_ids', JSON.stringify([...this.readAlertIds]));
    this.notify();
  }

  public async retryNotificationSchedule(): Promise<void> {
    await this.syncNotificationSchedule(true);
  }

  public notifyCatalogChanged(): void {
    const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
    if (repo.hydrateFromSqlite) {
      repo.hydrateFromSqlite();
    }
    this.notify();
  }

  /**
   * Enforces Owner Master PIN setup (FR-SEC-001, NFR-SEC-006).
   */
  public async setOwnerMasterPin(pin: string): Promise<boolean> {
    if (!PinSecurityEngine.isValidPinFormat(pin)) {
      throw new Error('PIN must be exactly 4 numeric digits.');
    }
    const salt = PinSecurityEngine.generateSalt();
    const hash = PinSecurityEngine.hashPin(pin, salt);
    appKeyValueStorage.setOwnerPin(hash, salt);
    appKeyValueStorage.setStoreSecurityEnabled(true);
    this.lockStore();
    return true;
  }

  /**
   * Verifies Owner Master PIN against progressive 5-try lockout engine.
   */
  public verifyOwnerMasterPin(pin: string): PinVerificationOutcome {
    const storedHash = appKeyValueStorage.getOwnerPinHash();
    const storedSalt = appKeyValueStorage.getOwnerPinSalt();
    if (!storedHash || !storedSalt) {
      return {
        success: true,
        remainingAttempts: 5,
        lockoutStatus: { isLocked: false, remainingSeconds: 0, failedAttempts: 0 },
      };
    }
    const lockoutUntil = appKeyValueStorage.getPinLockoutUntil() || 0;
    const failedAttempts = appKeyValueStorage.getFailedPinAttempts() || 0;
    const outcome = PinSecurityEngine.verifyPin(
      pin,
      storedHash,
      storedSalt,
      failedAttempts,
      lockoutUntil
    );
    if (outcome.success) {
      appKeyValueStorage.setFailedPinAttempts(0);
      appKeyValueStorage.setPinLockoutUntil(0);
    } else {
      const nextFailed = failedAttempts + 1;
      appKeyValueStorage.setFailedPinAttempts(nextFailed);
      if (outcome.lockoutStatus.isLocked) {
        const lockoutTimestamp = Date.now() + outcome.lockoutStatus.remainingSeconds * 1000;
        appKeyValueStorage.setPinLockoutUntil(lockoutTimestamp);
      }
    }
    this.notify();
    return outcome;
  }

  /**
   * Toggles operating role between OWNER and CASHIER mode via PIN authorization.
   */
  public switchOperatingMode(pin: string): boolean {
    const outcome = this.verifyOwnerMasterPin(pin);
    if (!outcome.success) {
      return false;
    }
    this.operatingMode = this.operatingMode === 'OWNER' ? 'CASHIER' : 'OWNER';
    appKeyValueStorage.setOperatingMode(this.operatingMode);
    this.notify();
    return true;
  }

  /**
   * Checks whether the store is currently unlocked within its active grace period.
   */
  public isStoreUnlocked(): boolean {
    if (!appKeyValueStorage.isStoreSecurityEnabled()) {
      return true;
    }
    return Date.now() < this.unlockedUntil;
  }

  /**
   * Unlocks the store for a 5-minute session grace period (or custom ms).
   */
  public unlockStore(durationMs: number = 5 * 60 * 1000): void {
    this.unlockedUntil = Date.now() + durationMs;
    this.operatingMode = 'OWNER';
    appKeyValueStorage.setUnlockedUntil(this.unlockedUntil);
    appKeyValueStorage.setOperatingMode('OWNER');
    this.notify();
  }

  /**
   * Immediately locks the store back to protected state.
   */
  public lockStore(): void {
    this.unlockedUntil = 0;
    this.operatingMode = 'CASHIER';
    appKeyValueStorage.setUnlockedUntil(0);
    appKeyValueStorage.setOperatingMode('CASHIER');
    this.notify();
  }

  /**
   * Enables or disables store security protection app-wide.
   */
  public enableStoreSecurity(enabled: boolean): void {
    appKeyValueStorage.setStoreSecurityEnabled(enabled);
    if (!enabled) {
      this.unlockStore();
    } else {
      this.lockStore();
    }
  }

  /**
   * Quick locks session back to protected state without requiring PIN entry.
   */
  public quickLockToCashierMode(): void {
    this.lockStore();
  }

  public setOperatingMode(mode: 'OWNER' | 'CASHIER'): void {
    if (mode === 'OWNER') {
      this.unlockStore();
    } else {
      this.lockStore();
    }
  }

  /**
   * Checks whether the current operating mode has permission for sensitive actions.
   */
  public isPrivilegeAllowed(
    action:
      | 'VIEW_MARGINS'
      | 'EDIT_PRICE'
      | 'SHRINKAGE_WRITE_OFF'
      | 'CLEAR_DATA'
      | 'STORE_SETTINGS'
  ): boolean {
    if (!appKeyValueStorage.isStoreSecurityEnabled()) return true;
    return this.isStoreUnlocked();
  }

  /**
   * Toggles extended brownout battery saver mode (NFR-ENV-003).
   */
  public toggleBrownoutBatterySaver(): boolean {
    this.isBrownoutSaverActive = !this.isBrownoutSaverActive;
    appKeyValueStorage.setBrownoutSaverActive(this.isBrownoutSaverActive);
    this.notify();
    return this.isBrownoutSaverActive;
  }

  /**
   * Queries products expiring within threshold days for FEFO clearance (FR-INV-005).
   */
  public getExpiringProducts(daysThreshold = 7): ProductDTO[] {
    return this.snapshot.products.filter((p) => {
      if (!p.expiryDate) return false;
      const expDate = new Date(p.expiryDate);
      if (isNaN(expDate.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= daysThreshold;
    });
  }
}
