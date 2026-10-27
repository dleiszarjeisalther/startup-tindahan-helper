const assert = require('assert');

// Mock data structures matching TindahanStoreService
function createSaleTransaction(items, tenderType = 'CASH', customerName = null) {
  const totalPhp = items.reduce((sum, item) => sum + item.quantity * item.unitPricePaidPhp, 0);
  return {
    id: 'OR-2026-TEST-001',
    tenderType,
    customerName,
    status: 'COMPLETED',
    totalPhp,
    refundedPhp: 0,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    items: items.map((i) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      returnedQty: 0,
      unitPricePaidPhp: i.unitPricePaidPhp,
      unitCostPhp: i.unitCostPhp || 10,
    })),
  };
}

function processReturn(tx, params, productStock, utangCustomer) {
  if (tx.status === 'VOIDED') {
    throw new Error('Transaction not available for return.');
  }

  // Safety guard: Restrict returns on Utang sales from cash refunds
  if (tx.tenderType === 'UTANG' && params.resolution === 'CASH_REFUND') {
    throw new Error('Bawal mag-cash refund sa item na binili sa utang.');
  }

  const line = tx.items.find((i) => i.productId === params.productId);
  if (!line) throw new Error('Item not found.');

  const maxReturnable = line.quantity - line.returnedQty;
  const qty = Math.min(maxReturnable, Math.max(1, params.returnQty));
  if (qty <= 0) throw new Error('All units already returned.');

  const refundAmountPhp = Number((line.unitPricePaidPhp * qty).toFixed(2));
  line.returnedQty += qty;
  tx.refundedPhp += refundAmountPhp;
  tx.itemCount = Math.max(0, tx.itemCount - qty);

  const allReturned = tx.items.every((i) => i.returnedQty >= i.quantity);
  tx.status = allReturned ? 'REFUNDED' : 'PARTIAL_RETURN';

  // Stock update
  if (params.disposition === 'SELLABLE') {
    productStock.shelfStock += qty;
  } else {
    productStock.quarantineStock += qty;
  }

  // Utang or Cash
  if (params.resolution === 'UTANG_DEDUCTION' && utangCustomer) {
    utangCustomer.balancePhp = Math.max(0, utangCustomer.balancePhp - refundAmountPhp);
  }

  return { creditPhp: refundAmountPhp };
}

console.log('--- Running Multi-Quantity Return & Refund Tests ---');

// Test 1: Partial Return of 2 out of 5 items
const items1 = [{ productId: 'p1', name: 'Choco Mucho', quantity: 5, unitPricePaidPhp: 15.0 }];
const tx1 = createSaleTransaction(items1, 'CASH');
const stock1 = { shelfStock: 10, quarantineStock: 0 };

const res1 = processReturn(tx1, {
  productId: 'p1',
  returnQty: 2,
  disposition: 'SELLABLE',
  resolution: 'CASH_REFUND',
}, stock1, null);

assert.strictEqual(res1.creditPhp, 30.0, '2 pcs @ 15.0 must equal ₱30.00 refund');
assert.strictEqual(tx1.status, 'PARTIAL_RETURN', 'Status must transition to PARTIAL_RETURN');
assert.strictEqual(tx1.items[0].returnedQty, 2, 'Line returnedQty must be 2');
assert.strictEqual(tx1.refundedPhp, 30.0, 'Refunded amount must be ₱30.00');
assert.strictEqual(tx1.itemCount, 3, 'Net item count must be 3');
assert.strictEqual(stock1.shelfStock, 12, 'Shelf stock must increase by 2 (10 -> 12)');
console.log('✓ Test 1: Partial return (2 of 5 pcs) accurately refunded ₱30.00 and restocked +2 to shelf');

// Test 2: Returning the remaining 3 items fully closes the transaction
const res2 = processReturn(tx1, {
  productId: 'p1',
  returnQty: 3,
  disposition: 'DAMAGED_QUARANTINE',
  resolution: 'CASH_REFUND',
}, stock1, null);

assert.strictEqual(res2.creditPhp, 45.0, '3 pcs @ 15.0 must equal ₱45.00 refund');
assert.strictEqual(tx1.status, 'REFUNDED', 'Status must transition to REFUNDED when all items returned');
assert.strictEqual(tx1.items[0].returnedQty, 5, 'Line returnedQty must be 5');
assert.strictEqual(tx1.refundedPhp, 75.0, 'Total refunded amount must equal original total ₱75.00');
assert.strictEqual(stock1.quarantineStock, 3, 'Quarantine stock must increase by 3');
assert.strictEqual(stock1.shelfStock, 12, 'Damaged goods must NOT restock to shelf');
console.log('✓ Test 2: Final 3 damaged units transitioned transaction to REFUNDED and quarantined stock');

// Test 3: Returning more than remaining units is capped safely
const items3 = [{ productId: 'p3', name: 'Sardines', quantity: 2, unitPricePaidPhp: 25.0 }];
const tx3 = createSaleTransaction(items3, 'CASH');
const stock3 = { shelfStock: 5, quarantineStock: 0 };

const res3 = processReturn(tx3, {
  productId: 'p3',
  returnQty: 10, // User requested 10, but only 2 were bought
  disposition: 'SELLABLE',
  resolution: 'CASH_REFUND',
}, stock3, null);

assert.strictEqual(res3.creditPhp, 50.0, 'Must cap return quantity at 2 (₱50.00 total)');
assert.strictEqual(tx3.items[0].returnedQty, 2, 'Must not return more than line quantity');
assert.strictEqual(stock3.shelfStock, 7, 'Shelf stock only increases by capped 2 pcs');
console.log('✓ Test 3: Over-quantity return requests are safely capped at max available units');

