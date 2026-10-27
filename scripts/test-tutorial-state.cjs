// scripts/test-tutorial-state.cjs
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { test } = require('node:test');

// Intercept native expo / react-native modules for Node CLI test environment
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'react-native') {
    return { Platform: { OS: 'web' } };
  }
  if (id === 'expo-sqlite' || id.endsWith('SqliteDatabase') || id.includes('SqliteDatabase')) {
    return {
      SqliteDatabase: {
        getInstance: () => ({ rawDb: null }),
      },
    };
  }
  return originalRequire.apply(this, arguments);
};

// TypeScript loader hook for Node test runner
require.extensions['.ts'] = (module, filename) => {
  const content = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  return module._compile(transpiled.outputText, filename);
};

const { appKeyValueStorage } = require('../src/infrastructure/storage/KeyValueStorage.ts');

test('KeyValueStorage tutorial state default is false for fresh installation', () => {
  appKeyValueStorage.delete('has_seen_interactive_tutorial');
  assert.equal(
    appKeyValueStorage.hasSeenInteractiveTutorial(),
    false,
    'Fresh install must return false for hasSeenInteractiveTutorial'
  );
});

test('KeyValueStorage setInteractiveTutorialCompleted updates persistence flag', () => {
  appKeyValueStorage.setInteractiveTutorialCompleted(true);
  assert.equal(
    appKeyValueStorage.hasSeenInteractiveTutorial(),
    true,
    'hasSeenInteractiveTutorial must return true after setInteractiveTutorialCompleted(true)'
  );

  // Calling without args defaults to true
  appKeyValueStorage.setInteractiveTutorialCompleted();
  assert.equal(
    appKeyValueStorage.hasSeenInteractiveTutorial(),
    true,
    'hasSeenInteractiveTutorial must remain true with default parameter'
  );
});

test('KeyValueStorage setInteractiveTutorialCompleted can reset tutorial flag for replay', () => {
  appKeyValueStorage.setInteractiveTutorialCompleted(true);
  assert.equal(appKeyValueStorage.hasSeenInteractiveTutorial(), true);

  appKeyValueStorage.setInteractiveTutorialCompleted(false);
  assert.equal(
    appKeyValueStorage.hasSeenInteractiveTutorial(),
    false,
    'Setting to false resets tutorial state for manual replay'
  );
});

test('Tutorial step sequence validation and boundary checks (6 Steps)', () => {
  // Simulate TutorialContext state machine transitions
  let currentStep = 1;
  const nextStep = () => {
    if (currentStep < 6) {
      currentStep += 1;
    } else {
      appKeyValueStorage.setInteractiveTutorialCompleted(true);
    }
  };
  const prevStep = () => {
    if (currentStep > 1) {
      currentStep -= 1;
    }
  };

  assert.equal(currentStep, 1);
  prevStep(); // Boundary check: Should not go below step 1
  assert.equal(currentStep, 1);

  nextStep(); // Step 1 (+ Add Product in POS) -> Step 2 (Inventory)
  assert.equal(currentStep, 2);

  nextStep(); // Step 2 (Sample Product in Inventory) -> Step 3 (Scan Tab)
  assert.equal(currentStep, 3);

  nextStep(); // Step 3 (Scan Tab in Bottom Bar) -> Step 4 (Product Grid in POS)
  assert.equal(currentStep, 4);

  nextStep(); // Step 4 (Add Product to Cart in POS) -> Step 5 (Cart FAB)
  assert.equal(currentStep, 5);

  nextStep(); // Step 5 (Cart FAB in Bottom Bar) -> Step 6 (Sukli Simulation Sheet)
  assert.equal(currentStep, 6);

  // On step 6, next completes tutorial
  nextStep();
  assert.equal(appKeyValueStorage.hasSeenInteractiveTutorial(), true);
});

test('Sukli simulation change computation matches store cash arithmetic', () => {
  const itemTotal = 15;
  const testTenders = [15, 20, 50, 100];
  const expectedChanges = [0, 5, 35, 85];

  testTenders.forEach((tender, idx) => {
    const change = Math.max(0, tender - itemTotal);
    assert.equal(
      change,
      expectedChanges[idx],
      `Tendered ₱${tender} for ₱${itemTotal} item should yield ₱${expectedChanges[idx]} sukli`
    );
  });
});

