# Graph Report - startupTindahanHelper  (2026-10-17)

## Corpus Check
- 74 files · ~261,338 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 950 nodes · 1480 edges · 79 communities (36 shown, 41 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d99d8340`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Product
- useTindahanStore
- TindahanStoreService
- app-tabs.web.tsx
- expo
- package.json
- SeasonalForecastEngine.ts
- include
- TindahanStoreService.ts
- reset-project.js
- dependencies
- animated-icon.tsx
- animated-icon.web.tsx
- 4. Common Problems in Seasonal Product Forecasting & Their Solutions
- eslint.config.js
- use-color-scheme.web.ts
- expo-constants
- sound-feedback.test.cjs
- SynchronousKeyValueStorage
- expo-asset
- expo-device
- expo-image
- expo-linking
- expo-router
- expo-splash-screen
- Data Input, Data Output & Mobile POS UX Best Practices (React Native + Expo)
- expo-status-bar
- expo-symbols
- expo-system-ui
- expo-font
- expo-sqlite
- react
- react-native
- react-native-gesture-handler
- react-native-reanimated
- react-native-safe-area-context
- react-native-screens
- expo-audio
- react-native-worklets
- 3. Applying the 4 Pillars of OOP to Juan's Store POS (TypeScript Implementation)
- Juan's Store POS 7-Screen Mobile UI Prototype
- Screen 1: POS / Scan Product
- Screen 2: Product List
- Screen 3: Checkout / Sales (New Sale)
- Screen 4: Inventory Management
- Screen 5: Sales History
- Screen 6: Menu / Profile (Sales Reports)
- Screen 7: Store Settings
- Welcome to your Expo app 👋
- AGENTS.md
- expo-camera
- expo-file-system
- react-dom
- expo-image-picker
- @expo/vector-icons
- expo-web-browser
- react-native-web
- sales.tsx
- getTranslations
- Barcode
- inventory.tsx
- ProductOnboardingService.ts
- Functional Requirements Specification (FRS)
- Functional Requirements Specification (FRS)
- Non-Functional Requirements Specification (NFRS)
- Non-Functional Requirements Specification (NFRS)
- 5. Core Business Rules (BR)
- 5. Core Business Rules (BR)
- container.ts
- Product.ts
- 3. Functional Requirements Traceability Matrix (`FR-xxx`)
- 3. Functional Requirements Traceability Matrix (`FR-xxx`)
- InMemoryProductRepository
- Money
- checkout.tsx
- REQUIREMENTS_TRACEABILITY_MATRIX_3b7cd623.md
- ConfirmationModal.tsx

## God Nodes (most connected - your core abstractions)
1. `TindahanStoreService` - 66 edges
2. `useTindahanStore()` - 60 edges
3. `Product` - 33 edges
4. `getTranslations()` - 23 edges
5. `Money` - 20 edges
6. `Barcode` - 19 edges
7. `SynchronousKeyValueStorage` - 16 edges
8. `expo-router` - 14 edges
9. `InMemoryProductRepository` - 14 edges
10. `IKeyValueStorage` - 14 edges

## Surprising Connections (you probably didn't know these)
- `CheckoutNewSaleScreen()` --calls--> `useTindahanStore()`  [EXTRACTED]
  src/app/checkout.tsx → src/presentation/hooks/useTindahanStore.ts
- `CheckoutNewSaleScreen()` --calls--> `getTranslations()`  [EXTRACTED]
  src/app/checkout.tsx → src/presentation/localization/i18n.ts
- `SeasonalForecastScreen()` --calls--> `adjustInventoryStock()`  [EXTRACTED]
  src/app/explore.tsx → src/presentation/hooks/useTindahanStore.ts
- `SeasonalForecastScreen()` --calls--> `getMonthlySalesHistory()`  [EXTRACTED]
  src/app/explore.tsx → src/presentation/hooks/useTindahanStore.ts
- `SeasonalForecastScreen()` --calls--> `updateSettings()`  [EXTRACTED]
  src/app/explore.tsx → src/presentation/hooks/useTindahanStore.ts

## Import Cycles
- None detected.

## Communities (79 total, 41 thin omitted)

### Community 1 - "useTindahanStore"
Cohesion: 0.11
Nodes (42): PosScanProductScreen(), InventoryManagementScreen(), ProductListScreen(), StoreSettingsScreen(), addCashAdjustment(), addCategory(), addManualUtangEntry(), addOrUpdateMonthlySalesRecord() (+34 more)

### Community 2 - "TindahanStoreService"
Cohesion: 0.08
Nodes (4): StoreSnapshot, TindahanStoreService, ProductDTO, MonthlySalesRecord

### Community 3 - "app-tabs.web.tsx"
Cohesion: 0.12
Nodes (20): styles, ExternalLink(), Props, HintRowProps, styles, styles, ThemedText(), ThemedTextProps (+12 more)

### Community 4 - "expo"
Cohesion: 0.06
Nodes (29): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, reactCompiler, typedRoutes (+21 more)

### Community 5 - "package.json"
Cohesion: 0.10
Nodes (20): eslint, eslint-config-expo, devDependencies, eslint, eslint-config-expo, @types/react, typescript, main (+12 more)

### Community 6 - "SeasonalForecastEngine.ts"
Cohesion: 0.19
Nodes (9): BaseSeasonalStrategy, ColdStartCategoryStrategy, ForecastConfidenceTier, getPhilippineCategorySeasonality(), InitialCycle12MonthStrategy, ISeasonalForecastStrategy, Recurring24MonthYoYStrategy, SeasonalForecastEngine (+1 more)

### Community 7 - "include"
Cohesion: 0.15
Nodes (12): ./assets/*, expo-env.d.ts, expo/tsconfig.base, .expo/types/**/*.ts, **/*.ts, **/*.tsx, compilerOptions, paths (+4 more)

### Community 8 - "TindahanStoreService.ts"
Cohesion: 0.09
Nodes (19): expo-sqlite, AddProductCommand, AddProductResult, CartItemDTO, CartSummaryDTO, CashDrawerAdjustmentRecord, DaySalesBucket, DEFAULT_CATEGORIES (+11 more)

### Community 9 - "reset-project.js"
Cohesion: 0.22
Nodes (7): exampleDirPath, fs, oldDirs, path, readline, rl, root

### Community 10 - "dependencies"
Cohesion: 0.22
Nodes (9): expo, expo-glass-effect, expo-haptics, @expo/ui, dependencies, expo, expo-glass-effect, expo-haptics (+1 more)

### Community 11 - "animated-icon.tsx"
Cohesion: 0.29
Nodes (4): glowKeyframe, keyframe, logoKeyframe, styles

### Community 12 - "animated-icon.web.tsx"
Cohesion: 0.29
Nodes (4): glowKeyframe, keyframe, logoKeyframe, styles

### Community 13 - "4. Common Problems in Seasonal Product Forecasting & Their Solutions"
Cohesion: 0.05
Nodes (43): 1. How Seasonal Product Forecasting Works, 2. Mathematical Model & Forecasting Formulas, 3. Worked Concrete Example: School Supplies Before School Year vs. Ordinary Months, 4. Common Problems in Seasonal Product Forecasting & Their Solutions, Complete Solution Architecture (Single-User Owner Model), Executive Summary, Part 1: Audit of the Current Juan's Store POS UI Prototype, Part 2: Common POS System Problems & Comprehensive Solutions (+35 more)

### Community 17 - "sound-feedback.test.cjs"
Cohesion: 0.20
Nodes (8): assert, h, { readFileSync }, { resolve }, setup(), { test }, ts, vm

### Community 18 - "SynchronousKeyValueStorage"
Cohesion: 0.13
Nodes (3): StoreSettingsState, IKeyValueStorage, SynchronousKeyValueStorage

### Community 25 - "Data Input, Data Output & Mobile POS UX Best Practices (React Native + Expo)"
Cohesion: 0.11
Nodes (18): 1.1 Dual-Mode Product Barcode Registration (`Manual Input` OR `Camera Scan`), 1.2 Match Every `TextInput` to the Exact Hardware Keyboard Type, 1.3 Eliminate Keyboard Occlusion ("Keyboard Bounce of Death"), 1.4 Hybrid User-Input Payment Tender (`TextInput`) + Quick-Fill Denomination Chips at Checkout (`Screen 3`), 1.5 Idempotent Submission & Double-Tap Prevention, 2.1 Tabular Currency Formatting & Integer Centavo Precision, 2.2 Triple-Encoded Stock & Forecast Badges (Color + Icon + Text), 2.3 Action-First Data Output for `Feature C: Seasonal Product Forecast` (+10 more)

### Community 39 - "3. Applying the 4 Pillars of OOP to Juan's Store POS (TypeScript Implementation)"
Cohesion: 0.15
Nodes (12): 1. Executive Summary: How OOP and React Native (Expo) Fit Together, 1. Reusable Dual-Mode Barcode Component (`Manual Input` OR `Camera Scan`), 2. Golden Rules for Using OOP in React Native (Expo), 2. Recommended Expo + OOP Project Directory Structure, 3. Applying the 4 Pillars of OOP to Juan's Store POS (TypeScript Implementation), 4. Expo Hardware & UI Integration Best Practices (`expo-camera` & `expo-sqlite`), Pillar 1: Encapsulation — `Barcode` Value Object (Manual Input OR Camera Scan), Pillar 2: Abstraction & Single Source of Truth — `Product` Entity (*Tingi* Multi-Unit & Seasonal Threshold) (+4 more)

### Community 48 - "Welcome to your Expo app 👋"
Cohesion: 0.29
Nodes (6): Get a fresh project, Get started, Join the community, Learn more, Other setup steps, Welcome to your Expo app 👋

### Community 49 - "AGENTS.md"
Cohesion: 0.18
Nodes (10): 1. Single Immutable Snapshot & `useSyncExternalStore`, 2. Never Hydrate on Screen Focus, 3. Atomic SQLite Commits, 4. Direct UI-to-Snapshot Binding, Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing (+2 more)

### Community 58 - "sales.tsx"
Cohesion: 0.16
Nodes (13): GASTOS_CATEGORIES, PANUKLI_CATEGORIES, PERIODS, SalesHistoryScreen(), styles, styles, CashAdjustmentType, DateRangeFilter (+5 more)

### Community 59 - "getTranslations"
Cohesion: 0.11
Nodes (23): expo-router, getLocalizedMonths(), getPhilippineSeasonInfo(), SeasonalForecastScreen(), styles, DateFilter, MovementFilter, StockMovementHistoryScreen() (+15 more)

### Community 61 - "inventory.tsx"
Cohesion: 0.25
Nodes (8): STOCK_FILTERS, styles, BarcodeInputField(), BarcodeInputFieldProps, styles, BarcodeScannerViewfinder(), BarcodeScannerViewfinderProps, styles

### Community 62 - "ProductOnboardingService.ts"
Cohesion: 0.24
Nodes (4): ProductOnboardingService, ExternalProductCatalogResult, IExternalCatalogLookupService, OpenFoodFactsApiClient

### Community 63 - "Functional Requirements Specification (FRS)"
Cohesion: 0.04
Nodes (48): 1. Specification Format & Metadata Standards, FR-CSH-001: Cash Drawer Float & Paid-In / Paid-Out Logging, FR-CSH-002: End-of-Day Cash Drawer Reconciliation, FR-EXC-001: Same-Day Sales Void with Automatic Stock Reversal, FR-EXC-002: Receipt-Linked Return Wizard with Quantity Capping, FR-EXC-003: Mandatory Condition Disposition Gating (Sellable vs. Bad Order Quarantine), FR-EXC-004: Atomic In-Flow Product Exchange Settlement, FR-FOR-001: Multi-Tier Historical Demand Analysis (+40 more)

### Community 64 - "Functional Requirements Specification (FRS)"
Cohesion: 0.04
Nodes (48): 1. Specification Format & Metadata Standards, FR-CSH-001: Cash Drawer Float & Paid-In / Paid-Out Logging, FR-CSH-002: End-of-Day Cash Drawer Reconciliation, FR-EXC-001: Same-Day Sales Void with Automatic Stock Reversal, FR-EXC-002: Receipt-Linked Return Wizard with Quantity Capping, FR-EXC-003: Mandatory Condition Disposition Gating (Sellable vs. Bad Order Quarantine), FR-EXC-004: Atomic In-Flow Product Exchange Settlement, FR-FOR-001: Multi-Tier Historical Demand Analysis (+40 more)

### Community 65 - "Non-Functional Requirements Specification (NFRS)"
Cohesion: 0.05
Nodes (37): 1. Specification Framework & Quality Attributes, NFR-ARC-001: Clean Architecture & Domain-Driven Modularity, NFR-ARC-002: Zero Floating-Point Currency Drift (Integer Centavos Standard), NFR-ARC-003: 100% Strict TypeScript Type Safety, NFR-ENV-001: Budget Mobile Hardware Compatibility, NFR-ENV-002: Tropical Thermal & Battery Throttling Management, NFR-ENV-003: Extended Brownout Battery Saver & AMOLED True-Black Theme, NFR-PERF-001: Cold Boot to Interactive Snapshot (+29 more)

### Community 66 - "Non-Functional Requirements Specification (NFRS)"
Cohesion: 0.05
Nodes (37): 1. Specification Framework & Quality Attributes, NFR-ARC-001: Clean Architecture & Domain-Driven Modularity, NFR-ARC-002: Zero Floating-Point Currency Drift (Integer Centavos Standard), NFR-ARC-003: 100% Strict TypeScript Type Safety, NFR-ENV-001: Budget Mobile Hardware Compatibility, NFR-ENV-002: Tropical Thermal & Battery Throttling Management, NFR-ENV-003: Extended Brownout Battery Saver & AMOLED True-Black Theme, NFR-PERF-001: Cold Boot to Interactive Snapshot (+29 more)

### Community 67 - "5. Core Business Rules (BR)"
Cohesion: 0.07
Nodes (29): 1.1 Context & Problem Statement, 1.2 Proposed Solution Vision, 1. Project Vision & Executive Summary, 2.1 Elicitation Methodology, 2.2 Stakeholder Profiles & Personas, 2.3 Comprehensive Stakeholder Needs Matrix, 2. Stakeholder Needs Elicitation & Analysis, 3.1 Quantified Business Goals (BG) (+21 more)

### Community 68 - "5. Core Business Rules (BR)"
Cohesion: 0.07
Nodes (29): 1.1 Context & Problem Statement, 1.2 Proposed Solution Vision, 1. Project Vision & Executive Summary, 2.1 Elicitation Methodology, 2.2 Stakeholder Profiles & Personas, 2.3 Comprehensive Stakeholder Needs Matrix, 2. Stakeholder Needs Elicitation & Analysis, 3.1 Quantified Business Goals (BG) (+21 more)

### Community 69 - "container.ts"
Cohesion: 0.22
Nodes (7): openFoodFactsApiClient, productOnboardingService, productRepository, seasonalForecastEngine, tindahanStoreService, TindahanStoreContext, TindahanStoreProvider()

### Community 70 - "Product.ts"
Cohesion: 0.35
Nodes (7): ProductVisual, SellingUnitTier, StockStatus, UnitOfMeasure, BarcodeSource, ProductRow, ProductThumbnailProps

### Community 71 - "3. Functional Requirements Traceability Matrix (`FR-xxx`)"
Cohesion: 0.12
Nodes (16): 1. Traceability Architecture & Executive Dashboard, 2. Stakeholder Needs Traceability Matrix (`SN-xxx`), 3. Functional Requirements Traceability Matrix (`FR-xxx`), 4. Non-Functional Requirements Traceability Matrix (`NFR-xxx`), 5. Backward Traceability & Gap Analysis, 6. Primary Artifact Deliverable, Module 1: POS & Barcode Checkout (`FR-POS-xxx`), Module 2: Tender & Checkout Settlement (`FR-TND-xxx`) (+8 more)

### Community 72 - "3. Functional Requirements Traceability Matrix (`FR-xxx`)"
Cohesion: 0.12
Nodes (16): 1. Traceability Architecture & Executive Dashboard, 2. Stakeholder Needs Traceability Matrix (`SN-xxx`), 3. Functional Requirements Traceability Matrix (`FR-xxx`), 4. Non-Functional Requirements Traceability Matrix (`NFR-xxx`), 5. Backward Traceability & Gap Analysis, 6. Primary Artifact Deliverable, Module 1: POS & Barcode Checkout (`FR-POS-xxx`), Module 2: Tender & Checkout Settlement (`FR-TND-xxx`) (+8 more)

### Community 75 - "checkout.tsx"
Cohesion: 0.14
Nodes (16): CartItemStepperProps, CheckoutNewSaleScreen(), styles, styles, styles, phpCurrencyFormatter, ProductThumbnail(), styles (+8 more)

### Community 76 - "REQUIREMENTS_TRACEABILITY_MATRIX_3b7cd623.md"
Cohesion: 0.40
Nodes (4): Sheet: Executive Summary, Sheet: Functional RTM, Sheet: Non-Functional RTM, Sheet: Stakeholder Needs Trace

### Community 78 - "ConfirmationModal.tsx"
Cohesion: 0.25
Nodes (8): ConfirmationState, ConfirmationModal(), ConfirmationModalDetail, ConfirmationModalProps, ConfirmationType, styles, THEMES, TypeTheme

## Knowledge Gaps
- **448 isolated node(s):** `name`, `slug`, `version`, `orientation`, `icon` (+443 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 525 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **41 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `expo-router` connect `getTranslations` to `app-tabs.web.tsx`, `expo`, `container.ts`, `checkout.tsx`, `sales.tsx`, `inventory.tsx`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `TindahanStoreService` connect `TindahanStoreService` to `TindahanStoreService.ts`, `container.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `plugins` connect `expo` to `TindahanStoreService.ts`, `getTranslations`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `useTindahanStore()` (e.g. with `addCashAdjustment()` and `addCategory()`) actually correct?**
  _`useTindahanStore()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _448 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Product` be split into smaller, more focused modules?**
  _Cohesion score 0.14035087719298245 - nodes in this community are weakly interconnected._
- **Should `useTindahanStore` be split into smaller, more focused modules?**
  _Cohesion score 0.10520487264673312 - nodes in this community are weakly interconnected._