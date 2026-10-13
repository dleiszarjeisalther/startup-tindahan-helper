// src/application/TindahanStoreService.ts
import { ProductDTO } from '../domain/entities/Product';
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

export interface CartItemDTO {
  productId: string;
  name: string;
  unitPricePhp: number;
  formattedUnitPrice: string;
  quantity: number;
  lineTotalPhp: number;
  formattedLineTotal: string;
  bundleApplied: boolean;
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

export interface SaleLineItemRecord {
  productId: string;
  name: string;
  quantity: number;
  returnedQty: number;
  unitPricePaidPhp: number;
  lineTotalPhp: number;
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
  refundedPhp: number;
  itemCount: number;
  tenderType: PaymentTenderType;
  customerName?: string;
  isOneTimeBulkOrder?: boolean;
  status: 'COMPLETED' | 'PARTIAL_RETURN' | 'REFUNDED' | 'VOIDED';
  voidOrReturnNote?: string;
  items: SaleLineItemRecord[];
  transactionType?: 'SALE' | 'UTANG_PAYMENT';
}

export interface UtangCustomerRecord {
  id: string;
  name: string;
  balancePhp: number;
  creditLimitPhp: number;
  lastUpdated: string;
}

export interface StoreSettingsState {
  storeName: string;
  ownerTitle: 'Owner';
  address: string;
  language: 'English' | 'Taglish';
  notifications: boolean;
  schoolOpeningMonth: number;
  wholesaleBudgetPhp: number;
}

export interface StoreSnapshot {
  revision: number;
  cartRevision: number;
  isSqliteActive: boolean;
  products: ProductDTO[];
  cartSummary: CartSummaryDTO;
  transactions: SaleTransactionRecord[];
  settings: StoreSettingsState;
  utangCustomers: UtangCustomerRecord[];
}

type Listener = () => void;

export class TindahanStoreService {
  private listeners = new Set<Listener>();
  private readonly instanceId = `store_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  private version = 0;
  private cartRevision = 0;
  private snapshot!: StoreSnapshot;
  private isCompletingSale = false;

  private cartMap = new Map<string, number>();
  private parkedCartMap: Map<string, number> | null = null;
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

  constructor(
    private readonly productRepo: IProductRepository,
    public readonly onboardingService: ProductOnboardingService
  ) {
    this.hydrateAllFromSqlite(true);
    this.snapshot = this.createSnapshot();
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
            if (validProductIds.size === 0 || validProductIds.has(r.product_id)) {
              hydratedCart.set(r.product_id, r.quantity);
            }
          }
        }
        this.cartMap = hydratedCart;
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
      }>('SELECT * FROM utang_customers ORDER BY rowid DESC');

      this.utangCustomers = custRows.map((c) => ({
        id: c.id,
        name: c.name,
        balancePhp: c.balance_php,
        creditLimitPhp: c.credit_limit_php,
        lastUpdated: c.last_updated,
      }));

      // 4. Hydrate Store Settings (Hybrid MMKV Key-Value + SQLite fallback)
      const mmkvSettings = appKeyValueStorage.loadSettings(this.settings);
      this.settings = mmkvSettings;

      const settingsRow = db.getFirstSync<{
        store_name: string;
        address: string;
        language: 'English' | 'Taglish';
        notifications: number;
        school_opening_month: number;
        wholesale_budget_php: number;
      }>('SELECT * FROM store_settings WHERE id = 1');

      if (settingsRow) {
        this.settings = {
          storeName: mmkvSettings.storeName || settingsRow.store_name,
          ownerTitle: 'Owner',
          address: mmkvSettings.address || settingsRow.address,
          language: mmkvSettings.language || settingsRow.language,
          notifications: mmkvSettings.notifications,
          schoolOpeningMonth: mmkvSettings.schoolOpeningMonth,
          wholesaleBudgetPhp: mmkvSettings.wholesaleBudgetPhp,
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
      const histRows = db.getAllSync<{
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
    } catch (err) {
      console.warn('Error hydrating store state from SQLite:', err);
    }
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
        transaction_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      ]
    );
  }

  private persistCustomerToSqlite(c: UtangCustomerRecord): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) return;
    db.runSync(
      `INSERT OR REPLACE INTO utang_customers (id, name, balance_php, credit_limit_php, last_updated)
       VALUES (?, ?, ?, ?, ?)`,
      [c.id, c.name, c.balancePhp, c.creditLimitPhp, c.lastUpdated]
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
      products: Object.freeze([...products]) as ProductDTO[],
      cartSummary: Object.freeze({
        ...cartSummary,
        items: Object.freeze([...cartSummary.items]) as CartItemDTO[],
      }),
      transactions: Object.freeze(this.transactions.map((tx) => ({
        ...tx,
        items: [...tx.items],
      }))) as SaleTransactionRecord[],
      settings: Object.freeze({ ...this.settings }),
      utangCustomers: Object.freeze(this.utangCustomers.map((customer) => ({ ...customer }))) as UtangCustomerRecord[],
    });
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
    this.lastRemovedItem = null;
    this.discountPhp = 0;
    this.exchangeCreditPhp = 0;
    this.exchangeSourceReceiptId = null;
    this.transactions = [];
    this.utangCustomers = [];
    this.monthlyHistoryMap.clear();
    const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
    if (repo.hydrateFromSqlite) {
      repo.hydrateFromSqlite();
    }
    this.hydrateAllFromSqlite(true);
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.version++;
    this.snapshot = this.createSnapshot();
    this.trace('published', { subscribers: this.listeners.size });
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
        db.runSync('DELETE FROM cart_items WHERE product_id = ?', [productId]);
        db.runSync('DELETE FROM monthly_sales_history WHERE product_id = ?', [productId]);
      });
      const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
      repo.hydrateFromSqlite?.();
    } else {
      await this.productRepo.deleteById(productId);
    }
    const nextCart = new Map(this.cartMap);
    nextCart.delete(productId);
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
      baseStockCount?: number;
      lowStockThreshold?: number;
    }
  ): Promise<void> {
    const all = await this.productRepo.getAll();
    const prod = all.find((p) => p.id === productId);
    if (!prod) return;
    const updated = prod.updateDetails(updates);
    await this.productRepo.save(updated);
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
    for (const [productId, qty] of this.cartMap.entries()) {
      if (qty <= 0) {
        continue;
      }
      const p = products.find((prod) => prod.id === productId);
      if (!p) {
        continue;
      }
      const lineTotalPhp = p.defaultPricePhp * qty;
      items.push({
        productId: p.id,
        name: p.name,
        unitPricePhp: p.defaultPricePhp,
        formattedUnitPrice: Money.fromPhp(p.defaultPricePhp).format(),
        quantity: qty,
        lineTotalPhp,
        formattedLineTotal: Money.fromPhp(lineTotalPhp).format(),
        bundleApplied: false,
      });
    }

    return items;
  }

  public getCartSummary(): CartSummaryDTO {
    return this.snapshot.cartSummary;
  }

  private calculateCartSummary(products: ProductDTO[] = this.readProducts()): CartSummaryDTO {
    const items = this.calculateCartItems(products);
    const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
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
      hasParkedCart: this.parkedCartMap !== null && this.parkedCartMap.size > 0,
      lastRemovedItem: this.lastRemovedItem,
    };
  }

  public addToCart(productId: string, deltaQty = 1): void {
    if (this.isCompletingSale) {
      throw new Error('Sale is currently being completed. Please wait.');
    }
    const nextCart = new Map(this.cartMap);
    const current = this.cartMap.get(productId) ?? 0;
    const next = Math.max(0, current + deltaQty);
    let nextLastRemoved = this.lastRemovedItem;
    if (next === 0) {
      const prod = this.snapshot.products.find((p) => p.id === productId);
      if (prod && current > 0) {
        nextLastRemoved = { productId, name: prod.name, qty: current };
      }
      nextCart.delete(productId);
    } else {
      nextCart.set(productId, next);
      nextLastRemoved = null;
    }
    this.persistCartToSqlite(nextCart);
    this.cartMap = nextCart;
    this.lastRemovedItem = nextLastRemoved;
    this.cartRevision++;
    this.notify();
  }

  public undoRemoveCartItem(): void {
    if (!this.lastRemovedItem) return;
    if (this.isCompletingSale) throw new Error('Sale is currently being completed. Please wait.');
    const nextCart = new Map(this.cartMap);
    nextCart.set(this.lastRemovedItem.productId, this.lastRemovedItem.qty);
    this.persistCartToSqlite(nextCart);
    this.cartMap = nextCart;
    this.lastRemovedItem = null;
    this.cartRevision++;
    this.notify();
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
    this.notify();
  }

  public parkCurrentCart(): void {
    if (this.cartMap.size === 0) return;
    if (this.isCompletingSale) throw new Error('Sale is currently being completed. Please wait.');
    const nextParkedCart = new Map(this.cartMap);
    this.persistCartToSqlite(new Map());
    this.parkedCartMap = nextParkedCart;
    this.cartMap.clear();
    this.discountPhp = 0;
    this.cartRevision++;
    this.notify();
  }

  public restoreParkedCart(): void {
    if (!this.parkedCartMap) return;
    if (this.isCompletingSale) throw new Error('Sale is currently being completed. Please wait.');
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
    const newTx: SaleTransactionRecord = {
      id: `OR-${curYear}-${String(1 + this.transactions.length).padStart(4, '0')}`,
      timeLabel: `${hr12}:${mins} ${ampm}`,
      dateLabel,
      timestampMs: txTime,
      totalPhp: summary.totalPhp,
      formattedTotal: summary.formattedTotal,
      amountTenderedPhp,
      changeDuePhp,
      gcashRef: options.gcashRef,
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
      items: summary.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        returnedQty: 0,
        unitPricePaidPhp: Number((i.lineTotalPhp / i.quantity).toFixed(2)),
        lineTotalPhp: i.lineTotalPhp,
      })),
    };

    const db = SqliteDatabase.getInstance().rawDb;
    this.isCompletingSale = true;
    this.trace('complete sale started', { expectedCartRevision: options.expectedCartRevision });
    try {
      if (db) {
        db.withTransactionSync(() => {
          for (const item of summary.items) {
            const row = db.getFirstSync<{ base_stock_count: number }>(
              'SELECT base_stock_count FROM products WHERE id = ?',
              [item.productId]
            );
            if (!row) throw new Error(`${item.name} is no longer in inventory.`);
            if (row.base_stock_count < item.quantity) {
              throw new Error(`Not enough stock for ${item.name}.`);
            }
            db.runSync(
              'UPDATE products SET base_stock_count = base_stock_count - ? WHERE id = ?',
              [item.quantity, item.productId]
            );
            if (!options.isOneTimeBulkOrder) {
              const historyId = `msh_${item.productId}_${curYear}_${curMonth}`;
              db.runSync(
                `INSERT INTO monthly_sales_history (
                  id, product_id, year, month, gross_units_sold,
                  voided_units, returned_changed_mind_units, out_of_stock_days, total_days_in_month
                ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 30)
                ON CONFLICT(id) DO UPDATE SET
                  gross_units_sold = gross_units_sold + excluded.gross_units_sold`,
                [historyId, item.productId, curYear, curMonth, item.quantity]
              );
            }
          }

          if (utangAmountToRecord > 0 && options.customerName?.trim()) {
            const cleanName = options.customerName.trim();
            const existing = this.utangCustomers.find(
              (customer) => customer.name.toLowerCase() === cleanName.toLowerCase()
            );
            const customer: UtangCustomerRecord = existing
              ? { ...existing, balancePhp: existing.balancePhp + utangAmountToRecord, lastUpdated: 'Just now' }
              : {
                  id: `cust_${txTime}`,
                  name: cleanName,
                  balancePhp: utangAmountToRecord,
                  creditLimitPhp: 500,
                  lastUpdated: 'Just now',
                };
            db.runSync(
              `INSERT OR REPLACE INTO utang_customers
                (id, name, balance_php, credit_limit_php, last_updated)
               VALUES (?, ?, ?, ?, ?)`,
              [customer.id, customer.name, customer.balancePhp, customer.creditLimitPhp, customer.lastUpdated]
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
            existing.balancePhp += utangAmountToRecord;
            existing.lastUpdated = 'Just now';
          } else {
            this.utangCustomers.unshift({
              id: `cust_${txTime}`,
              name: cleanName,
              balancePhp: utangAmountToRecord,
              creditLimitPhp: 500,
              lastUpdated: 'Just now',
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

  public getSalesSummary(period: 'Daily' | 'Weekly' | 'Monthly' = 'Daily') {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();

    const matchesPeriod = (tx: SaleTransactionRecord): boolean => {
      const txMs = tx.timestampMs ?? new Date(tx.dateLabel).getTime();
      if (!Number.isFinite(txMs) || isNaN(txMs)) {
        return true; // Fallback: include if timestamp is unparseable
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

    const periodTxs = this.transactions.filter(matchesPeriod);
    const activePeriodTxs = periodTxs.filter((t) => t.status !== 'VOIDED');

    // Separate Sales vs Utang Collections
    const activeSales = activePeriodTxs.filter((t) => t.transactionType !== 'UTANG_PAYMENT');
    const activePayments = activePeriodTxs.filter((t) => t.transactionType === 'UTANG_PAYMENT');

    // 1. Gross Sales: Merchandise sold in this period, net of refunds.
    // Excludes debt collections so we never double-count revenue!
    const totalSalesPhp = activeSales.reduce(
      (sum, t) => sum + Math.max(0, t.totalPhp - t.refundedPhp),
      0
    );
    const totalItems = activeSales.reduce((sum, t) => sum + t.itemCount, 0);

    // 2. Utang collections (Koleksyon)
    const utangCollectedPhp = activePayments.reduce((sum, t) => sum + t.totalPhp, 0);
    const utangCashCollectedPhp = activePayments
      .filter((t) => t.tenderType === 'CASH')
      .reduce((sum, t) => sum + t.totalPhp, 0);
    const utangGcashCollectedPhp = activePayments
      .filter((t) => t.tenderType === 'GCASH')
      .reduce((sum, t) => sum + t.totalPhp, 0);

    // 3. Cash Sales (Cash received for merchandise sold)
    const cashSalesPhp = activeSales
      .filter((t) => t.tenderType === 'CASH')
      .reduce((sum, t) => sum + Math.max(0, t.totalPhp - t.refundedPhp), 0);

    // 4. GCash Sales
    const gcashSalesPhp = activeSales
      .filter((t) => t.tenderType === 'GCASH')
      .reduce((sum, t) => sum + Math.max(0, t.totalPhp - t.refundedPhp), 0);

    // 5. Utang Credit Issued in period (Ipina-utang na paninda)
    const utangCreditIssuedPhp = activeSales
      .filter((t) => t.tenderType === 'UTANG')
      .reduce((sum, t) => sum + Math.max(0, t.totalPhp - t.refundedPhp), 0);

    // 6. Cash in Drawer (Pera sa Kahon / Cash on Hand)
    // Cash Sales + Cash collected from Utang
    const cashInDrawerPhp = Number((cashSalesPhp + utangCashCollectedPhp).toFixed(2));

    // 7. GCash Total
    const gcashTotalPhp = Number((gcashSalesPhp + utangGcashCollectedPhp).toFixed(2));

    return {
      period,
      totalSalesPhp,
      formattedTotalSales: Money.fromPhp(totalSalesPhp).format(),
      utangCollectedPhp,
      formattedUtangCollected: Money.fromPhp(utangCollectedPhp).format(),
      cashInDrawerPhp,
      formattedCashInDrawer: Money.fromPhp(cashInDrawerPhp).format(),
      gcashTotalPhp,
      formattedGcashTotal: Money.fromPhp(gcashTotalPhp).format(),
      utangCreditIssuedPhp,
      formattedUtangCreditIssued: Money.fromPhp(utangCreditIssuedPhp).format(),
      totalItems,
      totalTransactions: activePeriodTxs.length,
      totalSaleTransactions: activeSales.length,
      totalPaymentTransactions: activePayments.length,
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
          await this.productRepo.save(prod.adjustStock(remainingQty));
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
      if (params.disposition === 'SELLABLE') {
        await this.productRepo.save(prod.adjustStock(qty));
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
  }): Promise<void> {
    const allProducts = await this.productRepo.getAll();
    const prod = allProducts.find((p) => p.id === params.productId);
    if (!prod) return;

    const qty = Math.max(1, params.quantity);
    const db = SqliteDatabase.getInstance().rawDb;

    if (params.mode === 'RESTOCK') {
      await this.productRepo.save(prod.adjustStock(qty));
    } else if (params.mode === 'UNPACK_TINGI') {
      await this.productRepo.save(prod.adjustStock(qty * 10));
    } else if (params.mode === 'HOME_USE') {
      await this.productRepo.save(prod.adjustStock(-qty));
      const shk = {
        id: `shk_${Date.now()}`,
        productName: prod.name,
        qty,
        reason: 'Owner / Household Consumption (Sariling Gamit)',
        timestamp: 'Just now',
      };
      this.shrinkageLog.unshift(shk);
      if (db) {
        db.runSync(
          'INSERT INTO shrinkage_logs (id, product_name, qty, reason, timestamp) VALUES (?, ?, ?, ?, ?)',
          [shk.id, shk.productName, shk.qty, shk.reason, shk.timestamp]
        );
      }
    } else if (params.mode === 'DAMAGED_EXPIRED') {
      await this.productRepo.save(prod.addQuarantineStock(qty, true));
      const shk = {
        id: `shk_${Date.now()}`,
        productName: prod.name,
        qty,
        reason: 'Shelf Expired / Damaged (Moved to Quarantine)',
        timestamp: 'Just now',
      };
      this.shrinkageLog.unshift(shk);
      if (db) {
        db.runSync(
          'INSERT INTO shrinkage_logs (id, product_name, qty, reason, timestamp) VALUES (?, ?, ?, ?, ?)',
          [shk.id, shk.productName, shk.qty, shk.reason, shk.timestamp]
        );
      }
    }
    this.notify();
  }

  public getUtangCustomers(): UtangCustomerRecord[] {
    return [...this.snapshot.utangCustomers];
  }

  public addUtangCustomer(
    name: string,
    creditLimitPhp = 500,
    initialBalancePhp = 0
  ): void {
    const clean = name.trim();
    if (!clean) return;
    const existing = this.utangCustomers.find(
      (c) => c.name.toLowerCase() === clean.toLowerCase()
    );
    if (existing) {
      existing.creditLimitPhp = creditLimitPhp;
      existing.balancePhp += Math.max(0, initialBalancePhp);
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
    };
    this.utangCustomers.unshift(newCust);
    this.persistCustomerToSqlite(newCust);
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
          `INSERT OR REPLACE INTO utang_customers (id, name, balance_php, credit_limit_php, last_updated)
           VALUES (?, ?, ?, ?, ?)`,
          [cust.id, cust.name, cust.balancePhp, cust.creditLimitPhp, cust.lastUpdated]
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
    this.settings = { ...this.settings, ...partial, ownerTitle: 'Owner' };
    appKeyValueStorage.saveSettings(this.settings);
    this.persistSettingsToSqlite();
    this.notify();
  }

  public notifyCatalogChanged(): void {
    const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
    if (repo.hydrateFromSqlite) {
      repo.hydrateFromSqlite();
    }
    this.notify();
  }
}
