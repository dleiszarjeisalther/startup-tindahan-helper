// src/domain/entities/Product.ts
import { Barcode, BarcodeSource } from '../value-objects/Barcode';
import { Money } from '../value-objects/Money';

export interface SellingUnitTier {
  unitName: 'piece' | 'bundle' | 'pack' | 'box' | 'case';
  baseUnitMultiplier: number;
  unitPricePhp: number;
  barcode?: string;
  unitBarcode?: Barcode;
}

export type UnitOfMeasure = 'pc' | 'kg';

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface ProductVisual {
  bgColor: string;
  accentColor: string;
  textColor: string;
  shortLabel: string;
  subLabel: string;
  shape: 'BAG' | 'BOTTLE' | 'POUCH' | 'SACHET' | 'PAD';
  imageUri?: string;
}

export interface ProductDTO {
  id: string;
  name: string;
  category: string;
  barcode: string;
  barcodeSource: BarcodeSource;
  stockCount: number;
  quarantineStockCount: number;
  outOfStockDays: number;
  stockStatus: StockStatus;
  unitCostPhp: number;
  defaultPricePhp: number;
  catalogDisplayPricePhp: number;
  formattedPrice: string;
  formattedCatalogPrice: string;
  bundlePromoText?: string;
  ordinaryLowStockThreshold: number;
  effectiveLowStockThreshold: number;
  seasonalPeakMultiplier?: number;
  imageUri?: string;
  visual: ProductVisual;
  unitOfMeasure: UnitOfMeasure;
  formattedUnit: string;
  formattedStock: string;
  expiryDate?: string | null;
  expiryStatus?: 'SAFE' | 'NEAR_EXPIRY' | 'EXPIRED' | 'NONE';
  daysUntilExpiry?: number | null;
  sellingTiers: SellingUnitTier[];
}

export class Product {
  constructor(
    public readonly id: string,
    private _name: string,
    private _category: string,
    private _barcode: Barcode,
    private _baseStockCount: number,
    private _ordinaryLowStockThreshold: number,
    private _unitCostPhp: number,
    private _sellingTiers: SellingUnitTier[],
    private _quarantineStockCount = 0,
    private _outOfStockDays = 0,
    private _visual?: ProductVisual,
    private _imageUri?: string,
    private _unitOfMeasure: UnitOfMeasure = 'pc',
    private _expiryDate?: string | null
  ) {
    if (!_name.trim()) {
      throw new Error('Product name is required.');
    }
    if (_sellingTiers.length === 0) {
      throw new Error('Product must have at least one selling unit tier.');
    }
  }

  public get expiryDate(): string | null | undefined {
    return this._expiryDate;
  }

