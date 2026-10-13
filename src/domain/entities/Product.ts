// src/domain/entities/Product.ts
import { Barcode, BarcodeSource } from '../value-objects/Barcode';
import { Money } from '../value-objects/Money';

export interface SellingUnitTier {
  unitName: 'piece' | 'bundle' | 'pack' | 'case';
  baseUnitMultiplier: number;
  unitPricePhp: number;
  unitBarcode?: Barcode;
}

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
    private _imageUri?: string
  ) {
    if (!_name.trim()) {
      throw new Error('Product name is required.');
    }
    if (_sellingTiers.length === 0) {
      throw new Error('Product must have at least one selling unit tier.');
    }
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

  public calculateLineTotal(quantityInPieces: number): Money {
    const bundleTier = this._sellingTiers.find(
      (t) => t.unitName === 'bundle' && quantityInPieces >= t.baseUnitMultiplier
    );
    const pieceTier =
      this._sellingTiers.find((t) => t.unitName === 'piece') ?? this._sellingTiers[0];

    if (bundleTier && quantityInPieces >= bundleTier.baseUnitMultiplier) {
      const bundles = Math.floor(quantityInPieces / bundleTier.baseUnitMultiplier);
      const remainder = quantityInPieces % bundleTier.baseUnitMultiplier;
      const bundleMoney = Money.fromPhp(bundleTier.unitPricePhp).multiply(bundles);
      const remainderMoney = Money.fromPhp(pieceTier.unitPricePhp).multiply(remainder);
      return bundleMoney.add(remainderMoney);
    }
    return Money.fromPhp(pieceTier.unitPricePhp).multiply(quantityInPieces);
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
      this._imageUri
    );
  }

  public withImage(imageUri: string | undefined): Product {
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
      this._visual,
      imageUri
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
      this._imageUri
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
    const defaultPrice = pieceTier.unitPricePhp;
    const catalogDisplayPrice = bundleTier
      ? bundleTier.unitPricePhp / bundleTier.baseUnitMultiplier
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
      visual: this.getDefaultVisual(),
    };
  }
}
