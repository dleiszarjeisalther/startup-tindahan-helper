import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { BarcodeInputField } from '@/presentation/components/BarcodeInputField';
import { BarcodeScannerViewfinder } from '@/presentation/components/BarcodeScannerViewfinder';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';
import { useIdempotentSubmit } from '@/presentation/hooks/useIdempotentSubmit';
import { getTranslations } from '@/presentation/localization/i18n';

const STOCK_FILTERS = ['All', 'In Stock', 'Low Stock', 'Out of Stock'] as const;
const PRODUCT_CATEGORIES = ['Snacks', 'Beverages', 'Groceries', 'School Supplies'];

export default function InventoryManagementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ autoBarcode?: string }>();
  const {
    products,
    addProductToDatabase,
    deleteProductFromDatabase,
    updateProductImage,
    adjustInventoryStock,
    lookupOnlineCatalog,
    settings,
  } = useTindahanStore();

  const t = getTranslations(settings?.language);

  const [selectedFilter, setSelectedFilter] =
    useState<(typeof STOCK_FILTERS)[number]>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchScanning, setIsSearchScanning] = useState(false);
  const [showAddForm, setShowAddForm] = useState(products.length === 0);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [customRestockQty, setCustomRestockQty] = useState<string>('10');

  // Add Product Form State (Saved directly to SQLite)
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Snacks');
  const [newBarcode, setNewBarcode] = useState('');
  const [barcodeMode, setBarcodeMode] = useState<'SCAN' | 'MANUAL' | 'GENERATE_TINGI'>(
    'MANUAL'
  );
  const [newPricePhp, setNewPricePhp] = useState('');
  const [newCostPhp, setNewCostPhp] = useState('');
  const [newStock, setNewStock] = useState('');
  const [newLowThreshold, setNewLowThreshold] = useState('5');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLookingUpOnline, setIsLookingUpOnline] = useState(false);
  const [onlineNotice, setOnlineNotice] = useState<string | null>(null);

  const handleBarcodeChange = useCallback(
    async (code: string, mode: 'SCAN' | 'MANUAL' | 'GENERATE_TINGI') => {
      setErrorMsg(null);
      setFeedbackMsg(null);
      setOnlineNotice(null);
      setBarcodeMode(mode);

      if (mode === 'GENERATE_TINGI') {
        setNewBarcode('AUTO-TINGI-CODE');
        return;
      }

      setNewBarcode(code);

      const clean = code.trim();
      if (!clean) return;

      // 1. If barcode already exists in database, act like it was searched using barcode search!
      const existing = products.find((p) => p.barcode === clean);
      if (existing) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setSearchQuery(clean);
        setExpandedProductId(existing.id);
        setShowAddForm(false);
        setFeedbackMsg(
          `ℹ️ Product "${existing.name}" (${existing.barcode}) already exists in inventory! Switched to product restock & details.`
        );
        return;
      }

      // 2. Automated Open Food Facts lookup when barcode is scanned or has at least 8 digits
      if (clean.length >= 8) {
        setIsLookingUpOnline(true);
        try {
          const res = await lookupOnlineCatalog(clean);
          if (res?.found) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            if (res.productName) {
              setNewName(res.productName);
            }
            if (res.imageUrl) {
              setNewImageUri(res.imageUrl);
            }
            if (res.inferredCategory) {
              setNewCategory(res.inferredCategory);
            }
            setOnlineNotice(
              `✓ Open Food Facts: Found "${res.productName ?? 'Product'}" (Photo & Name autofilled)`
            );
          } else {
            setOnlineNotice(
              'ℹ️ Not in Open Food Facts catalog. You can input name and photo manually.'
            );
          }
        } catch {
          // Seamless fallback
        } finally {
          setIsLookingUpOnline(false);
        }
      }
    },
    [products, lookupOnlineCatalog]
  );

  useEffect(() => {
    if (params.autoBarcode) {
      const code = String(params.autoBarcode).trim();
      if (code) {
        const timer = setTimeout(() => {
          setShowAddForm(true);
          handleBarcodeChange(code, 'SCAN');
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [params.autoBarcode, handleBarcodeChange]);

  const handleSearchBarcodeScanned = useCallback(
    async (code: string) => {
      const clean = code.trim();
      if (!clean) return;
      setIsSearchScanning(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const matched = products.find((p) => p.barcode === clean);
      if (matched) {
        // Exists: act as barcode search
        setSearchQuery(clean);
        setExpandedProductId(matched.id);
        setShowAddForm(false);
        setFeedbackMsg(`✓ Found existing product: "${matched.name}" (Stock: ${matched.stockCount})`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        // Did not exist: take it as an add product!
        setSearchQuery('');
        setShowAddForm(true);
        setErrorMsg(null);
        setFeedbackMsg(`ℹ️ Barcode "${clean}" not found in inventory. Opened Add Product to register it!`);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        handleBarcodeChange(clean, 'SCAN');
      }
    },
    [products, handleBarcodeChange]
  );

  const handleTakePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setErrorMsg('Camera permission needed to take product photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setNewImageUri(result.assets[0].uri);
        setErrorMsg(null);
      }
    } catch {
      setErrorMsg('Could not open camera.');
    }
  };

  const handlePickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setErrorMsg('Gallery permission needed to choose product photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        setNewImageUri(result.assets[0].uri);
        setErrorMsg(null);
      }
    } catch {
      setErrorMsg('Could not open gallery.');
    }
  };

  const handleChangeExistingPhoto = async (productId: string) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        await updateProductImage(productId, result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setFeedbackMsg('✓ Updated product photo in SQLite Database');
      }
    } catch {
      setErrorMsg('Could not update photo.');
    }
  };

  const { trigger: handleSaveProduct, isSubmitting } = useIdempotentSubmit(async () => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      if (!newName.trim()) {
        setErrorMsg('Please enter a product name.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }

      if (barcodeMode !== 'GENERATE_TINGI' && !newBarcode.trim()) {
        setErrorMsg('Please scan, type, or generate a barcode.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }

      const cleanBarcode = newBarcode.trim();
      const existingByBarcode =
        barcodeMode !== 'GENERATE_TINGI'
          ? products.find((p) => p.barcode === cleanBarcode)
          : null;

      if (existingByBarcode) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setSearchQuery(cleanBarcode);
        setExpandedProductId(existingByBarcode.id);
        setShowAddForm(false);
        setFeedbackMsg(
          `⚠️ Product "${existingByBarcode.name}" (${existingByBarcode.barcode}) already exists in inventory! Switched to restock & details.`
        );
        return;
      }

      const cleanName = newName.trim().toLowerCase();
      const existingByName = products.find((p) => p.name.trim().toLowerCase() === cleanName);
      if (existingByName) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setSearchQuery(existingByName.name);
        setExpandedProductId(existingByName.id);
        setShowAddForm(false);
        setFeedbackMsg(
          `⚠️ Product "${existingByName.name}" is already in inventory (Barcode: ${existingByName.barcode})! Switched to product view.`
        );
        return;
      }

      const parsedPrice = parseFloat(newPricePhp.replace(/[^0-9.]/g, '') || '0');
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        setErrorMsg('Please enter a valid selling price greater than ₱0.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }

      const parsedCost = parseFloat(newCostPhp.replace(/[^0-9.]/g, '') || '0');
      const parsedStock = parseInt(newStock.replace(/[^0-9]/g, '') || '0', 10);
      const parsedLow = parseInt(newLowThreshold.replace(/[^0-9]/g, '') || '5', 10);

      const result = await addProductToDatabase({
        name: newName,
        category: newCategory,
        barcodeInputMode: barcodeMode,
        rawBarcodeValue: newBarcode,
        initialStock: Number.isFinite(parsedStock) ? parsedStock : 0,
        lowStockThreshold: Number.isFinite(parsedLow) ? parsedLow : 5,
        unitCostPhp:
          Number.isFinite(parsedCost) && parsedCost > 0
            ? parsedCost
            : Math.max(0.5, (Number.isFinite(parsedPrice) ? parsedPrice : 1) * 0.75),
        unitPricePhp: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        imageUri: newImageUri ?? undefined,
      });

      if (result.status === 'DUPLICATE_BARCODE_FOUND') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setSearchQuery(result.existingProduct.barcode);
        setExpandedProductId(result.existingProduct.id);
        setShowAddForm(false);
        setFeedbackMsg(
          `⚠️ Product "${result.existingProduct.name}" (${result.existingProduct.barcode}) already exists in database!`
        );
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setFeedbackMsg(
        `✓ Saved "${result.product.name}" with photo to SQLite Database`
      );
      setNewName('');
      setNewBarcode('');
      setBarcodeMode('MANUAL');
      setNewPricePhp('');
      setNewCostPhp('');
      setNewStock('');
      setNewLowThreshold('5');
      setNewImageUri(null);
      setSearchQuery('');
      setSelectedFilter('All');
      setShowAddForm(false);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save product.');
    }
  });

  const filteredProducts = products.filter((p) => {
    if (selectedFilter === 'In Stock' && p.stockStatus !== 'IN_STOCK') return false;
    if (selectedFilter === 'Low Stock' && p.stockStatus !== 'LOW_STOCK') return false;
    if (selectedFilter === 'Out of Stock' && p.stockStatus !== 'OUT_OF_STOCK')
      return false;

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
      {/* Header: Inventory | Circular Green '+' Button */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerTitle}>{t.inventoryTitle}</Text>
          <Text style={styles.headerSub}>
            {products.length} {products.length === 1 ? 'product' : 'products'} in SQLite DB
          </Text>
        </View>
        <Pressable
          style={styles.plusCircleBtn}
          onPress={() => {
            setErrorMsg(null);
            setShowAddForm((prev) => !prev);
          }}
          hitSlop={10}
        >
          <Text style={styles.plusCircleIcon}>{showAddForm ? '✕' : '+'}</Text>
        </Pressable>
      </View>

      {/* Search Bar with Live Barcode Scanner */}
      <View style={styles.searchWrapper}>
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
          <Pressable
            style={[styles.searchScanBtn, isSearchScanning && styles.searchScanBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setIsSearchScanning((prev) => !prev);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Scan barcode to search"
          >
            <Ionicons
              name={isSearchScanning ? 'close-circle' : 'barcode-outline'}
              size={15}
              color="#FFFFFF"
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.searchScanIcon, isSearchScanning && styles.searchScanIconActive]}>
              {isSearchScanning ? t.stopScanBtn : t.scanBarcodeBtn}
            </Text>
          </Pressable>
        </View>

        {/* Live Camera Barcode Scanner for Inventory Search */}
        {isSearchScanning ? (
          <View style={styles.searchScannerContainer}>
            <BarcodeScannerViewfinder
              isActive={true}
              onToggleActive={setIsSearchScanning}
              onBarcodeScanned={handleSearchBarcodeScanned}
              reticleWidth={240}
              reticleHeight={120}
              containerHeight={210}
              hintText="Scan barcode to search or add product"
              topRightAction={
                <Pressable
                  style={styles.closeSearchScanBtn}
                  onPress={() => setIsSearchScanning(false)}
                  hitSlop={8}
                >
                  <Text style={styles.closeSearchScanText}>✕ Close</Text>
                </Pressable>
              }
            />
          </View>
        ) : null}
      </View>

      {/* Stock Filter Pills */}
      <View style={styles.pillsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsContent}
        >
          {STOCK_FILTERS.map((filter) => {
            const active = selectedFilter === filter;
            const filterLabel =
              filter === 'All'
                ? t.filterAll
                : filter === 'In Stock'
                ? t.inStock
                : filter === 'Low Stock'
                ? t.lowStock
                : t.outOfStock;
            return (
              <Pressable
                key={filter}
                style={[styles.filterPill, active ? styles.filterPillActive : null]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    active ? styles.filterPillTextActive : null,
                  ]}
                >
                  {filterLabel}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {feedbackMsg ? (
        <View style={styles.feedbackBanner}>
          <Text style={styles.feedbackText}>{feedbackMsg}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Add New Product Card (With Image Capture & SQLite persistence) */}
        {showAddForm ? (
          <View style={styles.addCard}>
            <View style={styles.addCardHeader}>
              <Text style={styles.addCardTitle}>
                {t.addProductTitle}
              </Text>
              {products.length > 0 ? (
                <Pressable onPress={() => setShowAddForm(false)} hitSlop={8}>
                  <Text style={styles.closeFormLink}>{t.closeBtn}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Photo Selection Row */}
            <Text style={styles.fieldLabel}>Product Image (Camera / Gallery):</Text>
            <View style={styles.photoPickerRow}>
              {newImageUri ? (
                <View style={{ position: 'relative', width: 80, height: 80 }}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      handlePickImage();
                    }}
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 14,
                      backgroundColor: '#E2E8F0',
                      borderWidth: 1.5,
                      borderColor: '#10B981',
                      overflow: 'hidden',
                    }}
                  >
                    <Image
                      source={{ uri: newImageUri }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      transition={150}
                      cachePolicy="memory-disk"
                    />
                  </Pressable>
                  <Pressable
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      backgroundColor: '#EF4444',
                      borderRadius: 13,
                      width: 26,
                      height: 26,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: '#FFFFFF',
                      elevation: 4,
                      shadowColor: '#000000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.25,
                      shadowRadius: 2,
                    }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setNewImageUri(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800', lineHeight: 14 }}>✕</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={styles.photoPlaceholder}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    handlePickImage();
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="camera-outline" size={22} color="#94A3B8" />
                  <Text style={styles.photoPlaceholderText}>No Photo</Text>
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
                  <Ionicons name="camera" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.cameraBtnText}>
                    {newImageUri ? 'Retake Photo' : 'Take Photo'}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.galleryBtn}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    handlePickImage();
                  }}
                >
                  <Ionicons name="images" size={16} color="#374151" style={{ marginRight: 6 }} />
                  <Text style={styles.galleryBtnText}>
                    {newImageUri ? 'Change Photo' : 'Choose Gallery'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <BarcodeInputField
              value={newBarcode}
              onChangeBarcode={handleBarcodeChange}
              errorMessage={null}
            />

            {/* Open Food Facts Live Lookup Status Badge */}
            {isLookingUpOnline ? (
              <View style={styles.onlineBadgeLoading}>
                <Text style={styles.onlineBadgeTextLoading}>
                  🔍 Searching Open Food Facts database...
                </Text>
              </View>
            ) : onlineNotice ? (
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

            <Text style={styles.fieldLabel}>Product Name *</Text>
            <TextInput
              style={styles.textInput}
              value={newName}
              onChangeText={(t) => {
                setErrorMsg(null);
                setNewName(t);
              }}
              placeholder="e.g. Piattos BBQ or Intermediate Pad"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Category *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catRow}
            >
              {PRODUCT_CATEGORIES.map((cat) => {
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

            <View style={styles.twoColRow}>
              <View style={styles.halfCol}>
                <Text style={styles.fieldLabel}>Selling Price (₱) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newPricePhp}
                  onChangeText={(t) => {
                    setErrorMsg(null);
                    setNewPricePhp(t);
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.halfCol}>
                <Text style={styles.fieldLabel}>Unit Cost (₱, optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={newCostPhp}
                  onChangeText={setNewCostPhp}
                  placeholder="Auto (75%)"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={styles.twoColRow}>
              <View style={styles.halfCol}>
                <Text style={styles.fieldLabel}>Initial Stock (pcs) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={newStock}
                  onChangeText={setNewStock}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.halfCol}>
                <Text style={styles.fieldLabel}>Low Stock Alert At</Text>
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

            {errorMsg ? (
              <View style={styles.formErrorBox}>
                <Text style={styles.formErrorText}>⚠️ {errorMsg}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.saveProductBtn, isSubmitting ? styles.btnDisabled : null]}
              disabled={isSubmitting}
              onPress={() => handleSaveProduct()}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.saveProductBtnText}>
                {isSubmitting ? t.savingToDb : t.saveProductBtn}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Empty State when no products exist in SQLite */}
        {filteredProducts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {products.length === 0
                ? 'No Products in Database Yet'
                : 'No Matching Products'}
            </Text>
            <Text style={styles.emptySub}>
              {products.length === 0
                ? 'Your SQLite database starts completely clean with zero hardcoded items. Tap "+ Add Product" to add your products with photos.'
                : 'Try clearing your search or switching the stock filter.'}
            </Text>
            {searchQuery.trim().length > 0 ? (
              <Pressable
                style={styles.emptyAddBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  const query = searchQuery.trim();
                  setShowAddForm(true);
                  if (/^[0-9A-Za-z_-]{6,}$/.test(query)) {
                    handleBarcodeChange(query, 'MANUAL');
                  } else {
                    setNewName(query);
                  }
                  setSearchQuery('');
                }}
              >
                <Text style={styles.emptyAddBtnText}>
                  + Register &quot;{searchQuery.trim()}&quot; as New Product
                </Text>
              </Pressable>
            ) : !showAddForm ? (
              <Pressable
                style={styles.emptyAddBtn}
                onPress={() => setShowAddForm(true)}
              >
                <Text style={styles.emptyAddBtnText}>+ Add Product with Photo</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Dynamic SQLite Inventory Product List with Images */}
        {filteredProducts.map((item) => {
          const isExpanded = expandedProductId === item.id;
          return (
            <View key={item.id} style={styles.inventoryItemContainer}>
              <Pressable
                style={styles.inventoryRow}
                onPress={() =>
                  setExpandedProductId((prev) => (prev === item.id ? null : item.id))
                }
              >
                <View style={styles.thumbBox}>
                  <ProductThumbnail visual={item.visual} imageUri={item.imageUri} size="md" />
                </View>

                <View style={styles.itemMidCol}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.stockCountText}>
                    Stock: {item.stockCount} • Price: {item.formattedPrice} • [{item.barcode}]
                  </Text>
                  {item.quarantineStockCount > 0 ? (
                    <Text style={styles.quarantineNote}>
                      Quarantined (Damaged/B.O.): {item.quarantineStockCount}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    item.stockStatus === 'IN_STOCK'
                      ? styles.badgeGreen
                      : item.stockStatus === 'LOW_STOCK'
                      ? styles.badgeAmber
                      : styles.badgeRed,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      item.stockStatus === 'IN_STOCK'
                        ? styles.textGreen
                        : item.stockStatus === 'LOW_STOCK'
                        ? styles.textAmber
                        : styles.textRed,
                    ]}
                  >
                    {item.stockStatus === 'IN_STOCK'
                      ? '✓ In Stock'
                      : item.stockStatus === 'LOW_STOCK'
                      ? '⚠ Low Stock'
                      : '⊗ Out of Stock'}
                  </Text>
                </View>
              </Pressable>

              {/* Owner Stock Adjustment & Image Management Drawer */}
              {isExpanded ? (
                <View style={styles.ownerAdjustDrawer}>
                  <View style={styles.drawerTopRow}>
                    <Text style={styles.adjustTitle}>
                      Manage Product • Barcode: {item.barcode}
                    </Text>
                    <Pressable
                      style={styles.photoChangeBtn}
                      onPress={() => handleChangeExistingPhoto(item.id)}
                    >
                      <Text style={styles.photoChangeText}>📷 Change Photo</Text>
                    </Pressable>
                  </View>

                  {/* Custom Restock Input Row */}
                  <View style={styles.customRestockRow}>
                    <TextInput
                      style={styles.customRestockInput}
                      value={customRestockQty}
                      onChangeText={setCustomRestockQty}
                      placeholder="Qty"
                      keyboardType="number-pad"
                    />
                    <Pressable
                      style={styles.adjBtnGreen}
                      onPress={async () => {
                        const qty = Math.max(1, parseInt(customRestockQty || '1', 10) || 1);
                        await adjustInventoryStock({
                          productId: item.id,
                          mode: 'RESTOCK',
                          quantity: qty,
                        });
                        setFeedbackMsg(`✓ Restocked +${qty} ${item.name} in Database`);
                      }}
                    >
                      <Text style={styles.adjBtnGreenText}>
                        +{Math.max(1, parseInt(customRestockQty || '1', 10) || 1)} Restock
                      </Text>
                    </Pressable>

                    <Pressable
                      style={styles.adjBtnBlue}
                      onPress={async () => {
                        await adjustInventoryStock({
                          productId: item.id,
                          mode: 'UNPACK_TINGI',
                          quantity: 1,
                        });
                        setFeedbackMsg(
                          `✓ Unpacked 1 Bulk Pack into +10 Tingi pcs of ${item.name}`
                        );
                      }}
                    >
                      <Text style={styles.adjBtnBlueText}>📦 +10 Tingi</Text>
                    </Pressable>
                  </View>

                  <View style={styles.adjustBtnsRow}>
                    <Pressable
                      style={styles.adjBtnAmber}
                      onPress={async () => {
                        await adjustInventoryStock({
                          productId: item.id,
                          mode: 'HOME_USE',
                          quantity: 1,
                        });
                        setFeedbackMsg(
                          `Logged -1 ${item.name} as Owner/Home Use`
                        );
                      }}
                    >
                      <Text style={styles.adjBtnAmberText}>−1 Home Use</Text>
                    </Pressable>

                    <Pressable
                      style={styles.adjBtnRed}
                      onPress={async () => {
                        await adjustInventoryStock({
                          productId: item.id,
                          mode: 'DAMAGED_EXPIRED',
                          quantity: 1,
                        });
                        setFeedbackMsg(
                          `Moved 1 ${item.name} to Quarantine/Damaged`
                        );
                      }}
                    >
                      <Text style={styles.adjBtnRedText}>⚠ −1 Damaged</Text>
                    </Pressable>

                    <Pressable
                      style={styles.deleteBtn}
                      onPress={async () => {
                        await deleteProductFromDatabase(item.id);
                        setExpandedProductId(null);
                        setFeedbackMsg(`🗑 Deleted "${item.name}" from SQLite Database`);
                      }}
                    >
                      <Text style={styles.deleteBtnText}>🗑 Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Seasonal Forecast Navigation Card */}
        <Pressable
          style={styles.seasonalAlertBanner}
          onPress={() => router.push('/explore')}
        >
          <View style={styles.seasonalAlertLeft}>
            <Text style={styles.seasonalAlertTitle}>
              📈 Feature C: Seasonal Product Forecast
            </Text>
            <Text style={styles.seasonalAlertSub}>
              View Year-over-Year monthly sales comparisons &amp; log monthly history in SQLite ›
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  headerSub: {
    fontSize: 12,
    color: '#0D7A52',
    fontWeight: '600',
  },
  plusCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0D7A52',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  plusCircleIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 22,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    marginTop: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
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
    paddingHorizontal: 4,
  },
  searchScanBtn: {
    marginLeft: 6,
    backgroundColor: '#0D7A52',
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchScanBtnActive: {
    backgroundColor: '#EF4444',
  },
  searchScanIcon: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  searchScanIconActive: {
    color: '#FFFFFF',
  },
  searchScannerContainer: {
    marginTop: 8,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  closeSearchScanBtn: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  closeSearchScanText: {
    color: '#FFFFFF',
    fontSize: 12,
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
  filterPill: {
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterPillActive: {
    backgroundColor: '#0D7A52',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  feedbackBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  feedbackText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 130,
  },
  addCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 14,
    gap: 8,
  },
  addCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D7A52',
  },
  closeFormLink: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
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
  previewBox: {
    width: 72,
    height: 72,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  removePhotoText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  photoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  photoActionsCol: {
    flex: 1,
    gap: 6,
  },
  cameraBtn: {
    backgroundColor: '#0D7A52',
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  galleryBtn: {
    backgroundColor: '#E2E8F0',
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryBtnText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#D1D5DB',
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
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfCol: {
    flex: 1,
  },
  formErrorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  formErrorText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  saveProductBtn: {
    marginTop: 8,
    backgroundColor: '#0D7A52',
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  saveProductBtnText: {
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
  seasonalAlertBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  seasonalAlertLeft: {
    gap: 2,
  },
  seasonalAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  seasonalAlertSub: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '600',
  },
  inventoryItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  inventoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  thumbBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  itemMidCol: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  stockCountText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  quarantineNote: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  badgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  badgeAmber: {
    backgroundColor: '#FEF3C7',
  },
  badgeRed: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
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
  ownerAdjustDrawer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  drawerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adjustTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  photoChangeBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  photoChangeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7A52',
  },
  customRestockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  customRestockInput: {
    width: 64,
    height: 36,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  adjustBtnsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adjBtnGreen: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  adjBtnGreenText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '800',
  },
  adjBtnBlue: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  adjBtnBlueText: {
    color: '#1E40AF',
    fontSize: 12,
    fontWeight: '800',
  },
  adjBtnAmber: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  adjBtnAmberText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '800',
  },
  adjBtnRed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  adjBtnRedText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteBtn: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