  public get daysUntilExpiry(): number | null {
    if (!this._expiryDate) return null;
    const expiry = new Date(this._expiryDate);
    if (isNaN(expiry.getTime())) return null;
    const now = new Date();
    const dExpiry = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = dExpiry.getTime() - dNow.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  public getExpiryStatus(currentDate: Date = new Date()): 'SAFE' | 'NEAR_EXPIRY' | 'EXPIRED' | 'NONE' {
    if (!this._expiryDate) return 'NONE';
    const expiry = new Date(this._expiryDate);
    if (isNaN(expiry.getTime())) return 'NONE';
    const dExpiry = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const dNow = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const diffDays = Math.ceil((dExpiry.getTime() - dNow.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'EXPIRED';
    if (diffDays <= 30) return 'NEAR_EXPIRY';
    return 'SAFE';
  }

  public get barcode(): Barcode {
    return this._barcode;
  }

  public get name(): string {
    return this._name;
  }

  public get category(): string {
    return this._category;
  }

  public get baseStockCount(): number {
    return this._baseStockCount;
  }

  public get quarantineStockCount(): number {
    return this._quarantineStockCount;
  }

  public get outOfStockDays(): number {
    return this._outOfStockDays;
  }

  public get imageUri(): string | undefined {
    return this._imageUri;
  }

  public get unitOfMeasure(): UnitOfMeasure {
    return this._unitOfMeasure;
  }

  public get unitCostPhp(): number {
    return this._unitCostPhp;
  }

  public calculateLineTotal(quantity: number): Money {
    if (this._unitOfMeasure === 'kg') {
      const pieceTier =
        this._sellingTiers.find((t) => t.unitName === 'piece') ?? this._sellingTiers[0];
      const pricePerKg = Number(pieceTier?.unitPricePhp) || 0;
      const totalCentavos = Math.round(pricePerKg * 100 * quantity);
      return Money.fromCentavos(totalCentavos);
    }

    const bundleTier = this._sellingTiers.find(
      (t) => t.unitName === 'bundle' && quantity >= t.baseUnitMultiplier
    );
    const pieceTier =
      this._sellingTiers.find((t) => t.unitName === 'piece') ?? this._sellingTiers[0];

    if (bundleTier && quantity >= bundleTier.baseUnitMultiplier) {
      const bundles = Math.floor(quantity / bundleTier.baseUnitMultiplier);
      const remainder = quantity % bundleTier.baseUnitMultiplier;
      const bundleMoney = Money.fromPhp(bundleTier.unitPricePhp).multiply(bundles);
      const remainderMoney = Money.fromPhp(pieceTier.unitPricePhp).multiply(remainder);
      return bundleMoney.add(remainderMoney);
    }
    return Money.fromPhp(pieceTier.unitPricePhp).multiply(quantity);
  }

  public getEffectiveLowStockThreshold(activeSeasonalIndex = 1.0): number {
    return Math.ceil(this._ordinaryLowStockThreshold * Math.max(1.0, activeSeasonalIndex));
  }

  public getStockStatus(activeSeasonalIndex = 1.0): StockStatus {
    if (this._baseStockCount <= 0) return 'OUT_OF_STOCK';
    return this._baseStockCount <= this.getEffectiveLowStockThreshold(activeSeasonalIndex)
      ? 'LOW_STOCK'
      : 'IN_STOCK';
  }

  public adjustStock(deltaBaseUnits: number): Product {
    const nextStock = Math.max(0, this._baseStockCount + deltaBaseUnits);
    const nextOosDays = nextStock === 0 ? Math.max(1, this._outOfStockDays) : this._outOfStockDays;
    return new Product(
      this.id,
      this._name,
      this._category,
      this._barcode,
      nextStock,
      this._ordinaryLowStockThreshold,
      this._unitCostPhp,
      this._sellingTiers,
      this._quarantineStockCount,
      nextOosDays,
      this._visual,
      this._imageUri,
      this._unitOfMeasure,
      this._expiryDate
    );
  }

  public updateDetails(updates: {
    name?: string;
    category?: string;
    pricePhp?: number;
    unitCostPhp?: number;
    baseStockCount?: number;
    lowStockThreshold?: number;
    unitOfMeasure?: UnitOfMeasure;
    expiryDate?: string | null;
    sellingTiers?: SellingUnitTier[];
    imageUri?: string | null;
  }): Product {
    const nextName = updates.name !== undefined && updates.name.trim() ? updates.name.trim() : this._name;
    const nextCategory = updates.category !== undefined && updates.category.trim() ? updates.category.trim() : this._category;
    const nextStock = updates.baseStockCount !== undefined ? Math.max(0, updates.baseStockCount) : this._baseStockCount;
    const nextThreshold = updates.lowStockThreshold !== undefined ? Math.max(1, updates.lowStockThreshold) : this._ordinaryLowStockThreshold;
    const nextCost = updates.unitCostPhp !== undefined && updates.unitCostPhp >= 0 ? updates.unitCostPhp : this._unitCostPhp;
    const nextOosDays = nextStock === 0 ? Math.max(1, this._outOfStockDays) : (this._baseStockCount === 0 && nextStock > 0 ? 0 : this._outOfStockDays);
    const nextUnitOfMeasure = updates.unitOfMeasure ?? this._unitOfMeasure;
    const nextExpiry = updates.expiryDate !== undefined ? updates.expiryDate : this._expiryDate;
    const nextImageUri = updates.imageUri !== undefined ? (updates.imageUri || undefined) : this._imageUri;
    const nextVisual = this._visual ? { ...this._visual, imageUri: nextImageUri } : undefined;
    let nextTiers = updates.sellingTiers ? [...updates.sellingTiers] : this._sellingTiers;
    if (updates.pricePhp !== undefined && updates.pricePhp >= 0 && !updates.sellingTiers) {
      const pieceIdx = this._sellingTiers.findIndex((t) => t.unitName === 'piece');
      if (pieceIdx >= 0) {
        nextTiers = this._sellingTiers.map((t, idx) =>
          idx === pieceIdx ? { ...t, unitPricePhp: updates.pricePhp! } : t
        );
      } else if (this._sellingTiers.length > 0) {
        nextTiers = [{ ...this._sellingTiers[0], unitPricePhp: updates.pricePhp! }, ...this._sellingTiers.slice(1)];
      }
    }
    return new Product(
      this.id,
      nextName,
      nextCategory,
      this._barcode,
      nextStock,
      nextThreshold,
      nextCost,
      nextTiers,
      this._quarantineStockCount,
      nextOosDays,
      nextVisual,
      nextImageUri,
      nextUnitOfMeasure,
      nextExpiry
    );
  }

  public withImage(imageUri: string | undefined): Product {
    const nextVisual = this._visual ? { ...this._visual, imageUri } : undefined;
    return new Product(
      this.id,
      this._name,
      this._category,
      this._barcode,
      this._baseStockCount,
      this._ordinaryLowStockThreshold,
      this._unitCostPhp,
      this._sellingTiers,
      this._quarantineStockCount,
      this._outOfStockDays,
      nextVisual,
      imageUri,
      this._unitOfMeasure,
      this._expiryDate
    );
  }

  public addQuarantineStock(damagedUnits: number, deductFromSellable = false): Product {
    const nextSellable = deductFromSellable
      ? Math.max(0, this._baseStockCount - damagedUnits)
      : this._baseStockCount;
    return new Product(
      this.id,
      this._name,
      this._category,
      this._barcode,
      nextSellable,
      this._ordinaryLowStockThreshold,
      this._unitCostPhp,
      this._sellingTiers,
      this._quarantineStockCount + Math.max(0, damagedUnits),
      this._outOfStockDays,
      this._visual,
      this._imageUri,
      this._unitOfMeasure,
      this._expiryDate
    );
  }

  private getDefaultVisual(): ProductVisual {
    if (this._visual) {
      return { ...this._visual, imageUri: this._imageUri ?? this._visual.imageUri };
    }
    const cat = this._category.toLowerCase();
    if (cat.includes('beverage')) {
      return {
        bgColor: '#0D7A52',
        accentColor: '#A7F3D0',
        textColor: '#FFFFFF',
        shortLabel: this._name.slice(0, 6).toUpperCase(),
        subLabel: this._category.slice(0, 6).toUpperCase(),
        shape: 'BOTTLE',
        imageUri: this._imageUri,
      };
    }
    if (cat.includes('school')) {
      return {
        bgColor: '#2563EB',
        accentColor: '#DBEAFE',
        textColor: '#FFFFFF',
        shortLabel: this._name.slice(0, 6).toUpperCase(),
        subLabel: this._category.slice(0, 6).toUpperCase(),
        shape: 'PAD',
        imageUri: this._imageUri,
      };
    }
    return {
      bgColor: '#0D7A52',
      accentColor: '#D1FAE5',
      textColor: '#FFFFFF',
      shortLabel: this._name.slice(0, 7).toUpperCase(),
      subLabel: this._category.slice(0, 6).toUpperCase(),
      shape: 'BAG',
      imageUri: this._imageUri,
    };
  }

  public toDTO(activeSeasonalIndex = 1.0): ProductDTO {
    const pieceTier =
      this._sellingTiers.find((t) => t.unitName === 'piece') ?? this._sellingTiers[0];
    const bundleTier = this._sellingTiers.find((t) => t.unitName === 'bundle');
    const defaultPrice = Number(pieceTier?.unitPricePhp) || 0;
    const catalogDisplayPrice =
      bundleTier && bundleTier.baseUnitMultiplier > 0
        ? (Number(bundleTier.unitPricePhp) || 0) / bundleTier.baseUnitMultiplier
        : defaultPrice;

    return {
      id: this.id,
      name: this._name,
      category: this._category,
      barcode: this._barcode.value,
      barcodeSource: this._barcode.source,
      stockCount: this._baseStockCount,
      quarantineStockCount: this._quarantineStockCount,
      outOfStockDays: this._outOfStockDays,
      stockStatus: this.getStockStatus(activeSeasonalIndex),
      unitCostPhp: this._unitCostPhp,
      defaultPricePhp: defaultPrice,
      catalogDisplayPricePhp: catalogDisplayPrice,
      formattedPrice: Money.fromPhp(defaultPrice).format(),
      formattedCatalogPrice: Money.fromPhp(catalogDisplayPrice).format(),
      bundlePromoText: bundleTier
        ? `${bundleTier.baseUnitMultiplier} for ${Money.fromPhp(bundleTier.unitPricePhp).format()} (${Money.fromPhp(catalogDisplayPrice).format()}/pc)`
        : undefined,
      ordinaryLowStockThreshold: this._ordinaryLowStockThreshold,
      effectiveLowStockThreshold: this.getEffectiveLowStockThreshold(activeSeasonalIndex),
      seasonalPeakMultiplier: activeSeasonalIndex > 1.25 ? activeSeasonalIndex : undefined,
      imageUri: this._imageUri,
      visual: this._visual ?? this.getDefaultVisual(),
      unitOfMeasure: this._unitOfMeasure,
      formattedUnit: this._unitOfMeasure === 'kg' ? 'kg' : 'pc',
      formattedStock: (() => {
        if (this._unitOfMeasure === 'kg') {
          return `${Number(this._baseStockCount.toFixed(3))} kg`;
        }
        const basePcs = Math.floor(this._baseStockCount);
        const parts: string[] = [`${basePcs} pcs`];
        const boxTier = this._sellingTiers.find((t) => t.unitName === 'box');
        if (boxTier && boxTier.baseUnitMultiplier > 1) {
          const boxes = Math.floor(basePcs / boxTier.baseUnitMultiplier);
          parts.push(`${boxes} box${boxes === 1 ? '' : 'es'}`);
        }
        const packTier = this._sellingTiers.find((t) => t.unitName === 'pack');
        if (packTier && packTier.baseUnitMultiplier > 1) {
          const packs = Math.floor(basePcs / packTier.baseUnitMultiplier);
          parts.push(`${packs} pack${packs === 1 ? '' : 's'}`);
        }
        return parts.join(' • ');
      })(),
      expiryDate: this._expiryDate,
      expiryStatus: this.getExpiryStatus(),
      daysUntilExpiry: this.daysUntilExpiry,
      sellingTiers: this._sellingTiers.map((t) => ({ ...t })),
    };
  }

  public get sellingTiers(): SellingUnitTier[] {
    return this._sellingTiers.map((t) => ({ ...t }));
  }

  public get defaultPricePhp(): number {
    const pieceTier =
      this._sellingTiers.find((t) => t.unitName === 'piece') ?? this._sellingTiers[0];
    return Number(pieceTier?.unitPricePhp) || 0;
  }

  public getTier(unitName: string): SellingUnitTier | undefined {
    return this._sellingTiers.find((t) => t.unitName === unitName);
  }

  public getUnitMultiplier(unitName: string): number {
    return this.getTier(unitName)?.baseUnitMultiplier ?? 1;
  }

  public getUnitPrice(unitName: string): number {
    return this.getTier(unitName)?.unitPricePhp ?? this.defaultPricePhp;
  }
}
