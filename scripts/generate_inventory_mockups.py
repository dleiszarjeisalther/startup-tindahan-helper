import os
from playwright.sync_api import sync_playwright

OUTPUT_DIR = r"C:\Users\universal\.gemini\antigravity\brain\e6bfa9bb-94be-4bd4-893b-9af8e1e83202"
INV_1_PATH = os.path.join(OUTPUT_DIR, "ui_inventory_state_1_unclicked.png")
INV_2_PATH = os.path.join(OUTPUT_DIR, "ui_inventory_state_2_clicked_modal.png")

HTML_INV_1 = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=412, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  body { background-color: #F8FAFC; color: #0F172A; display: flex; justify-content: center; }
  .phone-frame { width: 412px; height: 892px; background: #FFFFFF; display: flex; flex-direction: column; overflow: hidden; position: relative; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
  
  /* Status Bar */
  .status-bar { height: 36px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; font-size: 13px; font-weight: 600; color: #1E293B; }
  
  /* Top App Bar matching user screen */
  .header { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; }
  .header-left { display: flex; align-items: center; gap: 8px; }
  .header-title { font-size: 20px; font-weight: 800; color: #0F172A; }
  .header-actions { display: flex; gap: 6px; align-items: center; }
  .btn-header-pill { background: #ECFDF5; border: 1px solid #A7F3D0; color: #0D7A52; font-size: 11px; font-weight: 700; padding: 6px 10px; border-radius: 8px; display: flex; align-items: center; gap: 4px; }
  .btn-header-add { width: 32px; height: 32px; border-radius: 16px; background: #0D7A52; color: #FFFFFF; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(13,122,82,0.3); }

  /* Summary Metrics */
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 6px 16px 8px; }
  .sum-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px 6px; text-align: center; }
  .sum-card.green { background: #F0FDF4; border-color: #DCFCE7; }
  .sum-card.amber { background: #FFFBEB; border-color: #FEF3C7; }
  .sum-label { font-size: 9.5px; font-weight: 700; color: #64748B; }
  .sum-val { font-size: 14px; font-weight: 800; color: #0F172A; margin-top: 2px; }
  .sum-val.green { color: #0D7A52; }
  .sum-val.amber { color: #D97706; }

  /* Callout Banner */
  .callout-banner { margin: 0 16px 8px; background: #ECFDF5; border: 1px dashed #10B981; border-radius: 8px; padding: 7px 12px; display: flex; align-items: center; gap: 8px; }
  .callout-icon { font-size: 16px; }
  .callout-text { font-size: 10.5px; font-weight: 600; color: #065F46; line-height: 1.3; }

  /* Search & Barcode Scan Bar matching actual app */
  .search-row { display: flex; gap: 8px; margin: 0 16px 8px; }
  .search-box { flex: 1; background: #F1F5F9; border-radius: 10px; padding: 6px 12px; display: flex; align-items: center; justify-content: space-between; border: 1px solid #E2E8F0; }
  .search-left { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748B; }
  .btn-scan-pill { background: #0D7A52; color: #FFFFFF; font-size: 10.5px; font-weight: 700; padding: 5px 10px; border-radius: 6px; display: flex; align-items: center; gap: 4px; }

  /* Category Filter Pills */
  .category-row { display: flex; gap: 6px; margin: 0 16px 8px; overflow-x: auto; }
  .cat-pill { font-size: 10.5px; font-weight: 700; padding: 4px 10px; border-radius: 16px; background: #F1F5F9; color: #475569; white-space: nowrap; }
  .cat-pill.active { background: #0D7A52; color: #FFFFFF; }

  /* Section Header */
  .section-header { display: flex; justify-content: space-between; align-items: center; margin: 0 16px 6px; }
  .section-title { font-size: 12px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.3px; }
  .section-count { font-size: 11px; font-weight: 600; color: #64748B; }

  /* Product List - CLEAN UNCLICKED CARDS (NO INLINE ACCORDION DRAWER) */
  .prod-list { flex: 1; overflow-y: auto; padding: 0 16px; display: flex; flex-direction: column; gap: 8px; }
  
  .prod-card { background: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); cursor: pointer; transition: all 0.2s; }
  .prod-card:hover { border-color: #0D7A52; transform: translateY(-1px); }

  .prod-thumb { width: 44px; height: 44px; border-radius: 10px; background: #F1F5F9; border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
  
  .prod-info { flex: 1; min-width: 0; }
  .prod-name { font-size: 13.5px; font-weight: 800; color: #0F172A; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prod-sub { font-size: 11px; color: #64748B; margin-top: 2px; }
  .prod-sub strong { color: #0D7A52; font-weight: 700; }
  .prod-barcode { font-size: 10px; color: #94A3B8; font-family: monospace; margin-top: 1px; }

  .prod-end { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .badge-stock { font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px; }
  .badge-in { background: #DCFCE7; color: #15803D; }
  .badge-low { background: #FEF3C7; color: #B45309; }
  .badge-out { background: #FEE2E2; color: #B91C1C; }
  .chevron { font-size: 18px; color: #94A3B8; font-weight: 700; line-height: 1; }

  /* Tab Bar */
  .tab-bar { height: 60px; background: #FFFFFF; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-around; align-items: center; position: relative; }
  .tab-item { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 10px; font-weight: 600; color: #94A3B8; }
  .tab-item.active { color: #0D7A52; font-weight: 800; }
  .cart-fab { position: absolute; top: -16px; width: 48px; height: 48px; border-radius: 24px; background: #0D7A52; color: #FFFFFF; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 4px 10px rgba(13,122,82,0.4); }
</style>
</head>
<body>

<div class="phone-frame">
  <!-- Status Bar -->
  <div class="status-bar">
    <span>02:45 PM</span>
    <span>📶 100% 🔋</span>
  </div>

  <!-- Header matching user's screen -->
  <div class="header">
    <div class="header-left">
      <span class="header-title">Imbentaryo</span>
    </div>
    <div class="header-actions">
      <div class="btn-header-pill">⏱ History</div>
      <div class="btn-header-pill">📁 Categories</div>
      <div class="btn-header-add">+</div>
    </div>
  </div>

  <!-- Inventory Summary Metrics -->
  <div class="summary-grid">
    <div class="sum-card green">
      <div class="sum-label">Total Paninda</div>
      <div class="sum-val green">48 Items</div>
    </div>
    <div class="sum-card">
      <div class="sum-label">Kabuuang Stock</div>
      <div class="sum-val">842 pcs</div>
    </div>
    <div class="sum-card amber">
      <div class="sum-label">Low / Out of Stock</div>
      <div class="sum-val amber">3 Items ⚠</div>
    </div>
  </div>

  <!-- Callout Informing No Inline Accordion -->
  <div class="callout-banner">
    <span class="callout-icon">✨</span>
    <span class="callout-text"><strong>Mas Malinis na Talaan:</strong> Hindi na lumolobo ang listahan. I-tap ang anumang produkto para buksan ang mga aksyon at pamamahala ng stock.</span>
  </div>

  <!-- Search & Barcode Bar matching app -->
  <div class="search-row">
    <div class="search-box">
      <div class="search-left">
        <span>🔍</span>
        <span>Search product or barcode...</span>
      </div>
      <div class="btn-scan-pill">||||| Scan</div>
    </div>
  </div>

  <!-- Category Filter Pills -->
  <div class="category-row">
    <div class="cat-pill active">Lahat (48)</div>
    <div class="cat-pill">Snacks & Biscuits</div>
    <div class="cat-pill">Canned Goods</div>
    <div class="cat-pill">Beverages</div>
  </div>

  <!-- Section Header -->
  <div class="section-header">
    <div class="section-title">Product Catalog</div>
    <div class="section-count">48 paninda nakatala</div>
  </div>

  <!-- Product List: UNCLICKED STATE (CLEAN, COMPACT, NO DROPDOWN) -->
  <div class="prod-list">
    <!-- Item 1 matching user screenshot exactly -->
    <div class="prod-card">
      <div class="prod-thumb">🍫</div>
      <div class="prod-info">
        <div class="prod-name">Choco Mucho</div>
        <div class="prod-sub">Stock: <strong>10 pcs</strong> • Price: <strong>₱10.00</strong></div>
        <div class="prod-barcode">[4800092116513] • Snacks</div>
      </div>
      <div class="prod-end">
        <div class="badge-stock badge-in">10 pcs</div>
        <div class="chevron">›</div>
      </div>
    </div>

    <!-- Item 2 -->
    <div class="prod-card">
      <div class="prod-thumb">🐟</div>
      <div class="prod-info">
        <div class="prod-name">Mega Sardines Red 155g</div>
        <div class="prod-sub">Stock: <strong>18 pcs</strong> • Price: <strong>₱25.00</strong></div>
        <div class="prod-barcode">[4800987654321] • Canned Goods</div>
      </div>
      <div class="prod-end">
        <div class="badge-stock badge-in">18 pcs</div>
        <div class="chevron">›</div>
      </div>
    </div>

    <!-- Item 3 -->
    <div class="prod-card">
      <div class="prod-thumb">🍜</div>
      <div class="prod-info">
        <div class="prod-name">Lucky Me Pancit Canton Kalamansi</div>
        <div class="prod-sub">Stock: <strong>3 pcs</strong> • Price: <strong>₱16.00</strong></div>
        <div class="prod-barcode">[4800112233445] • Noodles</div>
      </div>
      <div class="prod-end">
        <div class="badge-stock badge-low">3 pcs ⚠</div>
        <div class="chevron">›</div>
      </div>
    </div>

    <!-- Item 4 -->
    <div class="prod-card">
      <div class="prod-thumb">☕</div>
      <div class="prod-info">
        <div class="prod-name">Nescafe 3-in-1 Original Twin Pack</div>
        <div class="prod-sub">Stock: <strong>0 pcs</strong> • Price: <strong>₱14.00</strong></div>
        <div class="prod-barcode">[4800556677889] • Coffee</div>
      </div>
      <div class="prod-end">
        <div class="badge-stock badge-out">0 pcs ⊗</div>
        <div class="chevron">›</div>
      </div>
    </div>
  </div>

  <!-- Tab Bar -->
  <div class="tab-bar">
    <div class="tab-item">
      <span>📷</span>
      <span>Scan</span>
    </div>
    <div class="tab-item">
      <span>📊</span>
      <span>Sales</span>
    </div>
    <div class="cart-fab">🛒</div>
    <div class="tab-item active">
      <span>📦</span>
      <span>Inventory</span>
    </div>
    <div class="tab-item">
      <span>⚙️</span>
      <span>More</span>
    </div>
  </div>
</div>

</body>
</html>
"""

HTML_INV_2 = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=412, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  body { background-color: #0F172A; display: flex; justify-content: center; }
  .phone-frame { width: 412px; height: 892px; background: rgba(15, 23, 42, 0.7); display: flex; flex-direction: column; overflow: hidden; position: relative; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
  
  /* Dimmed background overlay */
  .dimmed-bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(2px); z-index: 1; }

  /* Bottom Sheet Modal Container */
  .modal-sheet { position: absolute; bottom: 0; left: 0; right: 0; background: #FFFFFF; border-radius: 24px 24px 0 0; z-index: 10; display: flex; flex-direction: column; max-height: 840px; box-shadow: 0 -10px 30px rgba(0,0,0,0.35); animation: slideUp 0.25s ease-out; }
  
  /* Handle Bar */
  .modal-handle-bar { width: 40px; height: 5px; background: #CBD5E1; border-radius: 3px; margin: 10px auto 4px; }

  /* Modal Header */
  .modal-header { padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; }
  .prod-header-left { display: flex; gap: 12px; align-items: center; }
  .prod-modal-thumb { width: 46px; height: 46px; border-radius: 12px; background: #ECFDF5; border: 1.5px solid #10B981; display: flex; align-items: center; justify-content: center; font-size: 24px; }
  .prod-modal-title { font-size: 16px; font-weight: 800; color: #0F172A; }
  .prod-modal-sub { font-size: 11px; font-weight: 600; color: #64748B; margin-top: 2px; }
  .close-btn { width: 32px; height: 32px; border-radius: 16px; background: #F1F5F9; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #64748B; cursor: pointer; }

  /* Modal Body */
  .modal-body { padding: 14px 18px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }

  /* Top Quick Actions (Edit / Photo) */
  .top-action-bar { display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px 12px; }
  .manage-tag { font-size: 11px; font-weight: 700; color: #475569; }
  .top-btn-group { display: flex; gap: 8px; }
  .btn-edit-pill { background: #ECFDF5; border: 1px solid #A7F3D0; color: #0D7A52; font-size: 11.5px; font-weight: 800; padding: 5px 12px; border-radius: 8px; display: flex; align-items: center; gap: 4px; cursor: pointer; }
  .btn-photo-pill { background: #E2E8F0; color: #334155; font-size: 11.5px; font-weight: 800; padding: 5px 12px; border-radius: 8px; display: flex; align-items: center; gap: 4px; cursor: pointer; }

  /* Stock & Pricing Overview Card */
  .overview-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 10px 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .ov-col { text-align: center; }
  .ov-label { font-size: 10px; font-weight: 700; color: #64748B; }
  .ov-val { font-size: 15px; font-weight: 800; color: #0F172A; margin-top: 2px; }
  .ov-val.green { color: #0D7A52; }

  /* Multi-Unit Selling Tiers Summary */
  .tiers-box { background: #F0FDF4; border: 1px solid #DCFCE7; border-radius: 10px; padding: 8px 12px; }
  .tiers-header { font-size: 11px; font-weight: 800; color: #0D7A52; margin-bottom: 3px; display: flex; justify-content: space-between; }
  .tiers-list { font-size: 10.5px; color: #166534; font-weight: 600; line-height: 1.4; }

  /* Stepper Box */
  .stepper-card { background: #FFFFFF; border: 1.5px solid #CBD5E1; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .stepper-top { display: flex; justify-content: space-between; align-items: center; }
  .stepper-title { font-size: 12px; font-weight: 800; color: #1E293B; text-transform: uppercase; }
  .stepper-controls { display: flex; align-items: center; gap: 8px; }
  .btn-step { width: 36px; height: 36px; border-radius: 8px; background: #F1F5F9; border: 1.5px solid #CBD5E1; color: #0F172A; font-size: 18px; font-weight: 800; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .input-qty { width: 64px; height: 36px; border-radius: 8px; background: #FFFFFF; border: 2px solid #0D7A52; font-size: 16px; font-weight: 800; text-align: center; color: #0D7A52; display: flex; align-items: center; justify-content: center; }
  .qty-chips { display: flex; gap: 6px; }
  .chip { background: #F1F5F9; border: 1px solid #E2E8F0; padding: 4px 9px; border-radius: 6px; font-size: 10.5px; font-weight: 700; color: #475569; cursor: pointer; }
  .chip.active { background: #DCFCE7; color: #15803D; border-color: #86EFAC; }

  /* Action Buttons Grid Matching User's Dropdown EXACTLY */
  .action-section-title { font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.3px; margin-top: 2px; }
  
  /* Row 1: Restock & Tingi */
  .btn-row-1 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .btn-restock { background: #DCFCE7; border: 1.5px solid #86EFAC; color: #166534; padding: 12px 10px; border-radius: 10px; font-size: 13px; font-weight: 800; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .btn-tingi { background: #DBEAFE; border: 1.5px solid #93C5FD; color: #1E40AF; padding: 12px 10px; border-radius: 10px; font-size: 13px; font-weight: 800; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

  /* Row 2: Gamit sa Bahay & Sira/Expired */
  .btn-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .btn-homeuse { background: #FEF3C7; border: 1.5px solid #FCD34D; color: #92400E; padding: 12px 10px; border-radius: 10px; font-size: 12px; font-weight: 800; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .btn-damage { background: #FEE2E2; border: 1.5px solid #FCA5A5; color: #991B1B; padding: 12px 10px; border-radius: 10px; font-size: 12px; font-weight: 800; text-align: center; display: flex; align-items: center; justify-content: center; gap: 4px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }

  /* Row 3: Delete Button */
  .btn-row-3 { margin-top: 2px; }
  .btn-delete { background: #1F2937; border: 1px solid #111827; color: #F9FAFB; padding: 11px; border-radius: 10px; font-size: 12px; font-weight: 800; text-align: center; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; }

  /* Microcopy Security Note */
  .security-footer { background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; padding: 8px 12px; font-size: 10px; color: #64748B; line-height: 1.35; text-align: center; }
  .security-footer strong { color: #0D7A52; }
</style>
</head>
<body>

<div class="phone-frame">
  <!-- Dimmed Background Overlay -->
  <div class="dimmed-bg"></div>

  <!-- Product Stock Management Modal (UI 2: CLICKED STATE IN INVENTORY) -->
  <div class="modal-sheet">
    <div class="modal-handle-bar"></div>

    <!-- Header -->
    <div class="modal-header">
      <div class="prod-header-left">
        <div class="prod-modal-thumb">🍫</div>
        <div>
          <div class="prod-modal-title">Choco Mucho</div>
          <div class="prod-modal-sub">Barcode: 4800092116513 • Snacks</div>
        </div>
      </div>
      <div class="close-btn">✕</div>
    </div>

    <!-- Body -->
    <div class="modal-body">
      
      <!-- Top Action Bar with Edit & Photo matching current drawer -->
      <div class="top-action-bar">
        <span class="manage-tag">Manage Paninda</span>
        <div class="top-btn-group">
          <div class="btn-edit-pill">✏️ Edit Details</div>
          <div class="btn-photo-pill">📷 Photo</div>
        </div>
      </div>

      <!-- Live Stock & Pricing Overview Card -->
      <div class="overview-card">
        <div class="ov-col">
          <div class="ov-label">Kasalukuyang Stock</div>
          <div class="ov-val green">10 pcs</div>
        </div>
        <div class="ov-col">
          <div class="ov-label">Presyo ng Benta</div>
          <div class="ov-val">₱10.00</div>
        </div>
        <div class="ov-col">
          <div class="ov-label">Tubo bawat Pc</div>
          <div class="ov-val">₱2.50 (+33%)</div>
        </div>
      </div>

      <!-- Multi-Unit Selling Tiers Summary -->
      <div class="tiers-box">
        <div class="tiers-header">
          <span>Multi-unit Selling Tiers:</span>
          <span>Aktibo</span>
        </div>
        <div class="tiers-list">
          • PIECE: ₱10.00 (1 pc)<br>
          • PACK: ₱95.00 (10 pcs) • May matitipid na ₱5.00
        </div>
      </div>

      <!-- Quantity Stepper Section -->
      <div class="stepper-card">
        <div class="stepper-top">
          <span class="stepper-title">Dami ng I-aadjust (Qty):</span>
          <div class="qty-chips">
            <span class="chip">+1</span>
            <span class="chip">+5</span>
            <span class="chip active">+10</span>
            <span class="chip">+24</span>
          </div>
        </div>
        <div class="stepper-controls">
          <div class="btn-step">−</div>
          <div class="input-qty">10</div>
          <div class="btn-step">+</div>
          <span style="font-size: 11px; font-weight: 700; color: #64748B; margin-left: 4px;">piraso (pcs)</span>
        </div>
      </div>

      <!-- Action Buttons Grid EXACTLY matching the dropdown buttons -->
      <div class="action-section-title">Mga Aksyon sa Stock:</div>

      <!-- Row 1: Green Restock + Blue Tingi -->
      <div class="btn-row-1">
        <button class="btn-restock">
          <span>+10 Restock</span>
        </button>
        <button class="btn-tingi">
          <span>📦 +100 Tingi</span>
        </button>
      </div>

      <!-- Row 2: Amber Gamit sa Bahay + Red Sira/Expired -->
      <div class="btn-row-2">
        <button class="btn-homeuse">
          <span>−10 Gamit sa Bahay</span>
        </button>
        <button class="btn-damage">
          <span>⚠ −10 Sira/Expired</span>
        </button>
      </div>

      <!-- Row 3: Delete Button -->
      <div class="btn-row-3">
        <button class="btn-delete">
          <span>🗑️ Alisin ang Paninda (May PIN)</span>
        </button>
      </div>

      <!-- Security / Audit Footer -->
      <div class="security-footer">
        🔒 <strong>Ligtas at Sigurado:</strong> Bawat galaw ng paninda ay may dahilan at agad na naisasalba sa iyong tindahan nang walang kalituhan o pagka-antala.
      </div>

    </div>
  </div>
</div>

</body>
</html>
"""

def generate():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        
        # State 1 (Unclicked Inventory List)
        page1 = browser.new_page(viewport={"width": 412, "height": 892}, device_scale_factor=2)
        page1.set_content(HTML_INV_1)
        page1.wait_for_timeout(300)
        page1.screenshot(path=INV_1_PATH)
        print("Generated Inventory State 1:", INV_1_PATH)
        page1.close()

        # State 2 (Clicked Inventory Modal)
        page2 = browser.new_page(viewport={"width": 412, "height": 892}, device_scale_factor=2)
        page2.set_content(HTML_INV_2)
        page2.wait_for_timeout(300)
        page2.screenshot(path=INV_2_PATH)
        print("Generated Inventory State 2:", INV_2_PATH)
        page2.close()

        browser.close()

if __name__ == "__main__":
    generate()
