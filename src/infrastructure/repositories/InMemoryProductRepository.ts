// src/infrastructure/repositories/InMemoryProductRepository.ts
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { Product, ProductDTO, ProductVisual, SellingUnitTier } from '../../domain/entities/Product';
import { Barcode, BarcodeSource } from '../../domain/value-objects/Barcode';
import { SqliteDatabase } from '../database/SqliteDatabase';

interface ProductRow {
  id: string;
  name: string;
  category: string;
  barcode: string;
  barcode_source: BarcodeSource;
  base_stock_count: number;
  ordinary_low_stock_threshold: number;
  unit_cost_php: number;
  selling_tiers_json: string;
  quarantine_stock_count: number;
  out_of_stock_days: number;
  visual_json: string | null;
  image_uri: string | null;
}

/**
 * Persistent SQLite-backed Product Repository.
 * All products and photos are stored in and fetched from SQLite (tindahan_pos_v3.db).
 */
export class InMemoryProductRepository implements IProductRepository {
  private products: Product[] = [];
  private tingiSeq = 1;

  constructor() {
    this.hydrateFromSqlite();
  }

  public hydrateFromSqlite(): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) return;

    try {
      const rows = db.getAllSync<ProductRow>('SELECT * FROM products ORDER BY rowid DESC');
      if (Array.isArray(rows)) {
        this.products = rows.map((r) => this.mapRowToProduct(r));
        this.tingiSeq = Math.max(1, rows.length + 1);
      }
    } catch (err) {
      console.warn('Error hydrating products from SQLite:', err);
    }
  }

  private mapRowToProduct(row: ProductRow): Product {
    let tiers: SellingUnitTier[] = [
      { unitName: 'piece', baseUnitMultiplier: 1, unitPricePhp: 1.0 },
    ];
    try {
      if (row.selling_tiers_json) {
        const parsed = JSON.parse(row.selling_tiers_json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          tiers = parsed;
        }
      }
    } catch {
      // fallback to default tier
    }

    let visual: ProductVisual | undefined;
    try {
      if (row.visual_json) {
        visual = JSON.parse(row.visual_json);
      }
    } catch {
      visual = undefined;
    }

    const barcode = Barcode.fromPersisted(row.barcode, row.barcode_source);

    return new Product(
      row.id,
      row.name,
      row.category,
      barcode,
      Number(row.base_stock_count) || 0,
      Number(row.ordinary_low_stock_threshold) || 5,
      Number(row.unit_cost_php) || 0,
      tiers,
      Number(row.quarantine_stock_count) || 0,
      Number(row.out_of_stock_days) || 0,
      visual,
      row.image_uri ?? visual?.imageUri ?? undefined
    );
  }

  private persistProductToSqlite(product: Product): void {
    const db = SqliteDatabase.getInstance().rawDb;
    if (!db) return;

    try {
      const dto = product.toDTO();
      const tiers: SellingUnitTier[] = [
        { unitName: 'piece', baseUnitMultiplier: 1, unitPricePhp: dto.defaultPricePhp },
      ];

      db.runSync(
        `INSERT OR REPLACE INTO products (
          id, name, category, barcode, barcode_source,
          base_stock_count, ordinary_low_stock_threshold, unit_cost_php,
          selling_tiers_json, quarantine_stock_count, out_of_stock_days, visual_json, image_uri
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dto.id,
          dto.name,
          dto.category,
          dto.barcode,
          dto.barcodeSource,
          dto.stockCount,
          dto.ordinaryLowStockThreshold,
          dto.unitCostPhp,
          JSON.stringify(tiers),
          dto.quarantineStockCount,
          dto.outOfStockDays,
          JSON.stringify(dto.visual),
          dto.imageUri ?? null,
        ]
      );
    } catch (err) {
      console.error('persistProductToSqlite error:', err);
    }
  }

  public getInitialDTOs(): ProductDTO[] {
    return this.products.map((p) => p.toDTO());
  }

  public async getAll(): Promise<Product[]> {
    return [...this.products];
  }

  public async findByBarcode(barcode: Barcode): Promise<Product | null> {
    return this.products.find((p) => p.barcode.equals(barcode)) ?? null;
  }

  public async save(product: Product): Promise<void> {
    const idx = this.products.findIndex((p) => p.id === product.id);
    if (idx >= 0) {
      this.products[idx] = product;
    } else {
      this.products.unshift(product);
    }
    this.persistProductToSqlite(product);
  }

  public async deleteById(id: string): Promise<void> {
    this.products = this.products.filter((p) => p.id !== id);
    const db = SqliteDatabase.getInstance().rawDb;
    if (db) {
      try {
        db.runSync('DELETE FROM products WHERE id = ?', [id]);
        db.runSync('DELETE FROM cart_items WHERE product_id = ?', [id]);
        db.runSync('DELETE FROM monthly_sales_history WHERE product_id = ?', [id]);
      } catch (err) {
        console.error('deleteById error:', err);
      }
    }
  }

  public async getNextTingiSequence(): Promise<number> {
    return this.tingiSeq++;
  }
}
