// src/app/products.tsx — Screen 2: Product List (SQLite Database Backed + Image Capture)
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ScreenSafeAreaView } from '@/presentation/components/ScreenSafeAreaView';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';
import { BarcodeInputField } from '@/presentation/components/BarcodeInputField';
import { useIdempotentSubmit } from '@/presentation/hooks/useIdempotentSubmit';
import { getTranslations } from '@/presentation/localization/i18n';
import { FloatingToast, ToastType } from '@/presentation/components/FloatingToast';
import { WeightQuantityModal, WeightQuantityProduct } from '@/presentation/components/WeightQuantityModal';
import {
  ConfirmationModal,
  ConfirmationType,
} from '@/presentation/components/ConfirmationModal';
import { SellingUnitTier } from '@/domain/entities/Product';
import { Money } from '@/domain/value-objects/Money';

export default function ProductListScreen() {
  const router = useRouter();
  const {
    products,
    categories,
    addToCart,
    setCartItemQuantity,
    addProductToDatabase,
    cartSummary,
    settings,
    lookupOnlineCatalog,
  } = useTindahanStore();
  const t = getTranslations(settings?.language);

  const filterCategories = ['All', ...categories];

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>('success');
  const showToast = (msg: string, type: ToastType = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };
  const [weightModalProduct, setWeightModalProduct] = useState<WeightQuantityProduct | null>(null);
  const [alertModal, setAlertModal] = useState<{
    type?: ConfirmationType;
    title: string;
    message: string;
    itemName?: string;
  } | null>(null);

  // Pagination state (12 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Add Product Form State
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(categories[0] ?? 'Snacks');
  const [newBarcode, setNewBarcode] = useState('');
  const [barcodeMode, setBarcodeMode] = useState<'SCAN' | 'MANUAL' | 'GENERATE_TINGI'>('MANUAL');
  const [packagingType, setPackagingType] = useState<'PACK' | 'PIECE' | 'KG'>('PACK');
  const [newPricePhp, setNewPricePhp] = useState('');
  const [newCostPhp, setNewCostPhp] = useState('');
  const [bundleCostPhp, setBundleCostPhp] = useState('');
  const [packPiecesCount, setPackPiecesCount] = useState('10');
  const [bundlePacksCount, setBundlePacksCount] = useState('5');
  const [newStock, setNewStock] = useState('');
  const [newLowThreshold, setNewLowThreshold] = useState('5');
  const [newExpiryDate, setNewExpiryDate] = useState('');
  const [tuboMode, setTuboMode] = useState<'PESO' | 'PERCENT'>('PESO');
  const [tuboValue, setTuboValue] = useState('');
  const [packPricePhp, setPackPricePhp] = useState('');
  const [packBarcode, setPackBarcode] = useState('');
  const [packMultiplier, setPackMultiplier] = useState('10');

  // Online catalog lookup state
  const [isLookingUpOnline, setIsLookingUpOnline] = useState(false);
  const [onlineNotice, setOnlineNotice] = useState<string | null>(null);
  const lookupSeqRef = useRef(0);
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Math & Pricing derivations
  const packPiecesCountNum = parseInt(packPiecesCount.replace(/[^0-9]/g, '') || '10', 10);
  const bundlePacksCountNum = parseInt(bundlePacksCount.replace(/[^0-9]/g, '') || '0', 10);
  const parsedStock =
    packagingType === 'KG'
      ? parseFloat(newStock.replace(/[^0-9.]/g, '') || '0')
      : packagingType === 'PACK'
      ? (bundlePacksCountNum > 0 ? bundlePacksCountNum : 1) * (packPiecesCountNum > 0 ? packPiecesCountNum : 10)
      : parseInt(newStock.replace(/[^0-9]/g, '') || '0', 10);

  const bundleCostParsed = parseFloat(bundleCostPhp.replace(/[^0-9.]/g, '') || '0');
  const pieceCostParsed = parseFloat(newCostPhp.replace(/[^0-9.]/g, '') || '0');

  const effectiveUnitCost = useMemo(() => {
    if (packagingType === 'PACK') {
      if (bundleCostParsed > 0) {
        return Number((bundleCostParsed / (packPiecesCountNum > 0 ? packPiecesCountNum : 10)).toFixed(2));
      }
      return pieceCostParsed > 0 ? pieceCostParsed : 0;
    }
    return pieceCostParsed > 0 ? pieceCostParsed : 0;
  }, [packagingType, bundleCostParsed, packPiecesCountNum, pieceCostParsed]);

  const currentEnteredPrice = parseFloat(newPricePhp.replace(/[^0-9.]/g, '') || '0');

  const profitPerPiece = useMemo(() => {
    if (currentEnteredPrice > 0 && effectiveUnitCost > 0) {
      return Number(Math.max(0, currentEnteredPrice - effectiveUnitCost).toFixed(2));
    }
    return 0;
  }, [currentEnteredPrice, effectiveUnitCost]);

  const totalBatchProfit = useMemo(() => {
    return Number((profitPerPiece * (parsedStock > 0 ? parsedStock : 1)).toFixed(2));
  }, [profitPerPiece, parsedStock]);

  const totalCapitalSpent = useMemo(() => {
    return Number((effectiveUnitCost * (parsedStock > 0 ? parsedStock : 0)).toFixed(2));
  }, [effectiveUnitCost, parsedStock]);

  const handleTuboChange = (val: string, mode: 'PESO' | 'PERCENT' = tuboMode) => {
    setTuboValue(val);
    const num = parseFloat(val.replace(/[^0-9.]/g, '') || '0');
    if (effectiveUnitCost > 0) {
      let nextPrice = 0;
      if (mode === 'PESO') {
        nextPrice = Number((effectiveUnitCost + num).toFixed(2));
      } else {
        nextPrice = Number((effectiveUnitCost * (1 + num / 100)).toFixed(2));
      }
      setNewPricePhp(nextPrice > 0 ? nextPrice.toString() : '');
    }
  };

  const handlePriceChange = (val: string) => {
    setNewPricePhp(val);
    const num = parseFloat(val.replace(/[^0-9.]/g, '') || '0');
    if (effectiveUnitCost > 0 && num > 0) {
      const diff = Math.max(0, num - effectiveUnitCost);
      if (tuboMode === 'PESO') {
        setTuboValue(diff > 0 ? diff.toFixed(2) : '0');
      } else {
        const pct = (diff / effectiveUnitCost) * 100;
        setTuboValue(pct > 0 ? pct.toFixed(0) : '0');
      }
    }
  };

  const handleQuickTubo = (amount: number, isPercent: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isPercent) {
      setTuboMode('PERCENT');
      handleTuboChange(amount.toString(), 'PERCENT');
    } else {
      setTuboMode('PESO');
      handleTuboChange(amount.toString(), 'PESO');
    }
  };

  const roundingSuggestions = useMemo(() => {
    if (currentEnteredPrice <= 0) return [];
    const isDecimal = currentEnteredPrice % 1 !== 0;
    if (!isDecimal) return [];

    const floorVal = Math.floor(currentEnteredPrice);
    const ceilVal = Math.ceil(currentEnteredPrice);
    const list: number[] = [];

    if (floorVal > effectiveUnitCost && floorVal > 0) {
      list.push(floorVal);
    }
    if (ceilVal > 0 && ceilVal !== floorVal) {
      list.push(ceilVal);
    }
    return list;
  }, [currentEnteredPrice, effectiveUnitCost]);

  const performOnlineLookup = useCallback(
    async (codeToLookup: string) => {
      const clean = codeToLookup.replace(/[\s-]/g, '').trim();
      if (!clean || clean.length < 6) return;

      const currentSeq = ++lookupSeqRef.current;
      setIsLookingUpOnline(true);
      setOnlineNotice(null);

      try {
        const res = await lookupOnlineCatalog(clean);
        if (lookupSeqRef.current !== currentSeq) return;

        if (res?.found) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          if (res.productName) setNewName(res.productName);
          if (res.imageUrl) setNewImageUri(res.imageUrl);
          if (res.inferredCategory) setNewCategory(res.inferredCategory);
          const srcTag = res.source ? ` [${res.source}]` : '';
          setOnlineNotice(
            `✓ Nahanap ang paninda online${srcTag}: "${res.productName ?? 'Paninda'}" (Nailagay na ang litrato at pangalan)`
          );
        } else {
          setOnlineNotice('ℹ️ Hindi nahanap online. Maaari mong ilagay ang pangalan at litrato nang mano-mano o i-tap ang "Maghanap Online".');
        }
      } catch {
        if (lookupSeqRef.current === currentSeq) {
          setOnlineNotice('ℹ️ Hindi makakonekta online. I-tap ang "Maghanap Online" para subukan ulit.');
        }
      } finally {
        if (lookupSeqRef.current === currentSeq) {
          setIsLookingUpOnline(false);
        }
      }
    },
    [lookupOnlineCatalog]
  );

  const handleBarcodeChange = useCallback(
    (code: string, mode: 'SCAN' | 'MANUAL' | 'GENERATE_TINGI') => {
      setOnlineNotice(null);
      setBarcodeMode(mode);

      if (lookupTimerRef.current) {
        clearTimeout(lookupTimerRef.current);
        lookupTimerRef.current = null;
      }

      if (mode === 'GENERATE_TINGI') {
        setNewBarcode('AUTO-TINGI-CODE');
        return;
      }

      setNewBarcode(code);

      const clean = code.replace(/[\s-]/g, '').trim();
      if (!clean) return;

      const existing = products.find((p) => p.barcode === clean);
      if (existing) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setAlertModal({
          type: 'warning',
          title: 'Nasa Tindahan Na!',
          message: `Ang panindang "${existing.name}" (${existing.barcode}) ay nakalista na sa tindahan.`,
          itemName: existing.name,
        });
        return;
      }

      if (mode === 'SCAN') {
        performOnlineLookup(clean);
      } else if (clean.length >= 8) {
        lookupTimerRef.current = setTimeout(() => {
          performOnlineLookup(clean);
        }, 450);
      }
    },
    [products, performOnlineLookup, setAlertModal]
  );

  useEffect(() => {
    return () => {
      if (lookupTimerRef.current) {
        clearTimeout(lookupTimerRef.current);
      }
    };
  }, []);

  const resetForm = useCallback(() => {
    setNewName('');
    setNewBarcode('');
    setBarcodeMode('MANUAL');
    setNewPricePhp('');
    setNewCostPhp('');
    setBundleCostPhp('');
    setPackPiecesCount('10');
    setBundlePacksCount('5');
    setNewStock('');
    setNewLowThreshold('5');
    setNewExpiryDate('');
    setTuboMode('PESO');
    setTuboValue('');
    setPackPricePhp('');
    setPackBarcode('');
    setPackMultiplier('10');
    setPackagingType('PACK');
    setNewImageUri(null);
    setOnlineNotice(null);
  }, []);

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showToast('Kailangan ng pahintulot sa Camera upang makakuha ng litrato ng paninda.', 'warning');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setNewImageUri(result.assets[0].uri);
      }
    } catch {
      showToast('Hindi mabuksan ang camera.', 'error');
    }
  };

  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast('Kailangan ng pahintulot sa Gallery upang makapili ng litrato ng paninda.', 'warning');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setNewImageUri(result.assets[0].uri);
      }
    } catch {
      showToast('Hindi mabuksan ang photo gallery.', 'error');
    }
  };

  const { trigger: handleSaveProduct, isSubmitting } = useIdempotentSubmit(async () => {
    try {
      if (!newName.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setAlertModal({
          type: 'warning',
          title: 'Kulang ang Pangalan',
          message: 'Mangyaring maglagay ng pangalan ng paninda bago mag-save.',
        });
        return;
      }

      if (barcodeMode !== 'GENERATE_TINGI' && !newBarcode.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setAlertModal({
          type: 'warning',
          title: 'Kulang ang Barcode',
          message: 'Mangyaring mag-scan, mag-type, o mag-generate ng barcode para sa paninda.',
        });
        return;
      }

      const cleanBarcode = newBarcode.trim();
      const existingByBarcode =
        barcodeMode !== 'GENERATE_TINGI'
          ? products.find((p) => p.barcode === cleanBarcode)
          : null;

      if (existingByBarcode) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setAlertModal({
          type: 'warning',
          title: 'May Parehong Barcode',
          message: `Ang barcode na "${cleanBarcode}" ay ginagamit na ng panindang "${existingByBarcode.name}".`,
          itemName: existingByBarcode.name,
        });
        return;
      }

      const cleanName = newName.trim().toLowerCase();
      const existingByName = products.find((p) => p.name.trim().toLowerCase() === cleanName);
      if (existingByName) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setAlertModal({
          type: 'warning',
          title: 'May Parehong Pangalan',
          message: `Ang panindang "${existingByName.name}" ay nakalista na sa tindahan (Barcode: ${existingByName.barcode}).`,
          itemName: existingByName.name,
        });
        return;
      }

      const priceMoney = Money.fromPhp(parseFloat(newPricePhp.replace(/[^0-9.]/g, '') || '0'));
      if (priceMoney.centavos <= 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setAlertModal({
          type: 'warning',
          title: 'Maling Presyo',
          message: 'Mangyaring maglagay ng wastong presyo ng benta na mas mataas sa ₱0.',
        });
        return;
      }

      const costMoney = Money.fromPhp(effectiveUnitCost);
      if (costMoney.centavos > 0 && priceMoney.centavos > 0 && costMoney.centavos >= priceMoney.centavos) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setAlertModal({
          type: 'warning',
          title: 'Suriin ang Puhunan at Presyo',
          message: `Ang puhunan (${costMoney.format()}) ay mas mataas o kapantay ng presyo ng benta (${priceMoney.format()}). Pakisuri kung Buong Balot ang nailagay.`,
        });
        return;
      }

      let finalStock = 0;
      if (packagingType === 'KG') {
        finalStock = parseFloat(newStock.replace(/[^0-9.]/g, '') || '0');
      } else if (packagingType === 'PACK') {
        finalStock =
          (bundlePacksCountNum > 0 ? bundlePacksCountNum : 1) * (packPiecesCountNum > 0 ? packPiecesCountNum : 10);
      } else {
        finalStock = parseInt(newStock.replace(/[^0-9]/g, '') || '0', 10);
      }
      const parsedLow = parseInt(newLowThreshold.replace(/[^0-9]/g, '') || '5', 10);

      let tiers: SellingUnitTier[] | undefined;
      if (packagingType === 'PACK') {
        const pMult = packPiecesCountNum > 0 ? packPiecesCountNum : 10;
        let pPrice = parseFloat(packPricePhp.replace(/[^0-9.]/g, '') || '0');
        if (pPrice <= 0) {
          pPrice = priceMoney.php * pMult;
        }
        tiers = [
          { unitName: 'piece', baseUnitMultiplier: 1, unitPricePhp: priceMoney.php },
          {
            unitName: 'pack',
            baseUnitMultiplier: pMult,
            unitPricePhp: pPrice,
            barcode: packBarcode.trim() || undefined,
          },
        ];
      }

      const finalCostPhp =
        costMoney.centavos > 0
          ? costMoney.php
          : Math.max(0.5, priceMoney.php * 0.75);

      const res = await addProductToDatabase({
        name: newName.trim(),
        category: newCategory,
        barcodeInputMode: barcodeMode,
        rawBarcodeValue: newBarcode,
        initialStock: Number.isFinite(finalStock) ? finalStock : 0,
        lowStockThreshold: Number.isFinite(parsedLow) ? parsedLow : 5,
        unitCostPhp: finalCostPhp,
        unitPricePhp: priceMoney.php,
        imageUri: newImageUri ?? undefined,
        unitOfMeasure: packagingType === 'KG' ? 'kg' : 'pc',
        expiryDate: newExpiryDate.trim() || undefined,
        sellingTiers: tiers,
      });

      if (res.status === 'DUPLICATE_BARCODE_FOUND') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setAlertModal({
          type: 'warning',
          title: 'May Parehong Barcode',
          message: res.message,
          itemName: newName,
        });
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(`✓ Naidagdag ang "${res.product.name}" [${res.product.barcode}] sa tindahan`, 'success');
      resetForm();
      setShowAddForm(false);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const msg = err instanceof Error ? err.message : 'Hindi mai-save ang paninda.';
      setAlertModal({
        type: 'danger',
        title: 'Error sa Pag-save',
        message: msg,
        itemName: newName,
      });
    }
  });

  const filtered = products.filter((p) => {
    const catMatch = selectedCategory === 'All' || p.category === selectedCategory;
    if (!catMatch) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  return (
    <ScreenSafeAreaView style={styles.safeArea}>
      <FloatingToast
        message={toastMsg}
        type={toastType}
        onDismiss={() => setToastMsg(null)}
      />

      {/* Top Header: <- Products | + Add Product */}
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>Products ({products.length})</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.navigate({ pathname: '/inventory', params: { openAdd: 'true' } });
          }}
        >
          <Ionicons name="add" size={16} color="#FFFFFF" style={{ marginRight: 2 }} />
          <Text style={styles.addBtnText}>Add Product</Text>
        </Pressable>
      </View>

      {/* Search Bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
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
              <Text style={styles.clearIcon}>✕</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Category Filter Pills */}
      <View style={styles.pillsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContent}
        >
          {filterCategories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                style={[styles.categoryPill, active ? styles.categoryPillActive : null]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    active ? styles.categoryPillTextActive : null,
                  ]}
                >
                  {cat === 'All' ? t.filterAll : cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Slide-Up Add Product Modal */}
      <Modal
        visible={showAddForm}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowAddForm(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdropContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.modalBackdropPressable}
            onPress={() => setShowAddForm(false)}
          />
          <View style={styles.modalContentCard}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderTitleGroup}>
                <View style={styles.modalHeaderIconBadge}>
                  <Ionicons name="add-circle" size={20} color="#0D7A52" />
                </View>
                <View>
                  <Text style={styles.modalTitleText}>Magdagdag ng Paninda</Text>
                  <Text style={styles.modalSubtitleBarcode}>
                    Ilagay ang detalye at presyo ng paninda
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setShowAddForm(false)}
                hitSlop={10}
                style={styles.modalCloseCircle}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.modalScrollContent}
            >
              {/* Photo Selection Row */}
              <Text style={styles.fieldLabel}>Litrato ng Paninda (Camera / Gallery):</Text>
              <View style={styles.photoPickerRow}>
                {newImageUri ? (
                  <View style={styles.photoPreviewContainer}>
                    <Image
                      source={{ uri: newImageUri }}
                      style={styles.photoPreviewImage}
                      contentFit="cover"
                      transition={150}
                      cachePolicy="memory-disk"
                    />
                    <Pressable
                      style={styles.photoRemoveBtn}
                      hitSlop={8}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setNewImageUri(null);
                      }}
                    >
                      <Text style={styles.photoRemoveBtnText}>✕</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.photoPlaceholderBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      handlePickImage();
                    }}
                  >
                    <Ionicons name="camera-outline" size={24} color="#94A3B8" />
                    <Text style={styles.photoPlaceholderText}>Walang Litrato</Text>
                  </Pressable>
                )}

                <View style={styles.photoActionsCol}>
                  <Pressable
                    style={styles.cameraBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      handleTakePhoto();
                    }}
                  >
                    <Ionicons name="camera" size={16} color="#FFFFFF" />
                    <Text style={styles.cameraBtnText}>
                      {newImageUri ? 'Kumuha Muli' : 'Kumuha sa Camera'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.galleryBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      handlePickImage();
                    }}
                  >
                    <Ionicons name="images" size={16} color="#334155" />
                    <Text style={styles.galleryBtnText}>
                      {newImageUri ? 'Palitan sa Gallery' : 'Pumili sa Gallery'}
                    </Text>
                  </Pressable>
                </View>
              </View>

              <BarcodeInputField
                label="Barcode ng Paninda (I-scan o I-type) *"
                placeholder="I-type o i-scan gamit ang camera"
                value={newBarcode}
                onChangeBarcode={handleBarcodeChange}
                errorMessage={null}
              />

              {/* Online Lookup Status Badge & Action */}
              {isLookingUpOnline ? (
                <View style={styles.onlineBadgeLoading}>
                  <Text style={styles.onlineBadgeTextLoading}>
                    🔍 Hinahanap ang paninda sa online catalog...
                  </Text>
                </View>
              ) : (
                <View style={styles.onlineNoticeContainer}>
                  {onlineNotice ? (
                    <View
                      style={
                        onlineNotice.startsWith('✓')
                          ? styles.onlineBadgeSuccess
                          : styles.onlineBadgeNeutral
                      }
                    >
                      <Text
                        style={
                          onlineNotice.startsWith('✓')
                            ? styles.onlineBadgeTextSuccess
                            : styles.onlineBadgeTextNeutral
                        }
                      >
                        {onlineNotice}
                      </Text>
                    </View>
                  ) : null}

                  {newBarcode.trim().length >= 6 &&
                  newBarcode !== 'AUTO-TINGI-CODE' &&
                  (!onlineNotice || !onlineNotice.startsWith('✓')) ? (
                    <Pressable
                      style={styles.retryOnlineBtn}
                      onPress={() => performOnlineLookup(newBarcode)}
                      hitSlop={8}
                    >
                      <Ionicons name="search" size={13} color="#0D7A52" />
                      <Text style={styles.retryOnlineBtnText}>
                        Maghanap Online (Search Catalog)
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}

              <Text style={styles.fieldLabel}>Pangalan ng Paninda *</Text>
              <TextInput
                style={styles.textInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="hal. Piattos BBQ 85g o Bear Brand 33g"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
              />

              <Text style={styles.fieldLabel}>Kategorya *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catRow}
              >
                {categories.map((cat) => {
                  const active = newCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[styles.catChip, active ? styles.catChipActive : null]}
                      onPress={() => setNewCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          active ? styles.catChipTextActive : null,
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* 1. URI NG PANINDA & PAGBENTA (3 Modes) */}
              <Text style={styles.fieldLabel}>Uri ng Paninda at Pagbenta *</Text>
              <View style={styles.unitSelectorRow}>
                <Pressable
                  style={[styles.unitToggleBtn, packagingType === 'PACK' && styles.unitToggleBtnActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setPackagingType('PACK');
                    if (!packMultiplier || packMultiplier === '0') setPackMultiplier(packPiecesCount || '10');
                    const pcs = packPiecesCountNum > 0 ? packPiecesCountNum : 10;
                    if (pieceCostParsed > 0 && (!bundleCostPhp || parseFloat(bundleCostPhp) === 0)) {
                      setBundleCostPhp((pieceCostParsed * pcs).toFixed(2));
                    }
                    const curStock = parseInt(newStock.replace(/[^0-9]/g, '') || '0', 10);
                    if (curStock > 0 && (!bundlePacksCount || parseInt(bundlePacksCount, 10) === 0)) {
                      setBundlePacksCount(String(Math.max(1, Math.floor(curStock / pcs))));
                    }
                  }}
                >
                  <Ionicons
                    name="layers-outline"
                    size={15}
                    color={packagingType === 'PACK' ? '#0D7A52' : '#64748B'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.unitToggleText, packagingType === 'PACK' && styles.unitToggleTextActive]}>
                    📦 Naka-Pack
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.unitToggleBtn, packagingType === 'PIECE' && styles.unitToggleBtnActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setPackagingType('PIECE');
                    const pcs = packPiecesCountNum > 0 ? packPiecesCountNum : 10;
                    const bCost = parseFloat(bundleCostPhp.replace(/[^0-9.]/g, '') || '0');
                    if (bCost > 0) {
                      setNewCostPhp((bCost / pcs).toFixed(2));
                    }
                    const bPacks = parseInt(bundlePacksCount.replace(/[^0-9]/g, '') || '0', 10);
                    if (bPacks > 0) {
                      setNewStock(String(bPacks * pcs));
                    } else if (packPiecesCount) {
                      setNewStock(String(pcs));
                    }
                  }}
                >
                  <Ionicons
                    name="cube-outline"
                    size={15}
                    color={packagingType === 'PIECE' ? '#0D7A52' : '#64748B'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.unitToggleText, packagingType === 'PIECE' && styles.unitToggleTextActive]}>
                    🏷️ Tingi Lang
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.unitToggleBtn, packagingType === 'KG' && styles.unitToggleBtnActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setPackagingType('KG');
                  }}
                >
                  <Ionicons
                    name="scale"
                    size={15}
                    color={packagingType === 'KG' ? '#0D7A52' : '#64748B'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.unitToggleText, packagingType === 'KG' && styles.unitToggleTextActive]}>
                    ⚖️ Kilo (kg)
                  </Text>
                </Pressable>
              </View>

              {/* 2. DYNAMIC INPUTS ACCORDING TO PACKAGING TYPE */}
              {packagingType === 'PACK' ? (
                /* PACK MODE: Auto-fill from Wholesale Pack Cost & Count */
                <View style={{ gap: 10 }}>
                  <View style={styles.costSectionCard}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#166534', marginBottom: 2 }}>
                      🧾 Puhunan sa Resibo (Wholesale Pack)
                    </Text>
                    <View style={styles.twoColRow}>
                      <View style={{ flex: 1.2 }}>
                        <Text style={styles.fieldLabel}>Presyo ng 1 Pack (₱) *</Text>
                        <TextInput
                          style={styles.textInput}
                          value={bundleCostPhp}
                          onChangeText={(val) => {
                            setBundleCostPhp(val);
                            const bCost = parseFloat(val.replace(/[^0-9.]/g, '') || '0');
                            const pcs = packPiecesCountNum > 0 ? packPiecesCountNum : 10;
                            const costNum = bCost > 0 ? bCost / pcs : 0;
                            if (costNum > 0) {
                              setNewCostPhp(costNum.toFixed(2));
                            }
                            if (tuboValue && costNum > 0) {
                              const tuboNum = parseFloat(tuboValue.replace(/[^0-9.]/g, '') || '0');
                              const nextPrice =
                                tuboMode === 'PESO'
                                  ? costNum + tuboNum
                                  : costNum * (1 + tuboNum / 100);
                              setNewPricePhp(nextPrice > 0 ? nextPrice.toFixed(2) : '');
                            }
                          }}
                          placeholder="Hal. 100.00"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={{ flex: 0.9 }}>
                        <Text style={styles.fieldLabel}>Piraso sa 1 Pack *</Text>
                        <TextInput
                          style={styles.textInput}
                          value={packPiecesCount}
                          onChangeText={(val) => {
                            setPackPiecesCount(val);
                            setPackMultiplier(val);
                            const bCost = parseFloat(bundleCostPhp.replace(/[^0-9.]/g, '') || '0');
                            const pcs = parseInt(val.replace(/[^0-9]/g, '') || '10', 10);
                            const costNum = bCost > 0 && pcs > 0 ? bCost / pcs : 0;
                            if (costNum > 0) {
                              setNewCostPhp(costNum.toFixed(2));
                            }
                            const bPacks = parseInt(bundlePacksCount.replace(/[^0-9]/g, '') || '0', 10);
                            if (bPacks > 0 && pcs > 0) {
                              setNewStock(String(bPacks * pcs));
                            }
                            if (tuboValue && costNum > 0) {
                              const tuboNum = parseFloat(tuboValue.replace(/[^0-9.]/g, '') || '0');
                              const nextPrice =
                                tuboMode === 'PESO'
                                  ? costNum + tuboNum
                                  : costNum * (1 + tuboNum / 100);
                              setNewPricePhp(nextPrice > 0 ? nextPrice.toFixed(2) : '');
                            }
                          }}
                          placeholder="10"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                        />
                      </View>
                      <View style={{ flex: 0.9 }}>
                        <Text style={styles.fieldLabel}>Ilang Pack Binili? *</Text>
                        <TextInput
                          style={styles.textInput}
                          value={bundlePacksCount}
                          onChangeText={(val) => {
                            setBundlePacksCount(val);
                            const bPacks = parseInt(val.replace(/[^0-9]/g, '') || '0', 10);
                            const pcs = packPiecesCountNum > 0 ? packPiecesCountNum : 10;
                            if (bPacks > 0 && pcs > 0) {
                              setNewStock(String(bPacks * pcs));
                            }
                          }}
                          placeholder="5"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    <View style={styles.twoColRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Mababang Stock Alert (piraso):</Text>
                        <TextInput
                          style={styles.textInput}
                          value={newLowThreshold}
                          onChangeText={setNewLowThreshold}
                          placeholder="5"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    {/* Auto-Compute Sneak Peek Banner */}
                    {effectiveUnitCost > 0 ? (
                      <View style={styles.sneakPeekBanner}>
                        <View style={styles.sneakPeekHeader}>
                          <Ionicons name="calculator-outline" size={14} color="#065F46" />
                          <Text style={styles.sneakPeekTitle}>⚡ Kusa Nang Kinalkula ng App:</Text>
                        </View>
                        <View style={styles.sneakPeekMetrics}>
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Puhunan / Piraso</Text>
                            <Text style={styles.sneakPeekValue}>₱{effectiveUnitCost.toFixed(2)}</Text>
                          </View>
                          <View style={styles.sneakPeekDivider} />
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Kabuuang Stock</Text>
                            <Text style={styles.sneakPeekValue}>{parsedStock} pcs</Text>
                          </View>
                          <View style={styles.sneakPeekDivider} />
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Kabuuang Puhunan</Text>
                            <Text style={styles.sneakPeekValue}>₱{totalCapitalSpent.toFixed(2)}</Text>
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Tubo / Markup & Tingi Selling Price */}
                  <View style={styles.tuboSectionCard}>
                    <View style={styles.tuboHeaderRow}>
                      <Text style={styles.fieldLabel}>Tubo sa Bawat Piraso (Tingi):</Text>
                      <View style={styles.modeSegmentRow}>
                        <Pressable
                          style={[styles.modeSegmentBtn, tuboMode === 'PESO' ? styles.modeSegmentBtnActive : null]}
                          onPress={() => {
                            setTuboMode('PESO');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            if (tuboValue && effectiveUnitCost > 0) handleTuboChange(tuboValue, 'PESO');
                          }}
                        >
                          <Text style={[styles.modeSegmentText, tuboMode === 'PESO' ? styles.modeSegmentTextActive : null]}>₱ Peso</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.modeSegmentBtn, tuboMode === 'PERCENT' ? styles.modeSegmentBtnActive : null]}
                          onPress={() => {
                            setTuboMode('PERCENT');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            if (tuboValue && effectiveUnitCost > 0) handleTuboChange(tuboValue, 'PERCENT');
                          }}
                        >
                          <Text style={[styles.modeSegmentText, tuboMode === 'PERCENT' ? styles.modeSegmentTextActive : null]}>% Percent</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.quickChipsRow}>
                      {[
                        { label: '+₱1.00', amount: 1, isPercent: false },
                        { label: '+₱2.00', amount: 2, isPercent: false },
                        { label: '+₱3.00', amount: 3, isPercent: false },
                        { label: '+₱5.00', amount: 5, isPercent: false },
                        { label: '+20%', amount: 20, isPercent: true },
                      ].map((chip) => {
                        const isSelected =
                          (chip.isPercent && tuboMode === 'PERCENT' && tuboValue === chip.amount.toString()) ||
                          (!chip.isPercent && tuboMode === 'PESO' && tuboValue === chip.amount.toString());
                        return (
                          <Pressable
                            key={chip.label}
                            style={[styles.quickTuboChip, isSelected ? styles.quickTuboChipActive : null]}
                            onPress={() => handleQuickTubo(chip.amount, chip.isPercent)}
                          >
                            <Text style={[styles.quickTuboChipText, isSelected ? styles.quickTuboChipTextActive : null]}>
                              {chip.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <TextInput
                      style={styles.textInput}
                      value={tuboValue}
                      onChangeText={(val) => handleTuboChange(val, tuboMode)}
                      placeholder={tuboMode === 'PESO' ? '0.00' : '20%'}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  {/* Selling Price Tingi */}
                  <View style={styles.sellingPriceSectionCard}>
                    <Text style={styles.fieldLabel}>Presyo ng Benta sa Tingi (₱ bawat piraso) *</Text>
                    <TextInput
                      style={[styles.textInput, styles.sellingPriceInput]}
                      value={newPricePhp}
                      onChangeText={handlePriceChange}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />

                    {roundingSuggestions.length > 0 ? (
                      <View style={styles.roundingBox}>
                        <Text style={styles.roundingTitle}>🪙 Walang Barya Helper:</Text>
                        <View style={styles.roundingChipsRow}>
                          {roundingSuggestions.map((roundPrice: number) => (
                            <Pressable
                              key={roundPrice}
                              style={styles.roundingChip}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                handlePriceChange(roundPrice.toFixed(2));
                              }}
                            >
                              <Text style={styles.roundingChipText}>{t.roundToLabel(roundPrice.toString())}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {currentEnteredPrice > 0 ? (
                      <View style={styles.profitSummaryBox}>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>{t.profitPerPiece}</Text>
                          <Text style={styles.profitSummaryVal}>
                            ₱{profitPerPiece.toFixed(2)}
                            {profitPerPiece > 0 && effectiveUnitCost > 0
                              ? ` (${((profitPerPiece / effectiveUnitCost) * 100).toFixed(0)}%)`
                              : ''}
                          </Text>
                        </View>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>Kabuuang Benta</Text>
                          <Text style={styles.profitSummaryVal}>
                            ₱{(currentEnteredPrice * (parsedStock > 0 ? parsedStock : 1)).toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>{t.totalBatchProfit}</Text>
                          <Text style={[styles.profitSummaryVal, { color: '#0D7A52', fontWeight: '800' }]}>
                            ₱{totalBatchProfit.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Whole Pack Selling Tier Card */}
                  <View style={[styles.costSectionCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="gift-outline" size={16} color="#0D7A52" />
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#166534' }}>
                        📦 Presyo ng Benta sa Buong Pack ({packPiecesCountNum} piraso)
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#4B5563', lineHeight: 16 }}>
                      Kapag binili ng buo ng suki sa New Sale, awtomatikong ibabawas ang {packPiecesCountNum} piraso sa stock.
                    </Text>

                    {currentEnteredPrice > 0 ? (
                      <View style={{ marginTop: 2 }}>
                        <Text style={{ fontSize: 11, color: '#374151', marginBottom: 4, fontWeight: '600' }}>
                          💡 Mungkahing Presyo ng Pack (Tingi: ₱{currentEnteredPrice.toFixed(2)} × {packPiecesCountNum} pcs = ₱{(currentEnteredPrice * packPiecesCountNum).toFixed(2)}):
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {[
                            {
                              label: `₱${(currentEnteredPrice * packPiecesCountNum).toFixed(2)} (Walang Bawas)`,
                              val: (currentEnteredPrice * packPiecesCountNum).toFixed(2),
                            },
                            {
                              label: `₱${Math.max(1, currentEnteredPrice * packPiecesCountNum - 5).toFixed(2)} (-₱5 Suki Bawas)`,
                              val: Math.max(1, currentEnteredPrice * packPiecesCountNum - 5).toFixed(2),
                            },
                            {
                              label: `₱${Math.max(1, currentEnteredPrice * packPiecesCountNum - 10).toFixed(2)} (-₱10 Suki Bawas)`,
                              val: Math.max(1, currentEnteredPrice * packPiecesCountNum - 10).toFixed(2),
                            },
                          ].map((chip) => (
                            <Pressable
                              key={chip.label}
                              style={[
                                styles.quickTuboChip,
                                packPricePhp === chip.val ? styles.quickTuboChipActive : null,
                              ]}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setPackPricePhp(chip.val);
                              }}
                            >
                              <Text
                                style={[
                                  styles.quickTuboChipText,
                                  packPricePhp === chip.val ? styles.quickTuboChipTextActive : null,
                                ]}
                              >
                                {chip.label}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    <View style={{ marginTop: 4 }}>
                      <Text style={styles.fieldLabel}>Presyo ng Buong Pack (₱) *</Text>
                      <TextInput
                        style={styles.textInput}
                        value={packPricePhp}
                        onChangeText={setPackPricePhp}
                        placeholder={
                          currentEnteredPrice > 0
                            ? (currentEnteredPrice * packPiecesCountNum).toFixed(2)
                            : 'Hal. 115.00'
                        }
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                      />
                    </View>

                    <BarcodeInputField
                      label="Hiwalay na Barcode sa Pack (Opsyonal):"
                      placeholder="Iwanang blangko kung pareho lang ang barcode"
                      value={packBarcode}
                      onChangeBarcode={(code) => setPackBarcode(code)}
                      showTingiButton={false}
                      helperText="I-scan gamit ang camera kung may sariling barcode ang packaging ng pack."
                      scannerHintText="I-tapat ang barcode ng buong pack sa reticle"
                      containerStyle={{ marginVertical: 4 }}
                    />
                  </View>

                  {/* Expiry Date */}
                  <View>
                    <Text style={styles.fieldLabel}>Petsa ng Expiry (Opsyonal - YYYY-MM-DD):</Text>
                    <TextInput
                      style={styles.textInput}
                      value={newExpiryDate}
                      onChangeText={setNewExpiryDate}
                      placeholder="Hal. 2026-12-31"
                      placeholderTextColor="#9CA3AF"
                      maxLength={10}
                    />
                  </View>
                </View>
              ) : packagingType === 'PIECE' ? (
                /* PIECE MODE: Tingi Lamang */
                <View style={{ gap: 10 }}>
                  <View style={styles.costSectionCard}>
                    <View style={styles.twoColRow}>
                      <View style={styles.halfCol}>
                        <Text style={styles.fieldLabel}>Puhunan bawat Piraso (₱) *</Text>
                        <TextInput
                          style={styles.textInput}
                          value={newCostPhp}
                          onChangeText={(val) => {
                            setNewCostPhp(val);
                            const costNum = parseFloat(val.replace(/[^0-9.]/g, '') || '0');
                            if (tuboValue && costNum > 0) {
                              const tuboNum = parseFloat(tuboValue.replace(/[^0-9.]/g, '') || '0');
                              const nextPrice =
                                tuboMode === 'PESO'
                                  ? costNum + tuboNum
                                  : costNum * (1 + tuboNum / 100);
                              setNewPricePhp(nextPrice > 0 ? nextPrice.toFixed(2) : '');
                            }
                          }}
                          placeholder={t.autoCostHint}
                          placeholderTextColor="#9CA3AF"
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={styles.halfCol}>
                        <Text style={styles.fieldLabel}>Kasalukuyang Stock (piraso) *</Text>
                        <TextInput
                          style={styles.textInput}
                          value={newStock}
                          onChangeText={setNewStock}
                          placeholder="0"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                    <View style={styles.twoColRow}>
                      <View style={styles.halfCol}>
                        <Text style={styles.fieldLabel}>Mababang Stock Alert (piraso):</Text>
                        <TextInput
                          style={styles.textInput}
                          value={newLowThreshold}
                          onChangeText={setNewLowThreshold}
                          placeholder="5"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    {/* Auto-Compute Sneak Peek Banner */}
                    {effectiveUnitCost > 0 || parsedStock > 0 ? (
                      <View style={styles.sneakPeekBanner}>
                        <View style={styles.sneakPeekHeader}>
                          <Ionicons name="calculator-outline" size={14} color="#065F46" />
                          <Text style={styles.sneakPeekTitle}>⚡ Kwenta ng Puhunan at Stock:</Text>
                        </View>
                        <View style={styles.sneakPeekMetrics}>
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Puhunan / Piraso</Text>
                            <Text style={styles.sneakPeekValue}>₱{effectiveUnitCost.toFixed(2)}</Text>
                          </View>
                          <View style={styles.sneakPeekDivider} />
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Kasalukuyang Stock</Text>
                            <Text style={styles.sneakPeekValue}>{parsedStock} pcs</Text>
                          </View>
                          <View style={styles.sneakPeekDivider} />
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Kabuuang Puhunan</Text>
                            <Text style={styles.sneakPeekValue}>₱{totalCapitalSpent.toFixed(2)}</Text>
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Tubo & Selling Price */}
                  <View style={styles.tuboSectionCard}>
                    <View style={styles.tuboHeaderRow}>
                      <Text style={styles.fieldLabel}>{t.desiredProfitLabel}</Text>
                      <View style={styles.modeSegmentRow}>
                        <Pressable
                          style={[styles.modeSegmentBtn, tuboMode === 'PESO' ? styles.modeSegmentBtnActive : null]}
                          onPress={() => {
                            setTuboMode('PESO');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            if (tuboValue && effectiveUnitCost > 0) handleTuboChange(tuboValue, 'PESO');
                          }}
                        >
                          <Text style={[styles.modeSegmentText, tuboMode === 'PESO' ? styles.modeSegmentTextActive : null]}>₱ Peso</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.modeSegmentBtn, tuboMode === 'PERCENT' ? styles.modeSegmentBtnActive : null]}
                          onPress={() => {
                            setTuboMode('PERCENT');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            if (tuboValue && effectiveUnitCost > 0) handleTuboChange(tuboValue, 'PERCENT');
                          }}
                        >
                          <Text style={[styles.modeSegmentText, tuboMode === 'PERCENT' ? styles.modeSegmentTextActive : null]}>% Percent</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.quickChipsRow}>
                      {[
                        { label: '+₱1.00', amount: 1, isPercent: false },
                        { label: '+₱2.00', amount: 2, isPercent: false },
                        { label: '+₱3.00', amount: 3, isPercent: false },
                        { label: '+₱5.00', amount: 5, isPercent: false },
                        { label: '+20%', amount: 20, isPercent: true },
                      ].map((chip) => {
                        const isSelected =
                          (chip.isPercent && tuboMode === 'PERCENT' && tuboValue === chip.amount.toString()) ||
                          (!chip.isPercent && tuboMode === 'PESO' && tuboValue === chip.amount.toString());
                        return (
                          <Pressable
                            key={chip.label}
                            style={[styles.quickTuboChip, isSelected ? styles.quickTuboChipActive : null]}
                            onPress={() => handleQuickTubo(chip.amount, chip.isPercent)}
                          >
                            <Text style={[styles.quickTuboChipText, isSelected ? styles.quickTuboChipTextActive : null]}>
                              {chip.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <TextInput
                      style={styles.textInput}
                      value={tuboValue}
                      onChangeText={(val) => handleTuboChange(val, tuboMode)}
                      placeholder={tuboMode === 'PESO' ? '0.00' : '20%'}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.sellingPriceSectionCard}>
                    <Text style={styles.fieldLabel}>{t.sellingPriceLabel}</Text>
                    <TextInput
                      style={[styles.textInput, styles.sellingPriceInput]}
                      value={newPricePhp}
                      onChangeText={handlePriceChange}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />

                    {roundingSuggestions.length > 0 ? (
                      <View style={styles.roundingBox}>
                        <Text style={styles.roundingTitle}>🪙 Walang Barya Helper:</Text>
                        <View style={styles.roundingChipsRow}>
                          {roundingSuggestions.map((roundPrice: number) => (
                            <Pressable
                              key={roundPrice}
                              style={styles.roundingChip}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                handlePriceChange(roundPrice.toFixed(2));
                              }}
                            >
                              <Text style={styles.roundingChipText}>{t.roundToLabel(roundPrice.toString())}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {currentEnteredPrice > 0 ? (
                      <View style={styles.profitSummaryBox}>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>{t.profitPerPiece}</Text>
                          <Text style={styles.profitSummaryVal}>
                            ₱{profitPerPiece.toFixed(2)}
                            {profitPerPiece > 0 && effectiveUnitCost > 0
                              ? ` (${((profitPerPiece / effectiveUnitCost) * 100).toFixed(0)}%)`
                              : ''}
                          </Text>
                        </View>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>Kabuuang Benta</Text>
                          <Text style={styles.profitSummaryVal}>
                            ₱{(currentEnteredPrice * (parsedStock > 0 ? parsedStock : 1)).toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>{t.totalBatchProfit}</Text>
                          <Text style={[styles.profitSummaryVal, { color: '#0D7A52', fontWeight: '800' }]}>
                            ₱{totalBatchProfit.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Expiry Date */}
                  <View>
                    <Text style={styles.fieldLabel}>Petsa ng Expiry (Opsyonal - YYYY-MM-DD):</Text>
                    <TextInput
                      style={styles.textInput}
                      value={newExpiryDate}
                      onChangeText={setNewExpiryDate}
                      placeholder="Hal. 2026-12-31"
                      placeholderTextColor="#9CA3AF"
                      maxLength={10}
                    />
                  </View>
                </View>
              ) : (
                /* KG MODE: Bigas / Asukal */
                <View style={{ gap: 10 }}>
                  <View style={styles.costSectionCard}>
                    <View style={styles.twoColRow}>
                      <View style={styles.halfCol}>
                        <Text style={styles.fieldLabel}>Puhunan bawat Kilo (₱) *</Text>
                        <TextInput
                          style={styles.textInput}
                          value={newCostPhp}
                          onChangeText={(val) => {
                            setNewCostPhp(val);
                            const costNum = parseFloat(val.replace(/[^0-9.]/g, '') || '0');
                            if (tuboValue && costNum > 0) {
                              const tuboNum = parseFloat(tuboValue.replace(/[^0-9.]/g, '') || '0');
                              const nextPrice =
                                tuboMode === 'PESO'
                                  ? costNum + tuboNum
                                  : costNum * (1 + tuboNum / 100);
                              setNewPricePhp(nextPrice > 0 ? nextPrice.toFixed(2) : '');
                            }
                          }}
                          placeholder="Hal. 42.00"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={styles.halfCol}>
                        <Text style={styles.fieldLabel}>Kasalukuyang Stock (kg) *</Text>
                        <TextInput
                          style={styles.textInput}
                          value={newStock}
                          onChangeText={setNewStock}
                          placeholder="50.0"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                    <View style={styles.twoColRow}>
                      <View style={styles.halfCol}>
                        <Text style={styles.fieldLabel}>Mababang Stock Alert (kg) *</Text>
                        <TextInput
                          style={styles.textInput}
                          value={newLowThreshold}
                          onChangeText={setNewLowThreshold}
                          placeholder="5.0"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>

                    {/* Auto-Compute Sneak Peek Banner */}
                    {effectiveUnitCost > 0 || parsedStock > 0 ? (
                      <View style={styles.sneakPeekBanner}>
                        <View style={styles.sneakPeekHeader}>
                          <Ionicons name="calculator-outline" size={14} color="#065F46" />
                          <Text style={styles.sneakPeekTitle}>⚡ Kwenta ng Puhunan at Stock:</Text>
                        </View>
                        <View style={styles.sneakPeekMetrics}>
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Puhunan / Kilo</Text>
                            <Text style={styles.sneakPeekValue}>₱{effectiveUnitCost.toFixed(2)}</Text>
                          </View>
                          <View style={styles.sneakPeekDivider} />
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Kasalukuyang Stock</Text>
                            <Text style={styles.sneakPeekValue}>{parsedStock} kg</Text>
                          </View>
                          <View style={styles.sneakPeekDivider} />
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Kabuuang Puhunan</Text>
                            <Text style={styles.sneakPeekValue}>₱{totalCapitalSpent.toFixed(2)}</Text>
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Tubo Section Card for Kilo */}
                  <View style={styles.tuboSectionCard}>
                    <View style={styles.tuboHeaderRow}>
                      <Text style={styles.fieldLabel}>Tubo sa Bawat Kilo:</Text>
                      <View style={styles.modeSegmentRow}>
                        <Pressable
                          style={[styles.modeSegmentBtn, tuboMode === 'PESO' ? styles.modeSegmentBtnActive : null]}
                          onPress={() => {
                            setTuboMode('PESO');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            if (tuboValue && effectiveUnitCost > 0) handleTuboChange(tuboValue, 'PESO');
                          }}
                        >
                          <Text style={[styles.modeSegmentText, tuboMode === 'PESO' ? styles.modeSegmentTextActive : null]}>₱ Peso</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.modeSegmentBtn, tuboMode === 'PERCENT' ? styles.modeSegmentBtnActive : null]}
                          onPress={() => {
                            setTuboMode('PERCENT');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            if (tuboValue && effectiveUnitCost > 0) handleTuboChange(tuboValue, 'PERCENT');
                          }}
                        >
                          <Text style={[styles.modeSegmentText, tuboMode === 'PERCENT' ? styles.modeSegmentTextActive : null]}>% Percent</Text>
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.quickChipsRow}>
                      {[
                        { label: '+₱3.00', amount: 3, isPercent: false },
                        { label: '+₱5.00', amount: 5, isPercent: false },
                        { label: '+₱8.00', amount: 8, isPercent: false },
                        { label: '+₱10.00', amount: 10, isPercent: false },
                        { label: '+15%', amount: 15, isPercent: true },
                        { label: '+20%', amount: 20, isPercent: true },
                      ].map((chip) => {
                        const isSelected =
                          (chip.isPercent && tuboMode === 'PERCENT' && tuboValue === chip.amount.toString()) ||
                          (!chip.isPercent && tuboMode === 'PESO' && tuboValue === chip.amount.toString());
                        return (
                          <Pressable
                            key={chip.label}
                            style={[styles.quickTuboChip, isSelected ? styles.quickTuboChipActive : null]}
                            onPress={() => handleQuickTubo(chip.amount, chip.isPercent)}
                          >
                            <Text style={[styles.quickTuboChipText, isSelected ? styles.quickTuboChipTextActive : null]}>
                              {chip.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <TextInput
                      style={styles.textInput}
                      value={tuboValue}
                      onChangeText={(val) => handleTuboChange(val, tuboMode)}
                      placeholder={tuboMode === 'PESO' ? '0.00' : '15%'}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.sellingPriceSectionCard}>
                    <Text style={styles.fieldLabel}>Presyo ng Benta bawat Kilo (₱) *</Text>
                    <TextInput
                      style={[styles.textInput, styles.sellingPriceInput]}
                      value={newPricePhp}
                      onChangeText={handlePriceChange}
                      placeholder="Hal. 52.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />

                    {roundingSuggestions.length > 0 ? (
                      <View style={styles.roundingBox}>
                        <Text style={styles.roundingTitle}>🪙 Walang Barya Helper:</Text>
                        <View style={styles.roundingChipsRow}>
                          {roundingSuggestions.map((roundPrice: number) => (
                            <Pressable
                              key={roundPrice}
                              style={styles.roundingChip}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                handlePriceChange(roundPrice.toFixed(2));
                              }}
                            >
                              <Text style={styles.roundingChipText}>{t.roundToLabel(roundPrice.toString())}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {currentEnteredPrice > 0 ? (
                      <View style={styles.profitSummaryBox}>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>Tubo bawat Kilo</Text>
                          <Text style={styles.profitSummaryVal}>
                            ₱{profitPerPiece.toFixed(2)}
                            {profitPerPiece > 0 && effectiveUnitCost > 0
                              ? ` (${((profitPerPiece / effectiveUnitCost) * 100).toFixed(0)}%)`
                              : ''}
                          </Text>
                        </View>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>Kabuuang Benta</Text>
                          <Text style={styles.profitSummaryVal}>
                            ₱{(currentEnteredPrice * (parsedStock > 0 ? parsedStock : 1)).toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>{t.totalBatchProfit}</Text>
                          <Text style={[styles.profitSummaryVal, { color: '#0D7A52', fontWeight: '800' }]}>
                            ₱{totalBatchProfit.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Expiry Date */}
                  <View>
                    <Text style={styles.fieldLabel}>Petsa ng Expiry (Opsyonal - YYYY-MM-DD):</Text>
                    <TextInput
                      style={styles.textInput}
                      value={newExpiryDate}
                      onChangeText={setNewExpiryDate}
                      placeholder="Hal. 2026-12-31"
                      placeholderTextColor="#9CA3AF"
                      maxLength={10}
                    />
                  </View>
                </View>
              )}

              <Pressable
                style={[styles.saveBtn, isSubmitting ? styles.btnDisabled : null]}
                disabled={isSubmitting}
                onPress={() => handleSaveProduct()}
              >
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>
                  {isSubmitting ? 'Isinusumite...' : '✓ I-save ang Paninda'}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Vertical Product List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {products.length === 0
                ? 'Wala Pang Paninda sa Tindahan'
                : 'Walang Tugmang Paninda'}
            </Text>
            <Text style={styles.emptySub}>
              {products.length === 0
                ? 'Pindutin ang "+ Add Product" para ilista ang iyong mga paninda na may litrato at presyo.'
                : 'Subukang baguhin ang kategorya o i-clear ang paghahanap.'}
            </Text>
            <Pressable
              style={styles.emptyAddBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.navigate({ pathname: '/inventory', params: { openAdd: 'true' } });
              }}
            >
              <Text style={styles.emptyAddBtnText}>+ Magdagdag ng Paninda</Text>
            </Pressable>
          </View>
        ) : null}

        {paginated.map((item) => (
          <Pressable
            key={item.id}
            style={styles.productRow}
            onPress={() => {
              if (item.stockCount <= 0) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
                  () => {}
                );
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
              try {
                addToCart(item.id, 1);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                showToast(`✓ Naidagdag ang 1× ${item.name} sa Bagong Benta`, 'success');
              } catch (error) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                const errorMsg =
                  error instanceof Error ? error.message : 'Could not update the cart. Try again.';
                const isInsufficient =
                  errorMsg.toLowerCase().includes('insufficient') ||
                  errorMsg.toLowerCase().includes('kulang') ||
                  errorMsg.toLowerCase().includes('stock');
                setAlertModal({
                  type: isInsufficient ? 'warning' : 'danger',
                  title: isInsufficient ? 'Kulang ang Stock' : 'May Error sa Cart',
                  message: errorMsg,
                  itemName: item.name,
                });
              }
            }}
          >
            <View style={styles.thumbWrapper}>
              <ProductThumbnail
                visual={item.visual}
                imageUri={item.imageUri}
                size="md"
              />
            </View>

            <View style={styles.infoCol}>
              <Text style={styles.productName}>{item.name}</Text>
              <View style={styles.priceLine}>
                <Text style={styles.productPrice}>
                  {item.formattedPrice}
                  {item.unitOfMeasure === 'kg' ? '/kg' : ''}
                </Text>
                <Text style={styles.barcodeNote}> • [{item.barcode}]</Text>
              </View>

              <View style={styles.badgeLine}>
                <View
                  style={[
                    styles.statusPill,
                    item.stockStatus === 'IN_STOCK'
                      ? styles.pillGreen
                      : item.stockStatus === 'LOW_STOCK'
                      ? styles.pillAmber
                      : styles.pillRed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      item.stockStatus === 'IN_STOCK'
                        ? styles.textGreen
                        : item.stockStatus === 'LOW_STOCK'
                        ? styles.textAmber
                        : styles.textRed,
                    ]}
                  >
                    {item.stockStatus === 'IN_STOCK'
                      ? `✓ In stock (${item.formattedStock})`
                      : item.stockStatus === 'LOW_STOCK'
                      ? `⚠ Low Stock (${item.formattedStock})`
                      : '⊗ Out of Stock (0)'}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.chevron}>+🛒</Text>
          </Pressable>
        ))}

        {/* Pagination Controls */}
        {totalPages > 1 ? (
          <View style={styles.paginationRow}>
            <Pressable
              style={[styles.pageBtn, currentPage === 1 ? styles.pageBtnDisabled : null]}
              disabled={currentPage === 1}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setCurrentPage((p) => Math.max(1, p - 1));
              }}
            >
              <Text
                style={[
                  styles.pageBtnText,
                  currentPage === 1 ? styles.pageBtnTextDisabled : null,
                ]}
              >
                {t.previousPage}
              </Text>
            </Pressable>

            <Text style={styles.pageIndicatorText}>
              {t.pageIndicator(currentPage, totalPages)}
            </Text>

            <Pressable
              style={[
                styles.pageBtn,
                currentPage >= totalPages ? styles.pageBtnDisabled : null,
              ]}
              disabled={currentPage >= totalPages}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setCurrentPage((p) => Math.min(totalPages, p + 1));
              }}
            >
              <Text
                style={[
                  styles.pageBtnText,
                  currentPage >= totalPages ? styles.pageBtnTextDisabled : null,
                ]}
              >
                {t.nextPage}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

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
            showToast(`✓ Naidagdag ang ${qty} kg na ${weightModalProduct?.name} sa Bagong Benta`, 'success');
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

      {/* Styled Pop-up Modal for Alerts / Errors */}
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
    </ScreenSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
  },
  backBtn: {
    width: 34,
    height: 34,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D7A52',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  clearIcon: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '700',
  },
  pillsWrapper: {
    marginTop: 12,
    marginBottom: 8,
  },
  pillsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  categoryPillActive: {
    backgroundColor: '#0D7A52',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  categoryPillTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 130,
  },
  modalBackdropContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  modalBackdropPressable: {
    flex: 1,
  },
  modalContentCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    width: '100%',
    maxHeight: '90%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 25,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalDragHandle: {
    width: 44,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  modalHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalHeaderIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitleBarcode: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollContent: {
    paddingBottom: 24,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginTop: 4,
  },
  photoPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  photoPreviewContainer: {
    position: 'relative',
    width: 76,
    height: 76,
  },
  photoPreviewImage: {
    width: 76,
    height: 76,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    borderWidth: 1.5,
    borderColor: '#10B981',
    overflow: 'hidden',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
  photoRemoveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  photoPlaceholderBtn: {
    width: 76,
    height: 76,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700',
    marginTop: 2,
  },
  photoActionsCol: {
    flex: 1,
    gap: 8,
  },
  cameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D7A52',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  cameraBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  galleryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 6,
  },
  galleryBtnText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  onlineBadgeLoading: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  onlineBadgeTextLoading: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
  },
  onlineBadgeSuccess: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  onlineBadgeTextSuccess: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '700',
  },
  onlineBadgeNeutral: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  onlineBadgeTextNeutral: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '600',
  },
  onlineNoticeContainer: {
    gap: 6,
    marginBottom: 8,
  },
  retryOnlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryOnlineBtnText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    color: '#111827',
  },
  catRow: {
    gap: 8,
    paddingVertical: 4,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  catChipActive: {
    backgroundColor: '#0D7A52',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  catChipTextActive: {
    color: '#FFFFFF',
  },
  unitSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  unitToggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  unitToggleBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#0D7A52',
  },
  unitToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  unitToggleTextActive: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  costSectionCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 8,
  },
  halfCol: {
    flex: 1,
  },
  sneakPeekBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  sneakPeekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sneakPeekTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  sneakPeekMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 2,
  },
  sneakPeekItem: {
    alignItems: 'center',
    gap: 2,
  },
  sneakPeekLabel: {
    fontSize: 10,
    color: '#047857',
    fontWeight: '600',
  },
  sneakPeekValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065F46',
    fontVariant: ['tabular-nums'],
  },
  sneakPeekDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#A7F3D0',
  },
  tuboSectionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  tuboHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeSegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 2,
  },
  modeSegmentBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  modeSegmentBtnActive: {
    backgroundColor: '#0D7A52',
  },
  modeSegmentText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  modeSegmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickTuboChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  quickTuboChipActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  quickTuboChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  quickTuboChipTextActive: {
    color: '#FFFFFF',
  },
  sellingPriceSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    gap: 8,
  },
  sellingPriceInput: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  roundingBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 8,
    gap: 6,
  },
  roundingTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  roundingChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roundingChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roundingChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  profitSummaryBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 4,
  },
  profitSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profitSummaryLabel: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '600',
  },
  profitSummaryVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
    fontVariant: ['tabular-nums'],
  },
  saveBtn: {
    marginTop: 8,
    backgroundColor: '#0D7A52',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  emptyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 8,
    marginVertical: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyAddBtn: {
    marginTop: 6,
    backgroundColor: '#0D7A52',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  thumbWrapper: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  infoCol: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  barcodeNote: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  badgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillGreen: {
    backgroundColor: '#DCFCE7',
  },
  pillAmber: {
    backgroundColor: '#FEF3C7',
  },
  pillRed: {
    backgroundColor: '#FEE2E2',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textGreen: {
    color: '#15803D',
  },
  textAmber: {
    color: '#B45309',
  },
  textRed: {
    color: '#B91C1C',
  },
  chevron: {
    fontSize: 14,
    color: '#0D7A52',
    fontWeight: '800',
    paddingLeft: 4,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
    marginBottom: 8,
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#0D7A52',
  },
  pageBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  pageBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pageBtnTextDisabled: {
    color: '#94A3B8',
  },
  pageIndicatorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
});
