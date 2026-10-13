// src/app/products.tsx — Screen 2: Product List (SQLite Database Backed + Image Capture)
import React, { useState, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';
import { BarcodeInputField } from '@/presentation/components/BarcodeInputField';
import { useIdempotentSubmit } from '@/presentation/hooks/useIdempotentSubmit';
import { getTranslations } from '@/presentation/localization/i18n';

const CATEGORIES = ['All', 'Beverages', 'Snacks', 'Groceries', 'School Supplies'];
const ADD_CATEGORIES = ['Snacks', 'Beverages', 'Groceries', 'School Supplies'];

export default function ProductListScreen() {
  const router = useRouter();
  const { products, addToCart, addProductToDatabase, settings } = useTindahanStore();
  const t = getTranslations(settings?.language);

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(products.length === 0);
  const [addedBanner, setAddedBanner] = useState<string | null>(null);

  // Add Product Form State
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Snacks');
  const [newBarcode, setNewBarcode] = useState('');
  const [barcodeMode, setBarcodeMode] = useState<'SCAN' | 'MANUAL' | 'GENERATE_TINGI'>(
    'MANUAL'
  );
  const [newPricePhp, setNewPricePhp] = useState('');
  const [newStock, setNewStock] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleBarcodeChange = useCallback(
    (code: string, mode: 'SCAN' | 'MANUAL' | 'GENERATE_TINGI') => {
      setErrorMsg(null);
      setBarcodeMode(mode);
      if (mode === 'GENERATE_TINGI') {
        setNewBarcode('AUTO-TINGI-CODE');
      } else {
        setNewBarcode(code);
      }
    },
    []
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

  const { trigger: handleSaveProduct, isSubmitting } = useIdempotentSubmit(async () => {
    setErrorMsg(null);
    try {
      const parsedPrice = parseFloat(newPricePhp.replace(/[^0-9.]/g, ''));
      const parsedStock = parseInt(newStock.replace(/[^0-9]/g, '') || '0', 10);

      const res = await addProductToDatabase({
        name: newName,
        category: newCategory,
        barcodeInputMode: barcodeMode,
        rawBarcodeValue: newBarcode,
        initialStock: Number.isFinite(parsedStock) ? parsedStock : 0,
        lowStockThreshold: 5,
        unitCostPhp: Math.max(0.5, (Number.isFinite(parsedPrice) ? parsedPrice : 1) * 0.75),
        unitPricePhp: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        imageUri: newImageUri ?? undefined,
      });

      if (res.status === 'DUPLICATE_BARCODE_FOUND') {
        setErrorMsg(res.message);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setAddedBanner(`✓ Naidagdag ang "${res.product.name}" [${res.product.barcode}] sa tindahan`);
      setNewName('');
      setNewBarcode('');
      setBarcodeMode('MANUAL');
      setNewPricePhp('');
      setNewStock('');
      setNewImageUri(null);
      setShowAddForm(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save product.');
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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
            setErrorMsg(null);
            setShowAddForm((prev) => !prev);
          }}
        >
          <Text style={styles.addBtnText}>{showAddForm ? '✕ Close' : '+ Add Product'}</Text>
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
          {CATEGORIES.map((cat) => {
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

      {addedBanner ? (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>{addedBanner}</Text>
        </View>
      ) : null}

      {/* Vertical Product List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {showAddForm ? (
          <View style={styles.addCard}>
            <Text style={styles.addCardTitle}>+ Magdagdag ng Paninda at Litrato</Text>

            <Text style={styles.fieldLabel}>Product Image (Camera / Gallery):</Text>
            <View style={styles.photoPickerRow}>
              {newImageUri ? (
                <View style={styles.previewBox}>
                  <Image source={{ uri: newImageUri }} style={styles.previewImage} contentFit="cover" />
                  <Pressable
                    style={styles.removePhotoBtn}
                    onPress={() => setNewImageUri(null)}
                  >
                    <Text style={styles.removePhotoText}>✕ Remove</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>📷 No Photo</Text>
                </View>
              )}

              <View style={styles.photoActionsCol}>
                <Pressable style={styles.cameraBtn} onPress={handleTakePhoto}>
                  <Text style={styles.cameraBtnText}>📸 Take Photo</Text>
                </Pressable>
                <Pressable style={styles.galleryBtn} onPress={handlePickImage}>
                  <Text style={styles.galleryBtnText}>🖼️ Choose from Gallery</Text>
                </Pressable>
              </View>
            </View>

            <BarcodeInputField
              value={newBarcode}
              onChangeBarcode={handleBarcodeChange}
              errorMessage={null}
            />

            <Text style={styles.fieldLabel}>Product Name *</Text>
            <TextInput
              style={styles.textInput}
              value={newName}
              onChangeText={(t) => {
                setErrorMsg(null);
                setNewName(t);
              }}
              placeholder="Enter product name"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>Category *</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catRow}
            >
              {ADD_CATEGORIES.map((cat) => {
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
            </View>

            {errorMsg ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorBoxText}>⚠️ {errorMsg}</Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.saveBtn, isSubmitting ? styles.btnDisabled : null]}
              disabled={isSubmitting}
              onPress={() => handleSaveProduct()}
            >
              <Text style={styles.saveBtnText}>
                {isSubmitting ? 'Saving...' : '✓ I-save ang Paninda'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {products.length === 0
                ? 'Wala Pang Paninda sa Tindahan'
                : 'Walang Tugmang Paninda'}
            </Text>
            <Text style={styles.emptySub}>
              {products.length === 0
                ? 'Add your store products above (with photo & barcode) to start selling.'
                : 'Try another category or clear your search.'}
            </Text>
            {!showAddForm ? (
              <Pressable
                style={styles.emptyAddBtn}
                onPress={() => setShowAddForm(true)}
              >
                <Text style={styles.emptyAddBtnText}>+ Add Product with Photo</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {filtered.map((item) => (
          <Pressable
            key={item.id}
            style={styles.productRow}
            onPress={() => {
              if (item.stockCount <= 0) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
                  () => {}
                );
                setAddedBanner(`⚠️ ${item.name} is Out of Stock — restock in Inventory`);
                return;
              }
              try {
                addToCart(item.id, 1);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setAddedBanner(`✓ Added 1× ${item.name} to New Sale`);
              } catch (error) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                setAddedBanner(
                  error instanceof Error ? error.message : 'Could not update the cart. Try again.'
                );
              }
              setTimeout(() => setAddedBanner(null), 2000);
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
                <Text style={styles.productPrice}>{item.formattedPrice}</Text>
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
                      ? `✓ In stock (${item.stockCount})`
                      : item.stockStatus === 'LOW_STOCK'
                      ? `⚠ Low Stock (${item.stockCount})`
                      : '⊗ Out of Stock (0)'}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.chevron}>+🛒</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
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
  backArrow: {
    fontSize: 22,
    color: '#111827',
    fontWeight: '700',
  },
  headerTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },
  addBtn: {
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
  toastBanner: {
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  toastText: {
    color: '#166534',
    fontWeight: '700',
    fontSize: 12,
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
  addCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D7A52',
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cameraBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  galleryBtn: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
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
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
  },
  errorBoxText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  saveBtn: {
    marginTop: 6,
    backgroundColor: '#0D7A52',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
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
});
