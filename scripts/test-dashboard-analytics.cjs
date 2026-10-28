// scripts/test-dashboard-analytics.cjs
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');

// Transpile .ts on the fly in CommonJS environment
require.extensions[''.concat('.ts')] = (module, filename) => {
  const content = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  module._compile(transpiled.outputText, filename);
};

const {
  DashboardAnalyticsEngine,
} = require('../src/domain/strategies/DashboardAnalyticsEngine.ts');
const { Money } = require('../src/domain/value-objects/Money.ts');

// Helper to create mock product
function createMockProduct(id, name, unitCostPhp, pricePhp, stockCount = 20, lowThreshold = 5) {
  return {
    id,
    name,
    category: 'Sari-Sari',
    barcode: `BAR_${id}`,
    barcodeSource: 'MANUAL_ENTRY',
    stockCount,
    quarantineStockCount: 0,
    outOfStockDays: 0,
    stockStatus: stockCount <= 0 ? 'OUT_OF_STOCK' : stockCount <= lowThreshold ? 'LOW_STOCK' : 'IN_STOCK',
    unitCostPhp,
    defaultPricePhp: pricePhp,
    catalogDisplayPricePhp: pricePhp,
    formattedPrice: `₱${pricePhp.toFixed(2)}`,
    formattedCatalogPrice: `₱${pricePhp.toFixed(2)}`,
    ordinaryLowStockThreshold: lowThreshold,
    effectiveLowStockThreshold: lowThreshold,
    visual: {
      primaryColor: '#059669',
      textColor: '#FFFFFF',
      shortLabel: name.substring(0, 2),
      subLabel: '',
      shape: 'POUCH',
    },
    unitOfMeasure: 'PIECE',
    formattedUnit: 'pc',
    formattedStock: `${stockCount} pc`,
    sellingTiers: [],
  };
}

// Fixed reference date: Wednesday, October 28, 2026 14:30:00 (2:30 PM)
const fixedDate = new Date(2026, 9, 28, 14, 30, 0); // October is month 9 (0-indexed)
const mockClock = () => new Date(fixedDate.getTime());

test('computes gross sales, net profit, margin and zero-float Money correctly', () => {
  const products = [
    createMockProduct('prod_coke', 'Coke Kasalo', 35, 45, 15),
    createMockProduct('prod_chips', 'Piattos', 15, 20, 30),
  ];

  // Transactions on today (Oct 28, 2026)
  const transactions = [
    {
      id: 'TX-001',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 10, 0, 0).getTime(), // 10 AM
      totalPhp: 90, // 2 Coke Kasalo @ 45
      refundedPhp: 0,
      tenderType: 'CASH',
      status: 'COMPLETED',
      items: [
        {
          productId: 'prod_coke',
          name: 'Coke Kasalo',
          quantity: 2,
          returnedQty: 0,
          unitPricePaidPhp: 45,
          lineTotalPhp: 90,
          unitCostPhp: 35,
        },
      ],
    },
    {
      id: 'TX-002',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 11, 30, 0).getTime(), // 11:30 AM
      totalPhp: 40, // 2 Piattos @ 20
      refundedPhp: 0,
      tenderType: 'GCASH',
      status: 'COMPLETED',
      items: [
        {
          productId: 'prod_chips',
          name: 'Piattos',
          quantity: 2,
          returnedQty: 0,
          unitPricePaidPhp: 20,
          lineTotalPhp: 40,
          unitCostPhp: 15,
        },
      ],
    },
  ];

  const engine = new DashboardAnalyticsEngine(transactions, products, [], mockClock);
  const metrics = engine.computeMetrics('Daily');

  // Gross sales = 90 + 40 = 130
  assert.equal(metrics.grossSales.php, 130);
  assert.equal(metrics.grossSales.centavos, 13000);

  // Total cost = (2 * 35) + (2 * 15) = 70 + 30 = 100
  assert.equal(metrics.totalCost.php, 100);

  // Net profit (Tubo) = 130 - 100 = 30
  assert.equal(metrics.netProfit.php, 30);
  assert.equal(metrics.netProfit.centavos, 3000);

  // Margin percent = (30 / 130) * 100 = 23.1%
  assert.equal(metrics.profitMarginPercent, 23.1);

  // Markup percent = (30 / 100) * 100 = 30.0%
  assert.equal(metrics.markupPercent, 30.0);

  assert.equal(metrics.transactionCount, 2);
  assert.equal(metrics.itemsSold, 4);
});

