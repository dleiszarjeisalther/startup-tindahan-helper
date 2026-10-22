// src/presentation/hooks/useLicensing.ts
import { useSyncExternalStore } from 'react';
import { licensingService, LicensingState } from '../../infrastructure/services/LicensingService';

const registerTrial = licensingService.registerTrial.bind(licensingService);
const verifyPin = licensingService.verifyPin.bind(licensingService);
const submitPaymentProof = licensingService.submitPaymentProof.bind(licensingService);
const checkOnlineApproval = licensingService.checkOnlineApproval.bind(licensingService);
const updateClockCheck = licensingService.updateClockCheck.bind(licensingService);
const isFeatureLocked = licensingService.isFeatureLocked.bind(licensingService);
const syncTrialStatusWithServer = licensingService.syncTrialStatusWithServer.bind(licensingService);
const resetLicensingForTesting = licensingService.resetLicensingForTesting.bind(licensingService);

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
    registerTrial,
    verifyPin,
    submitPaymentProof,
    checkOnlineApproval,
    updateClockCheck,
    isFeatureLocked,
    syncTrialStatusWithServer,
    resetLicensingForTesting,
  };
}
