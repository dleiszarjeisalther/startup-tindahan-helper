// src/domain/strategies/DashboardAnalyticsEngine.ts
import { Money } from '../value-objects/Money';
import { ProductDTO, ProductVisual } from '../entities/Product';

export type AnalyticsPeriod = 'Daily' | 'Weekly' | 'Monthly';

export interface DateRangeFilter {
  startMs: number;
  endMs: number;
  label: string;
}

export type DateFilterInput = AnalyticsPeriod | DateRangeFilter;
export type PaymentTenderType = 'CASH' | 'GCASH' | 'UTANG' | 'SPLIT';
export type TransactionStatus = 'COMPLETED' | 'PARTIAL_RETURN' | 'REFUNDED' | 'VOIDED';

export interface DashboardSaleLineItem {
  productId: string;
  name: string;
  quantity: number;
  returnedQty?: number;
  unitPricePaidPhp: number;
  lineTotalPhp: number;
  unitCostPhp?: number;
  unitOfMeasure?: 'pc' | 'kg';
  formattedQuantity?: string;
}

export interface DashboardSaleTransaction {
  id: string;
  timeLabel?: string;
  dateLabel: string;
  timestampMs?: number;
  totalPhp: number;
  formattedTotal?: string;
  amountTenderedPhp?: number;
  changeDuePhp?: number;
  gcashRef?: string;
  paymentReference?: string;
  convenienceFeePhp?: number;
  refundedPhp?: number;
  itemCount?: number;
  tenderType: PaymentTenderType;
  customerName?: string;
  isOneTimeBulkOrder?: boolean;
  status: TransactionStatus;
  items: DashboardSaleLineItem[];
  transactionType?: 'SALE' | 'UTANG_PAYMENT';
  costPhp?: number;
  tuboPhp?: number;
  profitMarginPercent?: number;
  markupPercent?: number;
}

export interface DashboardCashAdjustment {
  id: string;
  type: 'PANUKLI' | 'GASTOS';
  amountPhp: number;
  category?: string;
  note?: string;
  timestampMs: number;
}

export interface DashboardFinancialMetrics {
  grossSales: Money;
  totalCost: Money;
  netProfit: Money;
  cashInDrawer: Money;
  utangCollected: Money;
  utangCreditIssued: Money;
  cashSales: Money;
  gcashSales: Money;
  profitMarginPercent: number;
  markupPercent: number;
  transactionCount: number;
  itemsSold: number;
  voidedTotal: Money;
  voidedCount: number;
  periodLabel: string;
}

export interface TrendBarPoint {
  id: string;
  label: string;
  subLabel: string;
  sales: Money;
  salesPhp: number;
  heightPercent: number;
  isPeak: boolean;
  transactionCount: number;
}

export interface DashboardTopProduct {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: Money;
  revenuePhp: number;
  currentStock: number;
  imageUri?: string;
  visual?: ProductVisual;
  unitLabel: string;
  isOutOfStock: boolean;
  isLowStock: boolean;
}

export interface PaymentDistributionItem {
  tenderType: PaymentTenderType;
  label: string;
  amount: Money;
  amountPhp: number;
  percentage: number;
  color: string;
}

export interface PaymentDistributionSummary {
  items: PaymentDistributionItem[];
  total: Money;
  totalPhp: number;
}

/**
 * Pure Domain Strategy for Tindahan Analytics & Financial KPIs.
 * Zero React/Expo dependencies. All monetary arithmetic is conducted
 * via integer centavos and Money value objects to eliminate floating-point drift.
 */
export class DashboardAnalyticsEngine {
  private readonly productsMap: Map<string, ProductDTO>;

  constructor(
    private readonly transactions: readonly DashboardSaleTransaction[],
    private readonly products: readonly ProductDTO[],
    private readonly adjustments: readonly DashboardCashAdjustment[] = [],
    private readonly nowProvider: () => Date = () => new Date()
  ) {
    this.productsMap = new Map((products ?? []).map((p) => [p.id, p]));
  }

  /**
   * Resolves the timestamp in milliseconds from a transaction safely.
   */
  public resolveTxTimestamp(tx: DashboardSaleTransaction): number {
    if (typeof tx.timestampMs === 'number' && Number.isFinite(tx.timestampMs) && tx.timestampMs > 0) {
      return tx.timestampMs;
    }
    const parsed = new Date(tx.dateLabel).getTime();
    return Number.isFinite(parsed) ? parsed : this.nowProvider().getTime();
  }

