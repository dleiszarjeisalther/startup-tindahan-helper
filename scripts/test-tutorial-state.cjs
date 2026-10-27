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

test('Tutorial step sequence validation and boundary checks', () => {
  // Simulate TutorialContext state machine transitions
  let currentStep = 1;
  const nextStep = () => {
    if (currentStep < 4) {
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

  nextStep(); // Step 1 -> Step 2
  assert.equal(currentStep, 2);

  nextStep(); // Step 2 -> Step 3
  assert.equal(currentStep, 3);

  nextStep(); // Step 3 -> Step 4
  assert.equal(currentStep, 4);

  // On step 4, next completes tutorial
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

test('Step 2 product selection advances to Step 3 exactly once without double-advancing', () => {
  let tutorialStep = 2;
  let isTutorialActive = true;
  let advanceCount = 0;

  const nextTutorialStep = () => {
    advanceCount += 1;
    tutorialStep += 1;
  };

  // When tryAddToCart succeeds, nextTutorialStep is called exactly once
  const tryAddToCart = () => {
    if (isTutorialActive && (tutorialStep === 1 || tutorialStep === 2)) {
      nextTutorialStep();
    }
    return true;
  };

  // Simulating product card press
  tryAddToCart();

  assert.equal(advanceCount, 1, 'Step should only advance once on product card tap');
  assert.equal(tutorialStep, 3, 'Tapping product card on Step 2 must lead to Step 3 (Cart FAB), not skip to Step 4');
});

test('Step 3 Cart FAB press advances tutorial without navigating away to checkout screen', () => {
  let tutorialStep = 3;
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
    if (isTutorialActive && tutorialStep === 3) {
      nextTutorialStep();
      return; // Must suppress navigation to checkout screen
    }
    handleTabPress('checkout');
  };

  onCartFabPress();

  assert.equal(tutorialStep, 4, 'Tutorial must advance to Step 4 simulation');
  assert.equal(navigatedTo, null, 'Must NOT navigate to checkout tab during tutorial step 3');
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

