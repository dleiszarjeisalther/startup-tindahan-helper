import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { TindahanStoreProvider } from '@/presentation/providers/TindahanStoreProvider';
import { LicensingGate } from '@/presentation/components/LicensingGate';
import '@/infrastructure/services/SoundFeedbackService';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if already prevented in Expo Go reload
});

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {
      // Ignore if already hidden in Expo Go
    });
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <TindahanStoreProvider>
        <LicensingGate>
          <AppTabs />
        </LicensingGate>
      </TindahanStoreProvider>
    </ThemeProvider>
  );
}
