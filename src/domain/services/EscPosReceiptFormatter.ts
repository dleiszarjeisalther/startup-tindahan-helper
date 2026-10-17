// src/domain/services/EscPosReceiptFormatter.ts
/**
 * EscPosReceiptFormatter
 * Pure TypeScript Domain Service for formatting POS sales receipts into
 * ESC/POS binary buffers (for 58mm/80mm Bluetooth thermal printers) and
 * monospace plain text representations.
 *
 * Compliance: FR-TND-006, BR-RUL-012 (Strict Privacy: Omit wholesale cost & tubo)
 * Zero React/React Native or native module dependencies.
 */

export interface ReceiptLineItem {
  name: string;
  quantity: number;
  unitPricePhp: number;
  totalPricePhp: number;
  unitName?: string;
}

export interface ReceiptData {
  storeName: string;
  storeOwner?: string;
  storeAddress?: string;
  receiptNumber: string;
  receiptId?: string;
  timestamp: string; // ISO or formatted
  cashierName?: string;
  items: ReceiptLineItem[];
  subtotalPhp: number;
  discountPhp?: number;
  convenienceFeePhp?: number;
  totalAmountPhp: number;
  tenderType: 'CASH' | 'GCASH' | 'UTANG' | 'SPLIT';
  tenderedAmountPhp?: number;
  changePhp?: number;
  paymentReference?: string;
  customerName?: string;
  previousUtangPhp?: number;
  remainingUtangPhp?: number;
  paperWidth?: '58mm' | '80mm';
}

export type PaperWidth = 58 | 80 | '58mm' | '80mm';

export class EscPosReceiptFormatter {
  public static formatPlainTextReceipt(data: ReceiptData, paperWidth?: PaperWidth): string {
    const widthStr: '58mm' | '80mm' = (paperWidth === 80 || paperWidth === '80mm') ? '80mm' : '58mm';
    return this.formatMonospaceText({ ...data, paperWidth: widthStr });
  }

  public static formatReceipt(data: ReceiptData, paperWidth?: PaperWidth): Uint8Array {
    const widthStr: '58mm' | '80mm' = (paperWidth === 80 || paperWidth === '80mm') ? '80mm' : '58mm';
    return this.generateEscPosBytes({ ...data, paperWidth: widthStr });
  }

  // ESC/POS Command Constants
  private static readonly ESC = 0x1b;
  private static readonly GS = 0x1d;
  private static readonly LF = 0x0a;

  private static readonly CMD_INIT = [EscPosReceiptFormatter.ESC, 0x40];
  private static readonly CMD_ALIGN_LEFT = [EscPosReceiptFormatter.ESC, 0x61, 0x00];
  private static readonly CMD_ALIGN_CENTER = [EscPosReceiptFormatter.ESC, 0x61, 0x01];
  private static readonly CMD_ALIGN_RIGHT = [EscPosReceiptFormatter.ESC, 0x61, 0x02];
  private static readonly CMD_BOLD_ON = [EscPosReceiptFormatter.ESC, 0x45, 0x01];
  private static readonly CMD_BOLD_OFF = [EscPosReceiptFormatter.ESC, 0x45, 0x00];
  private static readonly CMD_DOUBLE_ON = [EscPosReceiptFormatter.ESC, 0x21, 0x30];
  private static readonly CMD_DOUBLE_OFF = [EscPosReceiptFormatter.ESC, 0x21, 0x00];
  private static readonly CMD_CUT = [EscPosReceiptFormatter.GS, 0x56, 0x41, 0x10];

  /**
   * Helper to format a currency amount with two decimal digits.
   */
  public static formatPhp(amount: number): string {
    return `P${amount.toFixed(2)}`;
  }

  /**
   * Formats a line with left text and right text padded with spaces.
   */
  public static padLine(left: string, right: string, width: number): string {
    const spaceNeeded = width - left.length - right.length;
    if (spaceNeeded <= 0) {
      // If text overflows, truncate left text slightly
      const maxLeft = Math.max(4, width - right.length - 1);
      return `${left.substring(0, maxLeft)} ${right}`;
    }
    return left + ' '.repeat(spaceNeeded) + right;
  }

