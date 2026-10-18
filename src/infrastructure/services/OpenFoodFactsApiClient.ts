// src/infrastructure/services/OpenFoodFactsApiClient.ts
import { File, Directory, Paths } from 'expo-file-system';

export interface ExternalProductCatalogResult {
  found: boolean;
  barcode: string;
  productName?: string;
  brand?: string;
  imageUrl?: string;
  inferredCategory?: 'Snacks' | 'Beverages' | 'Groceries' | 'School Supplies' | string;
  statusVerbose?: string;
  source?: string;
}

export interface IExternalCatalogLookupService {
  lookupBarcode(barcode: string): Promise<ExternalProductCatalogResult>;
  downloadImageLocally(remoteUrl: string, barcode: string): Promise<string>;
}

interface OpenFactsProductPayload {
  product_name?: string;
  product_name_en?: string;
  product_name_tl?: string;
  product_name_fil?: string;
  generic_name?: string;
  generic_name_en?: string;
  brands?: string;
  image_url?: string;
  image_front_url?: string;
  image_front_small_url?: string;
  categories_tags?: string[];
}

interface OpenFactsApiResponse {
  status?: number;
  status_verbose?: string;
  product?: OpenFactsProductPayload;
}

interface UpcItemDbPayload {
  code?: string;
  total?: number;
  items?: {
    title?: string;
    brand?: string;
    category?: string;
    images?: string[];
  }[];
}

/**
 * Resilient Multi-Database Online Product Catalog Lookup Client.
 * Queries:
 * 1. Open Food Facts (world.openfoodfacts.org) - Food, snacks, drinks
 * 2. Open Beauty Facts (world.openbeautyfacts.org) - Soaps, shampoos, hygiene, toiletries
 * 3. Open Products Facts (world.openproductsfacts.org) - Detergents, cleaners, household items
 * 4. UPCItemDB Trial API - Comprehensive retail catalog fallback
 *
 * Capabilities & Invariants:
 * - Automatic UPC-A / EAN-13 padding and unpadding (leading zero handling)
 * - Sanitization (strips spaces and hyphens)
 * - Extended localized field extraction (product_name, product_name_tl, generic_name, brands)
 * - Resilient timeouts (6000ms) with AbortController for mobile cellular connections
 * - Automatic category inference (Snacks, Beverages, Groceries, School Supplies)
 * - Persistent local image downloading into application documents
 */
export class OpenFoodFactsApiClient implements IExternalCatalogLookupService {
  private readonly userAgent =
    'StartupTindahanHelper/1.0 (contact@tindahanpos.ph - React Native Expo Mobile App)';