test('handles cash drawer float, sales, utang collection, and gastos accurately', () => {
  const products = [createMockProduct('prod_sardines', 'Sardinas', 18, 25)];

  const transactions = [
    // Cash sale: ₱50
    {
      id: 'TX-CASH-1',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 8, 0, 0).getTime(),
      totalPhp: 50,
      refundedPhp: 0,
      tenderType: 'CASH',
      status: 'COMPLETED',
      items: [
        {
          productId: 'prod_sardines',
          name: 'Sardinas',
          quantity: 2,
          returnedQty: 0,
          unitPricePaidPhp: 25,
          lineTotalPhp: 50,
          unitCostPhp: 18,
        },
      ],
    },
    // Utang collection payment: ₱100 in Cash
    {
      id: 'TX-UTANG-PAY-1',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 9, 0, 0).getTime(),
      totalPhp: 100,
      refundedPhp: 0,
      tenderType: 'CASH',
      status: 'COMPLETED',
      transactionType: 'UTANG_PAYMENT',
      items: [],
    },
  ];

  // Float adjustments: Starting Panukli = ₱200, Gastos (ice/yelo) = ₱30
  const adjustments = [
    {
      id: 'ADJ-1',
      type: 'PANUKLI',
      amountPhp: 200,
      timestampMs: new Date(2026, 9, 28, 6, 0, 0).getTime(),
    },
    {
      id: 'ADJ-2',
      type: 'GASTOS',
      amountPhp: 30,
      timestampMs: new Date(2026, 9, 28, 12, 0, 0).getTime(),
    },
  ];

  const engine = new DashboardAnalyticsEngine(transactions, products, adjustments, mockClock);
  const metrics = engine.computeMetrics('Daily');

  // Utang collection shouldn't inflate merchandise sales!
  assert.equal(metrics.grossSales.php, 50);
  assert.equal(metrics.utangCollected.php, 100);

  // Cash in drawer = 200 (panukli) + 50 (cash sale) + 100 (utang collection) - 30 (gastos) = 320
  assert.equal(metrics.cashInDrawer.php, 320);
});

test('excludes voided transactions and accounts for partial refunds and item returns', () => {
  const products = [createMockProduct('prod_noodles', 'Lucky Me', 12, 15)];

  const transactions = [
    // Completed sale with partial refund: ₱30 total, ₱15 refunded, 1 unit returned
    {
      id: 'TX-REFUND-1',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 10, 0, 0).getTime(),
      totalPhp: 30,
      refundedPhp: 15,
      tenderType: 'CASH',
      status: 'PARTIAL_RETURN',
      items: [
        {
          productId: 'prod_noodles',
          name: 'Lucky Me',
          quantity: 2,
          returnedQty: 1,
          unitPricePaidPhp: 15,
          lineTotalPhp: 30,
          unitCostPhp: 12,
        },
      ],
    },
    // Voided sale: ₱100
    {
      id: 'TX-VOID-1',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 11, 0, 0).getTime(),
      totalPhp: 100,
      refundedPhp: 0,
      tenderType: 'CASH',
      status: 'VOIDED',
      items: [
        {
          productId: 'prod_noodles',
          name: 'Lucky Me',
          quantity: 5,
          returnedQty: 0,
          unitPricePaidPhp: 15,
          lineTotalPhp: 75,
          unitCostPhp: 12,
        },
      ],
    },
  ];

  const engine = new DashboardAnalyticsEngine(transactions, products, [], mockClock);
  const metrics = engine.computeMetrics('Daily');

  // Gross sales = 30 - 15 = 15 (void is excluded)
  assert.equal(metrics.grossSales.php, 15);
  // Net cost = 1 unit net * 12 = 12
  assert.equal(metrics.totalCost.php, 12);
  // Net profit = 15 - 12 = 3
  assert.equal(metrics.netProfit.php, 3);
  // Items sold = 1 net unit
  assert.equal(metrics.itemsSold, 1);
  // Void tracking
  assert.equal(metrics.voidedCount, 1);
  assert.equal(metrics.voidedTotal.php, 100);
});