  /**
   * Checks whether a given timestamp matches the active period filter.
   */
  public matchesPeriod(timestampMs: number, filter: DateFilterInput): boolean {
    if (!Number.isFinite(timestampMs) || isNaN(timestampMs)) {
      return true;
    }

    if (typeof filter === 'object' && filter !== null) {
      return timestampMs >= filter.startMs && timestampMs <= filter.endMs;
    }

    const now = this.nowProvider();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();
    const targetDate = new Date(timestampMs);

    if (filter === 'Daily') {
      return (
        targetDate.getFullYear() === todayYear &&
        targetDate.getMonth() === todayMonth &&
        targetDate.getDate() === todayDate
      );
    }

    if (filter === 'Weekly') {
      const startOfWeekly = new Date(todayYear, todayMonth, todayDate - 6, 0, 0, 0, 0).getTime();
      const endOfToday = new Date(todayYear, todayMonth, todayDate, 23, 59, 59, 999).getTime();
      return timestampMs >= startOfWeekly && timestampMs <= endOfToday;
    }

    // Monthly
    return (
      targetDate.getFullYear() === todayYear &&
      targetDate.getMonth() === todayMonth
    );
  }

  /**
   * Returns human-readable label for the chosen filter.
   */
  public getPeriodLabel(filter: DateFilterInput): string {
    if (typeof filter === 'object' && filter !== null) {
      return filter.label || 'Sariling Petsa';
    }
    if (filter === 'Daily') return 'Ngayong Araw (Daily)';
    if (filter === 'Weekly') return 'Nakaraang 7 Araw (Weekly)';
    if (filter === 'Monthly') return 'Buwanang Tala (Monthly)';
    return 'Lahat';
  }

