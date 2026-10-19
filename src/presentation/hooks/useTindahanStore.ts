import { useCallback, useSyncExternalStore } from 'react';
import { tindahanStoreService } from '../../infrastructure/container';
import { useTindahanStoreService } from '../providers/TindahanStoreProvider';
import { AddProductCommand } from '../../application/ProductOnboardingService';
import { MonthlySalesRecord } from '../../domain/strategies/SeasonalForecastEngine';
import { DateRangeFilter, PaymentTenderType } from '../../application/TindahanStoreService';

// Stable dispatchers with fixed function identities across renders
const refreshFromSqlite = () => tindahanStoreService.refreshFromSqlite();
const getSalesSummary = (
  periodOrRange: 'Daily' | 'Weekly' | 'Monthly' | DateRangeFilter = 'Daily'
) => tindahanStoreService.getSalesSummary(periodOrRange);
const addProductToDatabase = (cmd: AddProductCommand) =>
  tindahanStoreService.addProductToDatabase(cmd);
const lookupOnlineCatalog = (barcode: string) =>
  tindahanStoreService.lookupOnlineCatalog(barcode);
const deleteProductFromDatabase = (productId: string) =>
  tindahanStoreService.deleteProductFromDatabase(productId);
const updateProductImage = (productId: string, imageUri: string) =>
  tindahanStoreService.updateProductImage(productId, imageUri);
const updateProductDetails = (
  productId: string,
  updates: Parameters<typeof tindahanStoreService.updateProductDetails>[1]
) => tindahanStoreService.updateProductDetails(productId, updates);
const addToCart = (
  productId: string,
  deltaQty = 1,
  unit: 'piece' | 'bundle' | 'pack' | 'box' | 'case' = 'piece'
) => tindahanStoreService.addToCart(productId, deltaQty, unit);
const setCartItemQuantity = (
  productId: string,
  quantity: number,
  unit: 'piece' | 'bundle' | 'pack' | 'box' | 'case' = 'piece'
) => tindahanStoreService.setCartItemQuantity(productId, quantity, unit);
const addCategory = (name: string) => tindahanStoreService.addCategory(name);
const updateCategory = (oldName: string, newName: string) =>
  tindahanStoreService.updateCategory(oldName, newName);
const deleteCategory = (categoryName: string, fallbackCategory?: string) =>
  tindahanStoreService.deleteCategory(categoryName, fallbackCategory);
const undoRemoveCartItem = () => tindahanStoreService.undoRemoveCartItem();
const setDiscountPhp = (d: number) => tindahanStoreService.setDiscountPhp(d);
const clearCart = () => tindahanStoreService.clearCart();
const parkCurrentCart = (customerName?: string) =>
  tindahanStoreService.parkCurrentCart(customerName);
const restoreParkedCart = () => tindahanStoreService.restoreParkedCart();
const restoreHeldCart = (heldCartId: string) =>
  tindahanStoreService.restoreHeldCart(heldCartId);
const deleteHeldCart = (heldCartId: string) =>
  tindahanStoreService.deleteHeldCart(heldCartId);
const completeSale = (opts: Parameters<typeof tindahanStoreService.completeSale>[0]) =>
  tindahanStoreService.completeSale(opts);
const voidEntireTransaction = (txId: string, reason: string) =>
  tindahanStoreService.voidEntireTransaction(txId, reason);
const processReturnOrExchange = (
  params: Parameters<typeof tindahanStoreService.processReturnOrExchange>[0]
) => tindahanStoreService.processReturnOrExchange(params);
const adjustInventoryStock = (
  params: Parameters<typeof tindahanStoreService.adjustInventoryStock>[0]
) => tindahanStoreService.adjustInventoryStock(params);
const addUtangCustomer = (
  name: string,
  creditLimitPhp?: number,
  initialBalancePhp?: number
) => tindahanStoreService.addUtangCustomer(name, creditLimitPhp, initialBalancePhp);
const updateUtangCustomer = (
  customerId: string,
  updates: Parameters<typeof tindahanStoreService.updateUtangCustomer>[1]
) => tindahanStoreService.updateUtangCustomer(customerId, updates);
const addManualUtangEntry = (
  customerId: string,
  amountPhp: number,
  note?: string
) => tindahanStoreService.addManualUtangEntry(customerId, amountPhp, note);
const deleteUtangCustomer = (customerId: string) =>
  tindahanStoreService.deleteUtangCustomer(customerId);
const recordUtangPayment = (
  customerId: string,
  amountPhp: number,
  paymentMethod: PaymentTenderType = 'CASH'
) => tindahanStoreService.recordUtangPayment(customerId, amountPhp, paymentMethod);
const getMonthlySalesHistory = (productId: string) =>
  tindahanStoreService.getMonthlySalesHistory(productId);
const addOrUpdateMonthlySalesRecord = (productId: string, rec: MonthlySalesRecord) =>
  tindahanStoreService.addOrUpdateMonthlySalesRecord(productId, rec);
const updateSettings = (partial: Parameters<typeof tindahanStoreService.updateSettings>[0]) =>
  tindahanStoreService.updateSettings(partial);