test('ranks top-selling products by quantity with revenue tie-breaker', () => {
  const products = [
    createMockProduct('prod_a', 'Egg', 8, 10, 100),
    createMockProduct('prod_b', 'Pandesal Pack', 25, 35, 10),
    createMockProduct('prod_c', 'Coffee Sachet', 11, 14, 2), // Low stock
  ];

  const transactions = [
    {
      id: 'TX-RANK-1',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 9, 0, 0).getTime(),
      totalPhp: 100,
      refundedPhp: 0,
      tenderType: 'CASH',
      status: 'COMPLETED',
      items: [
        { productId: 'prod_a', name: 'Egg', quantity: 5, unitPricePaidPhp: 10, lineTotalPhp: 50 },
        { productId: 'prod_b', name: 'Pandesal Pack', quantity: 2, unitPricePaidPhp: 35, lineTotalPhp: 70 },
        { productId: 'prod_c', name: 'Coffee Sachet', quantity: 10, unitPricePaidPhp: 14, lineTotalPhp: 140 },
      ],
    },
  ];

  const engine = new DashboardAnalyticsEngine(transactions, products, [], mockClock);
  const top = engine.getTopSellingProducts('Daily', 5);

  assert.equal(top.length, 3);
  // Top 1: Coffee Sachet (10 units)
  assert.equal(top[0].productId, 'prod_c');
  assert.equal(top[0].unitsSold, 10);
  assert.equal(top[0].isLowStock, true);

  // Top 2: Egg (5 units)
  assert.equal(top[1].productId, 'prod_a');
  assert.equal(top[1].unitsSold, 5);

  // Top 3: Pandesal Pack (2 units)
  assert.equal(top[2].productId, 'prod_b');
  assert.equal(top[2].unitsSold, 2);
});

test('generates trend bars with peak detection for Daily and Weekly periods', () => {
  const products = [createMockProduct('p1', 'Item 1', 10, 20)];

  const transactions = [
    // 7:30 AM: ₱20
    {
      id: 'TX-AM',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 7, 30, 0).getTime(),
      totalPhp: 20,
      refundedPhp: 0,
      tenderType: 'CASH',
      status: 'COMPLETED',
      items: [{ productId: 'p1', name: 'Item 1', quantity: 1, unitPricePaidPhp: 20, lineTotalPhp: 20 }],
    },
    // 10:15 AM: ₱80 (Peak)
    {
      id: 'TX-NOON',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 10, 15, 0).getTime(),
      totalPhp: 80,
      refundedPhp: 0,
      tenderType: 'CASH',
      status: 'COMPLETED',
      items: [{ productId: 'p1', name: 'Item 1', quantity: 4, unitPricePaidPhp: 20, lineTotalPhp: 80 }],
    },
  ];

  const engine = new DashboardAnalyticsEngine(transactions, products, [], mockClock);

  // Daily test
  const dailyBars = engine.getTrendBars('Daily');
  assert.equal(dailyBars.length, 6);

  // Bucket Bago 9a (id: b_early) has ₱20
  const bEarly = dailyBars.find((b) => b.id === 'b_early');
  assert.ok(bEarly);
  assert.equal(bEarly.salesPhp, 20);
  assert.equal(bEarly.isPeak, false);

  // Bucket 9-12p has ₱80 (Peak!)
  const b9_12 = dailyBars.find((b) => b.label === '9-12p');
  assert.equal(b9_12.salesPhp, 80);
  assert.equal(b9_12.isPeak, true);
  assert.equal(b9_12.heightPercent, 100);

  // Weekly test
  const weeklyBars = engine.getTrendBars('Weekly');
  assert.equal(weeklyBars.length, 7);
  const peakWeekly = weeklyBars.find((b) => b.isPeak);
  assert.ok(peakWeekly);
  assert.equal(peakWeekly.salesPhp, 100); // 20 + 80 = 100
});

