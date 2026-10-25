// src/app/index.tsx — Screen 1: POS / Scan Product (OOP Barcode Scanner Viewfinder + SQLite Backed)
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenSafeAreaView } from '@/presentation/components/ScreenSafeAreaView';
import * as Haptics from 'expo-haptics';
import { useRouter, useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';
import { BarcodeScannerViewfinder } from '@/presentation/components/BarcodeScannerViewfinder';
import { soundFeedbackService } from '@/infrastructure/services/SoundFeedbackService';
import { getTranslations } from '@/presentation/localization/i18n';
import { WeightQuantityModal, WeightQuantityProduct } from '@/presentation/components/WeightQuantityModal';
import { PinChallengeModal } from '@/presentation/components/PinChallengeModal';
import { UnitSelectionModal } from '@/presentation/components/UnitSelectionModal';
import { ConfirmationModal } from '@/presentation/components/ConfirmationModal';
import { ProductDTO } from '@/domain/entities/Product';
import { TrialBanner } from '@/presentation/components/TrialBanner';
import { useLicensing } from '@/presentation/hooks/useLicensing';
import { useLicensingGate } from '@/presentation/components/LicensingGate';
import { StoreAlertsModal } from '@/presentation/components/StoreAlertsModal';

export default function PosScanProductScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const {
    products,
    addToCart,
    setCartItemQuantity,
    cartSummary,
    settings,
    version,
    isStoreSecurityEnabled,
    isStoreLocked,
    isBrownoutSaverActive,
    toggleBrownoutBatterySaver,
    lockStore,
    unlockStore,
    updateProductDetails,
    activeAlerts,
    unreadAlertCount,
    markAlertRead,
    markAllAlertsRead,
  } = useTindahanStore();
  const t = getTranslations(settings?.language);
  const { isFeatureLocked, isLicensed, isRegistered } = useLicensing();
  const { openUpgradeModal } = useLicensingGate();
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyTingi, setOnlyTingi] = useState(false);
  const [liveCameraActive, setLiveCameraActive] = useState(true);
  const [scanToast, setScanToast] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState<{
    type?: 'warning' | 'danger' | 'info' | 'success';
    title: string;
    message: string;
    itemName?: string;
  } | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [lastScannedProductId, setLastScannedProductId] = useState<string | null>(null);
  const [weightModalProduct, setWeightModalProduct] = useState<WeightQuantityProduct | null>(null);
  const [unitModalProduct, setUnitModalProduct] = useState<ProductDTO | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [hasAutoOpenedAlerts, setHasAutoOpenedAlerts] = useState(false);
  const prevAlertCountRef = useRef<number>(0);
  const lastScannedBarcodeRef = useRef<string>('');

  useEffect(() => {
    if (settings?.notifications && unreadAlertCount > 0) {
      if (!hasAutoOpenedAlerts || unreadAlertCount > prevAlertCountRef.current) {
        setShowAlertsModal(true);
        setHasAutoOpenedAlerts(true);
      }
    }
    prevAlertCountRef.current = unreadAlertCount;
  }, [settings?.notifications, unreadAlertCount, hasAutoOpenedAlerts]);

  useEffect(() => {
    if (__DEV__) console.debug('[StoreRender]', { surface: 'Scan', version, cartCount: cartSummary.totalCount });
  }, [version, cartSummary.totalCount]);

  useEffect(() => {
    console.log(`[POS Screen] Screen focus changed: isFocused = ${isFocused}`);
  }, [isFocused]);



  const triggerScanToast = (msg: string) => {
    setScanToast(msg);
    setTimeout(() => {
      setScanToast((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  const tryAddToCart = (
    productId: string,
    successMessage: string,
    unit: 'piece' | 'bundle' | 'pack' | 'box' | 'case' = 'piece'
  ) => {
    if (isFeatureLocked()) {
      openUpgradeModal();
      return false;
    }
    const prod = products.find((p) => p.id === productId);
    try {
      if (prod && prod.expiryDate) {
        const expDate = new Date(prod.expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          setAlertModal({
            type: 'danger',
            title: 'Hala! Expired Na!',
            message: `Ang produktong ito ay expired na noong ${prod.expiryDate}. Mahigpit na ipinagbabawal ang pagbenta nito sa suki.`,
            itemName: prod.name,
          });
          return false;
        } else if (diffDays <= 7) {
          triggerScanToast(`⏳ FEFO: Malapit nang mag-expire (${diffDays} araw)!`);
        }
      }

      const result = addToCart(productId, 1, unit);
      if (result?.fellBackToPiece) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        const unitName =
          result.originalUnit === 'pack'
            ? 'buong pack'
            : result.originalUnit === 'box'
            ? 'buong box'
            : result.originalUnit === 'bundle'
            ? 'bundle'
            : (result.originalUnit ?? 'pack');
        triggerScanToast(
          `⚠️ Kulang na ang stock sa ${unitName} (${result.remainingStock} pcs na lang). Inilagay bilang piraso.`
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        triggerScanToast(successMessage);
      }
      soundFeedbackService.playBarcodeBeep();
      console.log(`[POS Screen] ✓ Added to cart: productId=${productId}, unit=${result?.unitAdded ?? unit}`);
      return true;
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const errorMsg = error instanceof Error ? error.message : 'Could not update the cart. Try again.';
      const isInsufficient =
        errorMsg.toLowerCase().includes('insufficient') ||
        errorMsg.toLowerCase().includes('kulang') ||
        errorMsg.toLowerCase().includes('stock');
      setAlertModal({
        type: isInsufficient ? 'warning' : 'danger',
        title: isInsufficient ? 'Kulang ang Stock' : 'May Error sa Cart',
        message: errorMsg,
        itemName: prod?.name,
      });
      console.log('[POS Screen] Failed to add to cart:', error);
      return false;
    }
  };

  const handleBarcodeDetected = (rawCode: string) => {
    if (!rawCode || typeof rawCode !== 'string') return;
    const clean = rawCode.replace(/\s+/g, '').trim().toUpperCase();
    console.log(`[POS Screen] handleBarcodeDetected received rawCode="${rawCode}", normalized="${clean}"`);
    if (!clean || clean.length < 2) return;
    lastScannedBarcodeRef.current = clean;

    const matched = products.find(
      (p) =>
        p.barcode.toUpperCase() === clean ||
        p.barcode.toUpperCase().endsWith(clean)
    );

    if (matched) {
      console.log(`[POS Screen] ✓ Product matched: "${matched.name}" (ID: ${matched.id}, Price: ₱${matched.defaultPricePhp}, Stock: ${matched.stockCount})`);
      setLastScannedProductId(matched.id);
      if (matched.stockCount <= 0) {
        console.log(`[POS Screen] ⚠️ Product "${matched.name}" is OUT OF STOCK.`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setAlertModal({
          type: 'warning',
          title: 'Out of Stock!',
          message: 'Wala nang natitirang stock ang produktong ito sa imbentaryo.',
          itemName: matched.name,
        });
        return;
      }
      if (matched.unitOfMeasure === 'kg') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setWeightModalProduct({
          id: matched.id,
          name: matched.name,
          defaultPricePhp: matched.defaultPricePhp,
          stockCount: matched.stockCount,
          formattedPrice: matched.formattedPrice,
          unitOfMeasure: matched.unitOfMeasure,
        });
        setUnknownBarcode(null);
        return;
      }
      if (matched.sellingTiers && matched.sellingTiers.length > 1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setUnitModalProduct(matched);
        setUnknownBarcode(null);
        return;
      }
      if (tryAddToCart(matched.id, `✓ Scanned +1 ${matched.name} (${matched.formattedPrice})`)) {
        setUnknownBarcode(null);
      }
    } else {
      console.log(`[POS Screen] Barcode not in catalog: "${clean}" (Prompting quick register banner)`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setUnknownBarcode(clean);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyTingi && p.barcodeSource !== 'GENERATED_TINGI' && p.defaultPricePhp > 20) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [products, onlyTingi, searchQuery]);

  const cartItemStatsByProductId = useMemo(() => {
    const map = new Map<
      string,
      {
        pieceQty: number;
        packQty: number;
        boxQty: number;
        totalKg: number;
        hasInCart: boolean;
        inCartBadgeLabel: string;
      }
    >();

    for (const c of cartSummary.items) {
      let entry = map.get(c.productId);
      if (!entry) {
        entry = {
          pieceQty: 0,
          packQty: 0,
          boxQty: 0,
          totalKg: 0,
          hasInCart: true,
          inCartBadgeLabel: '',
        };
        map.set(c.productId, entry);
      }
      if (!c.unit || c.unit === 'piece') {
        entry.pieceQty += c.quantity;
      } else if (c.unit === 'pack' || c.unit === 'bundle') {
        entry.packQty += c.quantity;
      } else if (c.unit === 'box' || c.unit === 'case') {
        entry.boxQty += c.quantity;
      }
      entry.totalKg += c.quantity;
    }

    for (const [productId, entry] of map.entries()) {
      const prod = products.find((p) => p.id === productId);
      if (prod?.unitOfMeasure === 'kg') {
        entry.inCartBadgeLabel = `${entry.totalKg}kg`;
      } else if (entry.packQty > 0 && entry.pieceQty > 0) {
        entry.inCartBadgeLabel = `${entry.pieceQty}+${entry.packQty}📦`;
      } else if (entry.packQty > 0) {
        entry.inCartBadgeLabel = `×${entry.packQty}📦`;
      } else if (entry.boxQty > 0 && entry.pieceQty > 0) {
        entry.inCartBadgeLabel = `${entry.pieceQty}+${entry.boxQty}📫`;
      } else if (entry.boxQty > 0) {
        entry.inCartBadgeLabel = `×${entry.boxQty}📫`;
      } else {
        entry.inCartBadgeLabel = `×${entry.pieceQty}`;
      }
    }

    return map;
  }, [cartSummary.items, products]);

  const showTrialBanner = !isLicensed && isRegistered;
  const scannerTopInset = 4;

  return (
    <ScreenSafeAreaView style={styles.safeArea} edges={[]}>

      {/* Top App Header Branding — Tindahan Helper */}
      <View style={[styles.topAppHeader, { paddingTop: insets.top + 6 }]}>
        <View style={styles.brandingRow}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.headerLogoIcon}
            resizeMode="contain"
          />
          <View style={styles.brandingTextContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.brandTitleWhite}>Tindahan</Text>
              <Text style={styles.brandTitleAccent}>Helper</Text>
              <View style={styles.brandUtilityPill}>
                <Text style={styles.brandUtilityPillText}>POS</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Right Header Notification Bell */}
        <Pressable
          style={styles.headerNotificationBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setShowAlertsModal(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${unreadAlertCount} hindi pa nababasang abiso`}
        >
          <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
          {unreadAlertCount > 0 ? (
            <View style={styles.headerNotificationBadge}>
              <Text style={styles.headerNotificationBadgeText}>
                {Math.min(99, unreadAlertCount)}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Trial Status Header Pill */}
      {showTrialBanner ? (
        <View style={{ paddingTop: 2 }}>
          <TrialBanner onPressUpgrade={openUpgradeModal} />
        </View>
      ) : null}

      {/* TOP HALF: Camera Barcode Viewfinder with Animated Sweeping Laser (OOP Shared Component) */}
      <BarcodeScannerViewfinder
        isActive={liveCameraActive && isFocused}
        onToggleActive={setLiveCameraActive}
        onBarcodeScanned={handleBarcodeDetected}
        toastMessage={scanToast}
        containerHeight={230 + scannerTopInset}
        topControlInset={scannerTopInset}
        topCenterAction={
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            {isStoreSecurityEnabled ? (
              <Pressable
                style={[
                  styles.rolePill,
                  !isStoreLocked ? styles.rolePillOwner : styles.rolePillCashier,
                ]}
                onPress={() => {
                  if (isStoreLocked) {
                    setShowPinModal(true);
                  } else {
                    lockStore();
                    triggerScanToast('🔒 Naka-lock na ang tindahan');
                  }
                }}
              >
                <Text style={styles.rolePillText}>
                  {!isStoreLocked ? '🔓 Bukas' : '🔒 Naka-lock'}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              style={[
                styles.brownoutBtn,
                isBrownoutSaverActive && styles.brownoutBtnActive,
              ]}
              onPress={() => {
                const next = toggleBrownoutBatterySaver();
                triggerScanToast(next ? '⚡ Brownout Saver Active' : '💡 Normal Display');
              }}
            >
              <Text style={styles.brownoutBtnText}>
                {isBrownoutSaverActive ? '⚡ Eco' : '💡'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.addDbQuickBtn}
              onPress={() => router.navigate('/inventory')}
            >
              <Text style={styles.addDbQuickText}>{t.addProductToDb}</Text>
            </Pressable>
          </View>
        }
        bottomBanner={
          unknownBarcode ? (
            <View style={styles.unknownBanner}>
              <Text style={styles.unknownText}>
                Hindi pa nakalista ang barcode &quot;{unknownBarcode}&quot;
              </Text>
              <Pressable
                style={styles.unknownAddBtn}
                onPress={() => {
                  const codeToRegister = unknownBarcode;
                  setUnknownBarcode(null);
                  router.navigate({
                    pathname: '/inventory',
                    params: { autoBarcode: codeToRegister },
                  });
                }}
              >
                <Text style={styles.unknownAddBtnText}>{t.quickRegisterPrompt}</Text>
              </Pressable>
            </View>
          ) : null
        }
      />

      {/* BOTTOM HALF: White Rounded Sheet with Search & SQLite Product Grid */}
      <View style={styles.bottomSheet}>
        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 6 }} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t.searchPlaceholder}
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Text style={styles.clearSearchText}>✕</Text>
              </Pressable>
            ) : null}
          </View>
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
                {t.filterAll} ({products.length})
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

          <Pressable onPress={() => router.navigate('/products')} hitSlop={6}>
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
                  ? 'Wala Pang Paninda sa Tindahan'
                  : 'Walang Tugmang Paninda'}
              </Text>
              <Text style={styles.emptyCatalogSub}>
                {products.length === 0
                  ? 'Malinis ang iyong talaan ng paninda. Pindutin sa ibaba para magdagdag ng unang paninda na may litrato.'
                  : 'Subukan ang ibang pangalan o barcode ng paninda.'}
              </Text>
              <Pressable
                style={styles.emptyCatalogBtn}
                onPress={() => router.navigate('/inventory')}
              >
                <Text style={styles.emptyCatalogBtnText}>
                  {t.addProductToDb}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {filteredProducts.map((item) => {
                const cartStats = cartItemStatsByProductId.get(item.id);
                const hasInCart = Boolean(cartStats?.hasInCart);
                const inCartBadgeLabel = cartStats?.inCartBadgeLabel ?? '';

                const hasPackTier = Boolean(
                  item.sellingTiers?.some(
                    (t) => (t.unitName === 'pack' || t.unitName === 'bundle') && t.baseUnitMultiplier > 1
                  )
                );

                return (
                  <Pressable
                    key={item.id}
                    style={[
                      styles.productCard,
                      item.stockCount <= 0 ? styles.productCardDisabled : null,
                      item.id === lastScannedProductId ? styles.productCardHighlighted : null,
                    ]}
                    onPress={() => {
                      if (item.stockCount <= 0) {
                        Haptics.notificationAsync(
                          Haptics.NotificationFeedbackType.Warning
                        ).catch(() => {});
                        setAlertModal({
                          type: 'warning',
                          title: 'Out of Stock!',
                          message: 'Wala nang natitirang stock ang produktong ito sa imbentaryo.',
                          itemName: item.name,
                        });
                        return;
                      }
                      if (item.unitOfMeasure === 'kg') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setWeightModalProduct({
                          id: item.id,
                          name: item.name,
                          defaultPricePhp: item.defaultPricePhp,
                          stockCount: item.stockCount,
                          formattedPrice: item.formattedPrice,
                          unitOfMeasure: item.unitOfMeasure,
                        });
                        return;
                      }
                      if (item.sellingTiers && item.sellingTiers.length > 1) {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setUnitModalProduct(item);
                        return;
                      }
                      tryAddToCart(
                        item.id,
                        `✓ +1 ${item.name} (${item.formattedPrice}) idinagdag sa New Sale`
                      );
                    }}
                  >
                    <View style={styles.cardThumbArea}>
                      <ProductThumbnail
                        visual={item.visual}
                        imageUri={item.imageUri}
                        size="lg"
                      />
                      {item.id === lastScannedProductId ? (
                        <View style={styles.scannedBadge}>
                          <Text style={styles.scannedBadgeText}>⚡ Scanned</Text>
                        </View>
                      ) : null}
                      {hasInCart ? (
                        <View style={styles.inCartBadge}>
                          <Text style={styles.inCartBadgeText}>{inCartBadgeLabel}</Text>
                        </View>
                      ) : null}
                      {item.stockCount <= 0 ? (
                        <View style={styles.oosOverlayPill}>
                          <Text style={styles.oosOverlayText}>{t.outOfStock}</Text>
                        </View>
                      ) : null}
                    </View>

                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {item.name}
                    </Text>

                    {hasPackTier ? (
                      <View style={styles.packBadge}>
                        <Text style={styles.packBadgeText}>📦 May Pack</Text>
                      </View>
                    ) : null}

                    <View style={styles.cardFooterRow}>
                      <View>
                        <Text style={styles.cardPrice}>
                          {item.formattedPrice}
                          {item.unitOfMeasure === 'kg' ? '/kg' : ''}
                        </Text>
                        <Text style={styles.cardStockLabel}>
                          Stock: {item.formattedStock} • [{item.barcode}]
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

      <WeightQuantityModal
        visible={weightModalProduct !== null}
        onClose={() => setWeightModalProduct(null)}
        product={weightModalProduct}
        currentQuantity={
          weightModalProduct
            ? cartSummary.items.find((i) => i.productId === weightModalProduct.id)?.quantity ?? 0
            : 0
        }
        onConfirm={(productId, qty) => {
          try {
            setCartItemQuantity(productId, qty);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            triggerScanToast(`✓ ${qty} kg ${weightModalProduct?.name} added to New Sale`);
          } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            const errorMsg = error instanceof Error ? error.message : 'Could not update cart.';
            const isInsufficient =
              errorMsg.toLowerCase().includes('insufficient') ||
              errorMsg.toLowerCase().includes('kulang') ||
              errorMsg.toLowerCase().includes('stock');
            setAlertModal({
              type: isInsufficient ? 'warning' : 'danger',
              title: isInsufficient ? 'Kulang ang Stock' : 'May Error sa Cart',
              message: errorMsg,
              itemName: weightModalProduct?.name,
            });
          }
        }}
      />

      <PinChallengeModal
        visible={showPinModal}
        title="Proteksyon ng Tindahan"
        subtitle="I-scan ang Fingerprint/Face ID o i-enter ang 4-digit PIN"
        onSuccess={() => {
          setShowPinModal(false);
          unlockStore();
          triggerScanToast('🔓 Na-unlock ang tindahan');
        }}
        onCancel={() => setShowPinModal(false)}
      />

      {/* Unit Selection Modal for Multi-Unit Selling (Whole Pack vs Per Piece, Box) */}
      <UnitSelectionModal
        visible={unitModalProduct !== null}
        product={unitModalProduct}
        onClose={() => setUnitModalProduct(null)}
        onSelectUnit={(unit, _multiplier, _price) => {
          if (!unitModalProduct) return;
          const unitLabel =
            unit === 'pack'
              ? 'Whole Pack'
              : unit === 'box'
              ? 'Whole Box'
              : 'Per Piece';
          const success = tryAddToCart(
            unitModalProduct.id,
            `✓ +1 ${unitLabel} (${unitModalProduct.name}) idinagdag sa New Sale`,
            unit
          );
          if (success) {
            setUnitModalProduct(null);
          }
        }}
        onSaveTierConfig={async (tiers) => {
          if (!unitModalProduct) return;
          try {
            await updateProductDetails(unitModalProduct.id, { sellingTiers: tiers });
            triggerScanToast(`✓ Na-update ang pack settings para sa ${unitModalProduct.name}`);
          } catch (e) {
            console.error('[POS Screen] Failed to update tiers:', e);
          }
        }}
      />

      {/* Styled Alert / Confirmation Pop-up Modal */}
      {alertModal ? (
        <ConfirmationModal
          visible={true}
          type={alertModal.type ?? 'warning'}
          title={alertModal.title}
          message={alertModal.message}
          itemName={alertModal.itemName}
          confirmText="Naintindihan"
          cancelText={null}
          onConfirm={() => setAlertModal(null)}
          onCancel={() => setAlertModal(null)}
        />
      ) : null}

      {/* Kailangang Asikasuhin Store Alerts Pop-up Modal */}
      <StoreAlertsModal
        visible={showAlertsModal}
        alerts={activeAlerts}
        unreadCount={unreadAlertCount}
        onClose={() => setShowAlertsModal(false)}
        onMarkAllRead={markAllAlertsRead}
        onMarkRead={markAlertRead}
        onViewAllNotifications={() => {
          setShowAlertsModal(false);
          router.navigate('/notifications');
        }}
        onActionAlert={(alert) => {
          setShowAlertsModal(false);
          markAlertRead(alert.id);
          router.navigate(alert.targetRoute as any);
        }}
      />
    </ScreenSafeAreaView>
  );
}

const styles = StyleSheet.create({
  topAppHeader: {
    backgroundColor: '#0D7A52',
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  brandingTextContainer: {
    justifyContent: 'center',
  },
  brandTitleWhite: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandTitleAccent: {
    color: '#FBBF24',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandUtilityPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginLeft: 2,
  },
  brandUtilityPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerNotificationBtn: {
    position: 'relative',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerNotificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  headerNotificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#0D7A52',
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
  productCardHighlighted: {
    borderColor: '#0D7A52',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  scannedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#0D7A52',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    zIndex: 10,
  },
  scannedBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
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
  packBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    marginBottom: 4,
  },
  packBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#065F46',
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
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
  },
  rolePillOwner: {
    backgroundColor: '#0D7A52',
  },
  rolePillCashier: {
    backgroundColor: '#475569',
  },
  rolePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  brownoutBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#64748B',
  },
  brownoutBtnActive: {
    backgroundColor: '#EAB308',
    borderColor: '#CA8A04',
  },
  brownoutBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
