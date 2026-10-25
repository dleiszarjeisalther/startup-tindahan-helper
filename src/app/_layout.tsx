import { DarkTheme, DefaultTheme, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { TindahanStoreProvider } from '@/presentation/providers/TindahanStoreProvider';
import { LicensingGate } from '@/presentation/components/LicensingGate';
import { AppUpdatePrompt } from '@/presentation/components/AppUpdatePrompt';
import '@/infrastructure/services/SoundFeedbackService';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore if already prevented in Expo Go reload
});

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    let isMounted = true;
    let subscription: { remove: () => void } | undefined;
    void import('expo-notifications')
      .then((Notifications) => {
        if (!isMounted) return;
        const openNotificationCenter = (
          notification: import('expo-notifications').Notification
        ) => {
          if (notification.request.content.data?.url === '/notifications') {
            router.navigate('/notifications');
          }
        };
        const initial = Notifications.getLastNotificationResponse();
        if (initial?.notification) openNotificationCenter(initial.notification);
        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          openNotificationCenter(response.notification);
        });
      })
      .catch(() => {
        // Expo Go can omit optional native notification modules; in-app alerts still work.
      });
    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <TindahanStoreProvider>
        <View style={{ flex: 1, backgroundColor: '#0D7A52' }}>
          <LicensingGate>
            <AppTabs />
            <AppUpdatePrompt />
          </LicensingGate>
          <AnimatedSplashOverlay />
        </View>
      </TindahanStoreProvider>
    </ThemeProvider>
  );
}
