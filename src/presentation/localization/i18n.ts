// src/presentation/localization/i18n.ts
export type SupportedLanguage = 'English' | 'Taglish';

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

  // Settings
  storeInfo: string;
  storeName: string;
  storeAddress: string;
  appSettings: string;
  language: string;
  notifications: string;
  notificationsSub: string;
  save: string;
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
  addProductToDb: '+ Add Product to DB',
  quickRegisterPrompt: '+ Register as New Product',

  cashReceivedLabel: 'Cash Amount Received (₱) *',
  gcashReceivedLabel: 'GCash Amount Received (₱) *',
  exactPayment: 'Exact',
  completeSaleBtn: 'Complete Sale',
  savingToDb: 'Saving to SQLite...',
  addMoreItemsBtn: '+ Add More Items',
  emptyCartTitle: 'No items in current sale',
  emptyCartSub: 'Tap "+ Add More Items" or Scan to add products.',
  changeGiven: 'Change Given (Sukli):',
  nextSaleBtn: 'Next Sale (Scan)',
  viewSalesHistoryBtn: 'Sales History',

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
  addProductTitle: '+ Add Product & Photo to SQLite Database',
  saveProductBtn: '✓ Save Product with Photo to Database',
  closeBtn: 'Close',
  filterAll: 'All',

  storeInfo: 'Store Information',
  storeName: 'Store Name',
  storeAddress: 'Store Address',
  appSettings: 'App Settings',
  language: 'Language',
  notifications: 'Notifications',
  notificationsSub: 'Pre-season restock alerts (14–21 days before peak)',
  save: 'Save',
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
  addProductToDb: '+ Magdagdag sa DB',
  quickRegisterPrompt: '+ Ilista bilang Bagong Produkto',

  cashReceivedLabel: 'Bayad na Natanggap mula sa Kostumer (₱) *',
  gcashReceivedLabel: 'Halaga ng GCash na Natanggap (₱) *',
  exactPayment: 'Sakto',
  completeSaleBtn: 'Tapusin ang Benta',
  savingToDb: 'Itinatala sa SQLite...',
  addMoreItemsBtn: '+ Magdagdag ng Paninda',
  emptyCartTitle: 'Walang paninda sa kasalukuyang benta',
  emptyCartSub: 'Pindutin ang "+ Magdagdag" o mag-scan ng produkto.',
  changeGiven: 'Sukli sa Kostumer:',
  nextSaleBtn: 'Susunod na Benta (I-scan)',
  viewSalesHistoryBtn: 'Talaan ng Benta',

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
  addProductTitle: '+ Magdagdag ng Produkto at Larawan sa SQLite',
  saveProductBtn: '✓ I-save ang Produkto sa Database',
  closeBtn: 'Isara',
  filterAll: 'Lahat',

  storeInfo: 'Impormasyon ng Tindahan',
  storeName: 'Pangalan ng Tindahan',
  storeAddress: 'Tirahan / Lokasyon',
  appSettings: 'Mga Setting ng App',
  language: 'Wika (Language)',
  notifications: 'Mga Notipikasyon',
  notificationsSub: 'Alerto bago maubusan ng stock',
  save: 'I-save',
};

const dictionaries: Record<SupportedLanguage, Translations> = {
  English: en,
  Taglish: taglish,
};

export function getTranslations(lang?: string): Translations {
  if (lang === 'Taglish' || lang === 'Tagalog' || lang === 'Filipino') {
    return dictionaries.Taglish;
  }
  return dictionaries.English;
}
