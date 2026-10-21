// src/presentation/components/LicensingGate.tsx
import React, { useEffect, useState, createContext, useContext } from 'react';
import { AppState, AppStateStatus, StyleSheet, View } from 'react-native';
import { useLicensing } from '../hooks/useLicensing';
import { OnboardingModal } from './OnboardingModal';
import { TrialExpiredModal } from './TrialExpiredModal';

interface LicensingGateContextType {
  openUpgradeModal: () => void;
}

const LicensingGateContext = createContext<LicensingGateContextType>({
  openUpgradeModal: () => {},
});

export const useLicensingGate = () => useContext(LicensingGateContext);

interface LicensingGateProps {
  children: React.ReactNode;
}

export function LicensingGate({ children }: LicensingGateProps) {
  const { isRegistered, isTrialExpired, isLicensed, updateClockCheck } = useLicensing();
  const [manualUpgradeVisible, setManualUpgradeVisible] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        updateClockCheck();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [updateClockCheck]);

  const openUpgradeModal = () => {
    setManualUpgradeVisible(true);
  };

  const showLockModal = !isLicensed && isTrialExpired;
  const showManualModal = manualUpgradeVisible;

  return (
    <LicensingGateContext.Provider value={{ openUpgradeModal }}>
      <View style={styles.container}>
        {children}

        {/* First-launch Onboarding Registration */}
        <OnboardingModal visible={!isRegistered} />

        {/* Lock Screen or Manual Upgrade Modal */}
        <TrialExpiredModal
          visible={showLockModal || showManualModal}
          canDismiss={!showLockModal && showManualModal}
          onClose={() => setManualUpgradeVisible(false)}
        />
      </View>
    </LicensingGateContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
