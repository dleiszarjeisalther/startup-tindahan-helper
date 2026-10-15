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

### FR-POS-005: Cart Parking / Hold Basket (`Park / Hold Cart`)
- **Traceability**: `SN-001`, `BG-001`
- **Priority**: `SHOULD`
- **Preconditions**: Active cart contains $\ge 1$ item; customer steps away to grab another item.
- **Trigger**: Operator taps `Park Cart` icon in Screen 3.
- **Processing Logic**:
  1. System serializes the current draft cart into SQLite table `held_carts` with a timestamp.
  2. Cart is cleared from active session snapshot, resetting total to ₱0.00.
  3. Header displays a notification badge: `1 Held Cart (₱54.00)`.
  4. Operator can serve the next customer immediately.
  5. Tapping `Resume Held Cart` restores items to the active session cart.
- **Outputs & Feedback**: Haptic confirmation; top banner indicates held basket status.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Park active cart and serve next customer
    Given a cart containing 2 items totaling ₱54.00
    When the operator taps "Park Cart"
    Then the active cart is cleared
    And a "Held Cart" indicator is displayed with total "₱54.00"
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

## Module 8: Settings, Store Preferences & Local Backup (`FR-SET-xxx`)

### FR-SET-001: Store Identity & Operational Preferences
- **Traceability**: `SN-007`, `BG-007`
- **Priority**: `MUST`
- **Preconditions**: Store Settings Screen (`Screen 7`) is active.
- **Trigger**: Operator modifies store details and taps Save.
- **Inputs & Validation Rules**:
  - `storeName`: String ($2 \le \text{length} \le 60$).
  - `ownerTitle`: String (e.g., `Juan's Store • Owner`).
  - `address`: String.
  - `language`: Selection from `['English', 'Filipino']`.
  - `notifications`: Boolean toggle.
  - `schoolOpeningMonth`: Integer ($1 \le \text{month} \le 12$, default $7$ for July).
  - `wholesaleBudgetPhp`: Decimal $> 0$.
- **Processing Logic**:
  1. Update `store_settings` table (row `id = 1`) in SQLite.
  2. Trigger UI re-render with new language strings or store header.
- **Outputs & Feedback**: Success toast: `✓ Store settings updated`.
- **Acceptance Criteria**:
  ```gherkin
  Scenario: Updating language to Filipino
    When the operator changes language to "Filipino"
    Then UI navigation labels update to Filipino (e.g., "Talaan ng Benta")
  ```

---

### FR-SET-002: Local SQLite Database Export & Import Backup
- **Traceability**: `SN-007`, `BG-007`
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
