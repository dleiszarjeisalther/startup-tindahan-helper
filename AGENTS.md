This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Offline-First Store & Realtime UI Architecture

This application operates offline-first on a single device. All user interactions (scan, add to cart, quantity change, clear cart, complete sale, adjust stock, void/return) must update visible screens, tab badges, and totals immediately without navigation or pull-to-refresh.

### 1. Single Immutable Snapshot & `useSyncExternalStore`
- Maintain a single store instance for the application session.
- Expose an immutable `StoreSnapshot` containing revision, cart summary, products, transactions, customers, and settings.
- UI hooks (`useTindahanStore`) must subscribe via `useSyncExternalStore(subscribe, getSnapshot)`:
  - Return the exact same snapshot object reference until state changes.
  - Publish a new immutable snapshot object before notifying subscribers.
  - Snapshot reads must be **100% pure**: zero database queries, zero hydration, and zero mutations during rendering.
- Remove duplicate forced-render triggers (`setTick`) and redundant listener chains.

### 2. Never Hydrate on Screen Focus
- Hydrate store state from SQLite **once at startup (cold boot)**.
- **NEVER** trigger automatic database re-hydration or cart resetting inside `useFocusEffect` or tab navigation callbacks. Screen transitions must read the live in-memory snapshot synchronously.
- Retain explicit recovery reloads through dedicated user-initiated recovery actions only.

### 3. Atomic SQLite Commits
- Stage state mutations in memory, persist them durably to SQLite, then publish the new snapshot.
- Execute multi-table mutations (sales receipt, stock deduction, monthly history, Utang balance, cart clearing) within **one atomic SQLite transaction** (`db.withTransactionSync`).
- **Never swallow SQLite write failures**: If a write fails, roll back, retain the previous committed state, and present a clear, retryable error to the user. Never show a false success toast.
- Enforce service-level completion locks to prevent double-tap or overlapping completion attempts.

### 4. Direct UI-to-Snapshot Binding
- Cart badges, floating tab counters, checkout line items, subtotals, and CTA enable/disable states must derive directly from the snapshot.
- Clearing or completing a sale must immediately publish an empty cart state, instantly hiding badges and resetting forms across all active views.

## Plain Language & Store-Owner Friendly Microcopy Invariant (Zero Tech Jargon in UI)

All user-visible text (screen titles, list items, badges, banners, modals, alert dialogs, confirmation prompts, error toasts, and helper notes) must use natural, vendor-friendly Taglish / Filipino language.

- **HARD INVARIANT**: NEVER display developer jargon, database internals, or framework architecture keywords in user-facing UI text.
  * Prohibited in UI: `SQLite`, `SQLite Sync`, `In-memory snapshot`, `commit`, `db.withTransactionSync()`, `API`, `Hook`, `Hydration`, `State mutation`, `StoreSnapshot`, `Query`, `Transaction rollback`.
- **User-Centric Language**:
  * Instead of "Live SQLite Sync" -> use "Agad Naitatala" or "Awtomatikong Naitala".
  * Instead of "Committed via db.withTransactionSync()" -> use "Ligtas at Sigurado ang Kwenta".
  * Instead of "Database write error" -> use "Hindi naisave ang tala. Pakisubukan muli."
  * Instead of "Quarantine stock" -> use "Sira / Expired na Paninda".

