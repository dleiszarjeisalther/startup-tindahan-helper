// src/presentation/localization/i18n.ts
export type SupportedLanguage = 'English' | 'Taglish' | 'Filipino';

export interface Translations {
  // Tabs
  tabScan: string;
  tabSales: string;
  tabNewSale: string;
  tabInventory: string;
  tabMore: string;

  // Header & Navigation
  newSaleTitle: string;
  inventoryTitle: string;
  salesTitle: string;
  storeSettingsTitle: string;
  moreTitle: string;

  // POS & Scanning
  searchPlaceholder: string;
  scanBarcodeBtn: string;
  stopScanBtn: string;
  outOfStockAlert: string;
  addProductToDb: string;
  quickRegisterPrompt: string;
  productFoundOnline: string;
  searchingOnline: string;

  // Checkout
  cashReceivedLabel: string;
  gcashReceivedLabel: string;
  exactPayment: string;
  completeSaleBtn: string;
  savingToDb: string;
  addMoreItemsBtn: string;
  emptyCartTitle: string;
  emptyCartSub: string;
  changeGiven: string;
  nextSaleBtn: string;
  viewSalesHistoryBtn: string;
  qtyInputPlaceholder: string;

  // Utang & Tenders
  tenderCash: string;
  tenderGcash: string;
  tenderUtang: string;
  customerNameLabel: string;
  customerNamePlaceholder: string;
  chargeDeficitToUtang: string;

  // Inventory & Stock
  inStock: string;
  lowStock: string;
  outOfStock: string;
  stockCount: string;
  addProductTitle: string;
  saveProductBtn: string;
  closeBtn: string;
  filterAll: string;
  manageCategories: string;
  addCategory: string;
  editCategory: string;
  deleteCategory: string;
  categoryName: string;
  categoryRequired: string;
  newCategoryNamePlaceholder: string;
  categoryDeleteConfirm: string;
  categoryDeleteWarning: string;
  cancelBtn: string;
  saveBtn: string;
  deleteBtn: string;

  // Receipt-First Add Product Flow
  initialStockLabel: string;
  lowStockThresholdLabel: string;
  unitCostLabel: string;
  perPieceMode: string;
  buongBalotMode: string;
  bundleCostPlaceholder: string;
  costSneakPeekTitle: string;
  costPerPiece: string;
  totalCapitalSpent: string;
  desiredProfitLabel: string;
  sellingPriceLabel: string;
  profitPerPiece: string;
  totalBatchProfit: string;
  roundToLabel: (p: string) => string;
  autoCostHint: string;

  // Pagination
  previousPage: string;
  nextPage: string;
  pageIndicator: (current: number, total: number) => string;

  // Settings
  storeInfo: string;
  storeName: string;
  storeLogo: string;
  storeLogoSub: string;
  storeAddress: string;
  appSettings: string;
  language: string;
  notifications: string;
  notificationsSub: string;
  save: string;
  schoolOpening: string;
  offlineStorage: string;
  offlineStorageSub: string;
  clearDataTitle: string;
  clearDataSub: string;
  clearDataConfirmTitle: string;
  clearDataConfirmMessage: string;
  clearDataConfirmBtn: string;
  ownerControlsSection: string;

  // Sales History & Financials (Tubo & Cash Drawer)
  tuboTitle: string;
  tuboSub: string;
  tuboHidden: string;
  puhunanLabel: string;
  tuboMarginLabel: string;
  cashDrawerTitle: string;
  cashDrawerSub: string;
  cashInBox: string;
  panukliStartingFloat: string;
  cashSalesShort: string;
  utangCashCollectedShort: string;
  gastosCashOut: string;
  addPanukliBtn: string;
  addGastosBtn: string;
  amountPhpLabel: string;
  categoryLabel: string;
  noteLabel: string;
  saveAdjustmentBtn: string;
  deleteAdjustmentConfirm: string;
  drawerHistoryTitle: string;
  noDrawerAdjustments: string;

  // Top Movers (Mabenta)
  mabentaTitle: string;
  mabentaSub: string;
  noSalesYet: string;
  unitsSoldSuffix: string;
  revenueGenerated: string;
  rankPrefix: string;

  // Filters & Search
  filterCash: string;
  filterGcash: string;
  filterUtang: string;
  filterBayadUtang: string;
  filterVoided: string;
  searchTxPlaceholder: string;
  noMatchingTransactions: string;

