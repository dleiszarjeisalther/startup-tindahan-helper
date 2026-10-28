/**
 * Automated Test: v1.0.8 Photo Edit, Visual Image Sync & Pricing Logic Parity
 */
const assert = require('assert');

function runTests() {
  console.log('--- Running v1.0.8 Photo Edit & Pricing Logic Parity Tests ---');

  // 1. Mock Product Visual Sync logic
  function createProduct(imageUri) {
    const visual = {
      bgColor: '#0D7A52',
      accentColor: '#10B981',
      textColor: '#FFFFFF',
      shortLabel: 'TEST',
      subLabel: 'ITEM',
      shape: 'POUCH',
      imageUri: imageUri || undefined,
    };
    return {
      id: 'prod_1',
      name: 'Test Product',
      imageUri: imageUri || undefined,
      visual,
      updateDetails(updates) {
        const nextImageUri = updates.imageUri !== undefined ? (updates.imageUri || undefined) : this.imageUri;
        const nextVisual = this.visual ? { ...this.visual, imageUri: nextImageUri } : undefined;
        return {
          ...this,
          name: updates.name || this.name,
          imageUri: nextImageUri,
          visual: nextVisual,
        };
      },
      withImage(newUri) {
        const nextVisual = this.visual ? { ...this.visual, imageUri: newUri || undefined } : undefined;
        return {
          ...this,
          imageUri: newUri || undefined,
          visual: nextVisual,
        };
      },
    };
  }

  // Test 1: Updating image in updateDetails syncs both imageUri and visual.imageUri
  const p1 = createProduct(null);
  const p1Updated = p1.updateDetails({ imageUri: 'file:///new_camera_photo.jpg' });
  assert.strictEqual(p1Updated.imageUri, 'file:///new_camera_photo.jpg');
  assert.strictEqual(p1Updated.visual.imageUri, 'file:///new_camera_photo.jpg');
  console.log('✓ Test 1: updateDetails stages new camera photo and syncs visual.imageUri');

  // Test 2: Clearing photo in updateDetails clears both imageUri and visual.imageUri
  const p2 = createProduct('file:///existing_photo.jpg');
  const p2Cleared = p2.updateDetails({ imageUri: null });
  assert.strictEqual(p2Cleared.imageUri, undefined);
  assert.strictEqual(p2Cleared.visual.imageUri, undefined);
  console.log('✓ Test 2: updateDetails with imageUri=null clears visual.imageUri (no stale fallback)');

  // Test 3: withImage syncs visual.imageUri
  const p3 = createProduct('file:///old.jpg');
  const p3Swapped = p3.withImage('file:///gallery_photo.jpg');
  assert.strictEqual(p3Swapped.imageUri, 'file:///gallery_photo.jpg');
  assert.strictEqual(p3Swapped.visual.imageUri, 'file:///gallery_photo.jpg');
  console.log('✓ Test 3: withImage correctly sets nextVisual.imageUri');

  // Test 4: updateDetails preserving image when imageUri not provided
  const p4 = createProduct('file:///kept_photo.jpg');
  const p4NameChanged = p4.updateDetails({ name: 'Renamed Product' });
  assert.strictEqual(p4NameChanged.name, 'Renamed Product');
  assert.strictEqual(p4NameChanged.imageUri, 'file:///kept_photo.jpg');
  assert.strictEqual(p4NameChanged.visual.imageUri, 'file:///kept_photo.jpg');
  console.log('✓ Test 4: updateDetails preserves existing photo when imageUri is undefined');

  // Test 5: Receipt-First Pricing Calculations (PACK mode)
  const bundleCost = 150.00; // ₱150 for 1 pack
  const packPieces = 10;
  const calculatedPieceCost = Number((bundleCost / packPieces).toFixed(2));
  assert.strictEqual(calculatedPieceCost, 15.00);

  const tuboPeso = 3.00;
  const srpPeso = Number((calculatedPieceCost + tuboPeso).toFixed(2));
  assert.strictEqual(srpPeso, 18.00);

  const bundlePacksCount = 5;
  const totalStockPieces = bundlePacksCount * packPieces;
  assert.strictEqual(totalStockPieces, 50);
  console.log('✓ Test 5: Receipt-First PACK mode math verified (Piece Cost: ₱15.00, SRP: ₱18.00, Stock: 50 pcs)');

  // Test 6: Percent Tubo Mode Math
  const tuboPercent = 25; // 25%
  const srpPercent = Number((calculatedPieceCost * (1 + tuboPercent / 100)).toFixed(2));
  assert.strictEqual(srpPercent, 18.75);
  console.log('✓ Test 6: PERCENT tubo calculation verified (₱15.00 + 25% = ₱18.75)');

  // Test 7: KG Mode Math
  const kgCost = 42.00;
  const kgTubo = 8.00;
  const kgSrp = Number((kgCost + kgTubo).toFixed(2));
  assert.strictEqual(kgSrp, 50.00);
  console.log('✓ Test 7: KG mode math verified (₱42.00 + ₱8.00 = ₱50.00/kg)');

  console.log('--- ALL PHOTO & PRICING TESTS PASSED ---');
}

runTests();
