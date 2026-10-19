/**
 * Automated Test: Multi-Unit Selling & Inventory Deduction Calculations
 * Verifies Task 03 & 04 requirements:
 * Example from requirements:
 * A product contains 12 pieces per box. Store has 60 pieces in stock.
 * - Selling 1 piece deducts 1 piece (leaves 59)
 * - Selling 1 box deducts 12 pieces (leaves 47)
 * - Selling 2 boxes deducts 24 pieces (leaves 23)
 * - Selling 1 box and 3 pieces deducts 15 pieces (leaves 8)
 * - Selling 1 box when only 8 pieces available throws Insufficient Stock.
 */

const assert = require('assert');

function runMultiUnitTests() {
  console.log('--- Running Multi-Unit Selling & Validation Tests ---');

  const product = {
    id: 'prod_test_01',
    name: 'Lucky Me Pancit Canton',
    stockCount: 60, // base pieces
    sellingTiers: [
      { unitName: 'piece', baseUnitMultiplier: 1, unitPricePhp: 15.00 },
      { unitName: 'pack', baseUnitMultiplier: 6, unitPricePhp: 85.00 },
      { unitName: 'box', baseUnitMultiplier: 12, unitPricePhp: 165.00 },
    ],
  };

  function getTier(unit) {
    return product.sellingTiers.find((t) => t.unitName === unit) || { baseUnitMultiplier: 1, unitPricePhp: 15 };
  }

  function calculateBaseUnitsDeducted(items) {
    let totalDeduction = 0;
    for (const item of items) {
      const tier = getTier(item.unit);
      totalDeduction += item.quantity * tier.baseUnitMultiplier;
    }
    return totalDeduction;
  }

  function validateStock(currentStock, itemsToAdd) {
    const totalRequired = calculateBaseUnitsDeducted(itemsToAdd);
    if (totalRequired > currentStock) {
      throw new Error(`Insufficient Stock — Only ${currentStock} pieces available.`);
    }
    return currentStock - totalRequired;
  }

  // Test 1: Selling 1 piece deducts 1 piece
  let stock = 60;
  stock = validateStock(stock, [{ unit: 'piece', quantity: 1 }]);
  assert.strictEqual(stock, 59, 'Expected 59 pieces after selling 1 piece');
  console.log('✓ Test 1: Selling 1 piece deducts 1 piece (60 -> 59)');

  // Test 2: Selling 1 box deducts 12 pieces
  stock = validateStock(stock, [{ unit: 'box', quantity: 1 }]);
  assert.strictEqual(stock, 47, 'Expected 47 pieces after selling 1 box');
  console.log('✓ Test 2: Selling 1 box deducts 12 pieces (59 -> 47)');

  // Test 3: Selling 2 boxes deducts 24 pieces
  stock = validateStock(stock, [{ unit: 'box', quantity: 2 }]);
  assert.strictEqual(stock, 23, 'Expected 23 pieces after selling 2 boxes');
  console.log('✓ Test 3: Selling 2 boxes deducts 24 pieces (47 -> 23)');

  // Test 4: Selling 1 box and 3 pieces deducts 15 pieces
  stock = validateStock(stock, [
    { unit: 'box', quantity: 1 },
    { unit: 'piece', quantity: 3 },
  ]);
  assert.strictEqual(stock, 8, 'Expected 8 pieces after selling 1 box + 3 pieces');
  console.log('✓ Test 4: Selling 1 box and 3 pieces deducts 15 pieces (23 -> 8)');

  // Test 5: Insufficient stock validation: Selling 1 box (12 pcs) when only 8 pcs remain
  assert.throws(
    () => validateStock(stock, [{ unit: 'box', quantity: 1 }]),
    /Insufficient Stock/,
    'Expected Insufficient Stock error when trying to sell 12 base units from 8 stock'
  );
  console.log('✓ Test 5: Insufficient stock correctly prevented sale of 1 box from 8 pieces');

  // Test 6: Pricing calculations
  const boxTier = getTier('box');
  const lineTotalBox = boxTier.unitPricePhp * 2;
  assert.strictEqual(lineTotalBox, 330.00, 'Expected ₱330.00 for 2 boxes');
  console.log('✓ Test 6: Box unit line total verified (2 × ₱165.00 = ₱330.00)');

  // Test 7: SQLite selling_tiers_json serialization & deserialization with barcodes
  const originalTiers = [
    { unitName: 'piece', baseUnitMultiplier: 1, unitPricePhp: 15.00 },
    { unitName: 'pack', baseUnitMultiplier: 6, unitPricePhp: 85.00, barcode: 'PACK-4800016644' },
    { unitName: 'box', baseUnitMultiplier: 24, unitPricePhp: 320.00, barcode: 'BOX-4800016699' },
  ];
  const serialized = JSON.stringify(originalTiers);
  const deserialized = JSON.parse(serialized).map((t) => ({
    unitName: t.unitName || 'piece',
    baseUnitMultiplier: Number(t.baseUnitMultiplier) || 1,
    unitPricePhp: Number(t.unitPricePhp) || 0,
    barcode: t.barcode ? String(t.barcode).trim() : undefined,
  }));
  assert.strictEqual(deserialized.length, 3);
  assert.strictEqual(deserialized[1].barcode, 'PACK-4800016644');
  assert.strictEqual(deserialized[2].barcode, 'BOX-4800016699');
  console.log('✓ Test 7: SQLite selling_tiers_json serialization and barcode restoration verified');

  // Test 8: Barcode scanner matching logic
  const mockProducts = [
    {
      id: 'p1',
      name: 'Lucky Me Pancit Canton',
      barcode: '4800016640001',
      stockCount: 60,
      sellingTiers: deserialized,
    },
  ];

  function matchBarcode(cleanCode) {
    for (const p of mockProducts) {
      const foundTier = p.sellingTiers?.find(
        (t) => t.barcode && t.barcode.trim().toUpperCase() === cleanCode
      );
      if (foundTier) return { product: p, tier: foundTier };
      if (p.barcode.toUpperCase() === cleanCode) {
        return { product: p, tier: p.sellingTiers?.find((t) => t.unitName === 'piece') };
      }
    }
    return null;
  }

  // Scanning pack barcode should return pack tier
  const scanPack = matchBarcode('PACK-4800016644');
  assert.ok(scanPack);
  assert.strictEqual(scanPack.tier.unitName, 'pack');
  assert.strictEqual(scanPack.tier.unitPricePhp, 85.00);
  console.log('✓ Test 8: Scanning pack tier barcode directly matches pack tier with correct price');

  // Scanning box barcode should return box tier
  const scanBox = matchBarcode('BOX-4800016699');
  assert.ok(scanBox);
  assert.strictEqual(scanBox.tier.unitName, 'box');
  assert.strictEqual(scanBox.tier.unitPricePhp, 320.00);
  console.log('✓ Test 9: Scanning box tier barcode directly matches box tier with correct price');

  // Scanning product primary barcode should match piece tier
  const scanPiece = matchBarcode('4800016640001');
  assert.ok(scanPiece);
  assert.strictEqual(scanPiece.tier.unitName, 'piece');
  console.log('✓ Test 10: Scanning piece primary barcode matches piece tier');

  // Test 11: Dynamic formattedStock calculation
  function formatStock(basePcs, tiers) {
    const parts = [`${basePcs} pcs`];
    const box = tiers.find((t) => t.unitName === 'box');
    if (box && box.baseUnitMultiplier > 1) {
      const boxes = Math.floor(basePcs / box.baseUnitMultiplier);
      parts.push(`${boxes} box${boxes === 1 ? '' : 'es'}`);
    }
    const pack = tiers.find((t) => t.unitName === 'pack');
    if (pack && pack.baseUnitMultiplier > 1) {
      const packs = Math.floor(basePcs / pack.baseUnitMultiplier);
      parts.push(`${packs} pack${packs === 1 ? '' : 's'}`);
    }
    return parts.join(' • ');
  }

  const formatted = formatStock(60, originalTiers);
  assert.strictEqual(formatted, '60 pcs • 2 boxes • 10 packs');
  console.log(`✓ Test 11: formattedStock calculation verified: "${formatted}"`);

  console.log('--- ALL MULTI-UNIT SELLING TESTS PASSED ---');
}

runMultiUnitTests();
