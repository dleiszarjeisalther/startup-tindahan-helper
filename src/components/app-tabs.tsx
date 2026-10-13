import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { tindahanStoreService } from '@/infrastructure/container';
import { getTranslations } from '@/presentation/localization/i18n';

// Safe custom tab bar receiving standard React Navigation BottomTabBarProps
function CustomTindahanTabBar(props: any) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cartSummary, settings } = useTindahanStore();
  const [, setTick] = React.useState(0);

  // React 19 & Expo SDK 57 Safe Render Rule: Use useState initializer instead of useRef.current
  const heartbeatAnim = React.useState(() => new Animated.Value(1))[0];

  React.useEffect(() => {
    return tindahanStoreService.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, []);

  // Heartbeat pulse animation whenever there are active items in the sale
  React.useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    if (cartSummary.totalCount > 0) {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(heartbeatAnim, {
            toValue: 1.15,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(heartbeatAnim, {
            toValue: 1.0,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(heartbeatAnim, {
            toValue: 1.1,
            duration: 140,
            useNativeDriver: true,
          }),
          Animated.timing(heartbeatAnim, {
            toValue: 1.0,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.delay(650),
        ])
      );
      animLoop.start();
    } else {
      heartbeatAnim.setValue(1);
    }

    return () => {
      if (animLoop) {
        animLoop.stop();
      }
      heartbeatAnim.setValue(1);
    };
  }, [cartSummary.totalCount, heartbeatAnim]);

  const t = getTranslations(settings?.language);

  const activeIndex = props?.state?.index ?? 0;
  const currentRouteName = props?.state?.routes?.[activeIndex]?.name ?? 'index';

  const isScan = currentRouteName === 'index' || currentRouteName === 'products';
  const isSales = currentRouteName === 'sales' || currentRouteName === 'explore';
  const isCheckout = currentRouteName === 'checkout';
  const isInventory = currentRouteName === 'inventory';
  const isMore = currentRouteName === 'more' || currentRouteName === 'settings';

  const handleTabPress = (routeTarget: string) => {
    try {
      if (props?.navigation?.navigate) {
        props.navigation.navigate(routeTarget);
      } else {
        router.navigate(`/${routeTarget}` as any);
      }
    } catch {
      try {
        router.navigate(`/${routeTarget}` as any);
      } catch {
        // Fallback safe no-op
      }
    }
  };

  // Lift floating pill above the phone's system navigation bar (3-button or gesture bar)
  const bottomOffset = Math.max(insets.bottom, 16) + 12;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.floatingWrapper, { bottom: bottomOffset }]}
    >
      <View style={styles.floatingPillBar}>
        {/* 1. Scan (Screen 1: POS / Barcode Scanner) */}
        <Pressable
          style={[styles.tabItem, isScan ? styles.tabItemActive : null]}
          onPress={() => handleTabPress('index')}
          hitSlop={8}
        >
          <Ionicons
            name={isScan ? 'barcode' : 'barcode-outline'}
            size={22}
            color={isScan ? '#0D7A52' : '#6B7280'}
          />
          <Text style={[styles.tabLabel, isScan ? styles.tabActiveText : null]}>
            {t.tabScan}
          </Text>
          {isScan ? <View style={styles.activeDot} /> : null}
        </Pressable>

        {/* 2. Sales (Screen 5: Sales History) */}
        <Pressable
          style={[styles.tabItem, isSales ? styles.tabItemActive : null]}
          onPress={() => handleTabPress('sales')}
          hitSlop={8}
        >
          <Ionicons
            name={isSales ? 'receipt' : 'receipt-outline'}
            size={22}
            color={isSales ? '#0D7A52' : '#6B7280'}
          />
          <Text style={[styles.tabLabel, isSales ? styles.tabActiveText : null]}>
            {t.tabSales}
          </Text>
          {isSales ? <View style={styles.activeDot} /> : null}
        </Pressable>

        {/* 3. Center Floating Green Cart FAB (Screen 3: New Sale / Checkout) */}
        <View style={styles.centerFabContainer}>
          <Animated.View style={{ transform: [{ scale: heartbeatAnim }], overflow: 'visible' }}>
            <Pressable
              style={[styles.centerFab, isCheckout ? styles.centerFabActive : null]}
              onPress={() => handleTabPress('checkout')}
              hitSlop={10}
            >
              <Ionicons name="cart" size={24} color="#FFFFFF" />
            </Pressable>
            {cartSummary.totalCount > 0 ? (
              <View style={styles.cartBadge} pointerEvents="none">
                <Text style={styles.cartBadgeText}>{cartSummary.totalCount}</Text>
              </View>
            ) : null}
          </Animated.View>
        </View>

        {/* 4. Inventory (Screen 4: Inventory Management) */}
        <Pressable
          style={[styles.tabItem, isInventory ? styles.tabItemActive : null]}
          onPress={() => handleTabPress('inventory')}
          hitSlop={8}
        >
          <Ionicons
            name={isInventory ? 'cube' : 'cube-outline'}
            size={22}
            color={isInventory ? '#0D7A52' : '#6B7280'}
          />
          <Text style={[styles.tabLabel, isInventory ? styles.tabActiveText : null]}>
            {t.tabInventory}
          </Text>
          {isInventory ? <View style={styles.activeDot} /> : null}
        </Pressable>

        {/* 5. More (Screen 6: Menu / Profile - Juan's Store Owner) */}
        <Pressable
          style={[styles.tabItem, isMore ? styles.tabItemActive : null]}
          onPress={() => handleTabPress('more')}
          hitSlop={8}
        >
          <Ionicons
            name={isMore ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'}
            size={22}
            color={isMore ? '#0D7A52' : '#6B7280'}
          />
          <Text style={[styles.tabLabel, isMore ? styles.tabActiveText : null]}>
            {t.tabMore}
          </Text>
          {isMore ? <View style={styles.activeDot} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tabs
      tabBar={(props) => <CustomTindahanTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Scan' }} />
      <Tabs.Screen name="products" options={{ title: 'Products', href: null }} />
      <Tabs.Screen name="checkout" options={{ title: 'New Sale' }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory' }} />
      <Tabs.Screen name="sales" options={{ title: 'Sales' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
      <Tabs.Screen name="settings" options={{ title: 'Store Settings', href: null }} />
      <Tabs.Screen name="explore" options={{ title: 'Seasonal Forecast', href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingWrapper: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 100,
  },
  floatingPillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 62,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    paddingHorizontal: 8,
    elevation: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 18,
    gap: 1,
  },
  tabItemActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0D7A52',
    marginTop: 1,
  },
  tabIcon: {
    fontSize: 18,
    color: '#64748B',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabActiveText: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  centerFabContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  centerFab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0D7A52',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    elevation: 8,
    shadowColor: '#0D7A52',
    shadowOpacity: 0.38,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
  centerFabActive: {
    backgroundColor: '#065F46',
    borderColor: '#34D399',
    borderWidth: 3.5,
    shadowColor: '#059669',
    shadowOpacity: 0.5,
    elevation: 12,
  },
  centerFabIcon: {
    fontSize: 23,
    color: '#FFFFFF',
  },
  cartBadge: {
    position: 'absolute',
    top: -22,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 20,
    zIndex: 9999,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
