import { DarkTheme, DefaultTheme, ThemeProvider, router } from 'expo-router';
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
            router.push('/notifications');
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
        <LicensingGate>
          <AppTabs />
        </LicensingGate>
      </TindahanStoreProvider>
    </ThemeProvider>
  );
}
