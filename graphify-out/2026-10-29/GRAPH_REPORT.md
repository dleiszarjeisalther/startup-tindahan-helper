# Graph Report - startupTindahanHelper  (2026-10-29)

## Corpus Check
- 152 files · ~510,100 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1643 nodes · 2774 edges · 148 communities (73 shown, 58 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 94 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3a6ba808`
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
- checkout.tsx
- animated-icon.web.tsx
- 4. Common Problems in Seasonal Product Forecasting & Their Solutions
- eslint.config.js
- use-color-scheme.web.ts
- InMemoryProductRepository
- sound-feedback.test.cjs
- SynchronousKeyValueStorage
- dependencies
- index.tsx
- expo-image
- expo-linking
- expo-router
- PinSecurityEngine
- Data Input, Data Output & Mobile POS UX Best Practices (React Native + Expo)
- expo-status-bar
- expo-symbols
- expo-notifications
- AppUpdateService
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
- StoreSettingsState
- 🎙️ Step-by-Step Script (Conversational Taglish)
- OpenFoodFactsApiClient.ts
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
- LicensingService.ts
- @expo/ui
- Social Media Content Strategy & Viral Video Scripts
- explore.tsx
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
- sales.tsx
- StoreAlertPolicy.ts
- SoundFeedbackService.ts
- useLicensing.ts
- expo-system-ui
- react-dom
- react-native-web
- Money
- ILocalNotificationScheduler
- utang.tsx
- inventory.tsx
- Android APK updates
- patch-expo-notifications.cjs
- 20261023000000_app_releases.sql
- OnboardingModal.tsx
- DashboardAnalyticsEngine
- test-app-updates.cjs
- test-product-image-edit.cjs
- Product.ts
- InventoryManagementScreen
- TransactionDetailModal.tsx
- settings.tsx
- DashboardAnalyticsEngine.ts
- AndroidAppUpdatePort
- AppUpdateService.ts
- android
- PosScanProductScreen
- permissions
- container.ts
- splash
- SoundFeedbackService
- extra
- experiments
- web

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
- `TrendBarPoint` --references--> `Money`  [EXTRACTED]
  src/domain/strategies/DashboardAnalyticsEngine.ts → src/domain/value-objects/Money.ts
- `PaymentDistributionSummary` --references--> `Money`  [EXTRACTED]
  src/domain/strategies/DashboardAnalyticsEngine.ts → src/domain/value-objects/Money.ts
- `CheckoutNewSaleScreen()` --calls--> `useIdempotentSubmit()`  [EXTRACTED]
  src/app/checkout.tsx → src/presentation/hooks/useIdempotentSubmit.ts

## Import Cycles
- None detected.

## Communities (148 total, 58 thin omitted)

### Community 1 - "useTindahanStore"
Cohesion: 0.12
Nodes (31): addCashAdjustment(), addManualUtangEntry(), addOrUpdateMonthlySalesRecord(), addUtangCustomer(), cancelExchangeCredit(), clearCart(), completeSale(), deleteCashAdjustment() (+23 more)

### Community 2 - "StoreSettingsScreen"
Cohesion: 0.25
Nodes (8): StoreSettingsScreen(), clearAllDatabaseData(), enableStoreSecurity(), exportDatabaseBackup(), restoreDatabaseBackup(), retryNotificationSchedule(), setOwnerMasterPin(), setPhoneNotificationsEnabled()

### Community 3 - "app-tabs.web.tsx"
Cohesion: 0.12
Nodes (20): styles, ExternalLink(), Props, HintRowProps, styles, styles, ThemedText(), ThemedTextProps (+12 more)

### Community 4 - "expo"
Cohesion: 0.15
Nodes (12): expo, backgroundColor, icon, ios, name, orientation, owner, scheme (+4 more)

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
Cohesion: 0.10
Nodes (19): AddProductResult, ActiveExchangeCreditInfo, AddToCartResult, CartItemDTO, CartSummaryDTO, CashAdjustmentType, DaySalesBucket, DEFAULT_CATEGORIES (+11 more)

### Community 9 - "reset-project.js"
Cohesion: 0.22
Nodes (7): exampleDirPath, fs, oldDirs, path, readline, rl, root

### Community 10 - "TindahanStoreService"
Cohesion: 0.06
Nodes (3): TindahanStoreService, MonthlySalesRecord, DatabaseBackupService

### Community 11 - "checkout.tsx"
Cohesion: 0.24
Nodes (8): expo-sharing, CartItemStepperProps, CheckoutNewSaleScreen(), styles, GcashQrModal(), GcashQrModalProps, styles, useLicensingGate()

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

### Community 20 - "index.tsx"
Cohesion: 0.18
Nodes (12): styles, styles, phpCurrencyFormatter, ConfirmationModal(), UnitSelectionModal(), PRESET_PESO_AMOUNTS, PRESET_WEIGHTS, styles (+4 more)

### Community 25 - "Data Input, Data Output & Mobile POS UX Best Practices (React Native + Expo)"
Cohesion: 0.11
Nodes (18): 1.1 Dual-Mode Product Barcode Registration (`Manual Input` OR `Camera Scan`), 1.2 Match Every `TextInput` to the Exact Hardware Keyboard Type, 1.3 Eliminate Keyboard Occlusion ("Keyboard Bounce of Death"), 1.4 Hybrid User-Input Payment Tender (`TextInput`) + Quick-Fill Denomination Chips at Checkout (`Screen 3`), 1.5 Idempotent Submission & Double-Tap Prevention, 2.1 Tabular Currency Formatting & Integer Centavo Precision, 2.2 Triple-Encoded Stock & Forecast Badges (Color + Icon + Text), 2.3 Action-First Data Output for `Feature C: Seasonal Product Forecast` (+10 more)

### Community 29 - "AppUpdateService"
Cohesion: 0.18
Nodes (3): setup(), AppUpdatePort, AppUpdateService

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

### Community 61 - "🎙️ Step-by-Step Script (Conversational Taglish)"
Cohesion: 0.17
Nodes (11): 1. The Approach (Warm Greeting & Rapport), 2. The Hook (Relatable Problem), 3-Minute Field Merchant Onboarding Script, 3. The Live Demo (Show, Don't Tell — 10 Seconds), 4. Overcoming The Core Objections, 5. The Close & Onboarding, Objection A: "Wala akong pambayad sa subscription diyan / Magastos 'yan!", Objection B: "Mahina ang signal dito / Wala akong Wi-Fi o data!" (+3 more)

### Community 62 - "OpenFoodFactsApiClient.ts"
Cohesion: 0.16
Nodes (7): ProductOnboardingService, ExternalProductCatalogResult, IExternalCatalogLookupService, OpenFactsApiResponse, OpenFactsProductPayload, OpenFoodFactsApiClient, UpcItemDbPayload

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
Nodes (11): EscPosReceiptFormatter, PaperWidth, ReceiptData, ReceiptLineItem, appReceiptPrinterService, BluetoothPrinterDevice, BluetoothThermalPrinterService, IReceiptPrinterService (+3 more)

### Community 70 - "_layout.tsx"
Cohesion: 0.12
Nodes (13): expo-asset, AnimatedSplashOverlay(), styles, AppTabs(), CustomTindahanTabBar(), styles, appUpdateService, tindahanStoreService (+5 more)

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

### Community 80 - "LicensingService.ts"
Cohesion: 0.08
Nodes (21): SqliteDatabase, BackupDataPayload, BackupExportResult, BackupRestoreResult, formatTimeRemaining(), getCompletedSalesCount(), getDeviceHardwareFingerprint(), getSecretSalt() (+13 more)

### Community 82 - "Social Media Content Strategy & Viral Video Scripts"
Cohesion: 0.20
Nodes (9): 📅 4-Week Social Media Content Calendar, 📱 Facebook Group Seeding & Organic Strategy, Key Target Communities, Script 1: "Ang Misteryo ng Nawawalang Utang" (Relatable Drama / Comedy), Script 2: "Bakit Walang Tubo ang Tindahan Mo?" (Educational & Reality Check), Script 3: "Si Ate Joy at ang Nakalilitong Sukli" (Speed & Accuracy), Social Media Content Strategy & Viral Video Scripts, Value-First Post Templates (No Spamming) (+1 more)

### Community 83 - "explore.tsx"
Cohesion: 0.18
Nodes (10): styles, FloatingToast(), FloatingToastProps, styles, ToastType, dictionaries, en, SupportedLanguage (+2 more)

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

### Community 106 - "sales.tsx"
Cohesion: 0.13
Nodes (21): DateFilter, HistoryCategoryFilter, MovementFilter, StockMovementHistoryScreen(), styles, UnifiedActivityItem, GASTOS_CATEGORIES, PANUKLI_CATEGORIES (+13 more)

### Community 107 - "StoreAlertPolicy.ts"
Cohesion: 0.13
Nodes (15): AlertFilter, FILTERS, styles, StoreSnapshot, parseDueAt(), ProductAlertSource, StoreAlert, StoreAlertKind (+7 more)

### Community 108 - "SoundFeedbackService.ts"
Cohesion: 0.22
Nodes (8): plugins, RFC-2397, expo-audio, expo-notifications, expo-sqlite, TabLayout(), BARCODE_BEEP_DATA_URI, BeepPlayer

### Community 111 - "useLicensing.ts"
Cohesion: 0.06
Nodes (41): LicensingState, LicensingGate(), LicensingGateContext, LicensingGateContextType, LicensingGateProps, styles, styles, TrialBanner() (+33 more)

### Community 115 - "Money"
Cohesion: 0.15
Nodes (4): DashboardFinancialMetrics, PaymentDistributionItem, Money, WeightQuantitySheet()

### Community 117 - "ILocalNotificationScheduler"
Cohesion: 0.27
Nodes (3): ILocalNotificationScheduler, LocalNotificationRequest, ExpoLocalNotificationScheduler

### Community 118 - "utang.tsx"
Cohesion: 0.19
Nodes (15): ConfirmationState, ConfirmationState, ConfirmationState, ConfirmationState, ConfirmationState, ConfirmationState, FilterType, styles (+7 more)

### Community 120 - "inventory.tsx"
Cohesion: 0.13
Nodes (15): expo-router, STOCK_FILTERS, styles, styles, BarcodeInputField(), BarcodeInputFieldProps, styles, BarcodeScannerViewfinder() (+7 more)

### Community 121 - "Android APK updates"
Cohesion: 0.33
Nodes (5): Android APK updates, Configuration and builds, Device behavior and recovery, Safe publication, Verification / release gate

### Community 122 - "patch-expo-notifications.cjs"
Cohesion: 0.50
Nodes (3): fs, path, targetFile

### Community 125 - "OnboardingModal.tsx"
Cohesion: 0.18
Nodes (10): getLocalizedMonths(), getPhilippineSeasonInfo(), SeasonalForecastScreen(), MenuProfileScreen(), OnboardingModal(), OnboardingModalProps, styles, adjustInventoryStock() (+2 more)

### Community 129 - "test-app-updates.cjs"
Cohesion: 0.13
Nodes (14): active, { AppRelease }, { AppUpdateService }, assert, before, enhanced, fs, nullMedia (+6 more)

### Community 131 - "Product.ts"
Cohesion: 0.17
Nodes (12): AddProductCommand, ProductDTO, SellingUnitTier, StockStatus, UnitOfMeasure, IProductRepository, BarcodeSource, ProductRow (+4 more)

### Community 132 - "InventoryManagementScreen"
Cohesion: 0.18
Nodes (12): InventoryManagementScreen(), ProductListScreen(), addCategory(), addProductToDatabase(), addToCart(), deleteCategory(), deleteProductFromDatabase(), lookupOnlineCatalog() (+4 more)

### Community 133 - "TransactionDetailModal.tsx"
Cohesion: 0.22
Nodes (9): SaleTransactionRecord, CancelExchangeCreditModal(), CancelExchangeCreditModalProps, styles, ReturnDisposition, ReturnResolution, styles, TransactionDetailModal() (+1 more)

### Community 135 - "settings.tsx"
Cohesion: 0.16
Nodes (12): styles, styles, BiometricAuthService, BiometricCapability, AppUpdateMenuItem(), PinChallengeModal(), PinChallengeModalProps, styles (+4 more)

### Community 136 - "DashboardAnalyticsEngine.ts"
Cohesion: 0.15
Nodes (13): ProductVisual, AnalyticsPeriod, DashboardCashAdjustment, DashboardSaleLineItem, DashboardSaleTransaction, DashboardTopProduct, DateFilterInput, DateRangeFilter (+5 more)

### Community 138 - "AppUpdateService.ts"
Cohesion: 0.29
Nodes (5): InstalledApp, UpdatePhase, UpdateSnapshot, AppRelease, ReleaseMetadata

### Community 139 - "android"
Cohesion: 0.20
Nodes (10): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, backgroundColor, package, predictiveBackGestureEnabled (+2 more)

### Community 140 - "PosScanProductScreen"
Cohesion: 0.20
Nodes (10): PosScanProductScreen(), NotificationsScreen(), convertExchangeCreditToCashRefund(), lockStore(), markAlertRead(), markAllAlertsRead(), toggleBrownoutBatterySaver(), undoExchangeCreditReturn() (+2 more)

### Community 141 - "permissions"
Cohesion: 0.33
Nodes (6): permissions, android.permission.CAMERA, android.permission.FOREGROUND_SERVICE, android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK, android.permission.MODIFY_AUDIO_SETTINGS, android.permission.RECORD_AUDIO

### Community 142 - "container.ts"
Cohesion: 0.33
Nodes (5): localNotificationScheduler, openFoodFactsApiClient, productOnboardingService, productRepository, seasonalForecastEngine

### Community 143 - "splash"
Cohesion: 0.60
Nodes (5): splash, splash, backgroundColor, image, resizeMode

### Community 145 - "extra"
Cohesion: 0.50
Nodes (4): projectId, extra, eas, router

### Community 146 - "experiments"
Cohesion: 0.67
Nodes (3): reactCompiler, typedRoutes, experiments

### Community 147 - "web"
Cohesion: 0.67
Nodes (3): web, favicon, output

## Knowledge Gaps
- **670 isolated node(s):** `name`, `slug`, `version`, `orientation`, `icon` (+665 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 848 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **58 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TindahanStoreService` connect `TindahanStoreService` to `Product.ts`, `_layout.tsx`, `TindahanStoreService.ts`, `StoreAlertPolicy.ts`, `container.ts`, `PinSecurityEngine`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `expo-router` connect `inventory.tsx` to `app-tabs.web.tsx`, `_layout.tsx`, `settings.tsx`, `sales.tsx`, `checkout.tsx`, `SoundFeedbackService.ts`, `StoreAlertPolicy.ts`, `useLicensing.ts`, `explore.tsx`, `index.tsx`, `utang.tsx`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `Barcode` connect `Barcode` to `InMemoryProductRepository`, `sound-feedback.test.cjs`, `Product.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Are the 58 inferred relationships involving `useTindahanStore()` (e.g. with `addCashAdjustment()` and `addCategory()`) actually correct?**
  _`useTindahanStore()` has 58 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _670 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Product` be split into smaller, more focused modules?**
  _Cohesion score 0.09971509971509972 - nodes in this community are weakly interconnected._
- **Should `useTindahanStore` be split into smaller, more focused modules?**
  _Cohesion score 0.12298387096774194 - nodes in this community are weakly interconnected._