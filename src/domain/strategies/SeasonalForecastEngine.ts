// src/domain/strategies/SeasonalForecastEngine.ts

export interface MonthlySalesRecord {
  year: number;
  month: number; // 1 (Jan) .. 12 (Dec)
  grossUnitsSold: number;
  voidedUnits: number;
  returnedChangedMindUnits: number;
  outOfStockDays: number;
  totalDaysInMonth: number;
}

export type ForecastConfidenceTier =
  | 'PROVISIONAL_UNDER_12M'
  | 'INITIAL_CYCLE_12_23M'
  | 'VERIFIED_RECURRING_24M_PLUS';

export interface SeasonalForecastResult {
  productId: string;
  productName: string;
  targetMonth: number;
  ordinaryMonthlyAverage: number;
  seasonalIndex: number;
  peakVsOrdinaryMultiplier: number;
  forecastedUnits: number;
  currentStock: number;
  recommendedRestockQty: number;
  confidenceTier: ForecastConfidenceTier;
  explanation: string;
}

export interface ISeasonalForecastStrategy {
  forecast(
    productId: string,
    productName: string,
    history: MonthlySalesRecord[],
    targetMonth: number,
    currentStock: number,
    categoryPriorIndex: number
  ): SeasonalForecastResult;
}

/**
 * Abstract Base Class (OOP Inheritance + Template Method):
 * Computes Net Uncensored Monthly Demand D(i,y,m) by subtracting voids/returns
 * and imputing stockout-censored days (when Stock == 0 in Screen 4).
 */
export abstract class BaseSeasonalStrategy implements ISeasonalForecastStrategy {
  protected computeUncensoredNetDemand(record: MonthlySalesRecord): number {
    const netSold = Math.max(
      0,
      record.grossUnitsSold - record.voidedUnits - record.returnedChangedMindUnits
    );
    const inStockDays = Math.max(1, record.totalDaysInMonth - record.outOfStockDays);
    const availabilityFactor = Math.min(2.0, record.totalDaysInMonth / inStockDays);
    return netSold * availabilityFactor;
  }

  public abstract forecast(
    productId: string,
    productName: string,
    history: MonthlySalesRecord[],
    targetMonth: number,
    currentStock: number,
    categoryPriorIndex: number
  ): SeasonalForecastResult;
}

/**
 * Strategy 1: 24+ Months History (Multi-Year Recurring YoY Comparison)
 */
export class Recurring24MonthYoYStrategy extends BaseSeasonalStrategy {
  public forecast(
    productId: string,
    productName: string,
    history: MonthlySalesRecord[],
    targetMonth: number,
    currentStock: number
  ): SeasonalForecastResult {
    const uncensored = history.map((r) => ({
      ...r,
      demand: this.computeUncensoredNetDemand(r),
    }));

    const years = Array.from(new Set(uncensored.map((r) => r.year))).sort();
    const monthlyFactors: number[] = [];

    for (const yr of years) {
      const yearRecords = uncensored.filter((r) => r.year === yr);
      if (yearRecords.length < 6) continue;
      const yearAvg =
        yearRecords.reduce((sum, r) => sum + r.demand, 0) / yearRecords.length;
      const targetRecord = yearRecords.find((r) => r.month === targetMonth);
      if (targetRecord && yearAvg > 0) {
        monthlyFactors.push(targetRecord.demand / yearAvg);
      }
    }

    const seasonalIndex =
      monthlyFactors.length > 0
        ? monthlyFactors.reduce((a, b) => a + b, 0) / monthlyFactors.length
        : 1.0;

    const recent12 = uncensored.slice(-12);
    const t12mBaseline =
      recent12.reduce((sum, r) => sum + r.demand, 0) / Math.max(1, recent12.length);

    const ordinaryMonths = uncensored.filter((r) => r.month !== targetMonth);
    const ordinaryAvg =
      ordinaryMonths.reduce((sum, r) => sum + r.demand, 0) /
      Math.max(1, ordinaryMonths.length);

    const forecastedUnits = Math.ceil(t12mBaseline * seasonalIndex);
    const safetyStock = Math.ceil(forecastedUnits * 0.15);
    const recommendedRestockQty = Math.max(0, forecastedUnits + safetyStock - currentStock);

    return {
      productId,
      productName,
      targetMonth,
      ordinaryMonthlyAverage: Math.round(ordinaryAvg),
      seasonalIndex: Number(seasonalIndex.toFixed(2)),
      peakVsOrdinaryMultiplier: Number(
        (forecastedUnits / Math.max(1, ordinaryAvg)).toFixed(1)
      ),
      forecastedUnits,
      currentStock,
      recommendedRestockQty,
      confidenceTier: 'VERIFIED_RECURRING_24M_PLUS',
      explanation: `Verified recurring pattern across ${years.length} annual cycles (${history.length} months of store history).`,
    };
  }
}

