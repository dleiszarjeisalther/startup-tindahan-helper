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

type Listener = () => void;

export class TindahanStoreService {
  private listeners = new Set<Listener>();

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
    this.hydrateAllFromSqlite();
  }

  public get isSqliteActive(): boolean {
    return SqliteDatabase.getInstance().isPersistentSqliteActive;
  }

  private hydrateAllFromSqlite(): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) {
      this.cartMap = new Map();
      this.transactions = [];
      this.utangCustomers = [];
      this.shrinkageLog = [];
      this.monthlyHistoryMap = new Map();
      return;
    }

    try {
      // 0. Hydrate Products from SQLite
      const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
      if (typeof repo.hydrateFromSqlite === 'function') {
        repo.hydrateFromSqlite();
      }

      // 1. Hydrate Cart (No hardcoded seed items)
      const cartRows = db.getAllSync<{ product_id: string; quantity: number }>(
        'SELECT * FROM cart_items'
      );
      this.cartMap = new Map(cartRows.map((r) => [r.product_id, r.quantity]));

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
      }>('SELECT * FROM sales_transactions ORDER BY sort_order DESC');

      this.transactions = txRows.map((r) => ({
        id: r.id,
        timeLabel: r.time_label,
        dateLabel: r.date_label,
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

      // 4. Hydrate Store Settings
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
          storeName: settingsRow.store_name,
          ownerTitle: 'Owner',
          address: settingsRow.address,
          language: settingsRow.language,
          notifications: settingsRow.notifications === 1,
          schoolOpeningMonth: settingsRow.school_opening_month,
          wholesaleBudgetPhp: settingsRow.wholesale_budget_php,
        };
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

  private persistCartToSqlite(): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) return;
    db.execSync('DELETE FROM cart_items;');
    for (const [productId, qty] of this.cartMap.entries()) {
      if (qty > 0) {
        db.runSync('INSERT INTO cart_items (product_id, quantity) VALUES (?, ?)', [
          productId,
          qty,
        ]);
      }
    }
  }

  private persistTransactionToSqlite(
    tx: SaleTransactionRecord,
    sortOrder = Date.now()
  ): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) return;
    db.runSync(
      `INSERT OR REPLACE INTO sales_transactions (
        id, time_label, date_label, total_php, formatted_total,
        amount_tendered_php, change_due_php, gcash_ref,
        refunded_php, item_count, tender_type, customer_name,
        is_one_time_bulk_order, status, void_or_return_note, items_json, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        sortOrder,
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

  public clearAllDatabaseData(): void {
    SqliteDatabase.getInstance().clearAllTablesForReset();
    const repo = this.productRepo as unknown as { hydrateFromSqlite?: () => void };
    if (repo.hydrateFromSqlite) {
      repo.hydrateFromSqlite();
    }
    this.hydrateAllFromSqlite();
    this.notify();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
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
    await this.productRepo.deleteById(productId);
    this.cartMap.delete(productId);
    this.monthlyHistoryMap.delete(productId);
    this.persistCartToSqlite();
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

  public getProductsSnapshot(): ProductDTO[] {
    const raw = (this.productRepo as { getInitialDTOs?: () => ProductDTO[] }).getInitialDTOs
      ? (this.productRepo as unknown as { getInitialDTOs: () => ProductDTO[] }).getInitialDTOs()
      : [];
    return raw;
  }

  public getCartItems(): CartItemDTO[] {
    const products = this.getProductsSnapshot();
    const items: CartItemDTO[] = [];
    for (const [productId, qty] of this.cartMap.entries()) {
      if (qty <= 0) continue;
      const p = products.find((prod) => prod.id === productId);
      if (!p) continue;
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

  public getCartSummary() {
    const items = this.getCartItems();
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
    const current = this.cartMap.get(productId) ?? 0;
    const next = Math.max(0, current + deltaQty);
    if (next === 0) {
      const prod = this.getProductsSnapshot().find((p) => p.id === productId);
      if (prod && current > 0) {
        this.lastRemovedItem = { productId, name: prod.name, qty: current };
      }
      this.cartMap.delete(productId);
    } else {
      this.cartMap.set(productId, next);
      this.lastRemovedItem = null;
    }
    this.persistCartToSqlite();
    this.notify();
  }

  public undoRemoveCartItem(): void {
    if (!this.lastRemovedItem) return;
    this.cartMap.set(this.lastRemovedItem.productId, this.lastRemovedItem.qty);
    this.lastRemovedItem = null;
    this.persistCartToSqlite();
    this.notify();
  }

  public setDiscountPhp(discount: number): void {
    this.discountPhp = Math.max(0, Number.isFinite(discount) ? discount : 0);
    this.notify();
  }

  public clearCart(): void {
    this.cartMap.clear();
    this.discountPhp = 0;
    this.exchangeCreditPhp = 0;
    this.exchangeSourceReceiptId = null;
    this.lastRemovedItem = null;
    this.persistCartToSqlite();
    this.notify();
  }

  public parkCurrentCart(): void {
    if (this.cartMap.size === 0) return;
    this.parkedCartMap = new Map(this.cartMap);
    this.cartMap.clear();
    this.discountPhp = 0;
    this.persistCartToSqlite();
    this.notify();
  }

  public restoreParkedCart(): void {
    if (!this.parkedCartMap) return;
    this.cartMap = new Map(this.parkedCartMap);
    this.parkedCartMap = null;
    this.persistCartToSqlite();
    this.notify();
  }

  public async completeSale(options: {
    tenderType: PaymentTenderType;
    amountTenderedPhp: number;
    gcashRef?: string;
    customerName?: string;
    chargeShortfallToUtang?: boolean;
    isOneTimeBulkOrder?: boolean;
  }): Promise<SaleTransactionRecord> {
    const summary = this.getCartSummary();
    if (summary.items.length === 0) {
      throw new Error('Cannot complete sale with an empty cart.');
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

    const allProducts = await this.productRepo.getAll();
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    // Deduct stock atomically and persist each product + monthly history in SQLite
    for (const item of summary.items) {
      const prod = allProducts.find((p) => p.id === item.productId);
      if (prod) {
        await this.productRepo.save(prod.adjustStock(-item.quantity));
      }
      if (!options.isOneTimeBulkOrder) {
        this.recordMonthlySaleIncrement(item.productId, curYear, curMonth, item.quantity);
      }
    }

    // Handle Utang or Split Shortfall to Utang
    const shortfallPhp = Math.max(0, summary.totalPhp - amountTenderedPhp);
    const utangAmountToRecord =
      tenderType === 'UTANG'
        ? summary.totalPhp
        : options.chargeShortfallToUtang
        ? shortfallPhp
        : 0;

    if (utangAmountToRecord > 0 && options.customerName?.trim()) {
      const cleanName = options.customerName.trim();
      const existing = this.utangCustomers.find(
        (c) => c.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (existing) {
        existing.balancePhp += utangAmountToRecord;
        existing.lastUpdated = 'Just now';
        this.persistCustomerToSqlite(existing);
      } else {
        const newCust: UtangCustomerRecord = {
          id: `cust_${Date.now()}`,
          name: cleanName,
          balancePhp: utangAmountToRecord,
          creditLimitPhp: 500,
          lastUpdated: 'Just now',
        };
        this.utangCustomers.unshift(newCust);
        this.persistCustomerToSqlite(newCust);
      }
    }

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

    const newTx: SaleTransactionRecord = {
      id: `OR-${curYear}-${String(1 + this.transactions.length).padStart(4, '0')}`,
      timeLabel: `${hr12}:${mins} ${ampm}`,
      dateLabel,
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

    this.transactions.unshift(newTx);
    this.persistTransactionToSqlite(newTx, Date.now());
    this.clearCart();
    this.notify();
    return newTx;
  }

  public getSalesSummary(period: 'Daily' | 'Weekly' | 'Monthly' = 'Daily') {
    const activeTxs = this.transactions.filter((t) => t.status !== 'VOIDED');
    const totalSalesPhp = activeTxs.reduce(
      (sum, t) => sum + Math.max(0, t.totalPhp - t.refundedPhp),
      0
    );
    const totalItems = activeTxs.reduce((sum, t) => sum + t.itemCount, 0);
    const totalTransactions = activeTxs.length;

    return {
      period,
      totalSalesPhp,
      formattedTotalSales: Money.fromPhp(totalSalesPhp).format(),
      totalItems,
      totalTransactions,
      transactions: [...this.transactions],
      shrinkageLog: [...this.shrinkageLog],
    };
  }

  public async voidEntireTransaction(txId: string, reason: string): Promise<void> {
    const tx = this.transactions.find((t) => t.id === txId);
    if (!tx || tx.status === 'VOIDED') return;

    const allProducts = await this.productRepo.getAll();
    for (const item of tx.items) {
      const remainingQty = item.quantity - item.returnedQty;
      if (remainingQty > 0) {
        const prod = allProducts.find((p) => p.id === item.productId);
        if (prod) {
          await this.productRepo.save(prod.adjustStock(remainingQty));
        }
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

    this.persistTransactionToSqlite(tx);

    const allProducts = await this.productRepo.getAll();
    const prod = allProducts.find((p) => p.id === params.productId);
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
        const db = SqliteDatabase.getInstance().rawDb;
        if (db) {
          db.runSync(
            'INSERT INTO shrinkage_logs (id, product_name, qty, reason, timestamp) VALUES (?, ?, ?, ?, ?)',
            [shk.id, shk.productName, shk.qty, shk.reason, shk.timestamp]
          );
        }
      }
    }

    if (params.resolution === 'EXCHANGE_CREDIT') {
      this.exchangeCreditPhp += refundAmountPhp;
      this.exchangeSourceReceiptId = tx.id;
    } else if (params.resolution === 'UTANG_DEDUCTION' && tx.customerName) {
      const cust = this.utangCustomers.find(
        (c) => c.name.toLowerCase() === tx.customerName!.toLowerCase()
      );
      if (cust) {
        cust.balancePhp = Math.max(0, cust.balancePhp - refundAmountPhp);
        this.persistCustomerToSqlite(cust);
      }
    }

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
    return [...this.utangCustomers];
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

  public recordUtangPayment(customerId: string, amountPhp: number): void {
    const cust = this.utangCustomers.find((c) => c.id === customerId);
    if (!cust) return;
    cust.balancePhp = Math.max(0, cust.balancePhp - amountPhp);
    cust.lastUpdated = 'Paid just now';
    this.persistCustomerToSqlite(cust);
    this.notify();
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
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<StoreSettingsState>): void {
    this.settings = { ...this.settings, ...partial, ownerTitle: 'Owner' };
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