  // Z-Reading
  zReadingTitle: string;
  zReadingSub: string;
  zReadingBtn: string;
  shareZReadingBtn: string;
  summaryCopied: string;
  peakDayLabel: string;

  // Suki Utang Ledger
  utangLedgerTitle: string;
  utangLedgerSub: string;
  totalReceivables: string;
  activeDebtors: string;
  overLimitCount: string;
  searchSukiPlaceholder: string;
  filterAllSuki: string;
  filterWithDebt: string;
  filterFullyPaid: string;
  filterOverLimit: string;
  addSukiBtn: string;
  creditLimitLabel: string;
  currentBalanceLabel: string;
  recordPaymentBtn: string;
  manualUtangBtn: string;
  viewStatementBtn: string;
  shareReminderBtn: string;
  reminderMessageTemplate: (storeName: string, customerName: string, balance: string) => string;
  noSukiFound: string;
  noSukiSub: string;

  // Hold / Park Cart
  holdCartModalTitle: string;
  customerNameOrNote: string;
  customerNameOrNotePlaceholder: string;
  holdCartBtn: string;
  confirmHoldBtn: string;
  heldCartsTitle: string;
  heldCartsSub: string;
  deleteHeldCartTitle: string;
  restoreBtn: string;
  noHeldCarts: string;
  heldCartsCountBadge: (count: number) => string;
  parkSuccessToast: (name: string, count: number) => string;
  restoreSuccessToast: (name: string) => string;
  deleteHeldCartSuccessToast: (name: string) => string;
  heldCartWarningExistingItems: string;

  // Tubo & Financials additions
  tuboLabel: string;
  tuboOnSale: string;
  puhunanOnSale: string;
  markupLabel: string;
  marginLabel: string;
  bentaLabel: string;
  koleksyonLabel: string;
  koleksyonTitle: string;
  cashInDrawerLabel: string;
  peraSaKahonLabel: string;
  bentaToday: string;
  bayadUtangBadge: string;

  // Common & Settings additions
  clearCart: string;
  cancel: string;
  delete: string;
  langChangedToast: string;
  storeNameSaved: string;
  storeAddressSaved: string;
  resetSuccess: string;
  langFilipino: string;
  langEnglish: string;

  // Date Range Filter & Calendar
  dateFilterTitle: string;
  dateFilterSub: string;
  filterToday: string;
  filterYesterday: string;
  filterLast7Days: string;
  filterThisMonth: string;
  filterLastMonth: string;
  filterYtd: string;
  filterCustomRange: string;
  applyDateFilter: string;
  resetDateFilter: string;
  startDateLabel: string;
  endDateLabel: string;
  selectStartDateHint: string;
  selectEndDateHint: string;

  // Sales & Collections Overview Modal
  salesOverviewTitle: string;
  salesOverviewSub: string;
  salesSectionTitle: string;
  salesTenderSectionTitle: string;
  collectionsSectionTitle: string;
  totalInflowSectionTitle: string;
  avgSpendPerReceipt: string;
  cashInflowLabel: string;
  digitalInflowLabel: string;
  grandTotalInflowLabel: string;
  salesOverviewBtnHint: string;
}