test('handles SPLIT tender type by splitting cash and utang debt accurately', () => {
  const products = [createMockProduct('prod_rice', 'Bigas 1kg', 40, 50)];

  // Total ₱100. Customer tendered ₱30 cash. Shortfall ₱70 is utang.
  const transactions = [
    {
      id: 'TX-SPLIT-1',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 10, 0, 0).getTime(),
      totalPhp: 100,
      amountTenderedPhp: 30,
      refundedPhp: 0,
      tenderType: 'SPLIT',
      status: 'COMPLETED',
      items: [
        { productId: 'prod_rice', name: 'Bigas 1kg', quantity: 2, unitPricePaidPhp: 50, lineTotalPhp: 100, unitCostPhp: 40 },
      ],
    },
  ];

  const engine = new DashboardAnalyticsEngine(transactions, products, [], mockClock);
  const metrics = engine.computeMetrics('Daily');

  assert.equal(metrics.grossSales.php, 100);
  assert.equal(metrics.cashSales.php, 30);
  assert.equal(metrics.utangCreditIssued.php, 70);
  // Cash in drawer only includes actual cash tendered (₱30), not the utang portion
  assert.equal(metrics.cashInDrawer.php, 30);

  const dist = engine.getPaymentDistribution('Daily');
  const cashItem = dist.items.find((i) => i.tenderType === 'CASH');
  const utangItem = dist.items.find((i) => i.tenderType === 'UTANG');
  assert.equal(cashItem.amountPhp, 30);
  assert.equal(cashItem.percentage, 30);
  assert.equal(utangItem.amountPhp, 70);
  assert.equal(utangItem.percentage, 70);
});

test('deducts returned items from top-selling product revenue accurately', () => {
  const products = [createMockProduct('prod_soda', 'Royal Tru-Orange', 18, 25)];

  // Bought 5 bottles (₱125 total), returned 2 damaged bottles (refunded ₱50)
  const transactions = [
    {
      id: 'TX-RETURN-LEADER',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 11, 0, 0).getTime(),
      totalPhp: 125,
      refundedPhp: 50,
      tenderType: 'CASH',
      status: 'PARTIAL_RETURN',
      items: [
        {
          productId: 'prod_soda',
          name: 'Royal Tru-Orange',
          quantity: 5,
          returnedQty: 2,
          unitPricePaidPhp: 25,
          lineTotalPhp: 125,
        },
      ],
    },
  ];

  const engine = new DashboardAnalyticsEngine(transactions, products, [], mockClock);
  const top = engine.getTopSellingProducts('Daily', 5);

  assert.equal(top.length, 1);
  assert.equal(top[0].unitsSold, 3); // 5 - 2 = 3
  assert.equal(top[0].revenuePhp, 75); // 3 * 25 = 75, NOT 125!
});

