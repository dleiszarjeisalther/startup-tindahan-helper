import { Tabs } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';

// Safe custom tab bar receiving standard React Navigation BottomTabBarProps
function CustomTindahanTabBar(props: any) {
  const insets = useSafeAreaInsets();
  const { cartSummary } = useTindahanStore();

  const activeIndex = props?.state?.index ?? 0;
  const currentRouteName = props?.state?.routes?.[activeIndex]?.name ?? 'index';

  const isHome = currentRouteName === 'index' || currentRouteName === 'products';
  const isSales = currentRouteName === 'sales' || currentRouteName === 'explore';
  const isCheckout = currentRouteName === 'checkout';
  const isInventory = currentRouteName === 'inventory';
  const isMore = currentRouteName === 'more' || currentRouteName === 'settings';

  const handleTabPress = (routeTarget: string) => {
    try {
      if (props?.navigation?.navigate) {
        props.navigation.navigate(routeTarget);
      }
    } catch {
      // Fallback safe no-op
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
        {/* 1. Home (Screen 1: POS / Scan Product) */}
        <Pressable
          style={styles.tabItem}
          onPress={() => handleTabPress('index')}
          hitSlop={8}
        >
          <Text style={[styles.tabIcon, isHome ? styles.tabActiveText : null]}>🏠</Text>
          <Text style={[styles.tabLabel, isHome ? styles.tabActiveText : null]}>
            Home
          </Text>
        </Pressable>

        {/* 2. Sales (Screen 5: Sales History) */}
        <Pressable
          style={styles.tabItem}
          onPress={() => handleTabPress('sales')}
          hitSlop={8}
        >
          <Text style={[styles.tabIcon, isSales ? styles.tabActiveText : null]}>📊</Text>
          <Text style={[styles.tabLabel, isSales ? styles.tabActiveText : null]}>
            Sales
          </Text>
        </Pressable>

        {/* 3. Center Floating Green Cart FAB (Screen 3: New Sale / Checkout) */}
        <View style={styles.centerFabContainer}>
          <Pressable
            style={[styles.centerFab, isCheckout ? styles.centerFabActive : null]}
            onPress={() => handleTabPress('checkout')}
            hitSlop={10}
          >
            <Text style={styles.centerFabIcon}>🛒</Text>
            {cartSummary.totalCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartSummary.totalCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* 4. Inventory (Screen 4: Inventory Management) */}
        <Pressable
          style={styles.tabItem}
          onPress={() => handleTabPress('inventory')}
          hitSlop={8}
        >
          <Text style={[styles.tabIcon, isInventory ? styles.tabActiveText : null]}>
            📦
          </Text>
          <Text style={[styles.tabLabel, isInventory ? styles.tabActiveText : null]}>
            Inventory
          </Text>
        </Pressable>

        {/* 5. More (Screen 6: Menu / Profile - Juan's Store Owner) */}
        <Pressable
          style={styles.tabItem}
          onPress={() => handleTabPress('more')}
          hitSlop={8}
        >
          <Text style={[styles.tabIcon, isMore ? styles.tabActiveText : null]}>•••</Text>
          <Text style={[styles.tabLabel, isMore ? styles.tabActiveText : null]}>
            More
          </Text>
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
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
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
    gap: 2,
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
  },
  centerFabIcon: {
    fontSize: 23,
    color: '#FFFFFF',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
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
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