  /**
   * Calculates financial metrics and KPIs using Money value objects.
   */
  public computeMetrics(filter: DateFilterInput): DashboardFinancialMetrics {
    const periodTxs = this.transactions.filter((tx) =>
      this.matchesPeriod(this.resolveTxTimestamp(tx), filter)
    );

    const activePeriodTxs = periodTxs.filter((t) => t.status !== 'VOIDED');
    const voidedTxs = periodTxs.filter((t) => t.status === 'VOIDED');

    let voidedCentavos = 0;
    for (const v of voidedTxs) {
      voidedCentavos += Math.round(v.totalPhp * 100);
    }

    // Separate Merchandise Sales vs Debt Payments
    const activeSales = activePeriodTxs.filter((t) => t.transactionType !== 'UTANG_PAYMENT');
    const activePayments = activePeriodTxs.filter((t) => t.transactionType === 'UTANG_PAYMENT');

    let grossSalesCentavos = 0;
    let itemsSold = 0;
    let totalCostCentavos = 0;

    let cashSalesCentavos = 0;
    let gcashSalesCentavos = 0;
    let utangCreditCentavos = 0;

    for (const sale of activeSales) {
      const netSalePhp = Math.max(0, sale.totalPhp - (sale.refundedPhp ?? 0));
      const netCentavos = Math.round(netSalePhp * 100);
      grossSalesCentavos += netCentavos;

      if (sale.tenderType === 'CASH') {
        cashSalesCentavos += netCentavos;
      } else if (sale.tenderType === 'GCASH') {
        gcashSalesCentavos += netCentavos;
      } else if (sale.tenderType === 'UTANG') {
        utangCreditCentavos += netCentavos;
      } else if (sale.tenderType === 'SPLIT') {
        const cashPortion = Math.min(netSalePhp, Math.max(0, sale.amountTenderedPhp ?? 0));
        const utangPortion = Math.max(0, netSalePhp - cashPortion);
        cashSalesCentavos += Math.round(cashPortion * 100);
        utangCreditCentavos += Math.round(utangPortion * 100);
      }

      for (const item of sale.items) {
        const netQty = Math.max(0, item.quantity - (item.returnedQty ?? 0));
        if (netQty <= 0) continue;
        itemsSold += netQty;

        const prod = this.productsMap.get(item.productId);
        const unitPrice =
          item.unitPricePaidPhp > 0
            ? item.unitPricePaidPhp
            : item.quantity > 0
            ? item.lineTotalPhp / item.quantity
            : 0;

        const unitCost = this.resolveItemCost(item.unitCostPhp, unitPrice, prod?.unitCostPhp);
        totalCostCentavos += Math.round(unitCost * 100 * netQty);
      }
    }

    let utangCollectedCentavos = 0;
    let utangCashCollectedCentavos = 0;
    for (const p of activePayments) {
      const pCentavos = Math.round(p.totalPhp * 100);
      utangCollectedCentavos += pCentavos;
      if (p.tenderType === 'CASH') {
        utangCashCollectedCentavos += pCentavos;
      }
    }

    // Cash Drawer adjustments in the period
    const periodAdjustments = this.adjustments.filter((adj) =>
      this.matchesPeriod(adj.timestampMs, filter)
    );

    let panukliCentavos = 0;
    let gastosCentavos = 0;
    for (const adj of periodAdjustments) {
      const adjCentavos = Math.round(adj.amountPhp * 100);
      if (adj.type === 'PANUKLI') {
        panukliCentavos += adjCentavos;
      } else if (adj.type === 'GASTOS') {
        gastosCentavos += adjCentavos;
      }
    }

    // Cash In Drawer = Starting Float (Panukli) + Cash Sales + Utang Cash Collected - Gastos
    const cashInDrawerCentavos = Math.max(
      0,
      panukliCentavos + cashSalesCentavos + utangCashCollectedCentavos - gastosCentavos
    );

    const grossSales = Money.fromCentavos(grossSalesCentavos);
    const totalCost = Money.fromCentavos(totalCostCentavos);
    const netProfit = grossSales.subtract(totalCost);

    const profitMarginPercent =
      grossSalesCentavos > 0
        ? Number(((netProfit.centavos / grossSalesCentavos) * 100).toFixed(1))
        : 0;

    const markupPercent =
      totalCostCentavos > 0
        ? Number(((netProfit.centavos / totalCostCentavos) * 100).toFixed(1))
        : 0;

    return {
      grossSales,
      totalCost,
      netProfit,
      cashInDrawer: Money.fromCentavos(cashInDrawerCentavos),
      utangCollected: Money.fromCentavos(utangCollectedCentavos),
      utangCreditIssued: Money.fromCentavos(utangCreditCentavos),
      cashSales: Money.fromCentavos(cashSalesCentavos),
      gcashSales: Money.fromCentavos(gcashSalesCentavos),
      profitMarginPercent,
      markupPercent,
      transactionCount: activeSales.length + activePayments.length,
      itemsSold,
      voidedTotal: Money.fromCentavos(voidedCentavos),
      voidedCount: voidedTxs.length,
      periodLabel: this.getPeriodLabel(filter),
    };
  }