test('computes payment distribution percentages summing to 100%', () => {
  const products = [createMockProduct('p1', 'Item 1', 10, 20)];

  const transactions = [
    // Cash: ₱60
    {
      id: 'TX-C',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 9, 0, 0).getTime(),
      totalPhp: 60,
      refundedPhp: 0,
      tenderType: 'CASH',
      status: 'COMPLETED',
      items: [{ productId: 'p1', name: 'Item 1', quantity: 3, unitPricePaidPhp: 20, lineTotalPhp: 60 }],
    },
    // GCash: ₱30
    {
      id: 'TX-G',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 10, 0, 0).getTime(),
      totalPhp: 30,
      refundedPhp: 0,
      tenderType: 'GCASH',
      status: 'COMPLETED',
      items: [{ productId: 'p1', name: 'Item 1', quantity: 1, unitPricePaidPhp: 30, lineTotalPhp: 30 }],
    },
    // Utang: ₱10
    {
      id: 'TX-U',
      dateLabel: 'Oct 28, 2026',
      timestampMs: new Date(2026, 9, 28, 11, 0, 0).getTime(),
      totalPhp: 10,
      refundedPhp: 0,
      tenderType: 'UTANG',
      status: 'COMPLETED',
      items: [{ productId: 'p1', name: 'Item 1', quantity: 1, unitPricePaidPhp: 10, lineTotalPhp: 10 }],
    },
  ];

  const engine = new DashboardAnalyticsEngine(transactions, products, [], mockClock);
  const dist = engine.getPaymentDistribution('Daily');

  assert.equal(dist.totalPhp, 100);
  const cashItem = dist.items.find((i) => i.tenderType === 'CASH');
  const gcashItem = dist.items.find((i) => i.tenderType === 'GCASH');
  const utangItem = dist.items.find((i) => i.tenderType === 'UTANG');

  assert.equal(cashItem.percentage, 60);
  assert.equal(gcashItem.percentage, 30);
  assert.equal(utangItem.percentage, 10);
  assert.equal(cashItem.percentage + gcashItem.percentage + utangItem.percentage, 100);
});

test('handles empty dataset gracefully without crashing or NaN values', () => {
  const engine = new DashboardAnalyticsEngine([], [], [], mockClock);

  const metrics = engine.computeMetrics('Daily');
  assert.equal(metrics.grossSales.php, 0);
  assert.equal(metrics.netProfit.php, 0);
  assert.equal(metrics.profitMarginPercent, 0);
  assert.equal(metrics.transactionCount, 0);

  const bars = engine.getTrendBars('Daily');
  assert.equal(bars.length, 6);
  bars.forEach((b) => {
    assert.equal(b.salesPhp, 0);
    assert.equal(b.heightPercent, 0);
    assert.equal(b.isPeak, false);
  });

  const top = engine.getTopSellingProducts('Daily', 5);
  assert.equal(top.length, 0);

  const dist = engine.getPaymentDistribution('Daily');
  assert.equal(dist.totalPhp, 0);
  dist.items.forEach((i) => assert.equal(i.percentage, 0));
});

test('verifies store settings search keyword matcher and regex word boundaries', () => {
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const createMatcher = (query) => {
    const normQuery = query.trim().toLowerCase();
    const queryWords = normQuery.split(/\s+/).filter(Boolean);
    const wordPrefixRegex = new RegExp(`(?:^|[\\s/_-])${escapeRegex(normQuery)}`, 'i');

    return (keywords) => {
      if (!normQuery) return true;
      return keywords.some((kw) => {
        const k = kw.toLowerCase();
        if (k === normQuery) return true;
        if (wordPrefixRegex.test(k)) return true;
        if (normQuery.length >= 5 && k.includes(normQuery)) return true;
        if (queryWords.length > 1) {
          return queryWords.every((qw) => {
            if (qw.length < 2) return true;
            const qwRegex = new RegExp(`(?:^|[\\s/_-])${escapeRegex(qw)}`, 'i');
            return qwRegex.test(k) || (qw.length >= 5 && k.includes(qw));
          });
        }
        return false;
      });
    };
  };

  const idMatcher = createMatcher('id');
  // Should match Tindahan ID keyword
  assert.equal(idMatcher(['tindahan id', 'device id']), true);
  // Should NOT match 'seguridad' just because 'seguridad' has 'id' substring
  assert.equal(idMatcher(['seguridad', 'seguridad ng tindahan']), false);

  const pinMatcher = createMatcher('pin');
  // Should match Master PIN
  assert.equal(pinMatcher(['master pin', '4-digit pin']), true);
  // Should NOT match 'shopping'
  assert.equal(pinMatcher(['shopping']), false);

  const printerMatcher = createMatcher('printer');
  assert.equal(printerMatcher(['resibo printer', 'bluetooth thermal printer']), true);
  assert.equal(printerMatcher(['seguridad']), false);

  // Partial typing 'prin' should match 'printer'
  const partialMatcher = createMatcher('prin');
  assert.equal(partialMatcher(['printer', 'bluetooth']), true);
});