const en: Translations = {
  tabScan: 'Scan',
  tabSales: 'Sales',
  tabNewSale: 'New Sale',
  tabInventory: 'Inventory',
  tabMore: 'More',

  newSaleTitle: 'New Sale',
  inventoryTitle: 'Inventory Management',
  salesTitle: 'Sales History',
  storeSettingsTitle: 'Store Settings',
  moreTitle: 'Menu & Store Profile',

  searchPlaceholder: 'Search product name or barcode...',
  scanBarcodeBtn: 'Scan',
  stopScanBtn: 'Stop',
  outOfStockAlert: 'is Out of Stock!',
  addProductToDb: '+ Add Product',
  quickRegisterPrompt: '+ Register as New Product',
  productFoundOnline: '✓ Product found online',
  searchingOnline: '🔍 Searching product online...',

  cashReceivedLabel: 'Cash Amount Received (₱) *',
  gcashReceivedLabel: 'GCash Amount Received (₱) *',
  exactPayment: 'Exact',
  completeSaleBtn: 'Complete Sale',
  savingToDb: 'Saving sale...',
  addMoreItemsBtn: '+ Add More Items',
  emptyCartTitle: 'No items in current sale',
  emptyCartSub: 'Tap "+ Add More Items" or Scan to add products.',
  changeGiven: 'Change Given (Sukli):',
  nextSaleBtn: 'Next Sale (Scan)',
  viewSalesHistoryBtn: 'Sales History',
  qtyInputPlaceholder: 'Qty',

  tenderCash: 'CASH',
  tenderGcash: 'GCASH',
  tenderUtang: 'Utang (Lista)',
  customerNameLabel: 'Customer Name (Suki):',
  customerNamePlaceholder: 'e.g. Aling Nena',
  chargeDeficitToUtang: 'Charge Deficit to Customer Utang',

  inStock: 'In Stock',
  lowStock: 'Low Stock',
  outOfStock: 'Out of Stock',
  stockCount: 'Stock',
  addProductTitle: '+ Add Product & Photo',
  saveProductBtn: '✓ Save Product with Photo',
  closeBtn: 'Close',
  filterAll: 'All',
  manageCategories: 'Manage Categories',
  addCategory: '+ Add Category',
  editCategory: 'Edit Category',
  deleteCategory: 'Delete Category',
  categoryName: 'Category Name',
  categoryRequired: 'Please enter a category name.',
  newCategoryNamePlaceholder: 'e.g. Candy, Canned Goods...',
  categoryDeleteConfirm: 'Are you sure you want to delete this category?',
  categoryDeleteWarning: 'Products in this category will be moved to another category.',
  cancelBtn: 'Cancel',
  saveBtn: 'Save',
  deleteBtn: 'Delete',

  initialStockLabel: 'Initial Stock (pcs) *',
  lowStockThresholdLabel: 'Low Stock Alert At',
  unitCostLabel: 'Unit Cost / Puhunan',
  perPieceMode: 'Per Piece',
  buongBalotMode: 'Whole Pack / Box',
  bundleCostPlaceholder: 'Total Pack Cost (₱)',
  costSneakPeekTitle: 'Cost Sneak Peek',
  costPerPiece: 'Cost Per Piece:',
  totalCapitalSpent: 'Total Capital:',
  desiredProfitLabel: 'Desired Profit (Tubo)',
  sellingPriceLabel: 'Selling Price (₱) *',
  profitPerPiece: 'Profit Per Piece:',
  totalBatchProfit: 'Total Batch Profit:',
  roundToLabel: (p: string) => `Round to ₱${p}`,
  autoCostHint: 'Auto (75% cost estimate)',

  previousPage: '‹ Prev',
  nextPage: 'Next ›',
  pageIndicator: (current: number, total: number) => `Page ${current} of ${total}`,

  storeInfo: 'Store Information',
  storeName: 'Store Name',
  storeLogo: 'Store Logo',
  storeLogoSub: 'Owner Storefront Avatar',
  storeAddress: 'Store Address',
  appSettings: 'App Settings',
  language: 'Language',
  notifications: 'Notifications',
  notificationsSub: 'Restock alerts and reminders',
  save: 'Save',
  schoolOpening: 'School Opening Month',
  offlineStorage: 'Offline Store Data',
  offlineStorageSub: '✓ Active & Secure (Saved offline on this phone)',
  clearDataTitle: 'Clear All Store Records',
  clearDataSub: 'Erase all products, sales, and debt records',
  clearDataConfirmTitle: 'Clear All Store Records?',
  clearDataConfirmMessage: 'Are you sure you want to clear all products, sales, and customer records? This cannot be undone.',
  clearDataConfirmBtn: 'Yes, Clear All',
  ownerControlsSection: 'Store Controls & Peak Season',

  tuboTitle: 'Estimated Profit (Tubo)',
  tuboSub: 'Markup earned from merchandise sold',
  tuboHidden: '••••••',
  puhunanLabel: 'Cost of Goods (Puhunan)',
  tuboMarginLabel: 'Profit Margin:',
  cashDrawerTitle: 'Cash Drawer (Pera sa Kahon)',
  cashDrawerSub: 'Reconcile physical cash with sales and collections',
  cashInBox: 'Total Cash in Drawer',
  panukliStartingFloat: 'Starting Change (+Panukli)',
  cashSalesShort: 'Cash Sales (+Benta)',
  utangCashCollectedShort: 'Cash Collections (+Bayad Utang)',
  gastosCashOut: 'Cash Out / Expenses (-Gastos)',
  addPanukliBtn: '+ Add Starting Cash (Panukli)',
  addGastosBtn: '- Record Cash Out (Gastos)',
  amountPhpLabel: 'Amount (₱) *',
  categoryLabel: 'Category *',
  noteLabel: 'Note (Optional)',
  saveAdjustmentBtn: '✓ Save Drawer Entry',
  deleteAdjustmentConfirm: 'Delete this drawer entry?',
  drawerHistoryTitle: "Today's Drawer Movements",
  noDrawerAdjustments: 'No float or cash-out entries logged today.',

  mabentaTitle: 'Top-Moving Products (Mabenta Today)',
  mabentaSub: 'Products ranked by quantity sold today',
  noSalesYet: 'No products sold in this period yet.',
  unitsSoldSuffix: 'sold',
  revenueGenerated: 'Total Sales:',
  rankPrefix: '#',

  filterCash: 'Cash',
  filterGcash: 'GCash',
  filterUtang: 'Utang',
  filterBayadUtang: 'Bayad Utang',
  filterVoided: 'Voided',
  searchTxPlaceholder: 'Search customer, receipt #, or item...',
  noMatchingTransactions: 'No transactions match your search or filter.',

  zReadingTitle: 'Daily Z-Reading Summary',
  zReadingSub: 'Official store daily end-of-day report',
  zReadingBtn: '📄 Z-Reading Report',
  shareZReadingBtn: 'Share Report via SMS / Messenger',
  summaryCopied: '✓ Summary copied to clipboard',
  peakDayLabel: 'Peak Day',

  // Suki Utang Ledger
  utangLedgerTitle: 'Suki Utang Ledger',
  utangLedgerSub: 'Customer credit notebook & balance statement',
  totalReceivables: 'Total Receivables (Utang):',
  activeDebtors: 'Suki with Balance:',
  overLimitCount: 'Over Limit:',
  searchSukiPlaceholder: 'Search suki name...',
  filterAllSuki: 'All Suki',
  filterWithDebt: 'With Utang',
  filterFullyPaid: 'Fully Paid (₱0)',
  filterOverLimit: 'Over Limit ⚠️',
  addSukiBtn: '+ Add Suki',
  creditLimitLabel: 'Credit Limit:',
  currentBalanceLabel: 'Current Balance:',
  recordPaymentBtn: '💵 Record Payment',
  manualUtangBtn: '+ Add Debt Entry',
  viewStatementBtn: '📒 Statement',
  shareReminderBtn: '📲 Send Reminder',
  reminderMessageTemplate: (storeName: string, customerName: string, balance: string) =>
    `Good day ${customerName}! This is a friendly reminder from ${storeName} regarding your outstanding balance of ₱${balance}. Thank you very much for your patronage!`,
  noSukiFound: 'No Suki records found.',
  noSukiSub: 'Tap "+ Add Suki" to register regular customers and track their credit balances.',

  // Hold / Park Cart
  holdCartModalTitle: 'Hold / Park Cart',
  customerNameOrNote: 'Customer Name / Note:',
  customerNameOrNotePlaceholder: 'e.g. Aling Maria or Order #1',
  holdCartBtn: 'Hold Cart',
  confirmHoldBtn: 'Hold Cart',
  heldCartsTitle: 'Held Carts',
  heldCartsSub: 'List of parked carts waiting for checkout',
  deleteHeldCartTitle: 'Delete Held Cart',
  restoreBtn: 'Restore',
  noHeldCarts: 'No parked carts waiting',
  heldCartsCountBadge: (count: number) => `${count} Held ${count === 1 ? 'Cart' : 'Carts'}`,
  parkSuccessToast: (name: string, count: number) => `✓ Parked cart for "${name}" (${count} items)`,
  restoreSuccessToast: (name: string) => `✓ Restored held cart for "${name}" to checkout`,
  deleteHeldCartSuccessToast: (name: string) => `✓ Deleted held cart for "${name}"`,
  heldCartWarningExistingItems: 'Restore this cart? Items in your current active checkout will be replaced.',

  // Tubo & Financials
  tuboLabel: 'Profit (Tubo)',
  tuboOnSale: 'Profit (Tubo):',
  puhunanOnSale: 'Cost (Puhunan):',
  markupLabel: 'Markup:',
  marginLabel: 'Margin:',
  bentaLabel: 'Benta (Sales)',
  koleksyonLabel: 'Collections (Utang)',
  koleksyonTitle: 'Collections',
  cashInDrawerLabel: 'Cash in Drawer',
  peraSaKahonLabel: 'Cash in Drawer',
  bentaToday: 'Sales Today',
  bayadUtangBadge: 'DEBT PAYMENT',

  // Common & Settings
  clearCart: 'Clear Sale',
  cancel: 'Cancel',
  delete: 'Delete',
  langChangedToast: '✓ Language changed to English',
  storeNameSaved: '✓ Store name saved',
  storeAddressSaved: '✓ Store address saved',
  resetSuccess: '✓ All store records successfully reset',
  langFilipino: '🇵🇭 Filipino / Taglish',
  langEnglish: '🇺🇸 English',

  // Date Range Filter & Calendar
  dateFilterTitle: 'Filter by Date & Period',
  dateFilterSub: 'Choose a preset timeframe or select custom start and end dates',
  filterToday: 'Today',
  filterYesterday: 'Yesterday',
  filterLast7Days: 'Last 7 Days',
  filterThisMonth: 'This Month',
  filterLastMonth: 'Last Month',
  filterYtd: 'This Year (YTD)',
  filterCustomRange: 'Custom Range',
  applyDateFilter: '✓ Apply Date Filter',
  resetDateFilter: 'Reset to Today',
  startDateLabel: 'Start Date',
  endDateLabel: 'End Date',
  selectStartDateHint: 'Tap a date to set Start Date',
  selectEndDateHint: 'Tap another date to set End Date',

  // Sales & Collections Overview Modal
  salesOverviewTitle: 'Sales & Collections Overview',
  salesOverviewSub: 'Detailed operational breakdown of sales, profit, and debt collections',
  salesSectionTitle: 'Sales & Profit Performance',
  salesTenderSectionTitle: 'Sales Breakdown by Tender',
  collectionsSectionTitle: 'Utang Collections Received',
  totalInflowSectionTitle: 'Total Operational Cash Inflow',
  avgSpendPerReceipt: 'Avg. Spend per Receipt',
  cashInflowLabel: 'Actual Cash Received',
  digitalInflowLabel: 'GCash / Digital Inflow',
  grandTotalInflowLabel: 'Grand Total Inflow',
  salesOverviewBtnHint: 'Full Overview ›',
};