  /**
   * Generates responsive visual trend bars scaled against the peak bucket.
   */
  public getTrendBars(filter: DateFilterInput): TrendBarPoint[] {
    const periodTxs = this.transactions.filter((tx) =>
      this.matchesPeriod(this.resolveTxTimestamp(tx), filter)
    );
    const activeSales = periodTxs.filter(
      (t) => t.status !== 'VOIDED' && t.transactionType !== 'UTANG_PAYMENT'
    );

    const bars: TrendBarPoint[] = [];

    if (filter === 'Daily') {
      // 6 time buckets throughout the day
      const dailyBuckets = [
        { id: 'b_early', label: 'Bago 9a', subLabel: 'Bago mag-9:00 AM (Almusal)', startH: 0, endH: 9 },
        { id: 'b_9_12', label: '9-12p', subLabel: '9:00 - 12:00 PM (Tanghali)', startH: 9, endH: 12 },
        { id: 'b_12_15', label: '12-3p', subLabel: '12:00 - 3:00 PM (Hapon)', startH: 12, endH: 15 },
        { id: 'b_15_18', label: '3-6p', subLabel: '3:00 - 6:00 PM (Merienda)', startH: 15, endH: 18 },
        { id: 'b_18_21', label: '6-9p', subLabel: '6:00 - 9:00 PM (Hapunan)', startH: 18, endH: 21 },
        { id: 'b_21_24', label: '9p+', subLabel: '9:00 PM hanggang hatinggabi', startH: 21, endH: 24 },
      ];

      for (const bucket of dailyBuckets) {
        let bucketCentavos = 0;
        let count = 0;

        for (const sale of activeSales) {
          const ms = this.resolveTxTimestamp(sale);
          const d = new Date(ms);
          const h = d.getHours();
          const matchesHour =
            bucket.startH === 0
              ? h < 9
              : bucket.startH === 21
              ? h >= 21
              : h >= bucket.startH && h < bucket.endH;

          if (matchesHour) {
            const netSale = Math.max(0, sale.totalPhp - (sale.refundedPhp ?? 0));
            bucketCentavos += Math.round(netSale * 100);
            count++;
          }
        }

        const sales = Money.fromCentavos(bucketCentavos);
        bars.push({
          id: bucket.id,
          label: bucket.label,
          subLabel: bucket.subLabel,
          sales,
          salesPhp: sales.php,
          heightPercent: 0,
          isPeak: false,
          transactionCount: count,
        });
      }
    } else if (filter === 'Weekly') {
      // 7 calendar days for the past week
      const now = this.nowProvider();
      const dayNames = ['Lin', 'Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab'];

      for (let i = 6; i >= 0; i--) {
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const dayLabel = dayNames[target.getDay()];
        const subLabel = target.toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
        });

        let dayCentavos = 0;
        let count = 0;

        for (const sale of activeSales) {
          const ms = this.resolveTxTimestamp(sale);
          const d = new Date(ms);
          if (
            d.getFullYear() === target.getFullYear() &&
            d.getMonth() === target.getMonth() &&
            d.getDate() === target.getDate()
          ) {
            const netSale = Math.max(0, sale.totalPhp - (sale.refundedPhp ?? 0));
            dayCentavos += Math.round(netSale * 100);
            count++;
          }
        }

        const sales = Money.fromCentavos(dayCentavos);
        bars.push({
          id: `w_${target.getTime()}`,
          label: dayLabel,
          subLabel,
          sales,
          salesPhp: sales.php,
          heightPercent: 0,
          isPeak: false,
          transactionCount: count,
        });
      }
    } else if (filter === 'Monthly') {
      // 5 week segments of the current month
      const now = this.nowProvider();
      const todayYear = now.getFullYear();
      const todayMonth = now.getMonth();
      const daysInMonth = new Date(todayYear, todayMonth + 1, 0).getDate();

      const monthBuckets = [
        { id: 'm_w1', label: 'W1', subLabel: 'Petsa 1-7', startD: 1, endD: 7 },
        { id: 'm_w2', label: 'W2', subLabel: 'Petsa 8-14', startD: 8, endD: 14 },
        { id: 'm_w3', label: 'W3', subLabel: 'Petsa 15-21', startD: 15, endD: 21 },
        { id: 'm_w4', label: 'W4', subLabel: 'Petsa 22-28', startD: 22, endD: 28 },
        { id: 'm_w5', label: 'W5', subLabel: `Petsa 29-${daysInMonth}`, startD: 29, endD: daysInMonth },
      ];

      for (const bucket of monthBuckets) {
        let segCentavos = 0;
        let count = 0;

        for (const sale of activeSales) {
          const ms = this.resolveTxTimestamp(sale);
          const d = new Date(ms);
          if (
            d.getFullYear() === todayYear &&
            d.getMonth() === todayMonth &&
            d.getDate() >= bucket.startD &&
            d.getDate() <= bucket.endD
          ) {
            const netSale = Math.max(0, sale.totalPhp - (sale.refundedPhp ?? 0));
            segCentavos += Math.round(netSale * 100);
            count++;
          }
        }

        const sales = Money.fromCentavos(segCentavos);
        bars.push({
          id: bucket.id,
          label: bucket.label,
          subLabel: bucket.subLabel,
          sales,
          salesPhp: sales.php,
          heightPercent: 0,
          isPeak: false,
          transactionCount: count,
        });
      }
    } else {
      // Custom Date Range
      const customRange = filter as DateRangeFilter;
      const spanDays = Math.max(
        1,
        Math.ceil((customRange.endMs - customRange.startMs) / 86400000)
      );

      if (spanDays <= 7) {
        // Daily breakdown for <= 7 days
        const startD = new Date(customRange.startMs);
        for (let i = 0; i < spanDays; i++) {
          const target = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate() + i);
          const label = target.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
          });

          let dayCentavos = 0;
          let count = 0;

          for (const sale of activeSales) {
            const ms = this.resolveTxTimestamp(sale);
            const d = new Date(ms);
            if (
              d.getFullYear() === target.getFullYear() &&
              d.getMonth() === target.getMonth() &&
              d.getDate() === target.getDate()
            ) {
              const netSale = Math.max(0, sale.totalPhp - (sale.refundedPhp ?? 0));
              dayCentavos += Math.round(netSale * 100);
              count++;
            }
          }

          const sales = Money.fromCentavos(dayCentavos);
          bars.push({
            id: `c_${target.getTime()}`,
            label,
            subLabel: target.toLocaleDateString('en-US', { weekday: 'short' }),
            sales,
            salesPhp: sales.php,
            heightPercent: 0,
            isPeak: false,
            transactionCount: count,
          });
        }
      } else {
        // Divide custom range into 5 equal buckets
        const bucketDuration = (customRange.endMs - customRange.startMs) / 5;
        for (let i = 0; i < 5; i++) {
          const bStart = customRange.startMs + i * bucketDuration;
          const bEnd = bStart + bucketDuration;
          const startDate = new Date(bStart);
          const endDate = new Date(bEnd);

          const label = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
          const subLabel = `Petsa ${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getMonth() + 1}/${endDate.getDate()}`;

          let bCentavos = 0;
          let count = 0;

          for (const sale of activeSales) {
            const ms = this.resolveTxTimestamp(sale);
            if (ms >= bStart && (i === 4 ? ms <= bEnd : ms < bEnd)) {
              const netSale = Math.max(0, sale.totalPhp - (sale.refundedPhp ?? 0));
              bCentavos += Math.round(netSale * 100);
              count++;
            }
          }

          const sales = Money.fromCentavos(bCentavos);
          bars.push({
            id: `c_bucket_${i}`,
            label,
            subLabel,
            sales,
            salesPhp: sales.php,
            heightPercent: 0,
            isPeak: false,
            transactionCount: count,
          });
        }
      }
    }

    // Scale heights and identify peak
    const maxCentavos = Math.max(0, ...bars.map((b) => b.sales.centavos));
    for (const bar of bars) {
      if (maxCentavos > 0) {
        bar.isPeak = bar.sales.centavos === maxCentavos && maxCentavos > 0;
        // Keep minimum visual height of 8% if there are sales in that bucket
        bar.heightPercent =
          bar.sales.centavos > 0
            ? Math.max(8, Math.round((bar.sales.centavos / maxCentavos) * 100))
            : 0;
      } else {
        bar.heightPercent = 0;
        bar.isPeak = false;
      }
    }

    return bars;
  }

  /**
   * Identifies and ranks top-selling products by quantity and revenue.
   */
  public getTopSellingProducts(
    filter: DateFilterInput,
    limit: number = 5
  ): DashboardTopProduct[] {
    const periodTxs = this.transactions.filter((tx) =>
      this.matchesPeriod(this.resolveTxTimestamp(tx), filter)
    );
    const activeSales = periodTxs.filter(
      (t) => t.status !== 'VOIDED' && t.transactionType !== 'UTANG_PAYMENT'
    );

    const aggMap = new Map<
      string,
      { productId: string; name: string; unitsSold: number; revenueCentavos: number }
    >();

    for (const sale of activeSales) {
      for (const item of sale.items) {
        const netQty = Math.max(0, item.quantity - (item.returnedQty ?? 0));
        if (netQty <= 0) continue;

        const unitPrice =
          item.unitPricePaidPhp > 0
            ? item.unitPricePaidPhp
            : item.quantity > 0
            ? item.lineTotalPhp / item.quantity
            : 0;

        const netLineCentavos = Math.round(netQty * unitPrice * 100);

        const current = aggMap.get(item.productId) ?? {
          productId: item.productId,
          name: item.name,
          unitsSold: 0,
          revenueCentavos: 0,
        };

        current.unitsSold += netQty;
        current.revenueCentavos += netLineCentavos;
        aggMap.set(item.productId, current);
      }
    }

    const results: DashboardTopProduct[] = Array.from(aggMap.values())
      .map((entry) => {
        const prod = this.productsMap.get(entry.productId);
        const currentStock = prod ? prod.stockCount : 0;
        const lowThreshold = prod ? prod.effectiveLowStockThreshold : 5;
        const unitLabel = prod?.formattedUnit || prod?.unitOfMeasure || 'pc';

        return {
          productId: entry.productId,
          name: entry.name,
          unitsSold: entry.unitsSold,
          revenue: Money.fromCentavos(entry.revenueCentavos),
          revenuePhp: entry.revenueCentavos / 100,
          currentStock,
          imageUri: prod?.imageUri,
          visual: prod?.visual,
          unitLabel,
          isOutOfStock: currentStock <= 0,
          isLowStock: currentStock > 0 && currentStock <= lowThreshold,
        };
      })
      .sort((a, b) => {
        if (b.unitsSold !== a.unitsSold) {
          return b.unitsSold - a.unitsSold;
        }
        return b.revenue.centavos - a.revenue.centavos;
      });

    return results.slice(0, Math.max(1, limit));
  }

  /**
   * Computes payment method distribution (Cash vs GCash vs Utang).
   */
  public getPaymentDistribution(filter: DateFilterInput): PaymentDistributionSummary {
    const periodTxs = this.transactions.filter((tx) =>
      this.matchesPeriod(this.resolveTxTimestamp(tx), filter)
    );
    const activeSales = periodTxs.filter(
      (t) => t.status !== 'VOIDED' && t.transactionType !== 'UTANG_PAYMENT'
    );

    let cashCentavos = 0;
    let gcashCentavos = 0;
    let utangCentavos = 0;

    for (const sale of activeSales) {
      const netSalePhp = Math.max(0, sale.totalPhp - (sale.refundedPhp ?? 0));
      const netCentavos = Math.round(netSalePhp * 100);

      if (sale.tenderType === 'CASH') {
        cashCentavos += netCentavos;
      } else if (sale.tenderType === 'GCASH') {
        gcashCentavos += netCentavos;
      } else if (sale.tenderType === 'UTANG') {
        utangCentavos += netCentavos;
      } else if (sale.tenderType === 'SPLIT') {
        const cashPortion = Math.min(netSalePhp, Math.max(0, sale.amountTenderedPhp ?? 0));
        const utangPortion = Math.max(0, netSalePhp - cashPortion);
        cashCentavos += Math.round(cashPortion * 100);
        utangCentavos += Math.round(utangPortion * 100);
      }
    }

    const totalCentavos = cashCentavos + gcashCentavos + utangCentavos;
    let cashPct = 0;
    let gcashPct = 0;
    let utangPct = 0;

    if (totalCentavos > 0) {
      cashPct = Math.round((cashCentavos / totalCentavos) * 100);
      gcashPct = Math.round((gcashCentavos / totalCentavos) * 100);
      utangPct = Math.max(0, 100 - cashPct - gcashPct); // Ensure sum is exactly 100%
    }

    const items: PaymentDistributionItem[] = [
      {
        tenderType: 'CASH',
        label: 'Cash (Barya at Papel)',
        amount: Money.fromCentavos(cashCentavos),
        amountPhp: cashCentavos / 100,
        percentage: cashPct,
        color: '#10B981', // Emerald green
      },
      {
        tenderType: 'GCASH',
        label: 'GCash / QR Ph',
        amount: Money.fromCentavos(gcashCentavos),
        amountPhp: gcashCentavos / 100,
        percentage: gcashPct,
        color: '#0284C7', // Sky blue
      },
      {
        tenderType: 'UTANG',
        label: 'Pina-utang (Suki)',
        amount: Money.fromCentavos(utangCentavos),
        amountPhp: utangCentavos / 100,
        percentage: utangPct,
        color: '#F59E0B', // Warm amber
      },
    ];

    const totalMoney = Money.fromCentavos(totalCentavos);
    return {
      items,
      total: totalMoney,
      totalPhp: totalMoney.php,
    };
  }

  /**
   * Resolves individual item cost dynamically with safety heal fallbacks.
   */
  private resolveItemCost(
    itemUnitCost: number | undefined,
    unitPrice: number,
    prodUnitCost?: number
  ): number {
    if (unitPrice <= 0) return 0;
    if (itemUnitCost !== undefined && itemUnitCost > 0 && itemUnitCost < unitPrice) {
      return itemUnitCost;
    }
    if (prodUnitCost !== undefined && prodUnitCost > 0 && prodUnitCost < unitPrice) {
      return prodUnitCost;
    }
    // Auto 75% standard retail fallback (25% profit margin)
    const fallback = Number((unitPrice * 0.75).toFixed(2));
    return fallback >= unitPrice ? Math.max(0.01, unitPrice * 0.7) : Math.max(0.01, fallback);
  }
}
