# Functional Requirements Specification (FRS)

> **Project**: Startup Tindahan Helper (*Juan's Store POS & Inventory System*)  
> **Standard Compliance**: ISO/IEC/IEEE 29148:2018 (Requirements Engineering)  
> **Traceability**: [BUSINESS_REQUIREMENTS.md](file:///c:/Developer/startupTindahanHelper/BUSINESS_REQUIREMENTS.md) · [NON_FUNCTIONAL_REQUIREMENTS.md](file:///c:/Developer/startupTindahanHelper/NON_FUNCTIONAL_REQUIREMENTS.md)  
> **Source Artifacts**: [POS_PROBLEMS_AND_SEASONAL_FORECAST.md](file:///c:/Developer/startupTindahanHelper/POS_PROBLEMS_AND_SEASONAL_FORECAST.md) · [DATA_INPUT_OUTPUT_UX_BEST_PRACTICES.md](file:///c:/Developer/startupTindahanHelper/DATA_INPUT_OUTPUT_UX_BEST_PRACTICES.md) · [REACT_EXPO_OOP_BEST_PRACTICES.md](file:///c:/Developer/startupTindahanHelper/REACT_EXPO_OOP_BEST_PRACTICES.md)  
> **Target Environment**: Single-Device Mobile (Expo SDK 57 / React Native 0.86 / `expo-sqlite`)

---

## 1. Specification Format & Metadata Standards

Every functional requirement in this specification is documented according to the following ISO/IEC/IEEE 29148 attribute model:
- **Requirement ID**: Globally unique identifier grouped by functional module (`FR-<MODULE>-<NUMBER>`).
- **Title**: Action-oriented concise description.
- **Traceability**: Cross-reference to Stakeholder Need (`SN-xxx`), Business Goal (`BG-xxx`), and Business Rule (`BR-RUL-xxx`).
- **Priority**: MoSCoW classification (`MUST`, `SHOULD`, `COULD`).
- **Preconditions**: State prerequisites that must evaluate to `TRUE` prior to execution.
- **Trigger**: The specific user action, UI event, or hardware interrupt initiating the workflow.
- **Inputs & Validation Rules**: Exact parameters, formats, keyboard types, and validation boundaries.
- **Processing Logic & State Transitions**: Step-by-step procedural flow, including atomic SQLite persistence steps.
- **Outputs & Feedback**: UI render changes, auditory beeps, and haptic signatures (`expo-haptics`).
- **Verification / Acceptance Criteria**: Executable test scenario written in Gherkin (`Given-When-Then`) format.

---

## Module 1: POS & Barcode Checkout (`FR-POS-xxx`)

### FR-POS-001: Dual-Mode Barcode Scanning (Camera Viewfinder & Manual Keypad)
- **Traceability**: `SN-001`, `BG-001`, `BR-RUL-001`
- **Priority**: `MUST`
- **Preconditions**: POS screen (`Screen 1`) is active; local product catalog is loaded into in-memory snapshot.
- **Trigger**: (a) Barcode enters camera viewfinder frame, OR (b) Operator types barcode digits into barcode input field.
- **Inputs & Validation Rules**:
  - `barcodeString`: Alphanumeric string ($2 \le \text{length} \le 32$).
  - For standard commercial barcodes (UPC-A, EAN-8, EAN-13, Code-128), system validates Modulo-10 GS1 check digit.
  - Sanitization: Strip whitespace, newlines, and non-printable characters.
- **Processing Logic**:
  1. System checks in-memory snapshot for matching SKU (`barcode === barcodeString` OR `barcode.endsWith(barcodeString)`).
  2. If product found:
     a. Check `stockCount`:
        - If `stockCount <= 0`: Do NOT add to cart. Play warning haptic (`NotificationFeedbackType.Warning`). Display amber banner: `⚠️ [Product Name] is Out of Stock!`.
        - If `stockCount > 0`: Increment cart quantity by 1 for matched SKU. Trigger success haptic (`NotificationFeedbackType.Success`) and 1200Hz confirmation chime. Render floating toast: `✓ Scanned +1 [Product Name] (₱XX.XX)`.
  3. If product NOT found:
     a. Play error haptic (`NotificationFeedbackType.Error`).
     b. Display prompt banner: `Barcode not yet registered: [Barcode] — + Add Product`.
- **Outputs & Feedback**:
  - Viewfinder displays visual green reticle flash on successful scan.
  - Floating Cart Action Button updates badge count instantly via immutable snapshot reference.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Successfully scanning an in-stock product
    Given the product "Piattos BBQ" has barcode "6800056520709" and stock count 24
    When the camera scans barcode "6800056520709"
    Then the cart item count for "Piattos BBQ" increases by 1
    And a success haptic is fired within 250 milliseconds
    And the floating cart badge updates immediately

  Scenario: Scanning an out-of-stock product
    Given the product "Coca-Cola 500ml" has barcode "4800016644400" and stock count 0
    When the camera scans barcode "4800016644400"
    Then the cart is NOT modified
    And a warning banner "⚠️ Coca-Cola 500ml is Out of Stock!" is displayed
  ```

---

### FR-POS-002: Last-4-Digits SKU Quick Matching & Fast Search
- **Traceability**: `SN-001`, `BG-001`
- **Priority**: `MUST`
- **Preconditions**: POS screen (`Screen 1`) or Product List (`Screen 2`) is active.
- **Trigger**: Operator enters numeric digits or text into the search input.
- **Inputs & Validation Rules**:
  - `searchQuery`: String, debounced at $150\text{ ms}$.
- **Processing Logic**:
  1. If `searchQuery` contains 4 or more digits and matches the suffix of any registered barcode (`barcode.endsWith(searchQuery)`), prioritize the matched SKU at the top of the search results grid.
  2. Perform case-insensitive substring match against `product.name` and `product.category`.
  3. If filter pill `Tingi / No Barcode` is toggled active, filter results to items where `barcodeSource === 'GENERATED_TINGI'` or price $\le \text{₱20.00}$.
- **Outputs & Feedback**: Instant update of 2-column product grid with 48x48dp tap targets.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Quick lookup via last 4 digits of barcode
    Given a product "Piattos BBQ" exists with barcode "6800056520709"
    When the operator enters "0709" in the search bar
    Then "Piattos BBQ" is displayed as the first item in the search results
  ```

---

### FR-POS-003: Interactive Cart Management & Quantity Steppers
- **Traceability**: `SN-001`, `BG-001`, `BR-RUL-001`
- **Priority**: `MUST`
- **Preconditions**: Cart has at least 1 item; Checkout Screen (`Screen 3`) is active.
- **Trigger**: Operator taps `+` button, `−` button, or enters a number directly into the quantity input box.
- **Inputs & Validation Rules**:
  - Direct quantity input: `number-pad` keyboard, integer $\ge 0$, maximum 9999.
- **Processing Logic**:
  1. Tapping `+`: Increments cart quantity by 1. Check if `newQty > stockCount`. If so, warn: `Only [X] units in stock`.
  2. Tapping `−`: Decrements cart quantity by 1. If quantity reaches 0, remove item from cart.
  3. Direct input: Updating input field parses integer immediately. If parsed integer equals 0, remove item.
  4. Real-time subtotal recomputation: Calculate each line item using applicable bundle tier pricing (e.g., 2 units at promo rate ₱12.00 vs. 1 unit at ₱16.00).
- **Outputs & Feedback**:
  - Haptic feedback (`ImpactFeedbackStyle.Light`) on every step.
  - Tabular numeric alignment with `fontVariant: ['tabular-nums']`.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Applying bundle tier pricing in cart
    Given product "Piattos BBQ" has single unit price ₱16.00 and bundle of 2 promo price ₱24.00
    When the cart quantity for "Piattos BBQ" is set to 2
    Then the line item total displays exactly "₱24.00"
    And the subtotal reflects "₱24.00"
  ```

---

### FR-POS-004: Scan-to-Create Shortcut for Unregistered SKUs
- **Traceability**: `SN-001`, `BG-001`
- **Priority**: `MUST`
- **Preconditions**: An unregistered barcode is detected in the POS scanner.
- **Trigger**: Operator taps the `+ Add Product` button on the unrecognized barcode banner.
- **Inputs & Validation Rules**:
  - Pre-filled barcode string copied directly from the scan event.
- **Processing Logic**:
  1. Navigate operator directly to the `Add Product` form in `Inventory Management`.
  2. Pre-fill the barcode field and lock it against accidental modification.
  3. Attempt background metadata lookup via OpenFoodFacts API (if offline, fail silently and allow manual name entry).
  4. Focus cursor immediately on the `Product Name` text input with `autoCapitalize="words"`.
- **Outputs & Feedback**: Smooth modal presentation with pre-populated barcode.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Scan unregistered barcode and open creation modal
    Given the barcode "4800016644499" is not registered in the catalog
    When the camera scans "4800016644499"
    And the operator taps "+ Add Product"
    Then the Add Product screen opens with barcode "4800016644499" pre-filled
  ```

---

### FR-POS-005: Persistent Named Held Carts & Multi-Customer Queue ("Stock" Basket)
- **Traceability**: `SN-001`, `SN-008`, `BG-001`, `BG-008`, `BR-RUL-007`
- **Priority**: `MUST`
- **Preconditions**: Active cart contains $\ge 1$ item; customer steps away or checkout is paused.
- **Trigger**: Cashier taps `Park Cart` / `Hold Cart` icon in Checkout Screen (`Screen 3`).
- **Inputs & Validation Rules**:
  - `customerName`: String (optional, max 50 characters; automatically falls back to `Customer N` if left blank).
- **Processing Logic**:
  1. Cashier taps the Hold/Park Cart icon in Screen 3.
  2. Modal prompt dialog appears requesting a Customer Name / Identifier (e.g., "Ate Susan", "Tricycle Driver").
  3. Upon confirmation, the system serializes active draft cart items and inserts a persistent row into SQLite table `held_carts` storing:
     - `id`: Unique identifier (`held_timestamp`).
     - `customer_name`: Assigned name or default fallback.
     - `total_php`: Decimal cart subtotal.
     - `total_count`: Total item units in cart.
     - `items_json`: JSON-serialized snapshot of cart line items.
     - `created_at_ms`: Epoch millisecond timestamp.
     - `time_label`: Formatted human-readable timestamp (e.g., `2:45 PM`).
  4. Active cart is cleared immediately, resetting checkout subtotal to ₱0.00 and updating the store snapshot.
  5. Top checkout header updates to display a persistent queue pill: `📦 Held Carts (N)` with active badge count.
  6. Tapping the queue pill opens the `Held Carts Queue` modal displaying all parked baskets sorted newest first.
  7. For each held cart, the cashier can:
     - Tap `Restore`: Restores items into the active cart session (if current cart is not empty, prompts cashier before replacing) and removes the record from SQLite atomically.
     - Tap `Delete`: Displays confirmation alert and permanently deletes the held basket from SQLite.
  8. Cold-Boot Hydration: On application launch or after process termination, all held carts are hydrated from `held_carts` in SQLite, ensuring zero cart loss across restarts or crashes.
- **Outputs & Feedback**: Haptic confirmation (`ImpactFeedbackStyle.Medium`), queue badge counter update, success toast: `✓ Cart parked for [Customer Name]`.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Park active cart with customer name
    Given a cart containing 3 items totaling ₱78.00
    When the cashier taps "Park Cart" and enters name "Ate Susan"
    Then the active cart is cleared
    And a held cart badge displays "📦 Held Carts (1)"
    And the SQLite table "held_carts" stores "Ate Susan" with total ₱78.00

  Scenario: Restore held cart from queue
    Given 1 held cart for "Ate Susan" exists in SQLite
    When the cashier taps "📦 Held Carts" and selects "Restore" for "Ate Susan"
    Then the active cart is restored with 3 items totaling ₱78.00
    And the held cart is removed from the queue and deleted from "held_carts"
  ```

---

## Module 2: Tender & Checkout Settlement (`FR-TND-xxx`)

### FR-TND-001: Multi-Tender Selection (Cash, GCash/Maya, Utang, Split Settlement)
- **Traceability**: `SN-002`, `SN-005`, `BG-002`, `BR-RUL-003`, `BR-RUL-004`
- **Priority**: `MUST`
- **Preconditions**: Cart has at least 1 item; `Total Due > 0`.
- **Trigger**: Operator taps a payment tender pill (`Cash`, `GCash`, `Utang / Credit`, `Split`).
- **Processing Logic**:
  1. `Cash`: Activates `Amount Received` numeric input with denomination quick-chips (`Exact`, `₱50`, `₱100`, `₱200`, `₱500`, `₱1000`).
  2. `GCash`: Activates `GCash Reference # (Last 4 Digits)` text input (`keyboardType="number-pad"`).
  3. `Utang`: Displays Customer Selection picker. Shows customer credit limit and current outstanding balance.
  4. `Split Settlement`: Displays dual inputs: `Cash Paid (₱)` and `Charge to Utang (₱)`. The sum of both must equal or exceed `Total Due`.
- **Outputs & Feedback**: Dynamic reconfiguration of the settlement card.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Selecting Utang tender validates credit limit
    Given customer "Mang Bert" has balance ₱450.00 and credit limit ₱500.00
    And the current cart total is ₱80.00
    When the operator selects "Utang" and chooses "Mang Bert"
    Then the system displays a warning "Exceeds credit limit by ₱30.00"
    And requires an explicit owner override confirmation
  ```

---

### FR-TND-002: Manual Tendered Amount & Change Calculation Guard
- **Traceability**: `SN-002`, `BG-002`, `BR-RUL-004`
- **Priority**: `MUST`
- **Preconditions**: Tender type is `Cash` or `GCash`.
- **Trigger**: Operator types into the `Amount Received` field or taps a quick denomination chip.
- **Inputs & Validation Rules**:
  - `amountReceived`: Numeric decimal string, parsed to integer centavos.
  - Must not be negative.
- **Processing Logic**:
  1. Compute difference: $\Delta = \text{amountReceivedCentavos} - \text{totalDueCentavos}$.
  2. If $\Delta \ge 0$:
     a. Compute `Change Due = Δ`.
     b. Display Change Due in prominent bold emerald text (`#065F46`).
     c. Enable `Complete Sale` CTA button.
  3. If $\Delta < 0$:
     a. Compute `Shortfall = -Δ`.
     b. Display warning banner: `⚠️ Short by ₱XX.XX`.
     c. Disable `Complete Sale` button, OR display 1-tap option: `Charge Deficit of ₱XX.XX to Utang`.
- **Outputs & Feedback**: Real-time tabular change calculation without screen jitter.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Odd cash tendered calculation
    Given the cart total due is ₱54.00
    When the operator enters amount received "64.00"
    Then the change due displays exactly "₱10.00"
    And the "Complete Sale" button is enabled

  Scenario: Underpayment blocks checkout
    Given the cart total due is ₱54.00
    When the operator enters amount received "50.00"
    Then the system displays "⚠️ Short by ₱4.00"
    And the "Complete Sale" button remains disabled
  ```

---

### FR-TND-003: Manual Centavo-Accurate Item & Cart Discount Entry
- **Traceability**: `BG-002`, `BR-RUL-001`
- **Priority**: `MUST`
- **Preconditions**: Cart has at least 1 item.
- **Trigger**: Operator enters value in the `Discount (₱)` numeric input field.
- **Inputs & Validation Rules**:
  - `discountInput`: Numeric decimal string ($\ge 0$, $\le \text{Subtotal}$).
- **Processing Logic**:
  1. Convert `discountInput` to integer centavos.
  2. Compute: $\text{Total Due} = \max(0, \text{Subtotal} - \text{Discount})$.
  3. Dynamically re-evaluate `Change Due` based on current `Amount Received`.
- **Outputs & Feedback**: Tabular price breakdown updates immediately.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Applying custom discount
    Given a cart subtotal of ₱54.00
    When the operator enters discount "4.00"
    Then the new total due displays "₱50.00"
  ```

---

### FR-TND-004: Synchronous Idempotent Submit Lock & Transaction Persistence
- **Traceability**: `SN-001`, `BG-001`, `BG-007`, `BR-RUL-005`
- **Priority**: `MUST`
- **Preconditions**: Valid cart state; valid payment validation.
- **Trigger**: Operator presses `Complete Sale` CTA button.
- **Processing Logic**:
  1. Check synchronous execution ref lock:
     ```ts
     if (isSubmittingRef.current) return;
     isSubmittingRef.current = true;
     ```
  2. Generate UUID v4 `transactionId`.
  3. Open atomic SQLite transaction via `db.withTransactionSync`:
     a. Insert record into `sales_transactions` table with line items JSON, total centavos, tender type, timestamp, and status `'COMPLETED'`.
     b. Deduct stock counts from `products` table for each line item SKU:
        $$\text{new\_stock} = \text{base\_stock\_count} - \text{purchased\_qty}$$
     c. If tender type is `Utang` or Split, update customer balance in `utang_customers` table:
        $$\text{new\_balance} = \text{balance\_php} + \text{charged\_amount}$$
     d. Delete records from `cart_items` table.
     e. Insert or update `monthly_sales_history` record for current month and year.
  4. Release lock, trigger cash register chime and success haptic, publish new in-memory immutable snapshot, and display Sale Completed modal with Change Due.
- **Outputs & Feedback**: High-contrast modal showing Change Due, item count, and 1-tap `New Sale` CTA.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Rapid double-tap on Complete Sale button
    Given an active cart with 1 item "Nescafe 3in1"
    When the operator rapidly double-taps "Complete Sale" within 100 milliseconds
    Then exactly ONE sales transaction is written to SQLite
    And inventory is decremented by exactly 1 unit
  ```

---

### FR-TND-005: Instant E-Receipt Image Generation & Native Sharing
- **Traceability**: `SN-005`, `BG-005`
- **Priority**: `MUST`
- **Preconditions**: Transaction completed successfully.
- **Trigger**: Operator taps `Share Digital Receipt` icon on the completion modal or Sales History details.
- **Processing Logic**:
  1. Offscreen receipt view is rendered with store name, address, date/time, itemized line items, subtotal, discount, total, tender details, and customer debt balance.
  2. Capture view to PNG file via `react-native-view-shot` with 2x pixel density.
  3. Invoke native Android/iOS share sheet via `expo-sharing`.
- **Outputs & Feedback**: System share sheet opens allowing direct sending to Messenger, Viber, WhatsApp, or SMS.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Sharing e-receipt image
    Given a completed sale transaction
    When the operator taps "Share Digital Receipt"
    Then an image file is rendered and the system share dialog is invoked
  ```

---

### FR-TND-006: 58mm/80mm ESC/POS Bluetooth Thermal Receipt Slip Printing
- **Traceability**: `SN-013`, `BG-011`, `BR-RUL-012`
- **Priority**: `SHOULD`
- **Preconditions**: A sale is completed or a transaction is selected in Sales History; a standard Bluetooth thermal printer is paired with the mobile device.
- **Trigger**: Operator taps the `Print Thermal Slip` button on the checkout completion modal or transaction detail card.
- **Inputs & Validation Rules**:
  - `paperWidth`: Selection (`58mm` [32 columns] or `80mm` [48 columns], defaults to `58mm`).
  - Bluetooth device connection status: Active connection required; if disconnected, displays Bluetooth pairing helper modal.
- **Processing Logic**:
  1. Retrieve transaction details (store header, receipt number, date/time, line items, subtotal, discount, fees, total, tender method, amount received, change due, suki utang balance).
  2. Encode data into standard ESC/POS command bytes:
     - Initialize printer (`ESC @`).
     - Center align store name (`ESC a 1`), bold text (`ESC E 1`).
     - Left align line items (`ESC a 0`), standard monospace formatting with price right-aligned.
     - Divider line (`--------------------------------`).
     - Summary totals and tender details.
     - Customer acknowledgment text and footer ("Salamat sa Pagbili! Balik po kayo!").
     - Feed and cut commands (`ESC d 3`, `GS V 66 0`).
  3. Send raw byte stream over Bluetooth SPP/BLE socket.
  4. Privacy Guard: Ensure wholesale cost, COGS, and gross profit (*tubo*) are strictly excluded from the printed slip.
- **Outputs & Feedback**: Haptic confirmation, printing status spinner, success toast: `✓ Receipt printed successfully`.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Printing 58mm thermal receipt slip
    Given a completed sale transaction totaling ₱145.00
    When the operator taps "Print Thermal Slip"
    Then the system formats the ESC/POS payload for 32 columns
    And transmits the data to the paired Bluetooth printer within 3 seconds
    And the printed slip contains no wholesale cost or profit margin data
  ```

---

### FR-TND-007: Static QR Ph / GCash Digital Payment Verification & Convenience Surcharge
- **Traceability**: `SN-014`, `BG-012`, `BR-RUL-013`
- **Priority**: `MUST`
- **Preconditions**: Checkout screen is active (`Screen 3`); cart has $\ge 1$ item.
- **Trigger**: Operator selects `GCash` or `Maya / QR Ph` tender pill.
- **Inputs & Validation Rules**:
  - `referenceNumber`: String ($\ge 4$ alphanumeric characters, mandatory).
  - `applyConvenienceFee`: Boolean toggle (configurable default in settings, e.g. +₱2.00 or +₱5.00).
- **Processing Logic**:
  1. Operator taps GCash tender pill.
  2. An on-screen prompt sheet displays the store's configured QR Ph standee image so the customer can scan directly from the phone screen if the physical counter standee is unreadable.
  3. If `applyConvenienceFee` is active, automatically append a `Cashless Convenience Surcharge` line item (+₱2.00 or +₱5.00) to the transaction total.
  4. Cashier inspects customer's SMS/app confirmation and enters the last 4-to-6 digits of the reference number into the mandatory input field.
  5. Upon tapping `Verify & Complete`, write transaction to `sales_transactions` with `payment_method = 'GCASH'` and `payment_reference = [ref]`.
  6. Financial separation: Record inflow under digital receivables; physical cash drawer float remains unaffected.
- **Outputs & Feedback**: Reference number recorded in transaction record; green cashless verified checkmark.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Complete GCash sale with convenience surcharge
    Given a cart with total ₱98.00 and convenience fee set to ₱2.00
    When the operator selects "GCash", toggles convenience fee, and enters reference "8942"
    Then the new total due updates to "₱100.00"
    And the transaction completes with reference "8942" logged in SQLite
    And the physical cash drawer float is not incremented
  ```

---

## Module 3: Catalog & Inventory Management (`FR-INV-xxx`)

### FR-INV-001: Product Onboarding with Barcode Verification & Auto-Generation
- **Traceability**: `SN-001`, `BG-001`, `BR-RUL-001`
- **Priority**: `MUST`
- **Preconditions**: Inventory Management Screen (`Screen 4`) is active.
- **Trigger**: Operator taps `+` Add Product button.
- **Inputs & Validation Rules**:
  - `barcode`: EAN/UPC or alphanumeric code. Must be unique in `products` table.
  - `name`: String ($2 \le \text{length} \le 80$), non-empty.
  - `category`: Selected from pills (`Beverages`, `Snacks`, `Groceries`, `School Supplies`, `Personal Care`, `Household`).
  - `unitCostPhp`: Decimal $\ge 0$.
  - `sellingPricePhp`: Decimal $> 0$.
  - `initialStock`: Integer $\ge 0$.
- **Processing Logic**:
  1. If operator taps `Scan Barcode`, open camera viewfinder modal; read barcode; auto-fill field.
  2. If operator taps `Generate Store Code` (for unbarcoded *tingi* items), generate unique shortcode with prefix `TINGI-XXXX`.
  3. Validate uniqueness: If barcode already exists in SQLite, block save and display: `⚠️ Product already registered. Restock instead?`.
  4. Write product to SQLite and publish updated store snapshot.
- **Outputs & Feedback**: Success toast: `✓ Added [Product Name] to catalog`.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Registering unbarcoded item with generated shortcode
    Given the operator is adding a repacked item "Brown Sugar 1/4kg"
    When the operator taps "Generate Store Code"
    Then a unique code starting with "TINGI-" is populated
    And the item can be saved to inventory successfully
  ```

---

### FR-INV-002: Multi-Tier Selling Units & Fractional *Tingi* Conversion
- **Traceability**: `SN-001`, `BR-RUL-001`
- **Priority**: `MUST`
- **Preconditions**: Product exists in catalog with base unit `piece`.
- **Trigger**: Operator configures selling tiers in Product Edit sheet.
- **Inputs & Validation Rules**:
  - Tier definitions: `tierName`, `quantityMultiplier` (integer $\ge 1$), `pricePhp` (decimal $> 0$).
- **Processing Logic**:
  1. Base stock count represents fundamental units (e.g., 24 pieces).
  2. When sold as `1 Pack (6 pcs)`: Deduct $1 \times 6 = 6$ units from `base_stock_count`.
  3. When received from supplier as `1 Case (24 pcs)`: Add $1 \times 24 = 24$ units to `base_stock_count`.
- **Outputs & Feedback**: Inventory screen displays stock count in both pieces and complete packs.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Deducting inventory for multi-unit pack sale
    Given product "Lucky Me! Pancit Canton" has base stock 24 pieces
    When a customer buys "1 Pack (6 pcs)"
    Then the remaining base stock in SQLite becomes 18 pieces
  ```

---

### FR-INV-003: Reason-Coded Stock Adjustments (Delivery, Household, Spoilage, Audit)
- **Traceability**: `SN-003`, `BG-003`, `BR-RUL-002`
- **Priority**: `MUST`
- **Preconditions**: Product exists in inventory.
- **Trigger**: Operator taps product row in Screen 4 and selects `Adjust Stock`.
- **Inputs & Validation Rules**:
  - `adjustmentType`: One of `['RESTOCK', 'HOUSEHOLD_CONSUMPTION', 'SPOILED_DAMAGED', 'AUDIT_CORRECTION']`.
  - `quantity`: Integer $> 0$.
  - `unitCost`: Required if `adjustmentType === 'RESTOCK'`.
- **Processing Logic**:
  1. `RESTOCK`: Increment `base_stock_count` by quantity; log delivery timestamp.
  2. `HOUSEHOLD_CONSUMPTION` (*Sariling Gamit*): Decrement `base_stock_count` by quantity; log entry in `shrinkage_logs` at `unit_cost_php` to track household expense.
  3. `SPOILED_DAMAGED`: Decrement `base_stock_count`; increment `quarantine_stock_count`; log reason in `shrinkage_logs`.
  4. `AUDIT_CORRECTION`: Update `base_stock_count` directly to match physical shelf count; log variance.
- **Outputs & Feedback**: Instant snapshot publication; status badge recomputed.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Logging household consumption
    Given product "Nescafe 3in1" has stock 12 and cost ₱10.00
    When the owner logs 2 units for "Household Consumption"
    Then the stock count becomes 10
    And a shrinkage log is recorded for 2 units at cost ₱20.00
  ```

---

### FR-INV-004: Triple-Encoded Stock Status Badges & Dynamic Reorder Alerts
- **Traceability**: `BG-006`, `BR-RUL-001`
- **Priority**: `MUST`
- **Preconditions**: Inventory catalog contains active products.
- **Processing Logic**:
  1. For each product, evaluate status:
     - `stockCount == 0`: Status is `OUT_OF_STOCK`.
     - `stockCount <= ordinary_low_stock_threshold`: Status is `LOW_STOCK`.
     - `stockCount > ordinary_low_stock_threshold`: Status is `IN_STOCK`.
  2. If product has an upcoming seasonal spike flagged by Feature C:
     - Multiply threshold by seasonal factor:
       $$\text{dynamic\_threshold} = \text{ordinary\_threshold} \times \text{peakMultiplier}$$
     - If current stock is below dynamic threshold, display `🔥 Peak Approaching: Reorder Soon`.
- **Outputs & Feedback**:
  - `IN_STOCK`: Emerald pill `#D1FAE5` with icon `●` and text `In Stock (X)`.
  - `LOW_STOCK`: Amber pill `#FEF3C7` with icon `▲` and text `Low Stock (X)`.
  - `OUT_OF_STOCK`: Red pill `#FEE2E2` with icon `✕` and text `Out of Stock (0)`.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Triple-encoded stock badge display
    Given a product has stock count 3 and threshold 5
    When rendered in the inventory list
    Then the badge displays amber fill, a warning triangle icon, and text "Low Stock (3)"
  ```

---

### FR-INV-005: Expiration Date Tracking, Shelf-Life Monitoring & FEFO Clearance Alerts
- **Traceability**: `SN-012`, `BG-010`, `BR-RUL-011`
- **Priority**: `MUST`
- **Preconditions**: Product catalog loaded in memory.
- **Trigger**: Operator creates/edits a product, navigates inventory list, or scans a product at checkout.
- **Inputs & Validation Rules**:
  - `expiryDate`: Optional date string in ISO format (`YYYY-MM-DD`).
- **Processing Logic**:
  1. In `Add/Edit Product` form, provide an optional Expiration Date picker.
  2. Calculate remaining shelf life: $\Delta\text{days} = \text{expiryDate} - \text{todayDate}$.
  3. Assign dynamic visual status badge:
     - `SAFE`: $\Delta\text{days} > 30$ (Green badge: `Exp: MM/DD/YYYY`).
     - `NEAR EXPIRY`: $1 \le \Delta\text{days} \le 30$ (Amber badge: `⚠️ Expiring in X days`).
     - `EXPIRED`: $\Delta\text{days} \le 0$ (Red badge: `⛔ EXPIRED`).
  4. In Inventory screen, provide a quick filter tab: `Expiring Soon` (lists all items with $\le 30$ days remaining, sorted by earliest expiration date first - FEFO).
  5. POS Checkout Guard: If an expired item ($\Delta\text{days} \le 0$) is scanned at the counter, display an immediate blocking warning modal: `⛔ Item Expired: [Product Name] expired [X] days ago. Do not sell.` Operator must explicitly override with Owner PIN or reject the scan.
- **Outputs & Feedback**: Color-coded badges, FEFO sorted clearance list, audio-haptic double buzz on scanning expired SKU.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Alerting near-expiry product in inventory
    Given a bread product "Gardenia Loaf" has expiration date 5 days from today
    When viewed in the inventory list
    Then the badge displays amber fill with text "⚠️ Expiring in 5 days"
    And the item appears in the "Expiring Soon" filter tab

  Scenario: Scanning expired item at checkout
    Given a milk product "Bear Brand Sachet" has expiration date 2 days ago
    When the barcode is scanned in POS Screen
    Then a blocking alert modal warns "⛔ Item Expired"
    And the item is not added to the cart without owner confirmation
  ```

---

## Module 4: Exception Handling — Voids, Returns & Exchanges (`FR-EXC-xxx`)

### FR-EXC-001: Same-Day Sales Void with Automatic Stock Reversal
- **Traceability**: `SN-004`, `BG-004`, `BR-RUL-002`, `BR-RUL-006`
- **Priority**: `MUST`
- **Preconditions**: Transaction exists in `sales_transactions` with status `'COMPLETED'`.
- **Trigger**: Operator selects transaction in Sales History (`Screen 5`) and taps `Void Transaction`.
- **Inputs & Validation Rules**:
  - `voidReason`: Mandatory selection (`['Cashier Entry Error', 'Customer Left Without Paying', 'System Duplicate']`).
- **Processing Logic**:
  1. Open atomic SQLite transaction:
     a. Update transaction status to `'VOIDED'`.
     b. Record `void_or_return_note` with timestamp and reason.
     c. For each line item in transaction, increment `base_stock_count` in `products` by the purchased quantity:
        $$\text{restored\_stock} = \text{base\_stock\_count} + \text{item.quantity}$$
     d. If transaction was charged to `Utang`, deduct the amount from customer balance in `utang_customers`.
     e. Update `monthly_sales_history`: Increment `voided_units` to ensure this sale is excluded from seasonal forecast calculations.
  2. Commit transaction and publish updated snapshot.
- **Outputs & Feedback**: Transaction badge changes to gray `VOIDED`; inventory count updates immediately.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Voiding a same-day sale restores inventory
    Given a completed transaction for 2 units of "Piattos BBQ"
    And current stock of "Piattos BBQ" is 22
    When the operator voids the transaction with reason "Cashier Entry Error"
    Then the transaction status is updated to "VOIDED"
    And the stock of "Piattos BBQ" is restored to 24
  ```

---

### FR-EXC-002: Receipt-Linked Return Wizard with Quantity Capping
- **Traceability**: `SN-004`, `BG-004`, `BR-RUL-002`
- **Priority**: `MUST`
- **Preconditions**: Original transaction is loaded from `sales_transactions`.
- **Trigger**: Operator taps `Return Items` from transaction details.
- **Processing Logic**:
  1. Display itemized checklist of purchased goods with purchased quantities and price paid.
  2. Enforce return quantity boundary:
     $$0 < \text{returnQty} \le \text{originalQty} - \text{previouslyReturnedQty}$$
  3. Calculate return credit based on actual price paid on receipt (accounting for bundle promo discounts).
- **Outputs & Feedback**: Visual return summary showing items eligible for return.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Return quantity cannot exceed original purchase
    Given a receipt where 2 units of "C2 Iced Tea" were purchased
    When the operator enters return quantity 3
    Then the system rejects the input and caps return quantity at 2
  ```

---

### FR-EXC-003: Mandatory Condition Disposition Gating (Sellable vs. Bad Order Quarantine)
- **Traceability**: `SN-004`, `BG-004`, `BR-RUL-002`
- **Priority**: `MUST`
- **Preconditions**: Line item selected for return in Return Wizard.
- **Trigger**: Operator selects item condition disposition.
- **Inputs & Validation Rules**:
  - `disposition`: Either `'SELLABLE'` OR `'DAMAGED_EXPIRED_BO'`.
- **Processing Logic**:
  1. If `disposition === 'SELLABLE'`:
     - System increments `base_stock_count` in `products`:
       $$\text{base\_stock\_count} = \text{base\_stock\_count} + \text{returnQty}$$
  2. If `disposition === 'DAMAGED_EXPIRED_BO'`:
     - System does NOT increment `base_stock_count`.
     - System increments `quarantine_stock_count`:
       $$\text{quarantine\_stock\_count} = \text{quarantine\_stock\_count} + \text{returnQty}$$
     - Log write-off entry in `shrinkage_logs` for supplier return claim.
  3. Refund amount is recorded as negative revenue against today's Net Sales.
- **Outputs & Feedback**: Clear alert confirming whether item was returned to shelf or sent to quarantine.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Returning spoiled item routes to quarantine without phantom stock
    Given product "C2 Iced Tea" has sellable stock 16 and quarantine stock 0
    When a customer returns 1 unit with disposition "DAMAGED_EXPIRED_BO"
    Then sellable stock remains 16
    And quarantine stock increases to 1
  ```

---

### FR-EXC-004: Atomic In-Flow Product Exchange Settlement
- **Traceability**: `SN-004`, `BG-004`, `BR-RUL-002`
- **Priority**: `MUST`
- **Preconditions**: Return credit calculated from FR-EXC-002.
- **Trigger**: Operator selects `Instant Exchange` resolution method.
- **Processing Logic**:
  1. Open New Sale screen (`Screen 3`) with pre-applied `Return Credit (₱)`.
  2. Operator scans replacement item(s).
  3. Compute net price difference:
     $$\Delta = \text{New Cart Total} - \text{Return Credit}$$
  4. If $\Delta > 0$: Operator collects balance $\Delta$ from customer via Cash/GCash/Utang.
  5. If $\Delta < 0$: Operator refunds difference $-\Delta$ to customer.
  6. If $\Delta == 0$: Even exchange; complete sale with ₱0.00 cash tender.
  7. Commit returned item disposition and replacement item stock deduction in one atomic SQLite transaction.
- **Outputs & Feedback**: Exchange receipt showing return credit and net cash collected.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Product exchange with price difference
    Given a return credit of ₱14.00 for returned Pancit Canton
    When the customer exchanges it for a ₱16.00 C2 Iced Tea
    Then the net total due displays "₱2.00"
    And completing the sale adjusts stock for both items atomically
  ```

---

## Module 5: Neighborhood Credit (*Utang*) Ledger (`FR-UTG-xxx`)

### FR-UTG-001: Customer Credit Profile & Limit Enforcement
- **Traceability**: `SN-005`, `BG-005`, `BR-RUL-003`
- **Priority**: `MUST`
- **Preconditions**: Utang Management Screen (`utang.tsx`) is active.
- **Trigger**: Operator creates or edits customer profile.
- **Inputs & Validation Rules**:
  - `name`: Non-empty string.
  - `creditLimitPhp`: Decimal $> 0$, default ₱500.00.
  - `contactNumber`: Optional phone number string.
- **Processing Logic**:
  1. Save customer record to `utang_customers` table.
  2. Prevent duplicate customer creation with identical name.
- **Outputs & Feedback**: Success toast: `✓ Registered [Customer Name] in Utang Ledger`.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Register new Utang customer
    When the operator enters name "Aling Rosa" with credit limit "1000"
    Then "Aling Rosa" appears in the customer directory with balance ₱0.00
  ```

---

### FR-UTG-002: Direct Checkout Charge to Utang Tab
- **Traceability**: `SN-005`, `BG-005`, `BR-RUL-003`
- **Priority**: `MUST`
- **Preconditions**: Customer is registered; cart total is valid.
- **Trigger**: Operator selects customer and taps `Charge to Utang`.
- **Processing Logic**:
  1. Check if $\text{currentBalance} + \text{saleTotal} > \text{creditLimit}$.
  2. If limit exceeded: Require explicit owner override prompt.
  3. In atomic SQLite transaction:
     - Update customer balance:
       $$\text{balance\_php} = \text{balance\_php} + \text{saleTotal}$$
     - Record transaction with tender type `'UTANG'`.
     - Record line items and deduct inventory immediately.
- **Outputs & Feedback**: Debt summary dialog showing previous balance, new charge, and new balance.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Charging sale to Utang
    Given customer "Mang Bert" has balance ₱200.00
    When a purchase of ₱54.00 is charged to his account
    Then his balance updates to ₱254.00
    And inventory is decremented on the day of the sale
  ```

---

### FR-UTG-003: Partial & Full Debt Payment Reconciliation
- **Traceability**: `SN-005`, `BG-005`, `BR-RUL-003`
- **Priority**: `MUST`
- **Preconditions**: Customer has outstanding balance $> 0$.
- **Trigger**: Operator taps `Record Payment` on customer detail card.
- **Inputs & Validation Rules**:
  - `paymentAmount`: Decimal $> 0$, $\le \text{currentBalance}$.
  - `tenderType`: `'Cash'` or `'GCash'`.
- **Processing Logic**:
  1. Open atomic SQLite transaction:
     a. Deduct payment from customer balance:
        $$\text{balance\_php} = \text{balance\_php} - \text{paymentAmount}$$
     b. Insert record into `cash_drawer_adjustments` with type `'UTANG_PAYMENT'` to record cash drawer inflow.
     c. Record receipt of debt payment.
  2. Update in-memory snapshot.
- **Outputs & Feedback**: Confirmation modal showing updated remaining balance.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Partial debt repayment
    Given customer "Mang Bert" has balance ₱254.00
    When the operator records a cash payment of ₱100.00
    Then his remaining balance updates to ₱154.00
    And cash drawer inflow increases by ₱100.00
  ```

---

### FR-UTG-004: Customer Debt Statement Export
- **Traceability**: `SN-005`, `BG-005`
- **Priority**: `MUST`
- **Preconditions**: Customer profile selected.
- **Trigger**: Operator taps `Export Statement`.
- **Processing Logic**:
  1. Render customer statement view showing all purchases, dates, items, payments, and current balance.
  2. Capture as PNG image card and open native share sheet via `expo-sharing`.
- **Outputs & Feedback**: Native share sheet opens to send image to customer via Messenger.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Exporting customer debt statement
    When the operator taps "Export Statement" for "Mang Bert"
    Then a verified image statement is generated for sharing
  ```

---

## Module 6: Feature C — Seasonal Product Forecast (`FR-FOR-xxx`)

### FR-FOR-001: Multi-Tier Historical Demand Analysis
- **Traceability**: `SN-006`, `BG-006`, `BR-RUL-006`
- **Priority**: `MUST`
- **Preconditions**: Product sales history exists in `monthly_sales_history`.
- **Trigger**: Forecast engine executes for target month (e.g., July for School Opening).
- **Processing Logic**:
  1. Query monthly records for target SKU.
  2. Determine history depth:
     - If history $\ge 24$ months: Execute `Recurring24MonthYoYStrategy` (Tier: `VERIFIED_RECURRING_24M_PLUS`). Compute multi-year average seasonal index:
       $$S_m = \frac{1}{K} \sum_{k=1}^K \frac{D_{k,m}}{\bar{D}_k}$$
     - If history 12–23 months: Execute `Initial12MonthCycleStrategy` (Tier: `INITIAL_CYCLE_12_23M`).
     - If history $< 12$ months: Execute `ProvisionalCategoryPriorStrategy` (Tier: `PROVISIONAL_UNDER_12M`).
- **Outputs & Feedback**: Card displays forecast result with verified confidence badge.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Forecast using 24+ months verified history
    Given product "Intermediate Pad Paper" has 24 months of sales history
    When the seasonal forecast runs for target month July
    Then the strategy tier is "VERIFIED_RECURRING_24M_PLUS"
    And the seasonal multiplier reflects multi-year YoY demand
  ```

---

### FR-FOR-002: Demand Uncensoring for Stockout Days
- **Traceability**: `SN-006`, `BG-006`, `BR-RUL-006`
- **Priority**: `MUST`
- **Preconditions**: Monthly history contains `outOfStockDays > 0`.
- **Processing Logic**:
  1. For each monthly record, compute uncensored demand:
     $$\text{inStockDays} = \max(1, \text{totalDaysInMonth} - \text{outOfStockDays})$$
     $$\text{availabilityFactor} = \min\left(2.0, \frac{\text{totalDaysInMonth}}{\text{inStockDays}}\right)$$
     $$D_{\text{uncensored}} = (\text{grossUnits} - \text{voidedUnits} - \text{returnedUnits}) \times \text{availabilityFactor}$$
  2. Use $D_{\text{uncensored}}$ as the true baseline for seasonal demand calculations.
- **Outputs & Feedback**: Forecast explanation notes: `Adjusted for X out-of-stock days`.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Uncensoring demand for stockout period
    Given a month with 30 total days and 10 out-of-stock days
    And recorded net sales of 20 units
    When demand uncensoring is computed
    Then the uncensored demand is 30 units (availability factor 1.5)
  ```

---

### FR-FOR-003: Anomaly Filtering (One-Time Bulk Orders & Voids Exclusion)
- **Traceability**: `SN-006`, `BG-006`, `BR-RUL-006`
- **Priority**: `MUST`
- **Preconditions**: Sales records contain flagged bulk orders or voided sales.
- **Processing Logic**:
  1. Query `sales_transactions` where `is_one_time_bulk_order == 1` or `status == 'VOIDED'`.
  2. Subtract flagged units from the monthly gross demand before computing seasonal indices.
- **Outputs & Feedback**: Clear audit notation that non-recurring bulk orders were filtered.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Filtering one-time fiesta bulk purchase
    Given a bulk purchase of 50 pad papers for a barangay fiesta marked as one-time
    When seasonal forecasting evaluates the month
    Then the 50 units are excluded from the recurring baseline
  ```

---

### FR-FOR-004: Plain-Language Restock Recommendations & Capital Budget Capping
- **Traceability**: `SN-006`, `BG-006`
- **Priority**: `MUST`
- **Preconditions**: Target month forecast generated.
- **Processing Logic**:
  1. Compute recommended restock quantity:
     $$\text{recommendedRestock} = \max(0, \text{forecastedUnits} - \text{currentStock})$$
  2. Compute required wholesale capital:
     $$\text{estCapitalPhp} = \text{recommendedRestock} \times \text{unitCostPhp}$$
  3. Compare total recommended restock across all seasonal items against `wholesale_budget_php`:
     - If total capital exceeds budget, scale recommendations proportionally and warn: `Exceeds wholesale budget by ₱XX.XX`.
  4. Generate plain-language action card:
     > **📅 Upcoming Peak: School Opening (July)**  
     > Intermediate Pad Paper sells **7.0× more** than ordinary months (98 vs 14 pads).  
     > Current Stock: **8 pads** $\rightarrow$ Recommended Restock: **+95 pads** (Est. Capital: ₱1,900.00).
- **Outputs & Feedback**: High-contrast recommendation card in Screen 4 and Screen 6.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Generating plain-language seasonal restock recommendation
    Given an ordinary monthly average of 14 units and seasonal multiplier 7.0x
    And current stock of 8 units with unit cost ₱20.00
    When the recommendation card renders
    Then it recommends restock of "+95 pads" with estimated capital "₱1,900.00"
  ```

---

### FR-FOR-005: 1-Tap Wholesale Shopping List Image Export
- **Traceability**: `SN-006`, `BG-006`
- **Priority**: `SHOULD`
- **Preconditions**: Seasonal forecast recommendations generated.
- **Trigger**: Operator taps `Export Wholesale Shopping List`.
- **Processing Logic**:
  1. Generate consolidated checklist showing SKU name, current stock, recommended order quantity in both pieces and cases, and estimated wholesale cost.
  2. Capture view to PNG image via `react-native-view-shot`.
  3. Open native share sheet via `expo-sharing`.
- **Outputs & Feedback**: Image card saved to phone gallery or sent to Messenger for shopping reference.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Exporting seasonal shopping list
    When the operator taps "Export Wholesale Shopping List"
    Then a shareable checklist card is exported via native share dialog
  ```

---

## Module 7: Cash Drawer & Operational Adjustments (`FR-CSH-xxx`)

### FR-CSH-001: Cash Drawer Float & Paid-In / Paid-Out Logging
- **Traceability**: `SN-002`, `BG-002`
- **Priority**: `MUST`
- **Preconditions**: Cash drawer management sheet active.
- **Trigger**: Operator records morning float or petty cash withdrawal.
- **Inputs & Validation Rules**:
  - `type`: `'OPENING_FLOAT'`, `'PAID_IN'`, or `'PAID_OUT'`.
  - `amount`: Decimal $> 0$.
  - `category`: String (`'Barya Exchange'`, `'Supplier Delivery'`, `'Store Expense'`, `'Owner Draw'`).
  - `note`: Optional string.
- **Processing Logic**:
  1. Insert record into `cash_drawer_adjustments` table with timestamp and date/time labels.
  2. Update expected cash drawer total in snapshot.
- **Outputs & Feedback**: Cash drawer balance card updates immediately.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Logging morning cash float
    When the operator records opening cash float of ₱1,000.00
    Then the expected cash drawer balance is initialized to ₱1,000.00
  ```

---

### FR-CSH-002: End-of-Day Cash Drawer Reconciliation
- **Traceability**: `SN-002`, `BG-002`
- **Priority**: `MUST`
- **Preconditions**: Sales and cash drawer records exist for today.
- **Trigger**: Operator navigates to End-of-Day Balancing sheet.
- **Inputs & Validation Rules**:
  - `physicalCountPhp`: Decimal $\ge 0$, entered by counting cash in drawer.
- **Processing Logic**:
  1. Compute expected cash:
     $$\text{Expected} = \text{Opening Float} + \text{Cash Sales} + \text{Cash Utang Payments} + \text{Paid In} - \text{Paid Out} - \text{Cash Refunds}$$
  2. Compute variance:
     $$\text{Variance} = \text{physicalCountPhp} - \text{Expected}$$
  3. If $\text{Variance} == 0$: Display `✓ Cash Drawer Balanced Perfectly`.
  4. If $\text{Variance} < 0$: Display `⚠️ Cash Short by ₱XX.XX`.
  5. If $\text{Variance} > 0$: Display `⚠️ Cash Over by ₱XX.XX`.
- **Outputs & Feedback**: Summary report with option to save daily reconciliation log.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Cash drawer balances perfectly
    Given expected cash total is ₱2,842.00
    When the operator enters physical count "2842.00"
    Then the system displays "✓ Cash Drawer Balanced Perfectly"
  ```

---

## Module 8: Settings, Store Preferences, Local Backup & Security Access Control (`FR-SET-xxx`, `FR-SEC-xxx`)

### FR-SET-001: Store Identity, Bilingual Localization & Operational Preferences
- **Traceability**: `SN-007`, `SN-010`, `BG-001`, `BG-007`, `BR-RUL-009`
- **Priority**: `MUST`
- **Preconditions**: Store Settings Screen (`Screen 7`) is active.
- **Trigger**: Operator modifies store details, toggles language, and taps Save.
- **Inputs & Validation Rules**:
  - `storeName`: String ($2 \le \text{length} \le 60$).
  - `ownerTitle`: String (e.g., `Juan's Store • Owner`).
  - `address`: String.
  - `language`: Selection from `['English', 'Filipino', 'Taglish']` (stored as `'en'`, `'fil'`, `'taglish'`).
  - `notifications`: Boolean toggle.
- **Processing Logic**:
  1. Synchronously persist `language` selection to `KeyValueStorage` and SQLite `app_settings` / `store_settings`.
  2. Cold-Boot Storage Precedence: On app launch, `KeyValueStorage` language preference takes precedence over SQLite defaults, preventing accidental revert to English.
  3. Update `store_settings` table (row `id = 1`) in SQLite with store name, owner title, and address.
  4. Trigger instant UI re-render across all screens, tabs, and modals without requiring manual app restart.
- **Outputs & Feedback**: Success toast: `✓ Store settings updated`.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Updating language to Taglish with persistent storage precedence
    When the operator changes language to "Taglish" in Settings
    Then UI navigation labels update to Taglish (e.g., "Mga Benta", "Talaan")
    And "taglish" is stored synchronously in KeyValueStorage
    When the app is restarted from cold boot
    Then the active language remains "Taglish"
  ```

---

### FR-SET-002: Seasonal Calendar Configuration (School Opening & Wholesale Budget)
- **Traceability**: `SN-006`, `BG-006`, `BR-RUL-006`
- **Priority**: `MUST`
- **Preconditions**: Store Settings Screen is active.
- **Trigger**: Operator modifies seasonal parameters and taps Save.
- **Inputs & Validation Rules**:
  - `schoolOpeningMonth`: Integer ($1 \le \text{month} \le 12$, default $7$ for July).
  - `wholesaleBudgetPhp`: Decimal $> 0$ (default ₱10,000.00).
- **Processing Logic**:
  1. Update `store_settings` table in SQLite with school opening month and capital budget.
  2. Trigger recomputation of `SeasonalForecastEngine` targets for the configured peak window.
- **Outputs & Feedback**: Confirmation toast: `✓ Seasonal configuration saved`.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Setting school opening month to August
    When the operator sets school opening month to "8" (August)
    Then seasonal forecast restock cards shift peak demand window to August
  ```

---

### FR-SET-003: Local SQLite Database Export & Import Backup
- **Traceability**: `SN-007`, `BG-007`, `BR-RUL-001`
- **Priority**: `MUST`
- **Preconditions**: Store Settings Screen is active.
- **Trigger**: Operator taps `Backup Database` or `Restore Database`.
- **Processing Logic**:
  1. `Backup Database`:
     a. Ensure SQLite database file `tindahan_pos_v3.db` is flushed (`PRAGMA wal_checkpoint(FULL)`).
     b. Copy `.db` file to document storage directory with timestamped filename `juan_store_backup_YYYYMMDD.db`.
     c. Open native share sheet (`expo-sharing`) allowing user to save to Google Drive or SD card.
  2. `Restore Database`:
     a. Operator selects valid `.db` file via document picker.
     b. Verify table schema integrity.
     c. Replace active database file, re-initialize SQLite connection, and refresh in-memory store snapshot.
- **Outputs & Feedback**: Progress indicator and modal confirmation upon restoration.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Exporting database backup
    When the operator taps "Backup Database"
    Then a verified SQLite backup file is generated and native share dialog opens
  ```

---

### FR-SEC-001: Owner Master PIN & Relief Cashier Operational Access Control
- **Traceability**: `SN-011`, `BG-009`, `BR-RUL-010`
- **Priority**: `MUST`
- **Preconditions**: Owner has configured a 4-digit Master PIN in Settings. System supports dual operational modes: "Owner Mode" and "Cashier Mode".
- **Trigger**: App launch from cold boot, manual toggle to Cashier Mode, or an operator attempting any restricted action in Cashier Mode.
- **Inputs & Validation Rules**:
  - `masterPin`: 4-digit numeric string `^[0-9]{4}$` stored as a salted SHA-256 hash.
  - `enteredPin`: 4-digit input submitted via the secure numeric keypad modal.
  - `lockoutThreshold`: Maximum 5 consecutive failed attempts before triggering a 300-second (5-minute) progressive lockout timer.
- **Processing Logic**:
  1. **Default Mode & Privilege Boundary**:
     - System defaults to "Cashier Mode" (or "Tindera Mode") on launch or upon tapping `Switch to Cashier`.
     - *Permitted Cashier Operations*: Barcode camera scanning, quick manual keypad entry, cart management, hold/park cart retrieval, cash/GCash settlement, customer Utang ledger recording.
     - *Restricted Operations (Guarded by Owner PIN)*:
       - Modifying wholesale cost prices or retail selling prices (`Screen 4`, `Screen 7`).
       - Logging inventory shrinkage or stock damage deductions (`Screen 4`).
       - Viewing financial Gross Profit (*Tubo*) and markup percentages in Sales History (`Screen 5`).
       - Viewing cumulative end-of-day Z-Reading gross profit summaries (`Screen 5`).
       - SQLite database export, restore, or factory database reset (`Screen 7`).
       - Modifying seasonal calendar configuration or store profile settings (`Screen 7`).
  2. **PIN Challenge Modal & Verification**:
     - When a restricted action or guarded screen is triggered, system displays a high-contrast PIN challenge modal: `"Ilagay ang Owner PIN / Enter Owner PIN"`.
     - System hashes `enteredPin` with stored salt and compares against stored hash.
     - **Success**: Grants temporary elevated privileges (Owner Mode) for the current session or switches the active mode; resets failed attempts counter to 0.
     - **Failure**: Increments failed attempts counter. Displays warning: `"Maling PIN. [N] attempts remaining."`.
     - **Lockout**: If failed attempts $\ge 5$, disables PIN input for 300 seconds, persists lockout timestamp in storage, and displays countdown timer: `"Too many failed attempts. Try again in [MM:SS]."`.
  3. **Auto-Lock Timeout**:
     - Elevated Owner Mode automatically reverts to Cashier Mode after 15 minutes of user inactivity or immediately when the user taps the quick-lock icon in the app header.
- **Outputs & Feedback**: Role badge in top navigation bar (`Owner Mode` [Gold Pill] vs `Cashier Mode` [Blue Pill]), secure PIN numpad modal, and haptic feedback on success/failure.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Relief cashier attempting to edit product price in Cashier Mode
    Given the app is operating in "Cashier Mode"
    When the relief cashier taps "Edit Price" on product "Safeguard White 60g"
    Then the system displays the PIN challenge modal "Ilagay ang Owner PIN"
    And access to the price edit form is blocked until the valid PIN is verified

  Scenario: Unlocking Owner Mode with valid 4-digit Master PIN
    Given the PIN challenge modal is active
    When the owner enters the correct 4-digit PIN "8899"
    Then the app switches to "Owner Mode"
    And sensitive financial margins (Tubo) and inventory editing become accessible

  Scenario: Enforcing brute-force lockout after 5 incorrect PIN attempts
    Given the operator enters 5 consecutive incorrect PINs
    Then the system locks PIN entry for 300 seconds
    And displays "Too many failed attempts. Try again in 5 minutes."
  ```

---

## Module 9: Sales History, Profit Intelligence & Z-Reading (`FR-SAL-xxx`)

### FR-SAL-001: Sales History, Gross Profit (Tubo / Markup) Intelligence & Z-Reading
- **Traceability**: `SN-009`, `BG-001`, `BG-002`, `BR-RUL-008`
- **Priority**: `MUST`
- **Preconditions**: Sales history view is active (`Screen 5` / `src/app/sales.tsx`).
- **Trigger**: Operator opens Sales screen, selects date filter, taps transaction row, or toggles privacy mode.
- **Inputs & Validation Rules**:
  - `dateFilter`: Filter option (`Today`, `7 Days`, `30 Days`, `All Time`).
  - `privacyMode`: Boolean toggle (stored in UI state, defaults to visible or saved preference).
- **Processing Logic**:
  1. Calculate Cost of Goods Sold (COGS) for each transaction using snapshot catalog wholesale costs:
     $$C = \sum_{i=1}^{n} (q_i \times \text{cost}_i)$$
  2. Compute gross profit (*Tubo*):
     $$\text{Gross Profit} = \text{Subtotal} - \text{Discount} - \text{COGS}$$
  3. Compute profit margin % and markup %:
     $$\text{Margin \%} = \left(\frac{\text{Gross Profit}}{\text{Net Total}}\right) \times 100, \quad \text{Markup \%} = \left(\frac{\text{Gross Profit}}{\text{COGS}}\right) \times 100$$
  4. Render transaction row card: display receipt number, timestamp, payment method badge, customer name (if credit), net sales amount, and green tubo pill:
     `Tubo +₱XX.XX (YY% markup)`
  5. Expanded financial breakdown: Tapping a transaction expands full line-item details with item names, unit selling prices, unit wholesale costs, and line-item gross profit.
  6. Header summary metrics: Display total Gross Sales, Net Sales, Total Tubo (Gross Profit), and Average Markup Percentage across active date filter.
  7. Owner Privacy Eye Toggle: Tapping the eye icon toggles privacy masking. When active, all gross profit values and markup percentages are obfuscated with `••••••` to shield sensitive wholesale margins from counter onlookers.
  8. Z-Reading End-of-Day Report: Operator can generate and share a daily Z-Reading receipt summarizing total transactions, cash in drawer, credit extensions, returns/voids, and net profit.
- **Outputs & Feedback**: Immediate financial display with `< 16ms` privacy mask toggling and high-contrast color badges.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Viewing transaction tubo and markup percentage
    Given a completed sale containing 2 "Piattos BBQ" (Price: ₱16.00, Cost: ₱12.00)
    When the owner views the transaction in Sales History
    Then the net sales displays "₱32.00"
    And the COGS is calculated as "₱24.00"
    And the tubo pill displays "+₱8.00 (33.3% markup)"

  Scenario: Toggling owner privacy eye masking
    Given the sales summary displays total tubo "₱520.00" with markup "32.5%"
    When the owner taps the privacy eye icon
    Then the tubo amount is masked as "••••••"
    And the markup percentage is masked as "••••••"
    And net sales "₱1,600.00" remains visible
  ```

