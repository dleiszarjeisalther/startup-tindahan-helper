// src/app/index.tsx — Screen 1: POS / Scan Product (OOP Barcode Scanner Viewfinder + SQLite Backed)
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';
import { BarcodeScannerViewfinder } from '@/presentation/components/BarcodeScannerViewfinder';

export default function PosScanProductScreen() {
  const router = useRouter();
  const { products, addToCart, cartSummary } = useTindahanStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyTingi, setOnlyTingi] = useState(false);
  const [liveCameraActive, setLiveCameraActive] = useState(false);
  const [scanToast, setScanToast] = useState<string | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);

  const triggerScanToast = (msg: string) => {
    setScanToast(msg);
    setTimeout(() => {
      setScanToast((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  const handleBarcodeDetected = (rawCode: string) => {
    const clean = rawCode.replace(/\s+/g, '').trim().toUpperCase();
    if (!clean) return;
    const matched = products.find(
      (p) =>
        p.barcode.toUpperCase() === clean ||
        p.barcode.toUpperCase().endsWith(clean)
    );
    if (matched) {
      if (matched.stockCount <= 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        triggerScanToast(`⚠️ ${matched.name} is Out of Stock!`);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      addToCart(matched.id, 1);
      setUnknownBarcode(null);
      triggerScanToast(`✓ Scanned +1 ${matched.name} (${matched.formattedPrice})`);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setUnknownBarcode(clean);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (onlyTingi && p.barcodeSource !== 'GENERATED_TINGI' && p.defaultPricePhp > 20) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* TOP HALF: Camera Barcode Viewfinder with Animated Sweeping Laser (OOP Shared Component) */}
      <BarcodeScannerViewfinder
        isActive={liveCameraActive}
        onToggleActive={setLiveCameraActive}
        onBarcodeScanned={handleBarcodeDetected}
        toastMessage={scanToast}
        topCenterAction={
          <Pressable
            style={styles.addDbQuickBtn}
            onPress={() => router.push('/inventory')}
          >
            <Text style={styles.addDbQuickText}>+ Add Product to DB</Text>
          </Pressable>
        }
        bottomBanner={
          unknownBarcode ? (
            <View style={styles.unknownBanner}>
              <Text style={styles.unknownText}>
                Barcode &quot;{unknownBarcode}&quot; not in database
              </Text>
              <Pressable
                style={styles.unknownAddBtn}
                onPress={() => {
                  setUnknownBarcode(null);
                  router.push('/inventory');
                }}
              >
                <Text style={styles.unknownAddBtnText}>+ Register in DB</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      {/* BOTTOM HALF: White Rounded Sheet with Search & SQLite Product Grid */}
      <View style={styles.bottomSheet}>
        {/* Search Bar + Barcode Icon Button */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search product or barcode in database..."
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Text style={styles.clearSearchText}>✕</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={styles.barcodeQuickBtn}
            onPress={() => router.push('/products')}
            hitSlop={6}
          >
            <Text style={styles.barcodeQuickIcon}>[||||]</Text>
          </Pressable>
        </View>

        {/* Sub-row: Quick Filters & Link to Screen 2 (Product List) */}
        <View style={styles.quickActionRow}>
          <View style={styles.filterPillsMini}>
            <Pressable
              style={[styles.miniPill, !onlyTingi ? styles.miniPillActive : null]}
              onPress={() => setOnlyTingi(false)}
            >
              <Text
                style={[styles.miniPillText, !onlyTingi ? styles.miniPillTextActive : null]}
              >
                All Items ({products.length})
              </Text>
            </Pressable>
            <Pressable
              style={[styles.miniPill, onlyTingi ? styles.miniPillActive : null]}
              onPress={() => setOnlyTingi(true)}
            >
              <Text
                style={[styles.miniPillText, onlyTingi ? styles.miniPillTextActive : null]}
              >
                ⚡ Tingi / Sachet
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.push('/products')} hitSlop={6}>
            <Text style={styles.viewAllLink}>+ Add / View All ›</Text>
          </Pressable>
        </View>

        {/* 2x2 Product Grid from SQLite Database */}
        <ScrollView
          contentContainerStyle={styles.gridScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyCatalogCard}>
              <Text style={styles.emptyCatalogTitle}>
                {products.length === 0
                  ? 'No Products in Database Yet'
                  : 'No Matching Products'}
              </Text>
              <Text style={styles.emptyCatalogSub}>
                {products.length === 0
                  ? 'Your SQLite database starts completely clean with zero hardcoded items. Tap below to add your first product with photo.'
                  : 'Try another search term or view all items.'}
              </Text>
              <Pressable
                style={styles.emptyCatalogBtn}
                onPress={() => router.push('/inventory')}
              >
                <Text style={styles.emptyCatalogBtnText}>
                  + Add Product to Database
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {filteredProducts.map((item) => {
                const inCartQty =
                  cartSummary.items.find((c) => c.productId === item.id)?.quantity ?? 0;

                return (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.productCard,
                      item.stockCount <= 0 ? styles.productCardDisabled : null,
                    ]}
                    onPress={() => {
                      if (item.stockCount <= 0) {
                        Haptics.notificationAsync(
                          Haptics.NotificationFeedbackType.Warning
                        ).catch(() => {});
                        triggerScanToast(`⚠️ ${item.name} is Out of Stock`);
                        return;
                      }
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                        () => {}
                      );
                      addToCart(item.id, 1);
                      triggerScanToast(`+1 ${item.name} added to New Sale`);
                    }}
                  >
                    <View style={styles.cardThumbArea}>
                      <ProductThumbnail
                        visual={item.visual}
                        imageUri={item.imageUri}
                        size="lg"
                      />
                      {inCartQty > 0 ? (
                        <View style={styles.inCartBadge}>
                          <Text style={styles.inCartBadgeText}>×{inCartQty}</Text>
                        </View>
                      ) : null}
                      {item.stockCount <= 0 ? (
                        <View style={styles.oosOverlayPill}>
                          <Text style={styles.oosOverlayText}>Out of Stock</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.name}
                    </Text>

                    <View style={styles.cardFooterRow}>
                      <View>
                        <Text style={styles.cardPrice}>{item.formattedPrice}</Text>
                        <Text style={styles.cardStockLabel}>
                          Stock: {item.stockCount} • [{item.barcode}]
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.plusGreenCircle,
                          item.stockCount <= 0 ? styles.plusCircleMuted : null,
                        ]}
                      >
                        <Text style={styles.plusGreenIcon}>+</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scannerSection: {
    height: 254,
    backgroundColor: '#0F172A',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scannerStandbyBackdrop: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#0B1329',
  },
  cameraTopBar: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  camIconBtn: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  camIconBtnActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#34D399',
  },
  camIconText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  addDbQuickBtn: {
    backgroundColor: 'rgba(13, 122, 82, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#34D399',
  },
  addDbQuickText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  reticleWrapper: {
    width: 270,
    height: 130,
    position: 'relative',
    marginTop: 8,
    overflow: 'hidden',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 28,
    height: 28,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#22C55E',
    borderTopLeftRadius: 10,
    zIndex: 5,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#22C55E',
    borderTopRightRadius: 10,
    zIndex: 5,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 28,
    height: 28,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#22C55E',
    borderBottomLeftRadius: 10,
    zIndex: 5,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#22C55E',
    borderBottomRightRadius: 10,
    zIndex: 5,
  },
  laserBeamWrapper: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 6,
    zIndex: 4,
  },
  laserCoreLine: {
    height: 2.5,
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  laserGlowAura: {
    height: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.45)',
    borderRadius: 3,
    marginTop: -4,
    shadowColor: '#EF4444',
    shadowOpacity: 0.95,
    shadowRadius: 8,
    elevation: 6,
  },
  reticleCenterGuide: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.35,
  },
  reticleCenterText: {
    color: '#86EFAC',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 8,
  },
  scannerHint: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  scanToastPill: {
    position: 'absolute',
    bottom: 8,
    backgroundColor: '#065F46',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#34D399',
    zIndex: 20,
  },
  scanToastText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  unknownBanner: {
    position: 'absolute',
    bottom: 8,
    left: 16,
    right: 16,
    backgroundColor: '#7F1D1D',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 20,
  },
  unknownText: {
    color: '#FECACA',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  unknownAddBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  unknownAddBtnText: {
    color: '#7F1D1D',
    fontWeight: '800',
    fontSize: 11,
  },
  bottomSheet: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -10,
    paddingTop: 14,
    paddingHorizontal: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
  },
  clearSearchText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  barcodeQuickBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barcodeQuickIcon: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0D7A52',
  },
  quickActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  filterPillsMini: {
    flexDirection: 'row',
    gap: 6,
  },
  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  miniPillActive: {
    backgroundColor: '#0D7A52',
  },
  miniPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  miniPillTextActive: {
    color: '#FFFFFF',
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D7A52',
  },
  gridScroll: {
    paddingBottom: 120,
  },
  emptyCatalogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  emptyCatalogTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  emptyCatalogSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyCatalogBtn: {
    marginTop: 6,
    backgroundColor: '#0D7A52',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  emptyCatalogBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  productCard: {
    width: '48.2%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  productCardDisabled: {
    opacity: 0.65,
  },
  cardThumbArea: {
    height: 82,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  inCartBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#0D7A52',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  inCartBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  oosOverlayPill: {
    position: 'absolute',
    bottom: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  oosOverlayText: {
    color: '#B91C1C',
    fontSize: 10,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  cardStockLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  plusGreenCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0D7A52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusCircleMuted: {
    backgroundColor: '#94A3B8',
  },
  plusGreenIcon: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
});
