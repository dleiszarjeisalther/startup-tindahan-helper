# Graph Report - startupTindahanHelper  (2026-10-14)

## Corpus Check
- 58 files · ~180,711 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 588 nodes · 992 edges · 63 communities (19 shown, 43 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e398494b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Product
- useTindahanStore.ts
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
- SynchronousKeyValueStorage
- SoundFeedbackService
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
- Barcode
- container.ts
- ProductOnboardingService.ts
- ProductDTO
- InMemoryProductRepository

## God Nodes (most connected - your core abstractions)
1. `TindahanStoreService` - 54 edges
2. `useTindahanStore()` - 45 edges
3. `Product` - 31 edges
4. `Barcode` - 19 edges
5. `getTranslations()` - 17 edges
6. `Money` - 16 edges
7. `InMemoryProductRepository` - 14 edges
8. `expo` - 13 edges
9. `SynchronousKeyValueStorage` - 13 edges
10. `expo-router` - 12 edges

## Surprising Connections (you probably didn't know these)
- `StoreSnapshot` --references--> `ProductDTO`  [EXTRACTED]
  src/application/TindahanStoreService.ts → src/domain/entities/Product.ts
- `Collapsible()` --calls--> `useTheme()`  [EXTRACTED]
  src/components/ui/collapsible.tsx → src/hooks/use-theme.ts
- `SellingUnitTier` --references--> `Barcode`  [EXTRACTED]
  src/domain/entities/Product.ts → src/domain/value-objects/Barcode.ts
- `ProductDTO` --references--> `BarcodeSource`  [EXTRACTED]
  src/domain/entities/Product.ts → src/domain/value-objects/Barcode.ts
- `InMemoryProductRepository` --references--> `Product`  [EXTRACTED]
  src/infrastructure/repositories/InMemoryProductRepository.ts → src/domain/entities/Product.ts

## Import Cycles
- None detected.

## Communities (63 total, 43 thin omitted)

### Community 1 - "useTindahanStore.ts"
Cohesion: 0.05
Nodes (71): expo-router, CheckoutNewSaleScreen(), styles, SeasonalForecastScreen(), styles, PosScanProductScreen(), styles, InventoryManagementScreen() (+63 more)

### Community 3 - "app-tabs.web.tsx"
Cohesion: 0.12
Nodes (20): styles, ExternalLink(), Props, HintRowProps, styles, styles, ThemedText(), ThemedTextProps (+12 more)

### Community 4 - "expo"
Cohesion: 0.08
Nodes (23): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, reactCompiler, typedRoutes (+15 more)

### Community 5 - "package.json"
Cohesion: 0.10
Nodes (20): eslint, eslint-config-expo, devDependencies, eslint, eslint-config-expo, @types/react, typescript, main (+12 more)

### Community 6 - "SeasonalForecastEngine.ts"
Cohesion: 0.20
Nodes (8): BaseSeasonalStrategy, ColdStartCategoryStrategy, ForecastConfidenceTier, InitialCycle12MonthStrategy, ISeasonalForecastStrategy, Recurring24MonthYoYStrategy, SeasonalForecastEngine, SeasonalForecastResult

### Community 7 - "include"
Cohesion: 0.15
Nodes (12): ./assets/*, expo-env.d.ts, expo/tsconfig.base, .expo/types/**/*.ts, **/*.ts, **/*.tsx, compilerOptions, paths (+4 more)

### Community 8 - "TindahanStoreService.ts"
Cohesion: 0.07
Nodes (17): plugins, expo-asset, expo-sqlite, AddProductCommand, AddProductResult, CartItemDTO, CartSummaryDTO, Listener (+9 more)

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

### Community 17 - "SynchronousKeyValueStorage"
Cohesion: 0.15
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

### Community 59 - "container.ts"
Cohesion: 0.17
Nodes (8): ProductOnboardingService, openFoodFactsApiClient, productOnboardingService, productRepository, seasonalForecastEngine, ExternalProductCatalogResult, IExternalCatalogLookupService, OpenFoodFactsApiClient

### Community 60 - "ProductOnboardingService.ts"
Cohesion: 0.36
Nodes (6): ProductVisual, SellingUnitTier, StockStatus, BarcodeSource, ProductRow, ProductThumbnailProps

## Knowledge Gaps
- **211 isolated node(s):** `name`, `slug`, `version`, `orientation`, `icon` (+206 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 277 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **43 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `expo-router` connect `useTindahanStore.ts` to `TindahanStoreService.ts`, `app-tabs.web.tsx`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `TindahanStoreService` connect `TindahanStoreService` to `TindahanStoreService.ts`, `useTindahanStore.ts`, `container.ts`, `ProductDTO`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `plugins` connect `TindahanStoreService.ts` to `useTindahanStore.ts`, `SoundFeedbackService`, `expo`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Are the 25 inferred relationships involving `useTindahanStore()` (e.g. with `addOrUpdateMonthlySalesRecord()` and `addProductToDatabase()`) actually correct?**
  _`useTindahanStore()` has 25 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _211 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `useTindahanStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05388151174668029 - nodes in this community are weakly interconnected._
- **Should `TindahanStoreService` be split into smaller, more focused modules?**
  _Cohesion score 0.10352941176470588 - nodes in this community are weakly interconnected._