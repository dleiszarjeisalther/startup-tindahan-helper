// src/infrastructure/services/OpenFoodFactsApiClient.ts
import { File, Directory, Paths } from 'expo-file-system';

export interface ExternalProductCatalogResult {
  found: boolean;
  barcode: string;
  productName?: string;
  brand?: string;
  imageUrl?: string;
  inferredCategory?: 'Snacks' | 'Beverages' | 'Groceries' | 'School Supplies';
  statusVerbose?: string;
}

export interface IExternalCatalogLookupService {
  lookupBarcode(barcode: string): Promise<ExternalProductCatalogResult>;
  downloadImageLocally(remoteUrl: string, barcode: string): Promise<string>;
}

/**
 * Open Food Facts API v2 Client.
 * Adheres to Clean Architecture Infrastructure layer invariants:
 * - Injects mandatory User-Agent header
 * - Restricts fields query to minimize mobile data
 * - Enforces 4000ms AbortController timeout for spotty connectivity
 * - Downloads remote product photos to local phone storage when saved
 */
export class OpenFoodFactsApiClient implements IExternalCatalogLookupService {
  private readonly baseUrl = 'https://world.openfoodfacts.org/api/v2/product';
  private readonly userAgent =
    'StartupTindahanHelper/1.0 (contact@tindahanpos.ph - React Native Expo Mobile App)';

  public async lookupBarcode(rawBarcode: string): Promise<ExternalProductCatalogResult> {
    const cleanBarcode = (rawBarcode || '').trim();
    if (!cleanBarcode || cleanBarcode.length < 4) {
      return { found: false, barcode: cleanBarcode, statusVerbose: 'Invalid barcode' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const url = `${this.baseUrl}/${encodeURIComponent(
        cleanBarcode
      )}.json?fields=code,product_name,product_name_en,brands,image_url,image_front_url,image_front_small_url,categories_tags`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          found: false,
          barcode: cleanBarcode,
          statusVerbose: `Server status: ${response.status}`,
        };
      }

      const data = await response.json();

      if (data.status === 1 && data.product) {
        const prod = data.product;
        const name =
          prod.product_name?.trim() ||
          prod.product_name_en?.trim() ||
          (prod.brands ? `${prod.brands} (Item)` : undefined);

        const img =
          prod.image_url ||
          prod.image_front_url ||
          prod.image_front_small_url ||
          undefined;

        const category = this.inferCategory(prod.categories_tags);

        return {
          found: true,
          barcode: cleanBarcode,
          productName: name,
          brand: prod.brands?.trim(),
          imageUrl: img,
          inferredCategory: category,
          statusVerbose: 'Product found on Open Food Facts',
        };
      }

      return {
        found: false,
        barcode: cleanBarcode,
        statusVerbose: data.status_verbose || 'Product not found',
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort =
        err instanceof Error &&
        (err.name === 'AbortError' || err.message.includes('aborted'));
      return {
        found: false,
        barcode: cleanBarcode,
        statusVerbose: isAbort ? 'Lookup timed out (4s)' : 'Network error',
      };
    }
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

      const downloaded = await File.downloadFileAsync(remoteUrl, destinationFile);
      return downloaded.uri;
    } catch (err) {
      console.warn('Image local download fallback:', err);
      return remoteUrl; // Fallback to remote URL on error
    }
  }

  private inferCategory(
    categoriesTags?: string[]
  ): 'Snacks' | 'Beverages' | 'Groceries' | 'School Supplies' {
    if (!Array.isArray(categoriesTags) || categoriesTags.length === 0) {
      return 'Groceries';
    }

    const joined = categoriesTags.join(' ').toLowerCase();

    if (
      joined.includes('beverage') ||
      joined.includes('drink') ||
      joined.includes('soda') ||
      joined.includes('juice') ||
      joined.includes('water') ||
      joined.includes('tea') ||
      joined.includes('coffee')
    ) {
      return 'Beverages';
    }

    if (
      joined.includes('snack') ||
      joined.includes('chip') ||
      joined.includes('biscuit') ||
      joined.includes('cookie') ||
      joined.includes('confectioner') ||
      joined.includes('candy') ||
      joined.includes('chocolate')
    ) {
      return 'Snacks';
    }

    if (
      joined.includes('school') ||
      joined.includes('stationery') ||
      joined.includes('paper')
    ) {
      return 'School Supplies';
    }

    return 'Groceries';
  }
}
