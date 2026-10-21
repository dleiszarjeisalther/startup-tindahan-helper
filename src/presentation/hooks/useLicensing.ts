// src/presentation/hooks/useLicensing.ts
import { useSyncExternalStore } from 'react';
import { licensingService, LicensingState } from '../../infrastructure/services/LicensingService';

export function useLicensing(): LicensingState & {
  registerTrial: typeof licensingService.registerTrial;
  verifyPin: typeof licensingService.verifyPin;
  submitPaymentProof: typeof licensingService.submitPaymentProof;
  checkOnlineApproval: typeof licensingService.checkOnlineApproval;
  updateClockCheck: typeof licensingService.updateClockCheck;
  isFeatureLocked: typeof licensingService.isFeatureLocked;
  syncTrialStatusWithServer: typeof licensingService.syncTrialStatusWithServer;
  resetLicensingForTesting: typeof licensingService.resetLicensingForTesting;
} {
  const state = useSyncExternalStore(
    licensingService.subscribe,
    licensingService.getSnapshot
  );

  return {
    ...state,
    registerTrial: licensingService.registerTrial.bind(licensingService),
    verifyPin: licensingService.verifyPin.bind(licensingService),
    submitPaymentProof: licensingService.submitPaymentProof.bind(licensingService),
    checkOnlineApproval: licensingService.checkOnlineApproval.bind(licensingService),
    updateClockCheck: licensingService.updateClockCheck.bind(licensingService),
    isFeatureLocked: licensingService.isFeatureLocked.bind(licensingService),
    syncTrialStatusWithServer: licensingService.syncTrialStatusWithServer.bind(licensingService),
    resetLicensingForTesting: licensingService.resetLicensingForTesting.bind(licensingService),
  };
}
