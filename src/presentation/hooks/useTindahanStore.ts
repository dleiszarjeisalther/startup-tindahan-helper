import { useSyncExternalStore } from 'react';
import { tindahanStoreService } from '../../infrastructure/container';
import { AddProductCommand } from '../../application/ProductOnboardingService';
import { MonthlySalesRecord } from '../../domain/strategies/SeasonalForecastEngine';

const subscribeToStore = (callback: () => void) => tindahanStoreService.subscribe(callback);
const getStoreVersion = () => tindahanStoreService.getVersion();

export function useTindahanStore() {
  const version = useSyncExternalStore(subscribeToStore, getStoreVersion);

  return {
    version,
    isSqliteActive: tindahanStoreService.isSqliteActive,
    products: tindahanStoreService.getProductsSnapshot(),
    cartSummary: tindahanStoreService.getCartSummary(),
    settings: tindahanStoreService.getSettings(),
    utangCustomers: tindahanStoreService.getUtangCustomers(),
    refreshFromSqlite: () => tindahanStoreService.refreshFromSqlite(),
    getSalesSummary: (period: 'Daily' | 'Weekly' | 'Monthly' = 'Daily') =>
      tindahanStoreService.getSalesSummary(period),
    addProductToDatabase: (cmd: AddProductCommand) =>
      tindahanStoreService.addProductToDatabase(cmd),
    lookupOnlineCatalog: (barcode: string) =>
      tindahanStoreService.lookupOnlineCatalog(barcode),
    deleteProductFromDatabase: (productId: string) =>
      tindahanStoreService.deleteProductFromDatabase(productId),
    updateProductImage: (productId: string, imageUri: string) =>
      tindahanStoreService.updateProductImage(productId, imageUri),
    addToCart: (productId: string, deltaQty = 1) =>
      tindahanStoreService.addToCart(productId, deltaQty),
    undoRemoveCartItem: () => tindahanStoreService.undoRemoveCartItem(),
    setDiscountPhp: (d: number) => tindahanStoreService.setDiscountPhp(d),
    clearCart: () => tindahanStoreService.clearCart(),
    parkCurrentCart: () => tindahanStoreService.parkCurrentCart(),
    restoreParkedCart: () => tindahanStoreService.restoreParkedCart(),
    completeSale: (opts: Parameters<typeof tindahanStoreService.completeSale>[0]) =>
      tindahanStoreService.completeSale(opts),
    voidEntireTransaction: (txId: string, reason: string) =>
      tindahanStoreService.voidEntireTransaction(txId, reason),
    processReturnOrExchange: (
      params: Parameters<typeof tindahanStoreService.processReturnOrExchange>[0]
    ) => tindahanStoreService.processReturnOrExchange(params),
    adjustInventoryStock: (
      params: Parameters<typeof tindahanStoreService.adjustInventoryStock>[0]
    ) => tindahanStoreService.adjustInventoryStock(params),
    addUtangCustomer: (
      name: string,
      creditLimitPhp?: number,
      initialBalancePhp?: number
    ) =>
      tindahanStoreService.addUtangCustomer(name, creditLimitPhp, initialBalancePhp),
    deleteUtangCustomer: (customerId: string) =>
      tindahanStoreService.deleteUtangCustomer(customerId),
    recordUtangPayment: (customerId: string, amountPhp: number) =>
      tindahanStoreService.recordUtangPayment(customerId, amountPhp),
    getMonthlySalesHistory: (productId: string) =>
      tindahanStoreService.getMonthlySalesHistory(productId),
    addOrUpdateMonthlySalesRecord: (productId: string, rec: MonthlySalesRecord) =>
      tindahanStoreService.addOrUpdateMonthlySalesRecord(productId, rec),
    updateSettings: (partial: Parameters<typeof tindahanStoreService.updateSettings>[0]) =>
      tindahanStoreService.updateSettings(partial),
    clearAllDatabaseData: () => tindahanStoreService.clearAllDatabaseData(),
    notifyCatalogChanged: () => tindahanStoreService.notifyCatalogChanged(),
  };
}
