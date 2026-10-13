import { useCallback, useSyncExternalStore } from 'react';
import { tindahanStoreService } from '../../infrastructure/container';
import { useTindahanStoreService } from '../providers/TindahanStoreProvider';
import { AddProductCommand } from '../../application/ProductOnboardingService';
import { MonthlySalesRecord } from '../../domain/strategies/SeasonalForecastEngine';
import { PaymentTenderType } from '../../application/TindahanStoreService';

// Stable dispatchers with fixed function identities across renders
const refreshFromSqlite = () => tindahanStoreService.refreshFromSqlite();
const getSalesSummary = (period: 'Daily' | 'Weekly' | 'Monthly' = 'Daily') =>
  tindahanStoreService.getSalesSummary(period);
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
const addToCart = (productId: string, deltaQty = 1) =>
  tindahanStoreService.addToCart(productId, deltaQty);
const undoRemoveCartItem = () => tindahanStoreService.undoRemoveCartItem();
const setDiscountPhp = (d: number) => tindahanStoreService.setDiscountPhp(d);
const clearCart = () => tindahanStoreService.clearCart();
const parkCurrentCart = () => tindahanStoreService.parkCurrentCart();
const restoreParkedCart = () => tindahanStoreService.restoreParkedCart();
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
const clearAllDatabaseData = () => tindahanStoreService.clearAllDatabaseData();
const notifyCatalogChanged = () => tindahanStoreService.notifyCatalogChanged();

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
    products: snapshot.products,
    cartSummary: snapshot.cartSummary,
    transactions: snapshot.transactions,
    settings: snapshot.settings,
    utangCustomers: snapshot.utangCustomers,
    refreshFromSqlite,
    getSalesSummary,
    addProductToDatabase,
    lookupOnlineCatalog,
    deleteProductFromDatabase,
    updateProductImage,
    updateProductDetails,
    addToCart,
    undoRemoveCartItem,
    setDiscountPhp,
    clearCart,
    parkCurrentCart,
    restoreParkedCart,
    completeSale,
    voidEntireTransaction,
    processReturnOrExchange,
    adjustInventoryStock,
    addUtangCustomer,
    deleteUtangCustomer,
    recordUtangPayment,
    getMonthlySalesHistory,
    addOrUpdateMonthlySalesRecord,
    updateSettings,
    clearAllDatabaseData,
    notifyCatalogChanged,
  };
}