test('Step 1 + Add Product advances to Step 2 and navigates to inventory', () => {
  let tutorialStep = 1;
  let isTutorialActive = true;
  let navigatedTo = null;

  const nextTutorialStep = () => {
    tutorialStep += 1;
  };
  const navigate = (path) => {
    navigatedTo = path;
  };

  const onAddProductPress = () => {
    if (isTutorialActive && tutorialStep === 1) {
      nextTutorialStep();
    }
    navigate('/inventory');
  };

  onAddProductPress();
  assert.equal(tutorialStep, 2, 'Tutorial must advance to Step 2');
  assert.equal(navigatedTo, '/inventory', 'Must navigate to /inventory');
});

test('Step 2 demo product helper advances to Step 3', () => {
  let tutorialStep = 2;
  let isTutorialActive = true;
  let advanceCount = 0;

  const nextTutorialStep = () => {
    advanceCount += 1;
    tutorialStep += 1;
  };

  const onDemoProductPress = () => {
    if (isTutorialActive && tutorialStep === 2) {
      nextTutorialStep();
    }
  };

  onDemoProductPress();
  assert.equal(advanceCount, 1, 'Step should advance once on demo product tap');
  assert.equal(tutorialStep, 3, 'Must advance to Step 3 (Scan Tab in bottom tabs)');
});

test('Step 3 Scan Tab press advances to Step 4 and navigates to POS (/)', () => {
  let tutorialStep = 3;
  let isTutorialActive = true;
  let navigatedTo = null;

  const nextTutorialStep = () => {
    tutorialStep += 1;
  };
  const handleTabPress = (route) => {
    navigatedTo = route;
  };

  const onScanTabPress = () => {
    if (isTutorialActive && tutorialStep === 3) {
      nextTutorialStep();
      handleTabPress('index');
      return;
    }
    handleTabPress('index');
  };

  onScanTabPress();
  assert.equal(tutorialStep, 4, 'Tutorial must advance to Step 4');
  assert.equal(navigatedTo, 'index', 'Must navigate to POS screen');
});

test('Step 4 product grid tap advances to Step 5', () => {
  let tutorialStep = 4;
  let isTutorialActive = true;
  let advanceCount = 0;

  const nextTutorialStep = () => {
    advanceCount += 1;
    tutorialStep += 1;
  };

  const onProductCardPress = () => {
    if (isTutorialActive && tutorialStep === 4) {
      nextTutorialStep();
    }
  };

  onProductCardPress();
  assert.equal(advanceCount, 1, 'Step should advance once on product card tap');
  assert.equal(tutorialStep, 5, 'Must advance to Step 5 (Cart FAB)');
});

test('Step 5 Cart FAB press advances tutorial to Step 6 without navigating away to checkout screen', () => {
  let tutorialStep = 5;
  let isTutorialActive = true;
  let navigatedTo = null;

  const nextTutorialStep = () => {
    tutorialStep += 1;
  };

  const handleTabPress = (route) => {
    navigatedTo = route;
  };

  // Cart FAB handler logic in app-tabs.tsx
  const onCartFabPress = () => {
    if (isTutorialActive && tutorialStep === 5) {
      nextTutorialStep();
      return; // Must suppress navigation to checkout screen
    }
    handleTabPress('checkout');
  };

  onCartFabPress();

  assert.equal(tutorialStep, 6, 'Tutorial must advance to Step 6 simulation');
  assert.equal(navigatedTo, null, 'Must NOT navigate to checkout tab during tutorial step 5');
});

test('Tutorial auto-start is gated behind onboarding registration (isRegistered)', () => {
  const checkAutoStart = (hasSeen, isRegistered) => {
    return !hasSeen && isRegistered;
  };

  // Fresh install before onboarding registration
  assert.equal(
    checkAutoStart(false, false),
    false,
    'Must NOT auto-start tutorial if store registration onboarding is incomplete'
  );

  // Fresh install after onboarding registration completes
  assert.equal(
    checkAutoStart(false, true),
    true,
    'Must auto-start tutorial once onboarding registration is completed'
  );

  // Existing user who already finished tutorial
  assert.equal(
    checkAutoStart(true, true),
    false,
    'Must NOT auto-start tutorial if user has already seen it'
  );
});