const taglish: Translations = {
  tabScan: 'I-scan',
  tabSales: 'Benta',
  tabNewSale: 'Bagong Benta',
  tabInventory: 'Imbentaryo',
  tabMore: 'Iba pa',

  newSaleTitle: 'Bagong Benta',
  inventoryTitle: 'Pamamahala ng Imbentaryo',
  salesTitle: 'Talaan ng Benta',
  storeSettingsTitle: 'Mga Setting ng Tindahan',
  moreTitle: 'Menu at Profile ng Tindahan',

  searchPlaceholder: 'Maghanap ng produkto o barcode...',
  scanBarcodeBtn: 'I-scan',
  stopScanBtn: 'Ihinto',
  outOfStockAlert: 'ay Ubos na ang Stock!',
  addProductToDb: '+ Bagong Paninda',
  quickRegisterPrompt: '+ Ilista bilang Bagong Produkto',
  productFoundOnline: '✓ Nahanap ang paninda online',
  searchingOnline: '🔍 Naghahanap ng paninda online...',

  cashReceivedLabel: 'Bayad na Natanggap mula sa Kostumer (₱) *',
  gcashReceivedLabel: 'Halaga ng GCash na Natanggap (₱) *',
  exactPayment: 'Sakto',
  completeSaleBtn: 'Tapusin ang Benta',
  savingToDb: 'Itinatala ang benta...',
  addMoreItemsBtn: '+ Magdagdag ng Paninda',
  emptyCartTitle: 'Walang paninda sa kasalukuyang benta',
  emptyCartSub: 'Pindutin ang "+ Magdagdag" o mag-scan ng produkto.',
  changeGiven: 'Sukli sa Kostumer:',
  nextSaleBtn: 'Susunod na Benta (I-scan)',
  viewSalesHistoryBtn: 'Talaan ng Benta',
  qtyInputPlaceholder: 'Dami',

  tenderCash: 'PERA (Cash)',
  tenderGcash: 'GCASH',
  tenderUtang: 'Utang (Ilista)',
  customerNameLabel: 'Pangalan ng Suki:',
  customerNamePlaceholder: 'hal. Aling Nena',
  chargeDeficitToUtang: 'Ilista ang kulang bilang Utang ng Suki',

  inStock: 'May Stock',
  lowStock: 'Kakaunti na',
  outOfStock: 'Ubos na',
  stockCount: 'Dami',
  addProductTitle: '+ Magdagdag ng Paninda at Larawan',
  saveProductBtn: '✓ I-save ang Paninda na may Larawan',
  closeBtn: 'Isara',
  filterAll: 'Lahat',
  manageCategories: 'Pamahalaan ang mga Kategorya',
  addCategory: '+ Bagong Kategorya',
  editCategory: 'I-edit ang Kategorya',
  deleteCategory: 'Burahin ang Kategorya',
  categoryName: 'Pangalan ng Kategorya',
  categoryRequired: 'Mangyaring maglagay ng pangalan ng kategorya.',
  newCategoryNamePlaceholder: 'hal. Candy, De-lata...',
  categoryDeleteConfirm: 'Sigurado ka bang nais mong burahin ang kategoryang ito?',
  categoryDeleteWarning: 'Ang mga paninda dito ay ililipat sa ibang kategorya.',
  cancelBtn: 'Kanselahin',
  saveBtn: 'I-save',
  deleteBtn: 'Burahin',

  initialStockLabel: 'Bilang ng Paninda (pcs) *',
  lowStockThresholdLabel: 'Alerto Kapag Kakaunti Na',
  unitCostLabel: 'Puhunan sa Paninda',
  perPieceMode: 'Bawat Piraso (Tingi)',
  buongBalotMode: 'Buong Balot o Kahon',
  bundleCostPlaceholder: 'Kabuuang Halaga ng Balot (₱)',
  costSneakPeekTitle: 'Pagsusuri ng Puhunan',
  costPerPiece: 'Puhunan Bawat Piraso:',
  totalCapitalSpent: 'Kabuuang Puhunan sa Batch:',
  desiredProfitLabel: 'Gustong Tubo Bawat Piraso',
  sellingPriceLabel: 'Presyo sa Tindahan (₱) *',
  profitPerPiece: 'Tubo Bawat Piraso:',
  totalBatchProfit: 'Kabuuang Kikitain sa Batch:',
  roundToLabel: (p: string) => `I-round sa ₱${p}`,
  autoCostHint: 'Tinatayang 75% puhunan',

  previousPage: '‹ Nakaraan',
  nextPage: 'Susunod ›',
  pageIndicator: (current: number, total: number) => `Pahina ${current} ng ${total}`,

  storeInfo: 'Impormasyon ng Tindahan',
  storeName: 'Pangalan ng Tindahan',
  storeLogo: 'Larawan ng Tindahan',
  storeLogoSub: 'Storefront Avatar ng May-ari',
  storeAddress: 'Tirahan / Lokasyon',
  appSettings: 'Mga Setting ng App',
  language: 'Wika (Language)',
  notifications: 'Mga Notipikasyon',
  notificationsSub: 'Alerto bago maubusan ng stock',
  save: 'I-save',
  schoolOpening: 'Buwan ng Pasukan sa Paaralan',
  offlineStorage: 'Pansariling Talaan sa Telepono',
  offlineStorageSub: '✓ Aktibo at Ligtas (Nakatago sa iyong telepono nang offline)',
  clearDataTitle: 'Burahin ang Lahat ng Talaan sa Tindahan',
  clearDataSub: 'Burahin ang lahat ng paninda, benta, cart, at talaan ng utang',
  clearDataConfirmTitle: 'Burahin ang Lahat ng Talaan?',
  clearDataConfirmMessage: 'Sigurado ka bang nais mong burahin ang lahat ng paninda, benta, at talaan ng utang sa iyong tindahan? Hindi na ito maibabalik.',
  clearDataConfirmBtn: 'Oo, Burahin Lahat',
  ownerControlsSection: 'Pamamahala ng Tindahan at Panahon ng Pasukan',

  tuboTitle: 'Tubo / Kita (Tinatayang Tubo)',
  tuboSub: 'Tunay na kinita mula sa naibentang paninda',
  tuboHidden: '••••••',
  puhunanLabel: 'Kabuuang Puhunan',
  tuboMarginLabel: 'Tubo Margin:',
  cashDrawerTitle: 'Pera sa Kahon (Kaha)',
  cashDrawerSub: 'Kuwentahin ang aktwal na pera sa kaha kasama ang panukli at gastos',
  cashInBox: 'Kabuuang Pera sa Kahon',
  panukliStartingFloat: 'Panimulang Barya (+Panukli)',
  cashSalesShort: 'Benta sa Cash (+Benta)',
  utangCashCollectedShort: 'Koleksyon ng Utang (+Bayad)',
  gastosCashOut: 'Labas na Pera / Gastos (-Gastos)',
  addPanukliBtn: '+ Maglagay ng Panukli',
  addGastosBtn: '- Magtala ng Gastos / Paluwal',
  amountPhpLabel: 'Halaga ng Pera (₱) *',
  categoryLabel: 'Kategorya *',
  noteLabel: 'Paliwanag / Note (Opsyonal)',
  saveAdjustmentBtn: '✓ I-save sa Kaha',
  deleteAdjustmentConfirm: 'Burahin ang tala na ito sa kaha?',
  drawerHistoryTitle: 'Talaan ng Panukli at Gastos Ngayon',
  noDrawerAdjustments: 'Wala pang naitalang panukli o gastos ngayong araw.',

  mabentaTitle: 'Mabenta Ngayong Araw (Top Products)',
  mabentaSub: 'Nangungunang paninda ayon sa dami ng nabenta',
  noSalesYet: 'Wala pang nabentang paninda sa panahong ito.',
  unitsSoldSuffix: 'nabenta',
  revenueGenerated: 'Kabuuang Benta:',
  rankPrefix: '#',

  filterCash: 'Pera (Cash)',
  filterGcash: 'GCash',
  filterUtang: 'Utang',
  filterBayadUtang: 'Bayad Utang',
  filterVoided: 'Na-Void',
  searchTxPlaceholder: 'Hanapin sa suki, resibo #, o paninda...',
  noMatchingTransactions: 'Walang transaksyon na tumutugma sa filter o search.',

  zReadingTitle: 'Z-Reading / Ulat ng Benta Ngayong Araw',
  zReadingSub: 'Opisyal na buod ng benta sa tindahan ngayong araw',
  zReadingBtn: '📄 Z-Reading Report',
  shareZReadingBtn: 'I-share via SMS / Messenger',
  summaryCopied: '✓ Nakopya ang ulat sa clipboard',
  peakDayLabel: 'Pinakamalakas na Araw',

  // Suki Utang Ledger
  utangLedgerTitle: 'Talaan ng Utang (Suki Ledger)',
  utangLedgerSub: 'Listahan ng pautang, bayad, at paalala sa suki',
  totalReceivables: 'Kabuuang Pautang:',
  activeDebtors: 'Mga Suking May Utang:',
  overLimitCount: 'Lagpas sa Limit:',
  searchSukiPlaceholder: 'Hanapin ang pangalan ng suki...',
  filterAllSuki: 'Lahat ng Suki',
  filterWithDebt: 'May Utang',
  filterFullyPaid: 'Bayad Na (₱0)',
  filterOverLimit: 'Lagpas sa Limit ⚠️',
  addSukiBtn: '+ Maglista ng Suki',
  creditLimitLabel: 'Limit ng Utang:',
  currentBalanceLabel: 'Kasalukuyang Utang:',
  recordPaymentBtn: '💵 Magbayad',
  manualUtangBtn: '+ Bagong Utang',
  viewStatementBtn: '📒 Talaan',
  shareReminderBtn: '📲 I-send ang Paalala',
  reminderMessageTemplate: (storeName: string, customerName: string, balance: string) =>
    `Magandang araw po ${customerName}! Magalang na paalala lamang po mula sa ${storeName} ukol sa inyong natitirang utang na ₱${balance}. Maraming salamat po sa patuloy na pagtangkilik!`,
  noSukiFound: 'Walang nahanap na suki.',
  noSukiSub: 'Pindutin ang "+ Maglista ng Suki" upang magtala ng mga regular na kostumer at kanilang utang.',

  // Hold / Park Cart
  holdCartModalTitle: 'Itabi ang Cart (Hold / Park)',
  customerNameOrNote: 'Pangalan ng Kostumer / Note:',
  customerNameOrNotePlaceholder: 'hal. Aling Maria o Order #1',
  holdCartBtn: 'Itabi ang Cart',
  confirmHoldBtn: 'Itabi ang Cart',
  heldCartsTitle: 'Mga Nakatabing Cart',
  heldCartsSub: 'Listahan ng mga nakatabing cart na naghihintay',
  deleteHeldCartTitle: 'Burahin ang Nakatabing Cart',
  restoreBtn: 'Ibalik (Restore)',
  noHeldCarts: 'Walang nakatabing cart sa kasalukuyan',
  heldCartsCountBadge: (count: number) => `${count} Nakatabi`,
  parkSuccessToast: (name: string, count: number) => `✓ Naitabi ang cart para kay "${name}" (${count} paninda)`,
  restoreSuccessToast: (name: string) => `✓ Naibalik ang cart ni "${name}" sa checkout`,
  deleteHeldCartSuccessToast: (name: string) => `✓ Nabura ang nakatabing cart ni "${name}"`,
  heldCartWarningExistingItems: 'Nais mo bang ibalik ang cart na ito? Mapapalitan ang kasalukuyang paninda sa checkout.',

  // Tubo & Financials
  tuboLabel: 'Tubo',
  tuboOnSale: 'Tubo sa Benta:',
  puhunanOnSale: 'Puhunan:',
  markupLabel: 'Tubo %:',
  marginLabel: 'Margin %:',
  bentaLabel: 'Benta',
  koleksyonLabel: 'Koleksyon (Utang)',
  koleksyonTitle: 'Koleksyon',
  cashInDrawerLabel: 'Pera sa Kahon',
  peraSaKahonLabel: 'Pera sa Kahon',
  bentaToday: 'Benta Ngayong Araw',
  bayadUtangBadge: 'BAYAD UTANG',

  // Common & Settings
  clearCart: 'I-clear ang Cart',
  cancel: 'Kanselahin',
  delete: 'Burahin',
  langChangedToast: '✓ Wika binago sa Filipino / Taglish',
  storeNameSaved: '✓ Na-save ang pangalan ng tindahan',
  storeAddressSaved: '✓ Na-save ang address ng tindahan',
  resetSuccess: '✓ Matagumpay na na-reset ang lahat ng data',
  langFilipino: '🇵🇭 Filipino / Taglish',
  langEnglish: '🇺🇸 English',

  // Date Range Filter & Calendar
  dateFilterTitle: 'Piliin ang Petsa o Panahon',
  dateFilterSub: 'Pumili ng nakahandang shortcut o tukuyin ang simula at katapusang petsa',
  filterToday: 'Ngayon',
  filterYesterday: 'Kahapon',
  filterLast7Days: 'Nakaraang 7 Araw',
  filterThisMonth: 'Buwang Ito',
  filterLastMonth: 'Nakaraang Buwan',
  filterYtd: 'Taong Ito (YTD)',
  filterCustomRange: 'Pumili ng Petsa',
  applyDateFilter: '✓ I-apply ang Petsa',
  resetDateFilter: 'I-reset sa Ngayon',
  startDateLabel: 'Simulang Petsa',
  endDateLabel: 'Katapusang Petsa',
  selectStartDateHint: 'Pumindot ng petsa para sa Simula',
  selectEndDateHint: 'Pumindot ng isa pang petsa para sa Katapusan',

  // Sales & Collections Overview Modal
  salesOverviewTitle: 'Buod ng Benta at Koleksyon',
  salesOverviewSub: 'Detalyadong ulat ng benta, kita, paraan ng bayad, at bayad sa utang',
  salesSectionTitle: 'Ulat ng Benta at Tubo',
  salesTenderSectionTitle: 'Paraan ng Bayad sa Benta',
  collectionsSectionTitle: 'Koleksyon sa Utang',
  totalInflowSectionTitle: 'Kabuuang Pumasok na Pera (Inflow)',
  avgSpendPerReceipt: 'Average Benta kada Resibo',
  cashInflowLabel: 'Aktwal na Cash na Pumasok',
  digitalInflowLabel: 'GCash / Digital na Pumasok',
  grandTotalInflowLabel: 'Lahat ng Pumasok na Pera',
  salesOverviewBtnHint: 'Buong Buod ›',
};

const dictionaries: Record<'English' | 'Taglish' | 'Filipino', Translations> = {
  English: en,
  Taglish: taglish,
  Filipino: taglish,
};

export function getTranslations(lang?: string): Translations {
  if (lang === 'Taglish' || lang === 'Tagalog' || lang === 'Filipino') {
    return dictionaries.Filipino;
  }
  return dictionaries.English;
}

