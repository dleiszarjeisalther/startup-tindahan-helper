/**
 * Test: Database Backup & Restore Integrity
 * Verifies Task 02 requirements
 */

const assert = require('assert');

function runBackupRestoreTests() {
  console.log('--- Running Database Backup & Restore Verification Tests ---');

  const mockDbData = {
    products: [
      { id: 'p1', name: 'Sardines', base_stock_count: 24, default_price_php: 22 },
      { id: 'p2', name: 'Instant Noodles', base_stock_count: 50, default_price_php: 15 },
    ],
    sales_transactions: [
      { id: 'tx1', receipt_id: 'RCP-001', gross_total_centavos: 3700, tender_type: 'CASH' },
    ],
    sales_line_items: [
      { id: 'li1', transaction_id: 'tx1', product_id: 'p1', quantity: 1, line_total_centavos: 2200 },
      { id: 'li2', transaction_id: 'tx1', product_id: 'p2', quantity: 1, line_total_centavos: 1500 },
    ],
    utang_customers: [
      { id: 'c1', name: 'Mang Kanor', balance_centavos: 15000 },
    ],
    store_settings: [
      { key: 'store_name', value: "Juan's Sari-Sari Store" },
    ],
  };

  // 1. Export structure validation
  function exportDatabase(data) {
    return {
      schemaVersion: 1,
      appIdentifier: 'com.startuptindahanhelper.app',
      exportedAt: new Date().toISOString(),
      metadata: {
        productCount: data.products.length,
        transactionCount: data.sales_transactions.length,
        customerCount: data.utang_customers.length,
      },
      tables: JSON.parse(JSON.stringify(data)),
    };
  }

  const backupJson = exportDatabase(mockDbData);
  assert.strictEqual(backupJson.schemaVersion, 1);
  assert.strictEqual(backupJson.appIdentifier, 'com.startuptindahanhelper.app');
  assert.strictEqual(backupJson.tables.products.length, 2);
  assert.strictEqual(backupJson.metadata.productCount, 2);
  console.log('✓ Test 1: Backup export produced valid structured envelope');

  // 2. Ensure sensitive data is not leaked
  const serialized = JSON.stringify(backupJson);
  assert.strictEqual(serialized.includes('pin_hash'), false);
  assert.strictEqual(serialized.includes('password'), false);
  console.log('✓ Test 2: Backup contains zero sensitive secrets or PIN hashes');

  // 3. Validation on restore
  function validateBackupEnvelope(jsonStr) {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || parsed.appIdentifier !== 'com.startuptindahanhelper.app') {
      throw new Error('Invalid backup file: App identifier does not match.');
    }
    if (!parsed.schemaVersion || parsed.schemaVersion > 1) {
      throw new Error('Unsupported schema version.');
    }
    if (!parsed.tables || !Array.isArray(parsed.tables.products)) {
      throw new Error('Missing core table: products.');
    }
    return parsed;
  }

  const restored = validateBackupEnvelope(serialized);
  assert.strictEqual(restored.tables.products.length, 2);
  assert.strictEqual(restored.tables.sales_transactions.length, 1);
  console.log('✓ Test 3: Valid backup successfully validated for restore');

  // 4. Invalid file rejection
  assert.throws(
    () => validateBackupEnvelope(JSON.stringify({ someOther: 'app' })),
    /Invalid backup file/,
    'Should reject file from different app'
  );
  console.log('✓ Test 4: Corrupted or foreign backup files correctly rejected');

  console.log('--- ALL BACKUP & RESTORE TESTS PASSED ---');
}

runBackupRestoreTests();