/**
 * Strategy 2: 12–23 Months History (Initial Seasonal Cycle)
 */
export class InitialCycle12MonthStrategy extends BaseSeasonalStrategy {
  public forecast(
    productId: string,
    productName: string,
    history: MonthlySalesRecord[],
    targetMonth: number,
    currentStock: number,
    categoryPriorIndex: number
  ): SeasonalForecastResult {
    const uncensored = history.map((r) => ({
      ...r,
      demand: this.computeUncensoredNetDemand(r),
    }));
    const t12mBaseline =
      uncensored.reduce((sum, r) => sum + r.demand, 0) / Math.max(1, uncensored.length);
    const sameMonthLastYear = uncensored.find((r) => r.month === targetMonth);
    const rawStoreIndex =
      sameMonthLastYear && t12mBaseline > 0
        ? sameMonthLastYear.demand / t12mBaseline
        : categoryPriorIndex;

    const ordinaryMonths = uncensored.filter((r) => r.month !== targetMonth);
    const ordinaryAvg =
      ordinaryMonths.reduce((sum, r) => sum + r.demand, 0) /
      Math.max(1, ordinaryMonths.length);

    const blendedIndex = 0.7 * rawStoreIndex + 0.3 * categoryPriorIndex;
    const forecastedUnits = Math.ceil(t12mBaseline * blendedIndex);
    const recommendedRestockQty = Math.max(
      0,
      Math.ceil(forecastedUnits * 1.15) - currentStock
    );

    return {
      productId,
      productName,
      targetMonth,
      ordinaryMonthlyAverage: Math.round(ordinaryAvg),
      seasonalIndex: Number(blendedIndex.toFixed(2)),
      peakVsOrdinaryMultiplier: Number(
        (forecastedUnits / Math.max(1, ordinaryAvg)).toFixed(1)
      ),
      forecastedUnits,
      currentStock,
      recommendedRestockQty,
      confidenceTier: 'INITIAL_CYCLE_12_23M',
      explanation:
        'Initial 12-month seasonal cycle combined with category benchmark smoothing.',
    };
  }
}

/**
 * Strategy 3: < 12 Months History (Cold-Start Category Priors)
 */
export class ColdStartCategoryStrategy extends BaseSeasonalStrategy {
  public forecast(
    productId: string,
    productName: string,
    history: MonthlySalesRecord[],
    targetMonth: number,
    currentStock: number,
    categoryPriorIndex: number
  ): SeasonalForecastResult {
    const uncensored = history.map((r) => this.computeUncensoredNetDemand(r));
    const ordinaryAvg =
      uncensored.length > 0
        ? uncensored.reduce((a, b) => a + b, 0) / uncensored.length
        : 15;
    const forecastedUnits = Math.ceil(ordinaryAvg * categoryPriorIndex);
    const recommendedRestockQty = Math.max(
      0,
      Math.ceil(forecastedUnits * 1.15) - currentStock
    );

    return {
      productId,
      productName,
      targetMonth,
      ordinaryMonthlyAverage: Math.round(ordinaryAvg),
      seasonalIndex: Number(categoryPriorIndex.toFixed(2)),
      peakVsOrdinaryMultiplier: Number(categoryPriorIndex.toFixed(1)),
      forecastedUnits,
      currentStock,
      recommendedRestockQty,
      confidenceTier: 'PROVISIONAL_UNDER_12M',
      explanation:
        'Provisional forecast (<12 months history) using Philippine Tindahan seasonal category benchmark.',
    };
  }
}

/**
 * Context Orchestrator that selects the right OOP Strategy based on history depth
 */
export class SeasonalForecastEngine {
  private readonly coldStart = new ColdStartCategoryStrategy();
  private readonly initial12m = new InitialCycle12MonthStrategy();
  private readonly recurring24m = new Recurring24MonthYoYStrategy();

  public evaluateProductSeasonality(
    productId: string,
    productName: string,
    history: MonthlySalesRecord[],
    targetMonth: number,
    currentStock: number,
    categoryPriorIndex = 1.0
  ): SeasonalForecastResult {
    if (history.length >= 24) {
      return this.recurring24m.forecast(
        productId,
        productName,
        history,
        targetMonth,
        currentStock
      );
    }
    if (history.length >= 12) {
      return this.initial12m.forecast(
        productId,
        productName,
        history,
        targetMonth,
        currentStock,
        categoryPriorIndex
      );
    }
    return this.coldStart.forecast(
      productId,
      productName,
      history,
      targetMonth,
      currentStock,
      categoryPriorIndex
    );
  }
}
