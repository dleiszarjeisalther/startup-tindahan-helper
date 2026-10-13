# Graph Report - startupTindahanHelper  (2026-10-13)

## Corpus Check
- 54 files · ~173,097 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 494 nodes · 766 edges · 54 communities (19 shown, 34 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `00f15e7e`
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
- expo-device
- Part 2: Common POS System Problems & Comprehensive Solutions
- expo-glass-effect
- expo-haptics
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
- react-native-web
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
- expo-image-picker
- react-dom

## God Nodes (most connected - your core abstractions)
1. `TindahanStoreService` - 41 edges
2. `Product` - 30 edges
3. `Barcode` - 19 edges
4. `useTindahanStore()` - 19 edges
5. `Money` - 16 edges
6. `InMemoryProductRepository` - 14 edges
7. `expo` - 13 edges
8. `expo-router` - 12 edges
9. `IProductRepository` - 12 edges
10. `CheckoutNewSaleScreen()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `CheckoutNewSaleScreen()` --calls--> `useIdempotentSubmit()`  [EXTRACTED]
  src/app/checkout.tsx → src/presentation/hooks/useIdempotentSubmit.ts
- `CheckoutNewSaleScreen()` --calls--> `useTindahanStore()`  [EXTRACTED]
  src/app/checkout.tsx → src/presentation/hooks/useTindahanStore.ts
- `SeasonalForecastScreen()` --calls--> `useTindahanStore()`  [EXTRACTED]
  src/app/explore.tsx → src/presentation/hooks/useTindahanStore.ts
- `PosScanProductScreen()` --calls--> `useTindahanStore()`  [EXTRACTED]
  src/app/index.tsx → src/presentation/hooks/useTindahanStore.ts
- `MenuProfileScreen()` --calls--> `useTindahanStore()`  [EXTRACTED]
  src/app/more.tsx → src/presentation/hooks/useTindahanStore.ts

## Import Cycles
- None detected.

## Communities (54 total, 34 thin omitted)

### Community 0 - "Product"
Cohesion: 0.06
Nodes (16): ProductOnboardingService, Product, ProductDTO, ProductVisual, SellingUnitTier, StockStatus, IProductRepository, Barcode (+8 more)

### Community 1 - "useTindahanStore"
Cohesion: 0.08
Nodes (34): expo-router, SeasonalForecastScreen(), styles, PosScanProductScreen(), styles, InventoryManagementScreen(), PRODUCT_CATEGORIES, STOCK_FILTERS (+26 more)

### Community 2 - "TindahanStoreService"
Cohesion: 0.11
Nodes (4): CheckoutNewSaleScreen(), SalesHistoryScreen(), TindahanStoreService, MonthlySalesRecord

### Community 3 - "app-tabs.web.tsx"
Cohesion: 0.12
Nodes (20): styles, ExternalLink(), Props, HintRowProps, styles, styles, ThemedText(), ThemedTextProps (+12 more)

### Community 4 - "expo"
Cohesion: 0.06
Nodes (26): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, reactCompiler, typedRoutes (+18 more)

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
Cohesion: 0.09
Nodes (16): styles, PERIODS, styles, AddProductCommand, AddProductResult, CartItemDTO, Listener, PaymentTenderType (+8 more)

### Community 9 - "reset-project.js"
Cohesion: 0.22
Nodes (7): exampleDirPath, fs, oldDirs, path, readline, rl, root

### Community 10 - "dependencies"
Cohesion: 0.22
Nodes (9): expo, expo-file-system, @expo/ui, expo-web-browser, dependencies, expo, expo-file-system, @expo/ui (+1 more)

### Community 11 - "animated-icon.tsx"
Cohesion: 0.29
Nodes (4): glowKeyframe, keyframe, logoKeyframe, styles

### Community 12 - "animated-icon.web.tsx"
Cohesion: 0.29
Nodes (4): glowKeyframe, keyframe, logoKeyframe, styles

### Community 13 - "4. Common Problems in Seasonal Product Forecasting & Their Solutions"
Cohesion: 0.08
Nodes (23): 1. How Seasonal Product Forecasting Works, 2. Mathematical Model & Forecasting Formulas, 3. Worked Concrete Example: School Supplies Before School Year vs. Ordinary Months, 4. Common Problems in Seasonal Product Forecasting & Their Solutions, Executive Summary, Part 1: Audit of the Current Juan's Store POS UI Prototype, Part 3: Feature C — Seasonal Product Forecast (Deep-Dive Specification), Part 4: UI/UX Integration Map for Juan's Store Prototype (+15 more)

### Community 18 - "Part 2: Common POS System Problems & Comprehensive Solutions"
Cohesion: 0.10
Nodes (20): Complete Solution Architecture (Single-User Owner Model), Part 2: Common POS System Problems & Comprehensive Solutions, Problem 1: Product Returns, Refunds, Exchanges, and Transaction Voids (Owner-Operated Workflow), Problem 2: Inventory Distortion, Shrinkage & Unrecorded Stock Movements, Problem 3: Multi-Unit Selling (*Tingi* vs. Pack vs. Case) & Price Inconsistency, Problem 4: Payment Tender Input Errors, Underpayment, Neighborhood Credit (*Utang*) & Split Payments, Problem 5: Product Registration & Checkout Barcode Handling (Must Support Manual Input or Camera Scan), Problem 6: Offline Connectivity Outages & Multi-Device Sync Conflicts (+12 more)

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
Cohesion: 0.33
Nodes (5): Building with EAS, Commands, Expo has changed — do not trust your training data, Navigation & Routing, Rules

## Knowledge Gaps
- **197 isolated node(s):** `name`, `slug`, `version`, `orientation`, `icon` (+192 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 250 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `expo-router` connect `useTindahanStore` to `TindahanStoreService.ts`, `app-tabs.web.tsx`, `expo`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `TindahanStoreService` connect `TindahanStoreService` to `TindahanStoreService.ts`, `useTindahanStore`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `plugins` connect `expo` to `useTindahanStore`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _197 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Product` be split into smaller, more focused modules?**
  _Cohesion score 0.05662862159789289 - nodes in this community are weakly interconnected._
- **Should `useTindahanStore` be split into smaller, more focused modules?**
  _Cohesion score 0.07535460992907801 - nodes in this community are weakly interconnected._
- **Should `TindahanStoreService` be split into smaller, more focused modules?**
  _Cohesion score 0.11100832562442182 - nodes in this community are weakly interconnected._