  /**
   * Builds human-readable monospace plain text suitable for on-screen preview or sharing.
   */
  public static formatMonospaceText(data: ReceiptData): string {
    const width = data.paperWidth === '80mm' ? 48 : 32;
    const divider = '-'.repeat(width);
    const doubleDivider = '='.repeat(width);
    const lines: string[] = [];

    // Header
    lines.push(this.centerText(data.storeName.toUpperCase(), width));
    if (data.storeOwner) {
      lines.push(this.centerText(data.storeOwner, width));
    }
    if (data.storeAddress) {
      lines.push(this.centerText(data.storeAddress, width));
    }
    lines.push(doubleDivider);

    // Metadata
    lines.push(this.padLine('Resibo #:', data.receiptNumber, width));
    lines.push(this.padLine('Petsa:', data.timestamp, width));
    if (data.cashierName) {
      lines.push(this.padLine('Kahera:', data.cashierName, width));
    }
    if (data.customerName) {
      lines.push(this.padLine('Suki:', data.customerName, width));
    }
    lines.push(divider);

    // Line Items
    lines.push(this.padLine('AYTEM / KANTIDAD', 'HALAGA', width));
    lines.push(divider);
    for (const item of data.items) {
      const itemHeader = `${item.quantity}x ${item.name}`;
      const itemTotal = this.formatPhp(item.totalPricePhp);
      lines.push(this.padLine(itemHeader, itemTotal, width));
      if (item.quantity > 1) {
        lines.push(`   @ ${this.formatPhp(item.unitPricePhp)} / ${item.unitName ?? 'pc'}`);
      }
    }
    lines.push(divider);

    // Financial Totals
    lines.push(this.padLine('Subtotal:', this.formatPhp(data.subtotalPhp), width));
    if (data.discountPhp && data.discountPhp > 0) {
      lines.push(this.padLine('Diskwento:', `-${this.formatPhp(data.discountPhp)}`, width));
    }
    if (data.convenienceFeePhp && data.convenienceFeePhp > 0) {
      lines.push(this.padLine('Convenience Fee:', `+${this.formatPhp(data.convenienceFeePhp)}`, width));
    }
    lines.push(this.padLine('KABUUANG HALAGA:', this.formatPhp(data.totalAmountPhp), width));
    lines.push(divider);

    // Settlement
    lines.push(this.padLine('Paraan ng Bayad:', data.tenderType, width));
    if (data.tenderType === 'CASH' && data.tenderedAmountPhp !== undefined) {
      lines.push(this.padLine('Inabot na Pera:', this.formatPhp(data.tenderedAmountPhp), width));
      lines.push(this.padLine('Sukli:', this.formatPhp(data.changePhp ?? 0), width));
    } else if (data.tenderType === 'GCASH') {
      if (data.paymentReference) {
        lines.push(this.padLine('GCash Ref #:', data.paymentReference, width));
      }
    } else if (data.tenderType === 'UTANG') {
      if (data.remainingUtangPhp !== undefined) {
        lines.push(this.padLine('Tirang Utang:', this.formatPhp(data.remainingUtangPhp), width));
      }
    }

    // Footer
    lines.push(doubleDivider);
    lines.push(this.centerText('Maraming Salamat sa Pagtangkilik!', width));
    lines.push(this.centerText('Ibalik ang resibo kung may depekto.', width));

    return lines.join('\n');
  }

  /**
   * Generates standard ESC/POS binary byte array for Bluetooth printer transmission.
   */
  public static generateEscPosBytes(data: ReceiptData): Uint8Array {
    const text = this.formatMonospaceText(data);
    const bytes: number[] = [];

    // Initialize printer
    bytes.push(...this.CMD_INIT);

    // Convert text lines into ESC/POS commands
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Emphasize Store Name and Grand Total
      if (i === 0 || line.includes('KABUUANG HALAGA:')) {
        bytes.push(...this.CMD_BOLD_ON);
      } else {
        bytes.push(...this.CMD_BOLD_OFF);
      }

      for (let c = 0; c < line.length; c++) {
        bytes.push(line.charCodeAt(c) & 0xff);
      }
      bytes.push(this.LF);
    }

    // Extra line feeds and paper cut
    bytes.push(this.LF, this.LF, this.LF);
    bytes.push(...this.CMD_CUT);

    return new Uint8Array(bytes);
  }

  private static centerText(text: string, width: number): string {
    if (text.length >= width) return text.substring(0, width);
    const totalPadding = width - text.length;
    const padLeft = Math.floor(totalPadding / 2);
    return ' '.repeat(padLeft) + text;
  }
}