const addCashAdjustment = (
  type: Parameters<typeof tindahanStoreService.addCashAdjustment>[0],
  amountPhp: number,
  category: string,
  note?: string
) => tindahanStoreService.addCashAdjustment(type, amountPhp, category, note);
const setCashInDrawer = (newAmountPhp: number, note?: string) =>
  tindahanStoreService.setCashInDrawer(newAmountPhp, note);
const deleteCashAdjustment = (adjustmentId: string) =>
  tindahanStoreService.deleteCashAdjustment(adjustmentId);
const recordStockMovement = (params: Parameters<typeof tindahanStoreService.recordStockMovement>[0]) =>
  tindahanStoreService.recordStockMovement(params);
const clearAllDatabaseData = () => tindahanStoreService.clearAllDatabaseData();
const exportDatabaseBackup = () => tindahanStoreService.exportDatabaseBackup();
const restoreDatabaseBackup = () => tindahanStoreService.restoreDatabaseBackup();
const notifyCatalogChanged = () => tindahanStoreService.notifyCatalogChanged();
const setOwnerMasterPin = (pin: string) => tindahanStoreService.setOwnerMasterPin(pin);
const verifyOwnerMasterPin = (pin: string) => tindahanStoreService.verifyOwnerMasterPin(pin);
const switchOperatingMode = (pin: string) => tindahanStoreService.switchOperatingMode(pin);
const quickLockToCashierMode = () => tindahanStoreService.quickLockToCashierMode();
const setOperatingMode = (mode: 'OWNER' | 'CASHIER') =>
  tindahanStoreService.setOperatingMode(mode);
const isPrivilegeAllowed = (
  action: Parameters<typeof tindahanStoreService.isPrivilegeAllowed>[0]
) => tindahanStoreService.isPrivilegeAllowed(action);
const toggleBrownoutBatterySaver = () => tindahanStoreService.toggleBrownoutBatterySaver();
const getExpiringProducts = (daysThreshold?: number) =>
  tindahanStoreService.getExpiringProducts(daysThreshold);
const unlockStore = (durationMs?: number) => tindahanStoreService.unlockStore(durationMs);
const lockStore = () => tindahanStoreService.lockStore();
const enableStoreSecurity = (enabled: boolean) => tindahanStoreService.enableStoreSecurity(enabled);
const isStoreUnlocked = () => tindahanStoreService.isStoreUnlocked();

export function useTindahanStore() {
  const store = useTindahanStoreService();
  const subscribe = useCallback((callback: () => void) => store.subscribe(callback), [store]);
  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot
  );

  return {
    version: snapshot.revision,
    cartRevision: snapshot.cartRevision,
    isSqliteActive: snapshot.isSqliteActive,
    operatingMode: snapshot.operatingMode,
    isStoreSecurityEnabled: snapshot.isStoreSecurityEnabled,
    isStoreLocked: snapshot.isStoreLocked,
    unlockedUntil: snapshot.unlockedUntil,
    isBrownoutSaverActive: snapshot.isBrownoutSaverActive,
    hasOwnerPinSet: snapshot.hasOwnerPinSet,
    pinLockoutUntil: snapshot.pinLockoutUntil,
    products: snapshot.products,
    cartSummary: snapshot.cartSummary,
    heldCarts: snapshot.heldCarts,
    transactions: snapshot.transactions,
    settings: snapshot.settings,
    utangCustomers: snapshot.utangCustomers,
    categories: snapshot.categories,
    cashDrawerAdjustments: snapshot.cashDrawerAdjustments,
    stockMovements: snapshot.stockMovements,
    recordStockMovement,
    refreshFromSqlite,
    getSalesSummary,
    addProductToDatabase,
    lookupOnlineCatalog,
    deleteProductFromDatabase,
    updateProductImage,
    updateProductDetails,
    addToCart,
    setCartItemQuantity,
    addCategory,
    updateCategory,
    deleteCategory,
    undoRemoveCartItem,
    setDiscountPhp,
    clearCart,
    parkCurrentCart,
    restoreParkedCart,
    restoreHeldCart,
    deleteHeldCart,
    completeSale,
    voidEntireTransaction,
    processReturnOrExchange,
    adjustInventoryStock,
    addUtangCustomer,
    updateUtangCustomer,
    addManualUtangEntry,
    deleteUtangCustomer,
    recordUtangPayment,
    addCashAdjustment,
    setCashInDrawer,
    deleteCashAdjustment,
    getMonthlySalesHistory,
    addOrUpdateMonthlySalesRecord,
    updateSettings,
    clearAllDatabaseData,
    exportDatabaseBackup,
    restoreDatabaseBackup,
    notifyCatalogChanged,
    setOwnerMasterPin,
    verifyOwnerMasterPin,
    switchOperatingMode,
    quickLockToCashierMode,
    setOperatingMode,
    isPrivilegeAllowed,
    toggleBrownoutBatterySaver,
    getExpiringProducts,
    unlockStore,
    lockStore,
    enableStoreSecurity,
    isStoreUnlocked,
  };
}