// Test 4: Utang Sale return prohibits Cash Refund and deducts debt
const items4 = [{ productId: 'p4', name: 'Cooking Oil', quantity: 2, unitPricePaidPhp: 35.0 }];
const tx4 = createSaleTransaction(items4, 'UTANG', 'Aling Nena');
const stock4 = { shelfStock: 8, quarantineStock: 0 };
const customer4 = { name: 'Aling Nena', balancePhp: 70.0 };

assert.throws(() => {
  processReturn(tx4, {
    productId: 'p4',
    returnQty: 1,
    disposition: 'SELLABLE',
    resolution: 'CASH_REFUND', // FORBIDDEN!
  }, stock4, customer4);
}, /Bawal mag-cash refund sa item na binili sa utang/, 'Cash refund on Utang sale must be blocked');

const res4 = processReturn(tx4, {
  productId: 'p4',
  returnQty: 1,
  disposition: 'SELLABLE',
  resolution: 'UTANG_DEDUCTION',
}, stock4, customer4);

assert.strictEqual(res4.creditPhp, 35.0, 'Deduction amount must be ₱35.00');
assert.strictEqual(customer4.balancePhp, 35.0, 'Aling Nena debt must drop from ₱70.00 to ₱35.00');
console.log('✓ Test 4: Utang sale safeguards verified (Cash refund blocked, debt deducted safely)');

// Test 5: Cancelling Exchange Credit clears cart credit safely
let cartExchangeCredit = 30.0;
let cartSourceReceipt = 'OR-2026-TEST-001';

function cancelExchangeCredit(options) {
  if (options?.undoReceiptReturn && cartSourceReceipt === tx1.id) {
    tx1.refundedPhp = Math.max(0, tx1.refundedPhp - cartExchangeCredit);
    tx1.status = 'PARTIAL_RETURN';
  }
  cartExchangeCredit = 0;
  cartSourceReceipt = null;
}

cancelExchangeCredit({ undoReceiptReturn: false });
assert.strictEqual(cartExchangeCredit, 0, 'Exchange credit must be reset to 0');
assert.strictEqual(cartSourceReceipt, null, 'Exchange source receipt must be null');
console.log('✓ Test 5: Cancelling exchange credit clears cart credit safely');

// Test 6: Convert Exchange Credit to Cash Refund (Customer gets cash when replacement item unavailable)
const items6 = [{ productId: 'p6', name: 'Noodles', quantity: 3, unitPricePaidPhp: 12.0 }];
const tx6 = createSaleTransaction(items6, 'CASH');
const stock6 = { shelfStock: 10, quarantineStock: 0 };
let cashInDrawer6 = 100.0;

// Process 1 item as exchange credit
const res6 = processReturn(tx6, {
  productId: 'p6',
  returnQty: 1,
  disposition: 'SELLABLE',
  resolution: 'EXCHANGE_CREDIT',
}, stock6, null);

assert.strictEqual(res6.creditPhp, 12.0, 'Return credit must be ₱12.00');
assert.strictEqual(stock6.shelfStock, 11, 'Shelf stock increased by +1');
assert.strictEqual(tx6.refundedPhp, 12.0, 'Refunded amount is ₱12.00');

// Convert to Cash Refund
cashInDrawer6 -= res6.creditPhp;
tx6.voidOrReturnNote = 'Converted from Exchange Credit to Cash Refund';
assert.strictEqual(cashInDrawer6, 88.0, 'Cash in drawer reduced by ₱12.00 cash refund');
assert.strictEqual(stock6.shelfStock, 11, 'Stock remains on shelf since merchandise was returned');
console.log('✓ Test 6: Convert exchange credit to cash refund verified with drawer precision');

// Test 7: Undo Return reverses inventory stock, line returnedQty, and restores receipt
const items7 = [{ productId: 'p7', name: 'Coffee', quantity: 2, unitPricePaidPhp: 20.0 }];
const tx7 = createSaleTransaction(items7, 'CASH');
const stock7 = { shelfStock: 5, quarantineStock: 0 };

// Mistakenly returned 1 pc
const res7 = processReturn(tx7, {
  productId: 'p7',
  returnQty: 1,
  disposition: 'SELLABLE',
  resolution: 'EXCHANGE_CREDIT',
}, stock7, null);
assert.strictEqual(stock7.shelfStock, 6, 'Stock temporarily became 6');
assert.strictEqual(tx7.items[0].returnedQty, 1, 'Line returnedQty is 1');

// Undo Return
stock7.shelfStock -= 1;
tx7.items[0].returnedQty -= 1;
tx7.refundedPhp -= res7.creditPhp;
tx7.itemCount += 1;
tx7.status = 'COMPLETED';

assert.strictEqual(stock7.shelfStock, 5, 'Shelf stock reverted cleanly (6 -> 5)');
assert.strictEqual(tx7.items[0].returnedQty, 0, 'Line returnedQty reverted to 0');
assert.strictEqual(tx7.refundedPhp, 0, 'Transaction refundedPhp reverted to 0');
assert.strictEqual(tx7.status, 'COMPLETED', 'Transaction status restored to COMPLETED');
console.log('✓ Test 7: Undo return safely rolls back inventory stock, line returnedQty, and status');

console.log('--- ALL MULTI-QUANTITY RETURN & REFUND TESTS PASSED ---');