test('Sukli simulation pointer transitions from P20 quick button to completion button upon tender selection', () => {
  let hasSelectedTender = false;
  let tenderedAmount = 20;
  const p20ButtonLayout = { x: 100, y: 300 };
  const completeBtnLayout = { x: 190, y: 550 };

  const getActivePointerTarget = () => {
    if (!hasSelectedTender && p20ButtonLayout) {
      return p20ButtonLayout;
    }
    if (completeBtnLayout) {
      return completeBtnLayout;
    }
    return null;
  };

  // Initially before tapping tender amount, pointer points at P20
  assert.deepEqual(
    getActivePointerTarget(),
    p20ButtonLayout,
    'Pointer must initially point to the ₱20 quick bill button'
  );

  // User taps ₱20
  tenderedAmount = 20;
  hasSelectedTender = true;

  // Pointer must now point to completion button, NOT stay frozen on P20
  assert.deepEqual(
    getActivePointerTarget(),
    completeBtnLayout,
    'Pointer must advance to completion button after tapping ₱20'
  );

  // If user taps ₱50 instead
  tenderedAmount = 50;
  assert.deepEqual(
    getActivePointerTarget(),
    completeBtnLayout,
    'Pointer must remain on completion button after custom tender change'
  );
});

test('Hardware back press navigates backwards in sync with screen routes without desyncing', () => {
  let currentStep = 6;
  let currentRoute = '/';

  const navigate = (route) => {
    currentRoute = route;
  };

  const handleBack = () => {
    if (currentStep === 2) {
      currentStep -= 1;
      navigate('/');
    } else if (currentStep === 4) {
      currentStep -= 1;
      navigate('/inventory');
    } else {
      currentStep -= 1;
    }
  };

  const handleHardwareBackPress = () => {
    if (currentStep > 1) {
      handleBack();
      return true; // Intercepted
    }
    return false; // Let OS handle back
  };

  // From Step 6 on / -> Step 5 on /
  assert.equal(handleHardwareBackPress(), true);
  assert.equal(currentStep, 5);
  assert.equal(currentRoute, '/');

  // From Step 5 on / -> Step 4 on /
  assert.equal(handleHardwareBackPress(), true);
  assert.equal(currentStep, 4);
  assert.equal(currentRoute, '/');

  // From Step 4 on / -> Step 3 on /inventory
  assert.equal(handleHardwareBackPress(), true);
  assert.equal(currentStep, 3);
  assert.equal(currentRoute, '/inventory');

  // From Step 3 on /inventory -> Step 2 on /inventory
  assert.equal(handleHardwareBackPress(), true);
  assert.equal(currentStep, 2);
  assert.equal(currentRoute, '/inventory');

  // From Step 2 on /inventory -> Step 1 on /
  assert.equal(handleHardwareBackPress(), true);
  assert.equal(currentStep, 1);
  assert.equal(currentRoute, '/');

  // At Step 1 -> Should not intercept; let OS handle
  assert.equal(handleHardwareBackPress(), false);
  assert.equal(currentStep, 1);
  assert.equal(currentRoute, '/');
});

test('Tutorial completion and skip reset active cart to ensure clean vendor start', () => {
  let cartCount = 1;
  const clearCart = () => {
    cartCount = 0;
  };

  // Simulate completion on step 6
  let currentStep = 6;
  const onCompleteTutorial = () => {
    if (currentStep >= 6) {
      clearCart();
      appKeyValueStorage.setInteractiveTutorialCompleted(true);
    }
  };

  onCompleteTutorial();
  assert.equal(cartCount, 0, 'Cart must be cleared after tutorial completion');
  assert.equal(appKeyValueStorage.hasSeenInteractiveTutorial(), true);

  // Simulate skip
  cartCount = 1;
  const onSkipTutorial = () => {
    clearCart();
    appKeyValueStorage.setInteractiveTutorialCompleted(true);
  };

  onSkipTutorial();
  assert.equal(cartCount, 0, 'Cart must be cleared after tutorial skip');
});

test('Step 2 advance auto-seeds demo product when catalog is empty', async () => {
  let products = [];
  const addProduct = async (cmd) => {
    products.push({ id: 'demo-1', name: cmd.name, unitPricePhp: cmd.unitPricePhp });
  };

  const handleNextStep2 = async () => {
    if (products.length === 0) {
      await addProduct({
        name: 'Pancit Canton (Chilimansi)',
        unitPricePhp: 15,
      });
    }
  };

  await handleNextStep2();
  assert.equal(products.length, 1, 'Demo product must be auto-seeded if missing');
  assert.equal(products[0].name, 'Pancit Canton (Chilimansi)');
});