  private async fetchJsonWithTimeout<T>(url: string, timeoutMs = 6000): Promise<T | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      clearTimeout(timeoutId);
      return null;
    }
  }

  public async lookupBarcode(rawBarcode: string): Promise<ExternalProductCatalogResult> {
    const cleanBarcode = (rawBarcode || '').replace(/[\s-]/g, '').trim();
    if (!cleanBarcode || cleanBarcode.length < 4) {
      return { found: false, barcode: cleanBarcode, statusVerbose: 'Invalid barcode' };
    }

    // Build code variations: original, plus leading zero (for 12-digit UPC-A to 13-digit EAN), or trimmed leading zero
    const codesToTry: string[] = [cleanBarcode];
    if (cleanBarcode.length === 12) {
      codesToTry.push('0' + cleanBarcode);
    } else if (cleanBarcode.length === 13 && cleanBarcode.startsWith('0')) {
      codesToTry.push(cleanBarcode.slice(1));
    }

    const openFactsEndpoints = [
      { domain: 'world.openfoodfacts.org', source: 'Open Food Facts' },
      { domain: 'world.openbeautyfacts.org', source: 'Open Beauty Facts' },
      { domain: 'world.openproductsfacts.org', source: 'Open Products Facts' },
    ];

    const fieldsParam =
      'fields=code,product_name,product_name_en,product_name_tl,product_name_fil,generic_name,generic_name_en,brands,image_url,image_front_url,image_front_small_url,categories_tags';

    for (const code of codesToTry) {
      // 1. Try Open Facts domain cluster (Food, Beauty/Hygiene, Products/Cleaning)
      for (const { domain, source } of openFactsEndpoints) {
        const url = `https://${domain}/api/v2/product/${encodeURIComponent(code)}.json?${fieldsParam}`;
        const data = await this.fetchJsonWithTimeout<OpenFactsApiResponse>(url, 5500);

        if (data && data.status === 1 && data.product) {
          const prod = data.product;
          const name =
            prod.product_name?.trim() ||
            prod.product_name_en?.trim() ||
            prod.product_name_tl?.trim() ||
            prod.product_name_fil?.trim() ||
            prod.generic_name?.trim() ||
            prod.generic_name_en?.trim() ||
            (prod.brands ? `${prod.brands.trim()} (Item)` : undefined);

          if (name) {
            const img =
              prod.image_url ||
              prod.image_front_url ||
              prod.image_front_small_url ||
              undefined;

            const category = this.inferCategory(prod.categories_tags, undefined, name);

            return {
              found: true,
              barcode: cleanBarcode,
              productName: name,
              brand: prod.brands?.trim(),
              imageUrl: img,
              inferredCategory: category,
              source,
              statusVerbose: `Product found on ${source}`,
            };
          }
        }
      }

      // 2. Try UPCItemDB trial endpoint as global retail fallback
      const upcUrl = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`;
      const upcData = await this.fetchJsonWithTimeout<UpcItemDbPayload>(upcUrl, 5500);

      if (upcData && upcData.code === 'OK' && Array.isArray(upcData.items) && upcData.items.length > 0) {
        const item = upcData.items[0];
        const name = item.title?.trim() || (item.brand ? `${item.brand.trim()} (Item)` : undefined);

        if (name) {
          const img = (item.images && item.images.length > 0) ? item.images[0] : undefined;
          const category = this.inferCategory(undefined, item.category, name);

          return {
            found: true,
            barcode: cleanBarcode,
            productName: name,
            brand: item.brand?.trim(),
            imageUrl: img,
            inferredCategory: category,
            source: 'UPCItemDB',
            statusVerbose: 'Product found on UPCItemDB',
          };
        }
      }
    }

    return {
      found: false,
      barcode: cleanBarcode,
      statusVerbose: 'Product not found across online catalogs',
    };
  }

  /**
   * Downloads remote image binary into the phone's persistent document directory.
   * Returns local file:/// URI for SQLite storage.
   */
  public async downloadImageLocally(remoteUrl: string, barcode: string): Promise<string> {
    if (!remoteUrl.startsWith('http://') && !remoteUrl.startsWith('https://')) {
      return remoteUrl; // Already a local file URI
    }

    try {
      const targetDir = new Directory(Paths.document, 'product_images');
      if (!targetDir.exists) {
        targetDir.create();
      }

      const safeBarcode = barcode.replace(/[^a-zA-Z0-9_-]/g, '_');
      const destinationFile = new File(targetDir, `${safeBarcode}.jpg`);

      if (destinationFile.exists) {
        return destinationFile.uri;
      }

      const downloaded = await File.downloadFileAsync(remoteUrl, destinationFile, {
        idempotent: true,
      });
      return downloaded.uri;
    } catch (err) {
      console.warn('Image local download fallback:', err);
      return remoteUrl; // Fallback to remote URL on error
    }
  }

  private inferCategory(
    categoriesTags?: string[],
    rawCategoryStr?: string,
    titleHint?: string
  ): 'Snacks' | 'Beverages' | 'Groceries' | 'School Supplies' {
    const text = [
      ...(Array.isArray(categoriesTags) ? categoriesTags : []),
      rawCategoryStr || '',
      titleHint || '',
    ]
      .join(' ')
      .toLowerCase();

    if (
      text.includes('beverage') ||
      text.includes('drink') ||
      text.includes('soda') ||
      text.includes('juice') ||
      text.includes('water') ||
      text.includes('tea') ||
      text.includes('coffee') ||
      text.includes('milk') ||
      text.includes('beer') ||
      text.includes('liquor') ||
      text.includes('wine')
    ) {
      return 'Beverages';
    }

    if (
      text.includes('snack') ||
      text.includes('chip') ||
      text.includes('biscuit') ||
      text.includes('cookie') ||
      text.includes('wafer') ||
      text.includes('cracker') ||
      text.includes('confectioner') ||
      text.includes('candy') ||
      text.includes('chocolate') ||
      text.includes('noodle') ||
      text.includes('pasta') ||
      text.includes('pancit') ||
      text.includes('bread')
    ) {
      return 'Snacks';
    }

    if (
      text.includes('school') ||
      text.includes('stationery') ||
      text.includes('paper') ||
      text.includes('pen') ||
      text.includes('pencil') ||
      text.includes('notebook')
    ) {
      return 'School Supplies';
    }

    return 'Groceries';
  }
}
