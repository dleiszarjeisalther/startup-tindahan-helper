// src/domain/value-objects/Barcode.ts

export type BarcodeSource = 'CAMERA_SCAN' | 'MANUAL_INPUT' | 'GENERATED_TINGI';

export class Barcode {
  private readonly _code: string;
  private readonly _source: BarcodeSource;

  private constructor(code: string, source: BarcodeSource) {
    this._code = code;
    this._source = source;
  }

  /**
   * Rehydrates a Barcode directly from SQLite storage without rejecting custom or generated codes.
   */
  public static fromPersisted(rawCode: string, source: BarcodeSource): Barcode {
    const cleaned = (rawCode || '').trim() || `SKU-${Date.now()}`;
    return new Barcode(cleaned, source || 'MANUAL_INPUT');
  }

  /**
   * Factory Method 1: Create from Camera Barcode Scanner (Screen 1 or Screen 4 '+' Add Product)
   */
  public static fromCameraScan(rawScannedData: string): Barcode {
    const cleaned = rawScannedData.trim();
    if (!cleaned) {
      throw new Error('Scanned barcode cannot be empty.');
    }
    return new Barcode(cleaned, 'CAMERA_SCAN');
  }

  /**
   * Factory Method 2: Create from Manual Keypad Input
   * Accepts any valid retail barcode digits or store shortcode entered by the owner.
   */
  public static fromManualInput(rawInput: string): Barcode {
    const cleaned = rawInput.trim().toUpperCase();
    if (!cleaned) {
      throw new Error('Please input a barcode or tap "Tingi Code" to auto-generate one.');
    }

    if (cleaned.length < 2 || cleaned.length > 32) {
      throw new Error('Barcode must be between 2 and 32 characters.');
    }

    return new Barcode(cleaned, 'MANUAL_INPUT');
  }

  /**
   * Factory Method 3: Auto-generate for unbarcoded Tingi / Repacked items (e.g. Ice, Repacked Sugar, Single Pen)
   */
  public static generateStoreCode(categoryPrefix: string, sequenceNumber: number): Barcode {
    const prefix = categoryPrefix.replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase() || 'SKU';
    const padded = String(sequenceNumber).padStart(4, '0');
    return new Barcode(`${prefix}-${padded}`, 'GENERATED_TINGI');
  }

  /**
   * Standard GS1 Modulo-10 Check-Digit Algorithm (informational helper)
   */
  public static isValidGs1Checksum(digits: string): boolean {
    if (!/^\d{8}$|^\d{12,13}$/.test(digits)) return false;
    const nums = digits.split('').map(Number);
    const checkDigit = nums.pop();
    if (checkDigit === undefined) return false;
    const sum = nums
      .reverse()
      .reduce((acc, digit, idx) => acc + digit * (idx % 2 === 0 ? 3 : 1), 0);
    const calculatedCheck = (10 - (sum % 10)) % 10;
    return checkDigit === calculatedCheck;
  }

  public get value(): string {
    return this._code;
  }

  public get source(): BarcodeSource {
    return this._source;
  }

  public equals(other: Barcode): boolean {
    return this._code === other._code;
  }
}
