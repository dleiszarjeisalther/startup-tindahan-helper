import React, { createContext, useContext } from 'react';
import { TindahanStoreService } from '@/application/TindahanStoreService';
import { tindahanStoreService } from '@/infrastructure/container';

const TindahanStoreContext = createContext<TindahanStoreService | null>(null);

export function TindahanStoreProvider({ children }: React.PropsWithChildren) {
  return (
    <TindahanStoreContext.Provider value={tindahanStoreService}>
      {children}
    </TindahanStoreContext.Provider>
  );
}

export function useTindahanStoreService(): TindahanStoreService {
  const store = useContext(TindahanStoreContext);
  if (!store) throw new Error('useTindahanStore must be used inside TindahanStoreProvider.');
  return store;
}
