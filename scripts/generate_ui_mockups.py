import os
from playwright.sync_api import sync_playwright

OUTPUT_DIR = r"C:\Users\universal\.gemini\antigravity\brain\e6bfa9bb-94be-4bd4-893b-9af8e1e83202"
IMG_1_PATH = os.path.join(OUTPUT_DIR, "ui_state_1_unclicked.png")
IMG_2_PATH = os.path.join(OUTPUT_DIR, "ui_state_2_clicked_modal.png")

HTML_STATE_1 = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=412, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  body { background-color: #F8FAFC; color: #0F172A; display: flex; justify-content: center; padding: 0; }
  .phone-frame { width: 412px; height: 892px; background: #FFFFFF; display: flex; flex-direction: column; overflow: hidden; position: relative; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
  
  /* Status Bar */
  .status-bar { height: 36px; display: flex; justify-content: space-between; align-items: center; padding: 0 20px; font-size: 13px; font-weight: 600; color: #1E293B; }
  
  /* Header */
  .header { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; }
  .header h1 { font-size: 22px; font-weight: 800; color: #0F172A; }
  .header-actions { display: flex; gap: 8px; }
  .btn-outline-green { border: 1px solid #10B981; background: #ECFDF5; color: #065F46; font-size: 11px; font-weight: 700; padding: 6px 10px; border-radius: 8px; display: flex; align-items: center; gap: 4px; }
  .btn-outline-slate { border: 1px solid #CBD5E1; background: #F8FAFC; color: #475569; font-size: 11px; font-weight: 700; padding: 6px 10px; border-radius: 8px; display: flex; align-items: center; gap: 4px; }

  /* Segmented Control */
  .period-tabs { display: flex; background: #F1F5F9; border-radius: 12px; margin: 8px 16px; padding: 3px; }
  .period-tab { flex: 1; text-align: center; padding: 7px 0; font-size: 13px; font-weight: 600; color: #64748B; border-radius: 9px; }
  .period-tab.active { background: #0D7A52; color: #FFFFFF; font-weight: 700; shadow: 0 2px 4px rgba(0,0,0,0.1); }

  /* Date Bar */
  .date-bar { display: flex; justify-content: space-between; align-items: center; margin: 4px 16px; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px 12px; }
  .date-display { font-size: 13px; font-weight: 700; color: #1E293B; display: flex; align-items: center; gap: 6px; }
  .date-growth { font-size: 11px; font-weight: 700; color: #0D7A52; background: #E6F4EA; padding: 3px 8px; border-radius: 6px; }

  /* Stats Grid */
  .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 8px 16px; }
  .stat-card { border-radius: 10px; padding: 10px 8px; border: 1px solid #E2E8F0; }
  .stat-card.sales { background: #F0FDF4; border-color: #DCFCE7; }
  .stat-card.utang { background: #F0FDFA; border-color: #CCFBF1; }
  .stat-card.drawer { background: #F8FAFC; border-color: #E2E8F0; }
  .stat-title { font-size: 10px; font-weight: 700; color: #475569; margin-bottom: 2px; }
  .stat-amount { font-size: 15px; font-weight: 800; color: #0F172A; }
  .stat-sub { font-size: 9px; color: #64748B; margin-top: 2px; }

  /* Sub Stats */
  .sub-stats { display: flex; justify-content: space-between; margin: 4px 16px; background: #F8FAFC; border-radius: 10px; padding: 8px 12px; border: 1px solid #E2E8F0; }
  .sub-stat-item { text-align: center; }
  .sub-stat-label { font-size: 9px; color: #64748B; font-weight: 600; }
  .sub-stat-val { font-size: 12px; font-weight: 800; color: #1E293B; }

  /* Section Title */
  .section-header { display: flex; justify-content: space-between; align-items: center; margin: 12px 16px 6px; }
  .section-title { font-size: 14px; font-weight: 800; color: #0F172A; }
  .section-hint { font-size: 10px; font-weight: 700; color: #0D7A52; }

  /* Search */
  .search-box { margin: 4px 16px 8px; background: #F1F5F9; border-radius: 10px; padding: 8px 12px; display: flex; align-items: center; gap: 8px; font-size: 12px; color: #94A3B8; }

  /* Filters */
  .filters-row { display: flex; gap: 6px; margin: 0 16px 10px; overflow-x: auto; }
  .filter-pill { font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 20px; background: #F1F5F9; color: #475569; white-space: nowrap; }
  .filter-pill.active { background: #0D7A52; color: #FFFFFF; }

  /* Transaction List - CONSISTENT CARD DESIGN (NO INLINE ACCORDION DROPDOWN) */
  .tx-list { flex: 1; overflow-y: auto; padding: 0 16px; display: flex; flex-direction: column; gap: 8px; }
  
  .tx-card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.03); cursor: pointer; }
  .tx-card:hover { border-color: #0D7A52; transform: translateY(-1px); }
  
  .tx-left { display: flex; flex-direction: column; gap: 4px; }
  .tx-top-line { display: flex; align-items: center; gap: 8px; }
  .tx-time { font-size: 12px; font-weight: 700; color: #1E293B; }
  .tag { font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
  .tag-cash { background: #DCFCE7; color: #15803D; }
  .tag-partial { background: #FEF3C7; color: #B45309; }
  .tag-utang { background: #EDE9FE; color: #6D28D9; }
  .tx-desc { font-size: 11px; color: #64748B; font-weight: 500; }
  .tx-desc strong { color: #334155; }

  .tx-right { display: flex; align-items: center; gap: 12px; }
  .tx-amt-col { text-align: right; }
  .tx-amount { font-size: 14px; font-weight: 800; color: #0F172A; }
  .tx-items { font-size: 10px; color: #64748B; font-weight: 600; }
  .chevron { font-size: 16px; color: #94A3B8; font-weight: 800; }

  /* Callout Banner */
  .callout-banner { margin: 8px 16px; background: #ECFDF5; border: 1px dashed #10B981; border-radius: 8px; padding: 8px 12px; display: flex; align-items: center; gap: 8px; }
  .callout-icon { font-size: 16px; }
  .callout-text { font-size: 10.5px; font-weight: 600; color: #065F46; line-height: 1.3; }

  /* Bottom Tab Bar */
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
    <span>02:15 PM</span>
    <span>📶 100% 🔋</span>
  </div>

  <!-- Header -->
  <div class="header">
    <h1>Sales History</h1>
    <div class="header-actions">
      <div class="btn-outline-green">📄 Z-Reading</div>
      <div class="btn-outline-slate">📈 Forecast</div>
    </div>
  </div>

  <!-- Period Tabs -->
  <div class="period-tabs">
    <div class="period-tab active">Daily</div>
    <div class="period-tab">Weekly</div>
    <div class="period-tab">Monthly</div>
  </div>

  <!-- Date Bar -->
  <div class="date-bar">
    <div class="date-display">📅 Oct 27, 2026 ▾</div>
    <div class="date-growth">📈 +0% vs kahapon</div>
  </div>

  <!-- Top Metric Cards -->
  <div class="stats-grid">
    <div class="stat-card sales">
      <div class="stat-title">Sales Today 👁️</div>
      <div class="stat-amount">₱165.00</div>
      <div class="stat-sub">Profit: ₱45.00</div>
    </div>
    <div class="stat-card utang">
      <div class="stat-title">Koleksyon (Utang)</div>
      <div class="stat-amount">₱0.00</div>
      <div class="stat-sub">0 Collections</div>
    </div>
    <div class="stat-card drawer">
      <div class="stat-title">Cash in Drawer 💵</div>
      <div class="stat-amount">₱165.00</div>
      <div class="stat-sub">Breakdown & Kaha ></div>
    </div>
  </div>

  <!-- Sub Stats -->
  <div class="sub-stats">
    <div class="sub-stat-item">
      <div class="sub-stat-label">GCash Total</div>
      <div class="sub-stat-val">₱0.00</div>
    </div>
    <div class="sub-stat-item">
      <div class="sub-stat-label">Bagong Utang</div>
      <div class="sub-stat-val">₱0.00</div>
    </div>
    <div class="sub-stat-item">
      <div class="sub-stat-label">Items Sold</div>
      <div class="sub-stat-val">5 pcs 🔥</div>
    </div>
    <div class="sub-stat-item">
      <div class="sub-stat-label">Receipts</div>
      <div class="sub-stat-val">3</div>
    </div>
  </div>

  <!-- Callout Informing No Inline Accordion -->
  <div class="callout-banner">
    <span class="callout-icon">✨</span>
    <span class="callout-text"><strong>Consistent Card Design:</strong> Hindi na lumalaki sa listahan ang dropdown. I-tap ang anumang resibo para magbukas ang nakalaang Management Modal.</span>
  </div>

  <!-- Section Header -->
  <div class="section-header">
    <div class="section-title">Recent Transactions</div>
    <div class="section-hint">Tap receipt for Return / Void ›</div>
  </div>

  <!-- Search -->
  <div class="search-box">
    <span>🔍</span>
    <span>Search customer, receipt #, or item...</span>
  </div>

  <!-- Filter Pills -->
  <div class="filters-row">
    <div class="filter-pill active">Lahat (3)</div>
    <div class="filter-pill">Cash (2)</div>
    <div class="filter-pill">GCash (0)</div>
    <div class="filter-pill">Utang (1)</div>
  </div>

  <!-- Transaction List: UNCLICKED STATE (CLEAN, COMPACT, NO GIANT DROPDOWN) -->
  <div class="tx-list">
    <!-- Card 1 -->
    <div class="tx-card">
      <div class="tx-left">
        <div class="tx-top-line">
          <span class="tx-time">02:07 PM</span>
          <span class="tag tag-cash">CASH</span>
        </div>
        <div class="tx-desc">OR-2026-0007 • <strong>Choco Mucho (3 pcs)</strong></div>
      </div>
      <div class="tx-right">
        <div class="tx-amt-col">
          <div class="tx-amount">₱45.00</div>
          <div class="tx-items">3 Items</div>
        </div>
        <div class="chevron">›</div>
      </div>
    </div>

    <!-- Card 2 -->
    <div class="tx-card">
      <div class="tx-left">
        <div class="tx-top-line">
          <span class="tx-time">02:06 PM</span>
          <span class="tag tag-partial">PARTIAL_RETURN</span>
          <span class="tag tag-cash">CASH</span>
        </div>
        <div class="tx-desc">OR-2026-0006 • <strong>Lucky Me Pancit (1 left)</strong></div>
      </div>
      <div class="tx-right">
        <div class="tx-amt-col">
          <div class="tx-amount">₱15.00</div>
          <div class="tx-items">1 Item</div>
        </div>
        <div class="chevron">›</div>
      </div>
    </div>

    <!-- Card 3 -->
    <div class="tx-card">
      <div class="tx-left">
        <div class="tx-top-line">
          <span class="tx-time">01:45 PM</span>
          <span class="tag tag-utang">UTANG</span>
        </div>
        <div class="tx-desc">OR-2026-0005 • <strong>Aling Nena • Sardines (2 cans)</strong></div>
      </div>
      <div class="tx-right">
        <div class="tx-amt-col">
          <div class="tx-amount">₱50.00</div>
          <div class="tx-items">2 Items</div>
        </div>
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
    <div class="tab-item active">
      <span>📊</span>
      <span>Sales</span>
    </div>
    <div class="cart-fab">🛒</div>
    <div class="tab-item">
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

HTML_STATE_2 = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=412, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  body { background-color: #0F172A; display: flex; justify-content: center; padding: 0; }
  .phone-frame { width: 412px; height: 892px; background: rgba(15, 23, 42, 0.7); display: flex; flex-direction: column; overflow: hidden; position: relative; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
  
  /* Dimmed background representation */
  .dimmed-bg { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(2px); z-index: 1; }

  /* Bottom Sheet Modal Container */
  .modal-sheet { position: absolute; bottom: 0; left: 0; right: 0; background: #FFFFFF; border-radius: 24px 24px 0 0; z-index: 10; display: flex; flex-direction: column; max-height: 820px; box-shadow: 0 -10px 25px rgba(0,0,0,0.3); animation: slideUp 0.3s ease-out; }
  
  /* Handle Bar */
  .modal-handle-bar { width: 40px; height: 5px; background: #CBD5E1; border-radius: 3px; margin: 10px auto 4px; }

  /* Modal Header */
  .modal-header { padding: 10px 18px 12px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #F1F5F9; }
  .modal-title-col { flex: 1; }
  .modal-title { font-size: 16px; font-weight: 800; color: #0F172A; }
  .modal-sub { font-size: 11px; font-weight: 600; color: #64748B; margin-top: 2px; }
  .close-btn { width: 30px; height: 30px; border-radius: 15px; background: #F1F5F9; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 800; color: #64748B; cursor: pointer; }

  /* Modal Body */
  .modal-body { padding: 14px 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }

  /* Financial Breakdown Card */
  .financial-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 10px 14px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .fin-col { text-align: center; }
  .fin-label { font-size: 10px; font-weight: 700; color: #64748B; }
  .fin-val { font-size: 13px; font-weight: 800; color: #0F172A; margin-top: 2px; }
  .fin-val.green { color: #0D7A52; }

  /* Step Title */
  .step-header { display: flex; justify-content: space-between; align-items: center; }
  .step-title { font-size: 12px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.3px; }
  .badge-full-control { background: #ECFDF5; color: #047857; font-size: 9px; font-weight: 800; padding: 2px 7px; border-radius: 6px; border: 1px solid #A7F3D0; }

  /* Interactive Line Item Card */
  .item-box { background: #FFFFFF; border: 1.5px solid #0D7A52; border-radius: 14px; padding: 12px 14px; box-shadow: 0 4px 12px rgba(13,122,82,0.08); display: flex; flex-direction: column; gap: 10px; }
  .item-top { display: flex; justify-content: space-between; align-items: center; }
  .item-name { font-size: 13.5px; font-weight: 800; color: #0F172A; }
  .item-price { font-size: 11px; font-weight: 700; color: #64748B; }
  .item-price strong { color: #0D7A52; }

  /* FULL CONTROL QUANTITY STEPPER */
  .stepper-container { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; }
  .stepper-label { font-size: 11.5px; font-weight: 700; color: #334155; }
  .stepper-control { display: flex; align-items: center; gap: 8px; }
  .step-btn { width: 32px; height: 32px; border-radius: 8px; background: #FFFFFF; border: 1.5px solid #CBD5E1; color: #1E293B; font-size: 16px; font-weight: 800; display: flex; align-items: center; justify-content: center; cursor: pointer; }
  .step-btn:active { background: #E2E8F0; }
  .step-input { width: 44px; height: 32px; border-radius: 8px; background: #FFFFFF; border: 1.5px solid #0D7A52; font-size: 14px; font-weight: 800; text-align: center; color: #0D7A52; display: flex; align-items: center; justify-content: center; }
  .step-limit { font-size: 10px; font-weight: 600; color: #94A3B8; }

  /* Condition Chips */
  .chip-group { display: flex; gap: 8px; }
  .chip-btn { flex: 1; padding: 8px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; text-align: center; border: 1.5px solid #E2E8F0; background: #FFFFFF; color: #475569; cursor: pointer; }
  .chip-btn.active-sellable { background: #ECFDF5; border-color: #10B981; color: #065F46; }
  .chip-btn.active-quarantine { background: #FEF3C7; border-color: #F59E0B; color: #92400E; }

  /* Reason Row */
  .reason-row { display: flex; gap: 6px; }
  .reason-pill { font-size: 10px; font-weight: 700; padding: 5px 10px; border-radius: 16px; background: #F1F5F9; color: #64748B; border: 1px solid #E2E8F0; }
  .reason-pill.active { background: #0D7A52; color: #FFFFFF; border-color: #0D7A52; }

  /* Resolution Dispatcher */
  .resolution-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .res-title { font-size: 11px; font-weight: 800; color: #1E293B; }
  
  .action-buttons-row { display: flex; gap: 8px; }
  .btn-refund-cash { flex: 1; background: #EF4444; color: #FFFFFF; font-size: 12px; font-weight: 800; padding: 11px 8px; border-radius: 10px; border: none; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(239,68,68,0.25); cursor: pointer; }
  .btn-exchange-credit { flex: 1; background: #0284C7; color: #FFFFFF; font-size: 12px; font-weight: 800; padding: 11px 8px; border-radius: 10px; border: none; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(2,132,199,0.25); cursor: pointer; }

  /* Receipt Slip & Void Footer */
  .modal-footer { padding: 12px 18px 18px; border-top: 1px solid #F1F5F9; display: flex; flex-direction: column; gap: 8px; }
  .btn-slip { width: 100%; background: #ECFDF5; border: 1.5px solid #10B981; color: #065F46; font-size: 12px; font-weight: 700; padding: 10px; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .btn-void { width: 100%; background: #FEF2F2; border: 1.5px solid #FCA5A5; color: #DC2626; font-size: 12px; font-weight: 700; padding: 10px; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; }
</style>
</head>
<body>

<div class="phone-frame">
  <!-- Dimmed Background Overlay -->
  <div class="dimmed-bg"></div>

  <!-- Modal Bottom Sheet (UI 2: CLICKED STATE) -->
  <div class="modal-sheet">
    <div class="modal-handle-bar"></div>

    <!-- Header -->
    <div class="modal-header">
      <div class="modal-title-col">
        <div class="modal-title">Receipt OR-2026-0007 • Paid via CASH</div>
        <div class="modal-sub">Juan Dela Cruz • Oct 27, 2026 • 02:07 PM</div>
      </div>
      <div class="close-btn">✕</div>
    </div>

    <!-- Body -->
    <div class="modal-body">
      <!-- Financial Breakdown Card -->
      <div class="financial-card">
        <div class="fin-col">
          <div class="fin-label">Benta (Sales)</div>
          <div class="fin-val">₱45.00</div>
        </div>
        <div class="fin-col">
          <div class="fin-label">Puhunan (Cost)</div>
          <div class="fin-val">₱30.00</div>
        </div>
        <div class="fin-col">
          <div class="fin-label">Tubo (Profit)</div>
          <div class="fin-val green">+₱15.00 (33%)</div>
        </div>
      </div>

      <!-- Step 1: Returned Item & FULL CONTROL Stepper -->
      <div class="step-header">
        <div class="step-title">1. Return Quantity & Condition</div>
        <div class="badge-full-control">★ Full Control</div>
      </div>

      <div class="item-box">
        <div class="item-top">
          <div class="item-name">Choco Mucho Chocolate Bar</div>
          <div class="item-price">Paid: <strong>₱15.00/pc</strong> (3 pcs bought)</div>
        </div>

        <!-- FULL CONTROL QUANTITY STEPPER -->
        <div class="stepper-container">
          <div class="stepper-label">Dami ng Ibabalik (Return Qty):</div>
          <div class="stepper-control">
            <div class="step-btn">−</div>
            <div class="step-input">2</div>
            <div class="step-btn">+</div>
            <span class="step-limit">/ 3 pcs</span>
          </div>
        </div>

        <!-- Condition Chips -->
        <div class="chip-group">
          <div class="chip-btn active-sellable">✓ Sellable (Restock +2)</div>
          <div class="chip-btn">⚠ Damaged (Quarantine)</div>
        </div>

        <!-- Reason Pills -->
        <div class="reason-row">
          <div class="reason-pill">Defective / Spoiled</div>
          <div class="reason-pill">Wrong Item</div>
          <div class="reason-pill active">✓ Changed Mind</div>
        </div>
      </div>

      <!-- Step 2: Resolution Dispatcher -->
      <div class="resolution-card">
        <div class="res-title">2. Piliin ang Paraan ng Pagbawi (Total: 2 × ₱15 = ₱30.00):</div>
        <div class="action-buttons-row">
          <button class="btn-refund-cash">
            <span>💵</span>
            <span>Cash Refund (₱30.00)</span>
          </button>
          <button class="btn-exchange-credit">
            <span>🔄</span>
            <span>Exchange Credit (₱30.00)</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Footer Actions -->
    <div class="modal-footer">
      <div class="btn-slip">🖨️ Thermal Receipt Slip (58mm / 80mm)</div>
      <div class="btn-void">🚫 Void Entire Receipt (Owner Entry Error)</div>
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
        
        # State 1 (Unclicked)
        page1 = browser.new_page(viewport={"width": 412, "height": 892}, device_scale_factor=2)
        page1.set_content(HTML_STATE_1)
        page1.wait_for_timeout(300)
        page1.screenshot(path=IMG_1_PATH)
        print("Generated:", IMG_1_PATH)
        page1.close()

        # State 2 (Clicked Modal)
        page2 = browser.new_page(viewport={"width": 412, "height": 892}, device_scale_factor=2)
        page2.set_content(HTML_STATE_2)
        page2.wait_for_timeout(300)
        page2.screenshot(path=IMG_2_PATH)
        print("Generated:", IMG_2_PATH)
        page2.close()

        browser.close()

if __name__ == "__main__":
    generate()
