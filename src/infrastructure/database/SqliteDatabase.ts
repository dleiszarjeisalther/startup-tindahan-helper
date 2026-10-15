// src/infrastructure/database/SqliteDatabase.ts
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

export class SqliteDatabase {
  private static instance: SqliteDatabase | null = null;
  private db: SQLite.SQLiteDatabase | null = null;

  private constructor() {
    if (Platform.OS !== 'web') {
      try {
        this.db = SQLite.openDatabaseSync('tindahan_pos_v3.db');
        this.initializeTables();
      } catch (err) {
        console.warn('SQLite init warning:', err);
        this.db = null;
      }
    }
  }

  public static getInstance(): SqliteDatabase {
    if (!SqliteDatabase.instance) {
      SqliteDatabase.instance = new SqliteDatabase();
    }
    return SqliteDatabase.instance;
  }

  public get rawDb(): SQLite.SQLiteDatabase | null {
    return this.db;
  }

  public get isPersistentSqliteActive(): boolean {
    return this.db !== null;
  }

  public initializeTables(): void {
    if (!this.db) return;

    try {
      this.db.execSync('PRAGMA journal_mode = WAL;');
    } catch {
      // WAL pragma might fail on some restricted Android environments
    }

    try {
      this.db.execSync(`
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        barcode TEXT NOT NULL UNIQUE,
        barcode_source TEXT NOT NULL,
        base_stock_count INTEGER NOT NULL DEFAULT 0,
        ordinary_low_stock_threshold INTEGER NOT NULL DEFAULT 5,
        unit_cost_php REAL NOT NULL DEFAULT 0,
        selling_tiers_json TEXT NOT NULL,
        quarantine_stock_count INTEGER NOT NULL DEFAULT 0,
        out_of_stock_days INTEGER NOT NULL DEFAULT 0,
        visual_json TEXT,
        image_uri TEXT,
        default_price_php REAL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS cart_items (
        product_id TEXT PRIMARY KEY NOT NULL,
        quantity INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sales_transactions (
        id TEXT PRIMARY KEY NOT NULL,
        time_label TEXT NOT NULL,
        date_label TEXT NOT NULL,
        total_php REAL NOT NULL,
        formatted_total TEXT NOT NULL,
        amount_tendered_php REAL NOT NULL DEFAULT 0,
        change_due_php REAL NOT NULL DEFAULT 0,
        gcash_ref TEXT,
        refunded_php REAL NOT NULL DEFAULT 0,
        item_count INTEGER NOT NULL DEFAULT 0,
        tender_type TEXT NOT NULL,
        customer_name TEXT,
        is_one_time_bulk_order INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL,
        void_or_return_note TEXT,
        items_json TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        transaction_type TEXT NOT NULL DEFAULT 'SALE'
      );

      CREATE TABLE IF NOT EXISTS utang_customers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        balance_php REAL NOT NULL DEFAULT 0,
        credit_limit_php REAL NOT NULL DEFAULT 500,
        last_updated TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS store_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        store_name TEXT NOT NULL,
        owner_title TEXT NOT NULL,
        address TEXT NOT NULL,
        language TEXT NOT NULL,
        notifications INTEGER NOT NULL DEFAULT 1,
        school_opening_month INTEGER NOT NULL DEFAULT 7,
        wholesale_budget_php REAL NOT NULL DEFAULT 3000
      );

      CREATE TABLE IF NOT EXISTS shrinkage_logs (
        id TEXT PRIMARY KEY NOT NULL,
        product_name TEXT NOT NULL,
        qty INTEGER NOT NULL,
        reason TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS monthly_sales_history (
        id TEXT PRIMARY KEY NOT NULL,
        product_id TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        gross_units_sold INTEGER NOT NULL DEFAULT 0,
        voided_units INTEGER NOT NULL DEFAULT 0,
        returned_changed_mind_units INTEGER NOT NULL DEFAULT 0,
        out_of_stock_days INTEGER NOT NULL DEFAULT 0,
        total_days_in_month INTEGER NOT NULL DEFAULT 30
      );

      CREATE TABLE IF NOT EXISTS cash_drawer_adjustments (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        amount_php REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT,
        timestamp_ms INTEGER NOT NULL,
        date_label TEXT NOT NULL,
        time_label TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS held_carts (
        id TEXT PRIMARY KEY NOT NULL,
        customer_name TEXT NOT NULL,
        total_php REAL NOT NULL,
        total_count INTEGER NOT NULL,
        items_json TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL,
        time_label TEXT NOT NULL
      );
    `);
    } catch (err) {
      console.warn('SQLite table initialization warning:', err);
    }

    try {
      this.db.execSync('ALTER TABLE products ADD COLUMN image_uri TEXT;');
    } catch {
      // Column already exists
    }

    try {
      this.db.execSync('ALTER TABLE products ADD COLUMN default_price_php REAL DEFAULT 0;');
    } catch {
      // Column already exists
    }

    try {
      this.db.execSync("ALTER TABLE sales_transactions ADD COLUMN transaction_type TEXT NOT NULL DEFAULT 'SALE';");
    } catch {
      // Column already exists
    }
  }

  public clearAllTablesForReset(): void {
    if (!this.db) return;
    this.db.execSync(`
      DELETE FROM products;
      DELETE FROM cart_items;
      DELETE FROM held_carts;
      DELETE FROM sales_transactions;
      DELETE FROM utang_customers;
      DELETE FROM store_settings;
      DELETE FROM shrinkage_logs;
      DELETE FROM monthly_sales_history;
      DELETE FROM cash_drawer_adjustments;
    `);
  }
}
