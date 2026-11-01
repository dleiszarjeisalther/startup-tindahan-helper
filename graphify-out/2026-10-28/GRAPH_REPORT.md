# Graph Report - startupTindahanHelper  (2026-10-28)

## Corpus Check
- 152 files · ~511,852 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1643 nodes · 2781 edges · 133 communities (60 shown, 56 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 94 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9671e034`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Product
- useTindahanStore
- StoreSettingsScreen
- app-tabs.web.tsx
- expo
- scripts
- SeasonalForecastEngine.ts
- include
- TindahanStoreService.ts
- reset-project.js
- TindahanStoreService
- settings.tsx
- animated-icon.web.tsx
- 4. Common Problems in Seasonal Product Forecasting & Their Solutions
- eslint.config.js
- use-color-scheme.web.ts
- InMemoryProductRepository
- sound-feedback.test.cjs
- SynchronousKeyValueStorage
- dependencies
- checkout.tsx
- expo-image
- expo-linking
- expo-router
- PinSecurityEngine
- Data Input, Data Output & Mobile POS UX Best Practices (React Native + Expo)
- expo-status-bar
- expo-symbols
- expo-notifications
- test-app-updates.cjs
- expo-sqlite
- react
- react-native
- expo-glass-effect
- react-native-reanimated
- react-native-safe-area-context
- react-native-gesture-handler
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
- Tindahan Helper
- AGENTS.md
- IKeyValueStorage
- test-dashboard-analytics.cjs
- 20261021000000_trial_licensing_schema.sql
- expo-image-picker
- @expo/vector-icons
- expo-web-browser
- expo-camera
- Grassroots & Barangay Ground Activation Playbook
- expo-clipboard
- useLicensing.ts
- 🎙️ Step-by-Step Script (Conversational Taglish)
- container.ts
- Functional Requirements Specification (FRS)
- Functional Requirements Specification (FRS)
- Non-Functional Requirements Specification (NFRS)
- Non-Functional Requirements Specification (NFRS)
- 5. Core Business Rules (BR)
- 5. Core Business Rules (BR)
- ReceiptPrinterModal.tsx
- _layout.tsx
- 3. Functional Requirements Traceability Matrix (`FR-xxx`)
- 3. Functional Requirements Traceability Matrix (`FR-xxx`)
- expo-haptics
- test-multi-quantity-refund.cjs
- test-tutorial-state.cjs
- REQUIREMENTS_TRACEABILITY_MATRIX_3b7cd623.md
- Barcode
- expo-local-authentication
- @expo/ui
- Social Media Content Strategy & Viral Video Scripts
- index.tsx
- Brand Identity & Positioning Guide
- App Store Optimization (ASO) & Store Listing Copy
- Marketing Collateral: Flyers, Tarpaulins & Counter Signs
- Startup Tindahan Helper — Marketing Kit & Strategy Hub
- expo-device
- expo-constants
- expo-sharing
- runMultiUnitTests
- runBackupRestoreTests
- expo-font
- expo-document-picker
- public.app_config
- expo-file-system
- public.device_trials
- public.payment_requests
- history.tsx
- StoreAlertPolicy.ts
- LicensingService.ts
- TutorialContext.tsx
- expo-system-ui
- react-dom
- react-native-web
- DashboardAnalyticsEngine.ts
- ILocalNotificationScheduler
- inventory.tsx
- expo-router
- Android APK updates
- patch-expo-notifications.cjs
- 20261023000000_app_releases.sql
- SeasonalForecastScreen
- DashboardAnalyticsEngine
- Money
- test-product-image-edit.cjs
- InMemoryProductRepository.ts
- StoreSettingsState

## God Nodes (most connected - your core abstractions)
1. `TindahanStoreService` - 96 edges
2. `useTindahanStore()` - 93 edges
3. `Product` - 41 edges
4. `SynchronousKeyValueStorage` - 40 edges
5. `IKeyValueStorage` - 38 edges
6. `Money` - 29 edges
7. `ProductDTO` - 24 edges
8. `getTranslations()` - 23 edges
9. `expo-router` - 19 edges
10. `Barcode` - 19 edges

## Surprising Connections (you probably didn't know these)
- `setup()` --calls--> `AppUpdateService`  [EXTRACTED]
  scripts/test-app-updates.cjs → src/application/AppUpdateService.ts
- `ApkUpdaterModule` --inherits--> `Module`  [EXTRACTED]
  modules/apk-updater/android/src/main/java/expo/modules/apkupdater/ApkUpdaterModule.kt → scripts/test-tutorial-state.cjs
- `ProductStockManageModalProps` --references--> `ProductDTO`  [EXTRACTED]
  src/presentation/components/ProductStockManageModal.tsx → src/domain/entities/Product.ts
- `PaymentDistributionSummary` --references--> `Money`  [EXTRACTED]
  src/domain/strategies/DashboardAnalyticsEngine.ts → src/domain/value-objects/Money.ts
- `AppUpdateMenuItem()` --calls--> `useTindahanStore()`  [EXTRACTED]
  src/presentation/components/AppUpdatePrompt.tsx → src/presentation/hooks/useTindahanStore.ts

## Import Cycles
- None detected.

## Communities (133 total, 56 thin omitted)

### Community 1 - "useTindahanStore"
Cohesion: 0.09
Nodes (52): PosScanProductScreen(), InventoryManagementScreen(), NotificationsScreen(), ProductListScreen(), addCashAdjustment(), addCategory(), addManualUtangEntry(), addOrUpdateMonthlySalesRecord() (+44 more)

### Community 2 - "StoreSettingsScreen"
Cohesion: 0.22
Nodes (9): StoreSettingsScreen(), clearAllDatabaseData(), enableStoreSecurity(), exportDatabaseBackup(), restoreDatabaseBackup(), retryNotificationSchedule(), setOwnerMasterPin(), setPhoneNotificationsEnabled() (+1 more)

### Community 3 - "app-tabs.web.tsx"
Cohesion: 0.12
Nodes (20): styles, ExternalLink(), Props, HintRowProps, styles, styles, ThemedText(), ThemedTextProps (+12 more)

### Community 4 - "expo"
Cohesion: 0.05
Nodes (43): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, backgroundColor, package, permissions (+35 more)

### Community 5 - "scripts"
Cohesion: 0.09
Nodes (21): eslint, eslint-config-expo, devDependencies, eslint, eslint-config-expo, @types/react, typescript, main (+13 more)

### Community 6 - "SeasonalForecastEngine.ts"
Cohesion: 0.19
Nodes (9): BaseSeasonalStrategy, ColdStartCategoryStrategy, ForecastConfidenceTier, getPhilippineCategorySeasonality(), InitialCycle12MonthStrategy, ISeasonalForecastStrategy, Recurring24MonthYoYStrategy, SeasonalForecastEngine (+1 more)

### Community 7 - "include"
Cohesion: 0.15
Nodes (12): ./assets/*, expo-env.d.ts, expo/tsconfig.base, .expo/types/**/*.ts, **/*.ts, **/*.tsx, compilerOptions, paths (+4 more)

### Community 8 - "TindahanStoreService.ts"
Cohesion: 0.08
Nodes (31): GASTOS_CATEGORIES, PANUKLI_CATEGORIES, PERIODS, styles, ActiveExchangeCreditInfo, AddToCartResult, CartSummaryDTO, CashAdjustmentType (+23 more)

### Community 9 - "reset-project.js"
Cohesion: 0.22
Nodes (7): exampleDirPath, fs, oldDirs, path, readline, rl, root

### Community 10 - "TindahanStoreService"
Cohesion: 0.05
Nodes (4): AddProductResult, TindahanStoreService, PinVerificationOutcome, MonthlySalesRecord

### Community 11 - "settings.tsx"
Cohesion: 0.13
Nodes (17): styles, styles, FilterType, styles, UtangCustomerRecord, BiometricAuthService, BiometricCapability, GcashQrModal() (+9 more)

### Community 12 - "animated-icon.web.tsx"
Cohesion: 0.29
Nodes (4): glowKeyframe, keyframe, logoKeyframe, styles

### Community 13 - "4. Common Problems in Seasonal Product Forecasting & Their Solutions"
Cohesion: 0.05
Nodes (43): 1. How Seasonal Product Forecasting Works, 2. Mathematical Model & Forecasting Formulas, 3. Worked Concrete Example: School Supplies Before School Year vs. Ordinary Months, 4. Common Problems in Seasonal Product Forecasting & Their Solutions, Complete Solution Architecture (Single-User Owner Model), Executive Summary, Part 1: Audit of the Current Juan's Store POS UI Prototype, Part 2: Common POS System Problems & Comprehensive Solutions (+35 more)

### Community 17 - "sound-feedback.test.cjs"
Cohesion: 0.15
Nodes (11): assert, h, initialPlayers, newPlayers, { readFileSync }, recoveredPlayers, { resolve }, setup() (+3 more)

### Community 19 - "dependencies"
Cohesion: 0.18
Nodes (11): expo, expo-asset, expo-crypto, expo-splash-screen, dependencies, expo, expo-asset, expo-crypto (+3 more)

### Community 20 - "checkout.tsx"
Cohesion: 0.13
Nodes (18): CartItemStepperProps, styles, styles, CartItemDTO, PaymentTenderType, phpCurrencyFormatter, FloatingToast(), FloatingToastProps (+10 more)

### Community 25 - "Data Input, Data Output & Mobile POS UX Best Practices (React Native + Expo)"
Cohesion: 0.11
Nodes (18): 1.1 Dual-Mode Product Barcode Registration (`Manual Input` OR `Camera Scan`), 1.2 Match Every `TextInput` to the Exact Hardware Keyboard Type, 1.3 Eliminate Keyboard Occlusion ("Keyboard Bounce of Death"), 1.4 Hybrid User-Input Payment Tender (`TextInput`) + Quick-Fill Denomination Chips at Checkout (`Screen 3`), 1.5 Idempotent Submission & Double-Tap Prevention, 2.1 Tabular Currency Formatting & Integer Centavo Precision, 2.2 Triple-Encoded Stock & Forecast Badges (Color + Icon + Text), 2.3 Action-First Data Output for `Feature C: Seasonal Product Forecast` (+10 more)

### Community 29 - "test-app-updates.cjs"
Cohesion: 0.06
Nodes (24): active, { AppRelease }, { AppUpdateService }, assert, before, enhanced, fs, nullMedia (+16 more)

### Community 39 - "3. Applying the 4 Pillars of OOP to Juan's Store POS (TypeScript Implementation)"
Cohesion: 0.15
Nodes (12): 1. Executive Summary: How OOP and React Native (Expo) Fit Together, 1. Reusable Dual-Mode Barcode Component (`Manual Input` OR `Camera Scan`), 2. Golden Rules for Using OOP in React Native (Expo), 2. Recommended Expo + OOP Project Directory Structure, 3. Applying the 4 Pillars of OOP to Juan's Store POS (TypeScript Implementation), 4. Expo Hardware & UI Integration Best Practices (`expo-camera` & `expo-sqlite`), Pillar 1: Encapsulation — `Barcode` Value Object (Manual Input OR Camera Scan), Pillar 2: Abstraction & Single Source of Truth — `Product` Entity (*Tingi* Multi-Unit & Seasonal Threshold) (+4 more)

### Community 48 - "Tindahan Helper"
Cohesion: 0.50
Nodes (3): Development, Features, Tindahan Helper

### Community 49 - "AGENTS.md"
Cohesion: 0.15
Nodes (12): 1. Single Immutable Snapshot & `useSyncExternalStore`, 2. Never Hydrate on Screen Focus, 3. Atomic SQLite Commits, 4. Direct UI-to-Snapshot Binding, Building with EAS, Commands, Expo has changed — do not trust your training data, Mandatory Graphify-First Codebase Exploration & Graph Maintenance Invariant (+4 more)

### Community 51 - "test-dashboard-analytics.cjs"
Cohesion: 0.06
Nodes (29): adjustments, assert, b9_12, bars, bEarly, cashItem, createMatcher(), dailyBars (+21 more)

### Community 52 - "20261021000000_trial_licensing_schema.sql"
Cohesion: 0.67
Nodes (3): public.app_config, public.device_trials, public.payment_requests

### Community 58 - "Grassroots & Barangay Ground Activation Playbook"
Cohesion: 0.14
Nodes (13): 🏬 Activation Channel 1: The Wholesaler Corridors (Puregold & Super8 Lines), 🏘️ Activation Channel 2: Barangay Negosyo Roadshow, 🏷️ Activation Channel 3: Point-of-Sale Counter Sticking Strategy, 🤝 Activation Channel 4: "Suki-to-Suki" Merchant Referral Mechanics, "Dito, Malinaw ang Listahan!" Store Counter Badges, Execution Strategy, Execution Strategy, Grassroots & Barangay Ground Activation Playbook (+5 more)

### Community 60 - "useLicensing.ts"
Cohesion: 0.11
Nodes (24): CheckoutNewSaleScreen(), LicensingGate(), LicensingGateContext, LicensingGateContextType, LicensingGateProps, styles, useLicensingGate(), OnboardingModalProps (+16 more)

### Community 61 - "🎙️ Step-by-Step Script (Conversational Taglish)"
Cohesion: 0.17
Nodes (11): 1. The Approach (Warm Greeting & Rapport), 2. The Hook (Relatable Problem), 3-Minute Field Merchant Onboarding Script, 3. The Live Demo (Show, Don't Tell — 10 Seconds), 4. Overcoming The Core Objections, 5. The Close & Onboarding, Objection A: "Wala akong pambayad sa subscription diyan / Magastos 'yan!", Objection B: "Mahina ang signal dito / Wala akong Wi-Fi o data!" (+3 more)

### Community 62 - "container.ts"
Cohesion: 0.12
Nodes (12): ProductOnboardingService, localNotificationScheduler, openFoodFactsApiClient, productOnboardingService, productRepository, seasonalForecastEngine, ExternalProductCatalogResult, IExternalCatalogLookupService (+4 more)

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

### Community 69 - "ReceiptPrinterModal.tsx"
Cohesion: 0.10
Nodes (12): EscPosReceiptFormatter, PaperWidth, ReceiptData, ReceiptLineItem, appReceiptPrinterService, BluetoothPrinterDevice, BluetoothThermalPrinterService, IReceiptPrinterService (+4 more)

### Community 70 - "_layout.tsx"
Cohesion: 0.11
Nodes (14): expo-asset, AnimatedSplashOverlay(), styles, AppTabs(), CustomTindahanTabBar(), styles, appUpdateService, tindahanStoreService (+6 more)

### Community 71 - "3. Functional Requirements Traceability Matrix (`FR-xxx`)"
Cohesion: 0.12
Nodes (16): 1. Traceability Architecture & Executive Dashboard, 2. Stakeholder Needs Traceability Matrix (`SN-xxx`), 3. Functional Requirements Traceability Matrix (`FR-xxx`), 4. Non-Functional Requirements Traceability Matrix (`NFR-xxx`), 5. Backward Traceability & Gap Analysis, 6. Primary Artifact Deliverable, Module 1: POS & Barcode Checkout (`FR-POS-xxx`), Module 2: Tender & Checkout Settlement (`FR-TND-xxx`) (+8 more)

### Community 72 - "3. Functional Requirements Traceability Matrix (`FR-xxx`)"
Cohesion: 0.12
Nodes (16): 1. Traceability Architecture & Executive Dashboard, 2. Stakeholder Needs Traceability Matrix (`SN-xxx`), 3. Functional Requirements Traceability Matrix (`FR-xxx`), 4. Non-Functional Requirements Traceability Matrix (`NFR-xxx`), 5. Backward Traceability & Gap Analysis, 6. Primary Artifact Deliverable, Module 1: POS & Barcode Checkout (`FR-POS-xxx`), Module 2: Tender & Checkout Settlement (`FR-TND-xxx`) (+8 more)

### Community 74 - "test-multi-quantity-refund.cjs"
Cohesion: 0.07
Nodes (23): assert, customer4, items1, items3, items4, items6, items7, res1 (+15 more)

### Community 75 - "test-tutorial-state.cjs"
Cohesion: 0.07
Nodes (30): FileProvider, ApkFileProvider, ApkUpdaterModule, PackageInfo, addProduct(), { appKeyValueStorage }, assert, clearCart() (+22 more)

### Community 76 - "REQUIREMENTS_TRACEABILITY_MATRIX_3b7cd623.md"
Cohesion: 0.40
Nodes (4): Sheet: Executive Summary, Sheet: Functional RTM, Sheet: Non-Functional RTM, Sheet: Stakeholder Needs Trace

### Community 82 - "Social Media Content Strategy & Viral Video Scripts"
Cohesion: 0.20
Nodes (9): 📅 4-Week Social Media Content Calendar, 📱 Facebook Group Seeding & Organic Strategy, Key Target Communities, Script 1: "Ang Misteryo ng Nawawalang Utang" (Relatable Drama / Comedy), Script 2: "Bakit Walang Tubo ang Tindahan Mo?" (Educational & Reality Check), Script 3: "Si Ate Joy at ang Nakalilitong Sukli" (Speed & Accuracy), Social Media Content Strategy & Viral Video Scripts, Value-First Post Templates (No Spamming) (+1 more)

### Community 83 - "index.tsx"
Cohesion: 0.22
Nodes (12): styles, styles, AddProductCommand, ProductDTO, SellingUnitTier, StockStatus, ProductThumbnail(), styles (+4 more)

### Community 84 - "Brand Identity & Positioning Guide"
Cohesion: 0.22
Nodes (8): 1. Brand Mission & Vision, 2. Positioning Statement, 3. Brand Personality & Tone of Voice, 4. Brand Taglines & Slogans, 5. Visual & Design Language Standards, Brand Identity & Positioning Guide, Primary Taglines, Secondary & Campaign-Specific Hooks

### Community 85 - "App Store Optimization (ASO) & Store Listing Copy"
Cohesion: 0.25
Nodes (7): App Store Optimization (ASO) & Store Listing Copy, 🖼️ App Store Screenshot Concepts (6 Slides), 📱 App Title & Short Metadata, 🔍 ASO Keyword Bank (Philippines Localization), 📝 Long Description (Taglish / Vernacular - High Converting), Primary High-Volume Search Keywords, Secondary & Long-Tail Keywords

### Community 86 - "Marketing Collateral: Flyers, Tarpaulins & Counter Signs"
Cohesion: 0.29
Nodes (6): [BACK SIDE], 📄 Collateral Item 1: Half-Page (A5) Wholesaler Handout Flyer, 🚩 Collateral Item 2: Wholesale Bay Tarpaulin Banner (2ft x 5ft / 3ft x 6ft), 🏷️ Collateral Item 3: Weather-Proof Counter Window Stickers (4in x 6in), [FRONT SIDE], Marketing Collateral: Flyers, Tarpaulins & Counter Signs

### Community 87 - "Startup Tindahan Helper — Marketing Kit & Strategy Hub"
Cohesion: 0.33
Nodes (5): 🗓️ Acquisition Milestones & Growth Goals, 💎 Core Value Propositions (The 5 Pillars), 📁 Marketing Directory Map, Startup Tindahan Helper — Marketing Kit & Strategy Hub, 🎯 Target Audience Snapshot

### Community 91 - "runMultiUnitTests"
Cohesion: 0.24
Nodes (5): assert, runMultiUnitTests(), calculateBaseUnitsDeducted(), getTier(), validateStock()

### Community 106 - "history.tsx"
Cohesion: 0.14
Nodes (16): DateFilter, HistoryCategoryFilter, MovementFilter, StockMovementHistoryScreen(), styles, UnifiedActivityItem, SalesHistoryScreen(), SukiUtangLedgerScreen() (+8 more)

### Community 107 - "StoreAlertPolicy.ts"
Cohesion: 0.13
Nodes (15): AlertFilter, FILTERS, styles, StoreSnapshot, parseDueAt(), ProductAlertSource, StoreAlert, StoreAlertKind (+7 more)

### Community 108 - "LicensingService.ts"
Cohesion: 0.05
Nodes (33): plugins, RFC-2397, expo-audio, expo-notifications, expo-sharing, expo-sqlite, TabLayout(), SqliteDatabase (+25 more)

### Community 111 - "TutorialContext.tsx"
Cohesion: 0.13
Nodes (20): FINGERTIP_OFFSET_X, GLOVE_ASSET, MickeyGlovePointer(), MickeyGlovePointerProps, styles, SpotlightOverlay(), styles, styles (+12 more)

### Community 115 - "DashboardAnalyticsEngine.ts"
Cohesion: 0.15
Nodes (13): ProductVisual, AnalyticsPeriod, DashboardCashAdjustment, DashboardSaleLineItem, DashboardSaleTransaction, DashboardTopProduct, DateFilterInput, DateRangeFilter (+5 more)

### Community 117 - "ILocalNotificationScheduler"
Cohesion: 0.40
Nodes (3): ILocalNotificationScheduler, LocalNotificationRequest, ExpoLocalNotificationScheduler

### Community 118 - "inventory.tsx"
Cohesion: 0.16
Nodes (19): ConfirmationState, ConfirmationState, STOCK_FILTERS, styles, ConfirmationState, ConfirmationState, ConfirmationState, ConfirmationState (+11 more)

### Community 120 - "expo-router"
Cohesion: 0.18
Nodes (8): expo-router, styles, BarcodeInputField(), BarcodeInputFieldProps, styles, BarcodeScannerViewfinder(), BarcodeScannerViewfinderProps, styles

### Community 121 - "Android APK updates"
Cohesion: 0.33
Nodes (5): Android APK updates, Configuration and builds, Device behavior and recovery, Safe publication, Verification / release gate

### Community 122 - "patch-expo-notifications.cjs"
Cohesion: 0.50
Nodes (3): fs, path, targetFile

### Community 125 - "SeasonalForecastScreen"
Cohesion: 0.25
Nodes (8): getLocalizedMonths(), getPhilippineSeasonInfo(), SeasonalForecastScreen(), MenuProfileScreen(), OnboardingModal(), adjustInventoryStock(), getMonthlySalesHistory(), updateSettings()

### Community 129 - "Money"
Cohesion: 0.17
Nodes (4): DashboardFinancialMetrics, PaymentDistributionItem, Money, WeightQuantitySheet()

### Community 131 - "InMemoryProductRepository.ts"
Cohesion: 0.53
Nodes (3): UnitOfMeasure, BarcodeSource, ProductRow

## Knowledge Gaps
- **669 isolated node(s):** `name`, `slug`, `version`, `orientation`, `icon` (+664 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 847 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **56 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TindahanStoreService` connect `TindahanStoreService` to `_layout.tsx`, `TindahanStoreService.ts`, `StoreAlertPolicy.ts`, `PinSecurityEngine`, `container.ts`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `expo-router` connect `expo-router` to `app-tabs.web.tsx`, `_layout.tsx`, `TindahanStoreService.ts`, `history.tsx`, `settings.tsx`, `LicensingService.ts`, `StoreAlertPolicy.ts`, `TutorialContext.tsx`, `index.tsx`, `checkout.tsx`, `inventory.tsx`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `Barcode` connect `Barcode` to `InMemoryProductRepository`, `sound-feedback.test.cjs`, `index.tsx`, `InMemoryProductRepository.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 58 inferred relationships involving `useTindahanStore()` (e.g. with `addCashAdjustment()` and `addCategory()`) actually correct?**
  _`useTindahanStore()` has 58 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _669 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Product` be split into smaller, more focused modules?**
  _Cohesion score 0.10333333333333333 - nodes in this community are weakly interconnected._
- **Should `useTindahanStore` be split into smaller, more focused modules?**
  _Cohesion score 0.08925979680696662 - nodes in this community are weakly interconnected._