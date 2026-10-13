// src/application/ProductOnboardingService.ts
import { IProductRepository } from '../domain/repositories/IProductRepository';
import { Barcode } from '../domain/value-objects/Barcode';
import { Product, ProductDTO } from '../domain/entities/Product';
import {
  IExternalCatalogLookupService,
  ExternalProductCatalogResult,
} from '../infrastructure/services/OpenFoodFactsApiClient';

export interface AddProductCommand {
  name: string;
  category: string;
  barcodeInputMode: 'SCAN' | 'MANUAL' | 'GENERATE_TINGI';
  rawBarcodeValue?: string;
  initialStock: number;
  lowStockThreshold: number;
  unitCostPhp: number;
  unitPricePhp: number;
  imageUri?: string;
}

export type AddProductResult =
  | {
      status: 'CREATED';
      product: ProductDTO;
    }
  | {
      status: 'DUPLICATE_BARCODE_FOUND';
      existingProduct: ProductDTO;
      message: string;
    };

export class ProductOnboardingService {
  constructor(
    private readonly productRepo: IProductRepository,
    private readonly catalogLookupService?: IExternalCatalogLookupService
  ) {}

  public async lookupOnlineCatalog(barcode: string): Promise<ExternalProductCatalogResult | null> {
    if (!this.catalogLookupService) return null;
    return this.catalogLookupService.lookupBarcode(barcode);
  }

  /**
   * Enforces that adding a product registers a valid barcode or auto-generates
   * a store code if none was scanned/typed, and prevents duplicate barcode creation.
   * If an image is a remote URL (e.g. from Open Food Facts), it downloads it locally.
   */
  public async registerNewProduct(cmd: AddProductCommand): Promise<AddProductResult> {
    if (!cmd.name || !cmd.name.trim()) {
      throw new Error('Please enter a Product Name.');
    }
    const safePrice = Number.isFinite(cmd.unitPricePhp) && cmd.unitPricePhp > 0
      ? cmd.unitPricePhp
      : 1.0;

    let barcode: Barcode;
    const rawTrimmed = (cmd.rawBarcodeValue ?? '').trim();

    if (
      cmd.barcodeInputMode === 'GENERATE_TINGI' ||
      rawTrimmed.toUpperCase() === 'AUTO-TINGI-CODE' ||
      !rawTrimmed
    ) {
      const seq = await this.productRepo.getNextTingiSequence();
      barcode = Barcode.generateStoreCode(cmd.category || 'SKU', seq);
    } else if (cmd.barcodeInputMode === 'SCAN') {
      barcode = Barcode.fromCameraScan(rawTrimmed);
    } else {
      barcode = Barcode.fromManualInput(rawTrimmed);
    }

    const existing = await this.productRepo.findByBarcode(barcode);
    if (existing) {
      const dto = existing.toDTO();
      return {
        status: 'DUPLICATE_BARCODE_FOUND',
        existingProduct: dto,
        message: `Barcode ${barcode.value} is already registered to "${dto.name}" (Stock: ${dto.stockCount}). Use Restock instead of creating a duplicate SKU.`,
      };
    }

    const safeStock = Number.isFinite(cmd.initialStock) ? Math.max(0, cmd.initialStock) : 0;
    const safeLowThreshold = Number.isFinite(cmd.lowStockThreshold)
      ? Math.max(1, cmd.lowStockThreshold)
      : 5;
    const safeCost = Number.isFinite(cmd.unitCostPhp) && cmd.unitCostPhp > 0
      ? cmd.unitCostPhp
      : Math.max(0.5, safePrice * 0.75);

    const product = new Product(
      `prod_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      cmd.name.trim(),
      cmd.category || 'Snacks',
      barcode,
      safeStock,
      safeLowThreshold,
      safeCost,
      [{ unitName: 'piece', baseUnitMultiplier: 1, unitPricePhp: safePrice }],
      0,
      0,
      undefined,
      cmd.imageUri
    );

    await this.productRepo.save(product);

    return {
      status: 'CREATED',
      product: product.toDTO(),
    };
  }
}
