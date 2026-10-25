import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
import { useRouter, useLocalSearchParams, useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { BarcodeInputField } from '@/presentation/components/BarcodeInputField';
import { BarcodeScannerViewfinder } from '@/presentation/components/BarcodeScannerViewfinder';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';
import { useIdempotentSubmit } from '@/presentation/hooks/useIdempotentSubmit';
import { getTranslations } from '@/presentation/localization/i18n';
import { ProductDTO, SellingUnitTier } from '@/domain/entities/Product';
import { FloatingToast, ToastType } from '@/presentation/components/FloatingToast';
import {
  ConfirmationModal,
  ConfirmationType,
  ConfirmationModalDetail,
  ReasonSelectorConfig,
} from '@/presentation/components/ConfirmationModal';
import { PinChallengeModal } from '@/presentation/components/PinChallengeModal';

interface ConfirmationState {
  type: ConfirmationType;
  title: string;
  message: string;
  itemName?: string;
  details?: ConfirmationModalDetail[];
  confirmText?: string;
  cancelText?: string | null;
  onConfirm: (reason?: string) => void | Promise<void>;
  reasonSelector?: ReasonSelectorConfig;
}

const STOCK_FILTERS = ['All', 'In Stock', 'Low Stock', 'Out of Stock', 'Expiring Soon'] as const;

export default function InventoryManagementScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ autoBarcode?: string }>();
  const {
    products,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    addProductToDatabase,
    deleteProductFromDatabase,
    updateProductImage,
    updateProductDetails,
    adjustInventoryStock,
    lookupOnlineCatalog,
    settings,
    operatingMode,
    setOperatingMode,
    isStoreSecurityEnabled,
    isStoreLocked,
    lockStore,
  } = useTindahanStore();

  const t = getTranslations(settings?.language);

  // Stock count computations for filter badges
  const inStockCount = products.filter((p) => p.stockStatus === 'IN_STOCK').length;
  const lowStockCount = products.filter((p) => p.stockStatus === 'LOW_STOCK').length;
  const outOfStockCount = products.filter((p) => p.stockStatus === 'OUT_OF_STOCK').length;
  const expiringSoonCount = products.filter((p) => {
    if (!p.expiryDate) return false;
    const exp = new Date(p.expiryDate);
    if (isNaN(exp.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= 7;
  }).length;

  const [selectedFilter, setSelectedFilter] =
    useState<(typeof STOCK_FILTERS)[number]>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchScanning, setIsSearchScanning] = useState(false);
  const activeSearchScanning = isSearchScanning && isFocused;
  const [showAddForm, setShowAddForm] = useState(products.length === 0);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [customRestockQty, setCustomRestockQty] = useState<string>('10');
  const [newExpiryDate, setNewExpiryDate] = useState<string>('');
  const [editExpiryDate, setEditExpiryDate] = useState<string>('');
  const [pinChallengeAction, setPinChallengeAction] = useState<(() => void) | null>(null);

  // Pagination state (12 items per page)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Category Management Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryOldName, setEditingCategoryOldName] = useState<string | null>(null);
  const [editingCategoryNewName, setEditingCategoryNewName] = useState('');
  const [, setCategoryModalError] = useState<string | null>(null);
  const [categoryModalSuccess, setCategoryModalSuccess] = useState<string | null>(null);

  // Styled Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationState | null>(null);

  const handleAddNewCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setConfirmDialog({
        type: 'warning',
        title: 'Kulang ang Pangalan',
        message: t.categoryRequired,
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
      return;
    }
    if (categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      setConfirmDialog({
        type: 'warning',
        title: 'Mayroon Nang Kategorya',
        message: 'Mayroon nang ganitong kategorya sa iyong tindahan.',
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
      return;
    }
    addCategory(trimmed);
    setNewCategoryName('');
    setCategoryModalError(null);
    showToast(`✓ Naidagdag ang kategoryang "${trimmed}"`, 'success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleSaveCategoryEdit = async (oldName: string) => {
    const trimmed = editingCategoryNewName.trim();
    if (!trimmed) {
      setConfirmDialog({
        type: 'warning',
        title: 'Kulang ang Pangalan',
        message: t.categoryRequired,
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
      return;
    }
    if (
      oldName.toLowerCase() !== trimmed.toLowerCase() &&
      categories.some((c) => c.toLowerCase() === trimmed.toLowerCase())
    ) {
      setConfirmDialog({
        type: 'warning',
        title: 'Mayroon Nang Kategorya',
        message: 'Mayroon nang ganitong kategorya sa iyong tindahan.',
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
      return;
    }
    await updateCategory(oldName, trimmed);
    setEditingCategoryOldName(null);
    setEditingCategoryNewName('');
    setCategoryModalError(null);
    showToast(`✓ Na-update ang kategoryang "${trimmed}"`, 'success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleDeleteCategory = (catName: string) => {
    if (categories.length <= 1) {
      setConfirmDialog({
        type: 'warning',
        title: 'Hindi Maaari',
        message: 'Dapat may matirang kahit isang kategorya sa iyong tindahan.',
        cancelText: null,
        confirmText: 'Naintindihan',
        onConfirm: () => {
          setConfirmDialog(null);
        },
      });
      return;
    }
    setConfirmDialog({
      type: 'delete',
      title: t.categoryDeleteConfirm,
      message: `${t.categoryDeleteWarning}\n\nKategorya: "${catName}"`,
      itemName: catName,
      confirmText: t.deleteBtn,
      cancelText: t.cancelBtn,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteCategory(catName);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setCategoryModalSuccess(`🗑️ Naalis ang kategoryang "${catName}"`);
          setTimeout(() => {
            setCategoryModalSuccess((prev) => (prev?.includes(catName) ? null : prev));
          }, 2800);
        } catch (err) {
          setCategoryModalError(
            err instanceof Error ? err.message : 'Hindi mabura ang kategorya.'
          );
        }
      },
    });
  };

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<ProductDTO | null>(null);
  const [editName, setEditName] = useState('');
  const [editPricePhp, setEditPricePhp] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editLowThreshold, setEditLowThreshold] = useState('');
  const [editCategory, setEditCategory] = useState(categories[0] ?? 'Snacks');
  const [editUnitOfMeasure, setEditUnitOfMeasure] = useState<'pc' | 'kg'>('pc');
  const [editPackagingType, setEditPackagingType] = useState<'PACK' | 'PIECE' | 'KG'>('PACK');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [, setEditError] = useState<string | null>(null);

  // Edit Receipt-First Workflow States & Math
  const [editCostPhp, setEditCostPhp] = useState('');
  const [editBundleCostPhp, setEditBundleCostPhp] = useState('');
  const [editTuboMode, setEditTuboMode] = useState<'PESO' | 'PERCENT'>('PESO');
  const [editTuboValue, setEditTuboValue] = useState('');

  // Multi-unit Selling Tiers (Pack) for Edit Product
  const [editPackMultiplier, setEditPackMultiplier] = useState('10');
  const [editPackPricePhp, setEditPackPricePhp] = useState('');
  const [editPackBarcode, setEditPackBarcode] = useState('');

  const editParsedStock = editUnitOfMeasure === 'kg'
    ? parseFloat(editStock.replace(/[^0-9.]/g, '') || '0')
    : parseInt(editStock.replace(/[^0-9]/g, '') || '0', 10);
  const editBundleCostParsed = parseFloat(editBundleCostPhp.replace(/[^0-9.]/g, '') || '0');
  const editPieceCostParsed = parseFloat(editCostPhp.replace(/[^0-9.]/g, '') || '0');

  const editEffectiveUnitCost = useMemo(() => {
    if (editPackagingType === 'PACK') {
      if (editBundleCostParsed > 0) {
        const pMult = parseInt(editPackMultiplier.replace(/[^0-9]/g, '') || '10', 10);
        return Number((editBundleCostParsed / (pMult > 0 ? pMult : 10)).toFixed(2));
      }
      return editPieceCostParsed > 0 ? editPieceCostParsed : 0;
    }
    return editPieceCostParsed > 0 ? editPieceCostParsed : 0;
  }, [editPackagingType, editBundleCostParsed, editPackMultiplier, editPieceCostParsed]);

  const editCurrentEnteredPrice = parseFloat(editPricePhp.replace(/[^0-9.]/g, '') || '0');

  const editProfitPerPiece = useMemo(() => {
    if (editCurrentEnteredPrice > 0 && editEffectiveUnitCost > 0) {
      return Number(Math.max(0, editCurrentEnteredPrice - editEffectiveUnitCost).toFixed(2));
    }
    return 0;
  }, [editCurrentEnteredPrice, editEffectiveUnitCost]);

  const editTotalBatchProfit = useMemo(() => {
    return Number((editProfitPerPiece * (editParsedStock > 0 ? editParsedStock : 1)).toFixed(2));
  }, [editProfitPerPiece, editParsedStock]);

  const editTotalCapitalSpent = useMemo(() => {
    return Number((editEffectiveUnitCost * (editParsedStock > 0 ? editParsedStock : 0)).toFixed(2));
  }, [editEffectiveUnitCost, editParsedStock]);

  const handleEditTuboChange = (val: string, mode: 'PESO' | 'PERCENT' = editTuboMode) => {
    setEditTuboValue(val);
    const num = parseFloat(val.replace(/[^0-9.]/g, '') || '0');
    if (editEffectiveUnitCost > 0) {
      let nextPrice = 0;
      if (mode === 'PESO') {
        nextPrice = Number((editEffectiveUnitCost + num).toFixed(2));
      } else {
        nextPrice = Number((editEffectiveUnitCost * (1 + num / 100)).toFixed(2));
      }
      setEditPricePhp(nextPrice > 0 ? nextPrice.toString() : '');
    }
  };

  const handleEditPriceChange = (val: string) => {
    setEditError(null);
    setEditPricePhp(val);
    const num = parseFloat(val.replace(/[^0-9.]/g, '') || '0');
    if (editEffectiveUnitCost > 0 && num > 0) {
      const diff = Math.max(0, num - editEffectiveUnitCost);
      if (editTuboMode === 'PESO') {
        setEditTuboValue(diff > 0 ? diff.toFixed(2) : '0');
      } else {
        const pct = (diff / editEffectiveUnitCost) * 100;
        setEditTuboValue(pct > 0 ? pct.toFixed(0) : '0');
      }
    }
  };

  const handleEditQuickTubo = (amount: number, isPercent: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isPercent) {
      setEditTuboMode('PERCENT');
      handleEditTuboChange(amount.toString(), 'PERCENT');
    } else {
      setEditTuboMode('PESO');
      handleEditTuboChange(amount.toString(), 'PESO');
    }
  };

  const editRoundingSuggestions = useMemo(() => {
    if (editCurrentEnteredPrice <= 0) return [];
    const isDecimal = editCurrentEnteredPrice % 1 !== 0;
    if (!isDecimal) return [];

    const floorVal = Math.floor(editCurrentEnteredPrice);
    const ceilVal = Math.ceil(editCurrentEnteredPrice);
    const list: number[] = [];

    if (floorVal > editEffectiveUnitCost && floorVal > 0) {
      list.push(floorVal);
    }
    if (ceilVal > 0 && ceilVal !== floorVal) {
      list.push(ceilVal);
    }
    return list;
  }, [editCurrentEnteredPrice, editEffectiveUnitCost]);

  const handleOpenEditModal = (item: ProductDTO) => {
    setEditingProduct(item);
    setEditName(item.name);
    setEditPricePhp(item.defaultPricePhp > 0 ? item.defaultPricePhp.toString() : '');
    setEditStock(item.stockCount.toString());
    setEditLowThreshold(item.ordinaryLowStockThreshold.toString());
    setEditCategory(item.category || (categories[0] ?? 'Snacks'));
    setEditUnitOfMeasure(item.unitOfMeasure ?? 'pc');
    setEditError(null);

    // Initialize Receipt-First fields for Edit
    setEditBundleCostPhp('');
    const cost = item.unitCostPhp > 0 ? item.unitCostPhp : 0;
    setEditCostPhp(cost > 0 ? cost.toString() : '');
    setEditTuboMode('PESO');
    setEditExpiryDate(item.expiryDate || '');

    if (item.defaultPricePhp > 0 && cost > 0) {
      const markup = Math.max(0, item.defaultPricePhp - cost);
      setEditTuboValue(markup.toFixed(2));
    } else {
      setEditTuboValue('');
    }

    // Multi-unit Selling Tiers (Pack) for Edit
    const packTier = item.sellingTiers?.find((t) => t.unitName === 'pack' || t.unitName === 'bundle');
    if (item.unitOfMeasure === 'kg') {
      setEditPackagingType('KG');
      setEditUnitOfMeasure('kg');
    } else if (packTier) {
      setEditPackagingType('PACK');
      setEditUnitOfMeasure('pc');
      setEditPackMultiplier(String(packTier.baseUnitMultiplier || 10));
      setEditPackPricePhp(String(packTier.unitPricePhp || ''));
      setEditPackBarcode(packTier.unitBarcode?.value || packTier.barcode || '');
      if (cost > 0) {
        setEditBundleCostPhp((cost * (packTier.baseUnitMultiplier || 10)).toFixed(2));
      }
    } else {
      setEditPackagingType('PIECE');
      setEditUnitOfMeasure('pc');
      setEditPackMultiplier('10');
      setEditPackPricePhp('');
      setEditPackBarcode('');
    }
  };

  const handleSaveEditProduct = async () => {
    if (!editingProduct) return;
    if (!editName.trim()) {
      setConfirmDialog({
        type: 'warning',
        title: 'Kulang ang Pangalan',
        message: 'Pangalan ng paninda ay kailangan bago i-save.',
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
      return;
    }
    const price = parseFloat(editPricePhp);
    if (isNaN(price) || price < 0) {
      setConfirmDialog({
        type: 'warning',
        title: 'Maling Presyo',
        message: 'Maglagay ng wastong presyo ng benta.',
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
      return;
    }
    const stock = editUnitOfMeasure === 'kg'
      ? parseFloat(editStock.replace(/[^0-9.]/g, '') || '0')
      : parseInt(editStock.replace(/[^0-9]/g, '') || '0', 10);
    if (isNaN(stock) || stock < 0) {
      setConfirmDialog({
        type: 'warning',
        title: 'Maling Bilang ng Stock',
        message: 'Maglagay ng wastong bilang ng stock sa imbentaryo.',
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
      return;
    }
    const threshold = parseInt(editLowThreshold, 10);
    if (isNaN(threshold) || threshold < 1) {
      setConfirmDialog({
        type: 'warning',
        title: 'Mababang Stock Alert',
        message: 'Ang paalala sa mababang stock ay dapat hindi bababa sa 1.',
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
      return;
    }

    if (editEffectiveUnitCost > 0 && price > 0 && editEffectiveUnitCost >= price) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setConfirmDialog({
        type: 'warning',
        title: 'Suriin ang Puhunan at Presyo',
        message: `Ang puhunan (₱${editEffectiveUnitCost.toFixed(2)}) ay mas mataas o kapantay ng presyo (₱${price.toFixed(2)}). Pakisuri kung Buong Balot ang nailagay.`,
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
      return;
    }

    let tiers: SellingUnitTier[] | undefined;
    if (editPackagingType === 'PACK') {
      const pMult = parseInt(editPackMultiplier.replace(/[^0-9]/g, '') || '10', 10);
      let pPrice = parseFloat(editPackPricePhp.replace(/[^0-9.]/g, '') || '0');
      if (pPrice <= 0) {
        pPrice = price * pMult;
      }
      tiers = [
        { unitName: 'piece', baseUnitMultiplier: 1, unitPricePhp: price },
        {
          unitName: 'pack',
          baseUnitMultiplier: pMult,
          unitPricePhp: pPrice,
          barcode: editPackBarcode.trim() || undefined,
        },
      ];
    } else if (editingProduct.sellingTiers && editingProduct.sellingTiers.length > 1) {
      tiers = [
        { unitName: 'piece', baseUnitMultiplier: 1, unitPricePhp: price }
      ];
    }

    const finalUnitCost =
      editEffectiveUnitCost > 0
        ? editEffectiveUnitCost
        : price > 0
          ? Math.max(0.5, price * 0.75)
          : 0;

    const markupDiff = Math.max(0, price - finalUnitCost);

    setConfirmDialog({
      type: 'info',
      title: 'Kumpirmahin ang Pagbabago',
      itemName: editName.trim(),
      message: 'Nais mo bang i-save ang mga sumusunod na pagbabago sa paninda?',
      details: [
        { label: 'Presyo', value: `₱${price.toFixed(2)}${editUnitOfMeasure === 'kg' ? '/kg' : ''}` },
        { label: 'Puhunan', value: `₱${finalUnitCost.toFixed(2)} (Tubo: ₱${markupDiff.toFixed(2)})` },
        { label: 'Stock', value: `${stock} ${editUnitOfMeasure === 'kg' ? 'kg' : 'piraso'}`, highlight: true },
        { label: 'Low Stock Alert', value: `${threshold} ${editUnitOfMeasure === 'kg' ? 'kg' : 'piraso'}` },
        { label: 'Kategorya', value: editCategory },
        { label: 'Petsa ng Expiry', value: editExpiryDate.trim() || 'Walang Expiry' },
        ...(editPackagingType === 'PACK'
          ? [
              {
                label: 'Pack Unit',
                value: `₱${parseFloat(editPackPricePhp.replace(/[^0-9.]/g, '') || '0').toFixed(2)} (${editPackMultiplier} pcs)${editPackBarcode.trim() ? ` • Barcode: ${editPackBarcode.trim()}` : ''}`,
              },
            ]
          : []),
      ],
      confirmText: '✓ I-save',
      cancelText: 'Bumalik',
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsSubmittingEdit(true);
        setEditError(null);
        try {
          await updateProductDetails(editingProduct.id, {
            name: editName.trim(),
            category: editCategory,
            pricePhp: price,
            unitCostPhp: finalUnitCost,
            baseStockCount: stock,
            lowStockThreshold: threshold,
            unitOfMeasure: editUnitOfMeasure,
            expiryDate: editExpiryDate.trim() || null,
            sellingTiers: tiers,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          showToast(`✓ Na-save ang pagbabago sa "${editName.trim()}"`, 'success');
          setEditingProduct(null);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Hindi ma-update ang paninda.';
          setEditError(msg);
          setConfirmDialog({
            type: 'danger',
            title: 'Error sa Pag-update',
            message: msg,
            confirmText: 'Naintindihan',
            cancelText: null,
            onConfirm: () => setConfirmDialog(null),
          });
        } finally {
          setIsSubmittingEdit(false);
        }
      },
    });
  };

  // Add Product Form State (Saved directly to SQLite)
  const [newImageUri, setNewImageUri] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(categories[0] ?? 'Snacks');
  const [newBarcode, setNewBarcode] = useState('');
  const [barcodeMode, setBarcodeMode] = useState<'SCAN' | 'MANUAL' | 'GENERATE_TINGI'>(
    'MANUAL'
  );
  const [newPricePhp, setNewPricePhp] = useState('');
  const [newCostPhp, setNewCostPhp] = useState('');
  const [newStock, setNewStock] = useState('');
  const [newLowThreshold, setNewLowThreshold] = useState('5');
  const [packagingType, setPackagingType] = useState<'PACK' | 'PIECE' | 'KG'>('PACK');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>('success');

  const showToast = (msg: string, type: ToastType = 'success') => {
    setFeedbackMsg(msg);
    setToastMsg(msg);
    setToastType(type);
  };
  const [, setErrorMsg] = useState<string | null>(null);
  const [isLookingUpOnline, setIsLookingUpOnline] = useState(false);
  const [onlineNotice, setOnlineNotice] = useState<string | null>(null);

  // Receipt-First Workflow States & Math
  const [bundleCostPhp, setBundleCostPhp] = useState('');
  const [tuboMode, setTuboMode] = useState<'PESO' | 'PERCENT'>('PESO');
  const [tuboValue, setTuboValue] = useState('');
  const [packPiecesCount, setPackPiecesCount] = useState('10');
  const [bundlePacksCount, setBundlePacksCount] = useState('1');

  // Multi-unit Selling Tiers (Pack) for Add Product
  const [packMultiplier, setPackMultiplier] = useState('10');
  const [packPricePhp, setPackPricePhp] = useState('');
  const [packBarcode, setPackBarcode] = useState('');

  const packPiecesCountNum = parseInt(packPiecesCount.replace(/[^0-9]/g, '') || '10', 10);
  const bundlePacksCountNum = parseInt(bundlePacksCount.replace(/[^0-9]/g, '') || '1', 10);
  const bundleCostParsed = parseFloat(bundleCostPhp.replace(/[^0-9.]/g, '') || '0');
  const pieceCostParsed = parseFloat(newCostPhp.replace(/[^0-9.]/g, '') || '0');

  const parsedStock = useMemo(() => {
    if (packagingType === 'KG') {
      return parseFloat(newStock.replace(/[^0-9.]/g, '') || '0');
    }
    if (packagingType === 'PACK') {
      return (bundlePacksCountNum > 0 ? bundlePacksCountNum : 1) * (packPiecesCountNum > 0 ? packPiecesCountNum : 10);
    }
    return parseInt(newStock.replace(/[^0-9]/g, '') || '0', 10);
  }, [packagingType, newStock, bundlePacksCountNum, packPiecesCountNum]);

  const effectiveUnitCost = useMemo(() => {
    if (packagingType === 'PACK') {
      if (bundleCostParsed <= 0) return 0;
      const pcs = packPiecesCountNum > 0 ? packPiecesCountNum : 10;
      return Number((bundleCostParsed / pcs).toFixed(2));
    }
    return pieceCostParsed > 0 ? pieceCostParsed : 0;
  }, [packagingType, bundleCostParsed, pieceCostParsed, packPiecesCountNum]);

  const totalCapitalSpent = useMemo(() => {
    if (packagingType === 'PACK' && bundleCostParsed > 0) {
      return Number((bundleCostParsed * (bundlePacksCountNum > 0 ? bundlePacksCountNum : 1)).toFixed(2));
    }
    return Number((effectiveUnitCost * (parsedStock > 0 ? parsedStock : 0)).toFixed(2));
  }, [packagingType, bundleCostParsed, bundlePacksCountNum, effectiveUnitCost, parsedStock]);

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
    setErrorMsg(null);
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

  const lookupSeqRef = useRef(0);
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performOnlineLookup = useCallback(
    async (codeToLookup: string) => {
      const clean = codeToLookup.replace(/[\s-]/g, '').trim();
      if (!clean || clean.length < 6) return;

      const currentSeq = ++lookupSeqRef.current;
      setIsLookingUpOnline(true);
      setOnlineNotice(null);

      try {
        const res = await lookupOnlineCatalog(clean);
        // Stale response guard: ensure this is still the active lookup request
        if (lookupSeqRef.current !== currentSeq) return;

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
          const srcTag = res.source ? ` [${res.source}]` : '';
          const foundLabel =
            settings?.language === 'Taglish'
              ? `✓ Nahanap ang paninda online${srcTag}: "${res.productName ?? 'Paninda'}" (Nailagay na ang litrato at pangalan)`
              : `✓ Product found online${srcTag}: "${res.productName ?? 'Product'}" (Photo & Name autofilled)`;
          setOnlineNotice(foundLabel);
        } else {
          const notFoundLabel =
            settings?.language === 'Taglish'
              ? 'ℹ️ Hindi nahanap online. Maaari mong ilagay ang pangalan at litrato nang mano-mano o i-tap ang "Maghanap Online".'
              : 'ℹ️ Not found online. You can enter name and photo manually or tap "Search Online".';
          setOnlineNotice(notFoundLabel);
        }
      } catch {
        if (lookupSeqRef.current === currentSeq) {
          const errLabel =
            settings?.language === 'Taglish'
              ? 'ℹ️ Hindi makakonekta online. I-tap ang "Maghanap Online" para subukan ulit.'
              : 'ℹ️ Could not connect online. Tap "Search Online" to retry.';
          setOnlineNotice(errLabel);
        }
      } finally {
        if (lookupSeqRef.current === currentSeq) {
          setIsLookingUpOnline(false);
        }
      }
    },
    [lookupOnlineCatalog, settings, setNewName, setNewImageUri, setNewCategory]
  );

  const handleBarcodeChange = useCallback(
    (code: string, mode: 'SCAN' | 'MANUAL' | 'GENERATE_TINGI') => {
      setErrorMsg(null);
      setFeedbackMsg(null);
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

      // 2. Automated online catalog lookup: immediate on camera scan, debounced 450ms on typing
      if (mode === 'SCAN') {
        performOnlineLookup(clean);
      } else if (clean.length >= 8) {
        lookupTimerRef.current = setTimeout(() => {
          performOnlineLookup(clean);
        }, 450);
      }
    },
    [
      products,
      performOnlineLookup,
      setBarcodeMode,
      setNewBarcode,
      setFeedbackMsg,
      setSearchQuery,
      setExpandedProductId,
      setShowAddForm,
    ]
  );

  useEffect(() => {
    return () => {
      if (lookupTimerRef.current) {
        clearTimeout(lookupTimerRef.current);
      }
    };
  }, []);

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
      console.log(`[Inventory Screen] handleSearchBarcodeScanned received code: "${code}", clean: "${clean}"`);
      if (!clean) return;
      setIsSearchScanning(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const matched = products.find((p) => p.barcode === clean);
      if (matched) {
        console.log(`[Inventory Screen] ✓ Matched existing product: "${matched.name}" (ID: ${matched.id})`);
        // Exists: act as barcode search
        setSearchQuery(clean);
        setExpandedProductId(matched.id);
        setShowAddForm(false);
        showToast(`✓ Found existing product: "${matched.name}" (Stock: ${matched.stockCount})`, 'success');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        console.log(`[Inventory Screen] ℹ️ Barcode "${clean}" not in catalog. Switching to Add Product form.`);
        // Did not exist: take it as an add product!
        setSearchQuery('');
        setShowAddForm(true);
        setErrorMsg(null);
        showToast(`ℹ️ Barcode "${clean}" not found in inventory. Opened Add Product to register it!`, 'info');
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
        showToast('✓ Na-update ang litrato ng paninda', 'success');
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setConfirmDialog({
          type: 'warning',
          title: 'Kulang ang Pangalan',
          message: 'Mangyaring maglagay ng pangalan ng paninda bago mag-save.',
          confirmText: 'Naintindihan',
          cancelText: null,
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      if (barcodeMode !== 'GENERATE_TINGI' && !newBarcode.trim()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setConfirmDialog({
          type: 'warning',
          title: 'Kulang ang Barcode',
          message: 'Mangyaring mag-scan, mag-type, o mag-generate ng barcode para sa paninda.',
          confirmText: 'Naintindihan',
          cancelText: null,
          onConfirm: () => setConfirmDialog(null),
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
        setConfirmDialog({
          type: 'info',
          title: 'Nasa Imbentaryo Na!',
          itemName: existingByBarcode.name,
          message: `Ang panindang "${existingByBarcode.name}" (${existingByBarcode.barcode}) ay nakalista na sa imbentaryo. Lilipat sa detalye at restock ng panindang ito.`,
          confirmText: 'Tingnan ang Paninda',
          cancelText: null,
          onConfirm: () => {
            setConfirmDialog(null);
            setSearchQuery(cleanBarcode);
            setExpandedProductId(existingByBarcode.id);
            setShowAddForm(false);
          },
        });
        return;
      }

      const cleanName = newName.trim().toLowerCase();
      const existingByName = products.find((p) => p.name.trim().toLowerCase() === cleanName);
      if (existingByName) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setConfirmDialog({
          type: 'info',
          title: 'Nasa Imbentaryo Na!',
          itemName: existingByName.name,
          message: `Ang panindang "${existingByName.name}" ay nakalista na sa imbentaryo (Barcode: ${existingByName.barcode}). Lilipat sa detalye ng panindang ito.`,
          confirmText: 'Tingnan ang Paninda',
          cancelText: null,
          onConfirm: () => {
            setConfirmDialog(null);
            setSearchQuery(existingByName.name);
            setExpandedProductId(existingByName.id);
            setShowAddForm(false);
          },
        });
        return;
      }

      const parsedPrice = parseFloat(newPricePhp.replace(/[^0-9.]/g, '') || '0');
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setConfirmDialog({
          type: 'warning',
          title: 'Maling Presyo',
          message: 'Mangyaring maglagay ng wastong presyo ng benta na mas mataas sa ₱0.',
          confirmText: 'Naintindihan',
          cancelText: null,
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      if (effectiveUnitCost > 0 && parsedPrice > 0 && effectiveUnitCost >= parsedPrice) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setConfirmDialog({
          type: 'warning',
          title: 'Suriin ang Puhunan at Presyo',
          message: `Ang puhunan (₱${effectiveUnitCost.toFixed(2)}) ay mas mataas o kapantay ng presyo ng benta (₱${parsedPrice.toFixed(2)}). Pakisuri kung Buong Balot ang nailagay.`,
          confirmText: 'Naintindihan',
          cancelText: null,
          onConfirm: () => setConfirmDialog(null),
        });
        return;
      }

      let finalStock = 0;
      if (packagingType === 'KG') {
        finalStock = parseFloat(newStock.replace(/[^0-9.]/g, '') || '0');
      } else if (packagingType === 'PACK') {
        finalStock = (bundlePacksCountNum > 0 ? bundlePacksCountNum : 1) * (packPiecesCountNum > 0 ? packPiecesCountNum : 10);
      } else {
        finalStock = parseInt(newStock.replace(/[^0-9]/g, '') || '0', 10);
      }
      const parsedLow = parseInt(newLowThreshold.replace(/[^0-9]/g, '') || '5', 10);

      let tiers: SellingUnitTier[] | undefined;
      if (packagingType === 'PACK') {
        const pMult = packPiecesCountNum > 0 ? packPiecesCountNum : 10;
        let pPrice = parseFloat(packPricePhp.replace(/[^0-9.]/g, '') || '0');
        if (pPrice <= 0) {
          pPrice = parsedPrice * pMult;
        }
        tiers = [
          { unitName: 'piece', baseUnitMultiplier: 1, unitPricePhp: parsedPrice },
          {
            unitName: 'pack',
            baseUnitMultiplier: pMult,
            unitPricePhp: pPrice,
            barcode: packBarcode.trim() || undefined,
          },
        ];
      }

      const result = await addProductToDatabase({
        name: newName,
        category: newCategory,
        barcodeInputMode: barcodeMode,
        rawBarcodeValue: newBarcode,
        initialStock: Number.isFinite(finalStock) ? finalStock : 0,
        lowStockThreshold: Number.isFinite(parsedLow) ? parsedLow : 5,
        unitCostPhp:
          Number.isFinite(effectiveUnitCost) && effectiveUnitCost > 0
            ? effectiveUnitCost
            : Math.max(0.5, (Number.isFinite(parsedPrice) ? parsedPrice : 1) * 0.75),
        unitPricePhp: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        imageUri: newImageUri ?? undefined,
        unitOfMeasure: packagingType === 'KG' ? 'kg' : 'pc',
        expiryDate: newExpiryDate.trim() || undefined,
        sellingTiers: tiers,
      });

      if (result.status === 'DUPLICATE_BARCODE_FOUND') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setConfirmDialog({
          type: 'warning',
          title: 'May Parehong Barcode',
          itemName: result.existingProduct.name,
          message: `Mayroon nang paninda na "${result.existingProduct.name}" (${result.existingProduct.barcode}) sa imbentaryo!`,
          confirmText: 'Tingnan ang Paninda',
          cancelText: null,
          onConfirm: () => {
            setConfirmDialog(null);
            setSearchQuery(result.existingProduct.barcode);
            setExpandedProductId(result.existingProduct.id);
            setShowAddForm(false);
          },
        });
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      showToast(
        `✓ Na-save ang "${result.product.name}" na may litrato`,
        'success'
      );
      setNewName('');
      setNewBarcode('');
      setBarcodeMode('MANUAL');
      setNewPricePhp('');
      setNewCostPhp('');
      setNewStock('');
      setNewLowThreshold('5');
      setNewExpiryDate('');
      setPackagingType('PACK');
      setBundleCostPhp('');
      setPackPiecesCount('10');
      setBundlePacksCount('1');
      setTuboValue('');
      setTuboMode('PESO');
      setPackMultiplier('10');
      setPackPricePhp('');
      setPackBarcode('');
      setNewImageUri(null);
      setSearchQuery('');
      setSelectedFilter('All');
      setShowAddForm(false);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const msg = err instanceof Error ? err.message : 'Hindi mai-save ang paninda.';
      setErrorMsg(msg);
      setConfirmDialog({
        type: 'danger',
        title: 'Error sa Pag-save',
        message: msg,
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
    }
  });

  const filteredProducts = products.filter((p) => {
    if (selectedFilter === 'In Stock' && p.stockStatus !== 'IN_STOCK') return false;
    if (selectedFilter === 'Low Stock' && p.stockStatus !== 'LOW_STOCK') return false;
    if (selectedFilter === 'Out of Stock' && p.stockStatus !== 'OUT_OF_STOCK')
      return false;
    if (selectedFilter === 'Expiring Soon') {
      if (!p.expiryDate) return false;
      const exp = new Date(p.expiryDate);
      if (isNaN(exp.getTime())) return false;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff > 7) return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.barcode.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE
  );

  return (
    <ScreenSafeAreaView style={styles.safeArea}>
      <FloatingToast
        message={toastMsg}
        type={toastType}
        onDismiss={() => setToastMsg(null)}
      />
      {/* Header: Security Role Pill on Left, Action Buttons on Right */}
      <View style={styles.headerRow}>
        {isStoreSecurityEnabled ? (
          <Pressable
            style={[
              styles.rolePill,
              !isStoreLocked ? styles.rolePillOwner : styles.rolePillCashier,
            ]}
            onPress={() => {
              if (isStoreLocked) {
                setPinChallengeAction(() => () => {
                  showToast('🔓 Na-unlock ang tindahan', 'success');
                });
              } else {
                lockStore();
                showToast('🔒 Naka-lock na muli ang tindahan', 'info');
              }
            }}
          >
            <Text style={styles.rolePillText}>
              {!isStoreLocked ? '🔓 Bukas' : '🔒 Naka-lock'}
            </Text>
          </Pressable>
        ) : (
          <View />
        )}

        <View style={styles.headerRightActions}>
          <Pressable
            style={styles.manageCatHeaderBtn}
            onPress={() => router.navigate('/history')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Stock Movement History"
          >
            <Ionicons name="time-outline" size={15} color="#0D7A52" />
            <Text style={styles.manageCatHeaderText}>
              History
            </Text>
          </Pressable>

          <Pressable
            style={styles.manageCatHeaderBtn}
            onPress={() => setShowCategoryModal(true)}
            hitSlop={8}
          >
            <Ionicons name="folder-outline" size={15} color="#0D7A52" />
            <Text style={styles.manageCatHeaderText}>
              {settings?.language === 'Taglish' ? 'Kategorya' : 'Categories'}
            </Text>
          </Pressable>

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
            style={[styles.searchScanBtn, activeSearchScanning && styles.searchScanBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setIsSearchScanning((prev) => !prev);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Scan barcode to search"
          >
            <Ionicons
              name={activeSearchScanning ? 'close-circle' : 'barcode-outline'}
              size={15}
              color="#FFFFFF"
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.searchScanIcon, activeSearchScanning && styles.searchScanIconActive]}>
              {activeSearchScanning ? t.stopScanBtn : t.scanBarcodeBtn}
            </Text>
          </Pressable>
        </View>

        {/* Live Camera Barcode Scanner for Inventory Search */}
        {activeSearchScanning ? (
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
                : filter === 'Out of Stock'
                ? t.outOfStock
                : '⏳ Expiring Soon';
            const badgeCount =
              filter === 'All'
                ? products.length
                : filter === 'In Stock'
                ? inStockCount
                : filter === 'Low Stock'
                ? lowStockCount
                : filter === 'Out of Stock'
                ? outOfStockCount
                : filter === 'Expiring Soon'
                ? expiringSoonCount
                : null;

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
                {badgeCount !== null && (filter === 'All' || filter === 'In Stock' || badgeCount > 0) ? (
                  <View
                    style={[
                      styles.filterBadgePill,
                      filter === 'Out of Stock'
                        ? styles.filterBadgeRed
                        : filter === 'Expiring Soon'
                        ? styles.filterBadgePurple
                        : filter === 'Low Stock'
                        ? styles.filterBadgeAmber
                        : filter === 'In Stock'
                        ? styles.filterBadgeGreen
                        : styles.filterBadgeNeutral,
                    ]}
                  >
                    <Text style={styles.filterBadgeText}>{badgeCount}</Text>
                  </View>
                ) : null}
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
                  {t.searchingOnline}
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
                      {settings?.language === 'Taglish'
                        ? 'Maghanap Online (Search Catalog)'
                        : 'Search Online Catalog'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}

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
              <Pressable
                style={styles.catChipManage}
                onPress={() => setShowCategoryModal(true)}
              >
                <Text style={styles.catChipManageText}>{t.addCategory}</Text>
              </Pressable>
            </ScrollView>

            {/* 1. URI NG PANINDA & PAGBENTA (3 Unified Modes) */}
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
                  // Auto-fill Tingi inputs from Pack inputs
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
                    Iisang barcode lang ang gagamitin by default. Kapag binili ng buo ng suki sa New Sale, awtomatikong ibabawas ang {packPiecesCountNum} piraso sa stock.
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
                        onChangeText={(val) => {
                          setErrorMsg(null);
                          setNewStock(val);
                        }}
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
                        onChangeText={(val) => {
                          setErrorMsg(null);
                          setNewStock(val);
                        }}
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
                ? 'Wala Pang Paninda sa Tindahan'
                : 'Walang Tugmang Paninda'}
            </Text>
            <Text style={styles.emptySub}>
              {products.length === 0
                ? 'Malinis ang iyong talaan ng paninda. Pindutin ang "+ Add Product" para ilista ang iyong mga paninda na may litrato.'
                : 'Subukang baguhin ang filter o i-clear ang paghahanap.'}
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

        {/* Dynamic Inventory Product List with Images */}
        {paginatedProducts.map((item) => {
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
                    Stock: {item.formattedStock} • Price: {item.formattedPrice}{item.unitOfMeasure === 'kg' ? '/kg' : ''} • [{item.barcode}]
                  </Text>
                  {item.quarantineStockCount > 0 ? (
                    <Text style={styles.quarantineNote}>
                      Quarantined (Damaged/B.O.): {item.quarantineStockCount}
                    </Text>
                  ) : null}
                  {item.expiryDate ? (
                    <Text
                      style={[
                        styles.quarantineNote,
                        item.daysUntilExpiry != null && item.daysUntilExpiry < 0
                          ? { color: '#DC2626', fontWeight: '700' }
                          : item.daysUntilExpiry != null && item.daysUntilExpiry <= 7
                          ? { color: '#7C3AED', fontWeight: '700' }
                          : { color: '#0D7A52', fontWeight: '600' },
                      ]}
                    >
                      {item.daysUntilExpiry != null && item.daysUntilExpiry < 0
                        ? `🔴 EXPIRED (${item.expiryDate})`
                        : item.daysUntilExpiry != null && item.daysUntilExpiry <= 7
                        ? `⏳ FEFO: Expiring in ${item.daysUntilExpiry}d (${item.expiryDate})`
                        : `📅 Expiry: ${item.expiryDate}`}
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
                    <Text style={styles.adjustTitle} numberOfLines={1}>
                      Manage • Barcode: {item.barcode}
                    </Text>
                    <View style={styles.topDrawerActions}>
                      <Pressable
                        style={styles.editProductBtn}
                        onPress={() => {
                          if (operatingMode === 'CASHIER' || (isStoreSecurityEnabled && isStoreLocked)) {
                            setPinChallengeAction(() => () => handleOpenEditModal(item));
                          } else {
                            handleOpenEditModal(item);
                          }
                        }}
                      >
                        <Ionicons name="pencil" size={13} color="#0D7A52" style={{ marginRight: 3 }} />
                        <Text style={styles.editProductBtnText}>Edit</Text>
                      </Pressable>
                      <Pressable
                        style={styles.photoChangeBtn}
                        onPress={() => handleChangeExistingPhoto(item.id)}
                      >
                        <Text style={styles.photoChangeText}>📷 Photo</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Multi-unit Selling Tiers Summary */}
                  {item.sellingTiers && item.sellingTiers.length > 1 ? (
                    <View style={styles.itemTiersSummaryBadge}>
                      <Text style={styles.itemTierBadgeHeader}>Multi-unit Selling Tiers:</Text>
                      {item.sellingTiers.map((tier) => (
                        <Text key={tier.unitName} style={styles.itemTierBadgeText}>
                          • {tier.unitName.toUpperCase()}: ₱{tier.unitPricePhp.toFixed(2)} ({tier.baseUnitMultiplier} pcs)
                          {tier.barcode ? ` [Barcode: ${tier.barcode}]` : ''}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {/* Custom Restock / Adjustment Input Row */}
                  {(() => {
                    const inputQty = Math.max(1, parseInt(customRestockQty || '1', 10) || 1);
                    return (
                      <>
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
                            onPress={() => {
                              setConfirmDialog({
                                type: 'restock',
                                title: 'Kumpirmahin ang Restock',
                                itemName: item.name,
                                message: 'Sigurado ka bang nais mong magdagdag ng stock sa panindang ito?',
                                details: [
                                  { label: 'Kasalukuyang Stock', value: `${item.stockCount} pcs` },
                                  { label: 'Dami ng Idaragdag', value: `+${inputQty} pcs` },
                                  { label: 'Magiging Kabuuan', value: `${item.stockCount + inputQty} pcs`, highlight: true },
                                ],
                                reasonSelector: {
                                  label: 'Dahilan ng Restock (Reason):',
                                  options: ['Bagong Delivery', 'Replenishment', 'Return to Shelf', 'Physical Count Correction'],
                                  defaultReason: 'Bagong Delivery',
                                  placeholder: 'Hal. galing sa supplier / resibo #...',
                                },
                                confirmText: 'Itala ang Stock',
                                cancelText: 'Kanselahin',
                                onConfirm: async (reason) => {
                                  setConfirmDialog(null);
                                  await adjustInventoryStock({
                                    productId: item.id,
                                    mode: 'RESTOCK',
                                    quantity: inputQty,
                                    reason,
                                  });
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                                  showToast(`✓ Naidagdag +${inputQty} ${item.name} sa stock (Total: ${item.stockCount + inputQty} pcs)`, 'success');
                                },
                              });
                            }}
                          >
                            <Text style={styles.adjBtnGreenText}>
                              +{inputQty} Restock
                            </Text>
                          </Pressable>

                          <Pressable
                            style={styles.adjBtnBlue}
                            onPress={() => {
                              setConfirmDialog({
                                type: 'unpack',
                                title: 'Kumpirmahin ang Pag-unpack',
                                itemName: item.name,
                                message: `Nais mo bang buksan ang ${inputQty} bulk pack para maging +${inputQty * 10} tingi piraso?`,
                                details: [
                                  { label: 'Kasalukuyang Stock', value: `${item.stockCount} pcs` },
                                  { label: 'Mababawas na Pack', value: `-${inputQty} pack` },
                                  { label: 'Dagdag sa Tingi', value: `+${inputQty * 10} piraso`, highlight: true },
                                ],
                                reasonSelector: {
                                  label: 'Dahilan ng Pag-unpack:',
                                  options: ['Binuksang Pack para sa Tingi', 'Replenish Tingi Shelf', 'Pabor sa Suki'],
                                  defaultReason: 'Binuksang Pack para sa Tingi',
                                },
                                confirmText: 'I-unpack ang Tingi',
                                cancelText: 'Kanselahin',
                                onConfirm: async (reason) => {
                                  setConfirmDialog(null);
                                  await adjustInventoryStock({
                                    productId: item.id,
                                    mode: 'UNPACK_TINGI',
                                    quantity: inputQty,
                                    reason,
                                  });
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                                  showToast(
                                    `✓ Na-unpack ang ${inputQty} bulk pack sa +${inputQty * 10} tingi piraso ng ${item.name}`,
                                    'success'
                                  );
                                },
                              });
                            }}
                          >
                            <Text style={styles.adjBtnBlueText}>📦 +{inputQty * 10} Tingi</Text>
                          </Pressable>
                        </View>

                        <View style={styles.adjustBtnsRow}>
                          <Pressable
                            style={styles.adjBtnAmber}
                            onPress={() => {
                              const remaining = Math.max(0, item.stockCount - inputQty);
                              setConfirmDialog({
                                type: 'home_use',
                                title: 'Gamit sa Bahay (Home Use)',
                                itemName: item.name,
                                message: `Ibabawas ba ang ${inputQty} pc ng paninda para sa pansariling gamit sa bahay?`,
                                details: [
                                  { label: 'Kasalukuyang Stock', value: `${item.stockCount} pcs` },
                                  { label: 'Ibabawas', value: `-${inputQty} pc` },
                                  { label: 'Matitirang Stock', value: `${remaining} pcs`, highlight: true },
                                ],
                                reasonSelector: {
                                  label: 'Dahilan ng Bawas (Home Use):',
                                  options: ['Pansariling Gamit', 'Kusina / Pananghalian', 'Pamilya / Suki Sample'],
                                  defaultReason: 'Pansariling Gamit',
                                  placeholder: 'Hal. ulam ng pamilya, meryenda...',
                                },
                                confirmText: 'I-bawas sa Stock',
                                cancelText: 'Kanselahin',
                                onConfirm: async (reason) => {
                                  setConfirmDialog(null);
                                  await adjustInventoryStock({
                                    productId: item.id,
                                    mode: 'HOME_USE',
                                    quantity: inputQty,
                                    reason,
                                  });
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                                  showToast(
                                    `✓ Naitala ang -${inputQty} ${item.name} bilang Gamit sa Bahay (Tira: ${remaining} pcs)`,
                                    'warning'
                                  );
                                },
                              });
                            }}
                          >
                            <Text style={styles.adjBtnAmberText}>−{inputQty} Gamit sa Bahay</Text>
                          </Pressable>

                          <Pressable
                            style={styles.adjBtnRed}
                            onPress={() => {
                              const remaining = Math.max(0, item.stockCount - inputQty);
                              setConfirmDialog({
                                type: 'damaged',
                                title: 'Sira o Expired na Paninda',
                                itemName: item.name,
                                message: `Sigurado ka bang sira o expired ang ${inputQty} pc? Ibabawas ito sa mabebentang stock.`,
                                details: [
                                  { label: 'Kasalukuyang Stock', value: `${item.stockCount} pcs` },
                                  { label: 'Ibabawas', value: `-${inputQty} pc` },
                                  { label: 'Matitirang Stock', value: `${remaining} pcs`, highlight: true },
                                ],
                                reasonSelector: {
                                  label: 'Dahilan ng Pagkasira/Expired:',
                                  options: ['Basag / Depektibo', 'Lampas na sa Expiry', 'Daga / Insekto / Nabasa'],
                                  defaultReason: 'Lampas na sa Expiry',
                                  placeholder: 'Hal. may tagas ang supot, expired noong...',
                                },
                                confirmText: 'Itala bilang Sira',
                                cancelText: 'Kanselahin',
                                onConfirm: async (reason) => {
                                  setConfirmDialog(null);
                                  await adjustInventoryStock({
                                    productId: item.id,
                                    mode: 'DAMAGED_EXPIRED',
                                    quantity: inputQty,
                                    reason,
                                  });
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                                  showToast(
                                    `✓ Inilipat ang ${inputQty} ${item.name} sa Sira/Expired (Tira: ${remaining} pcs)`,
                                    'warning'
                                  );
                                },
                              });
                            }}
                          >
                            <Text style={styles.adjBtnRedText}>⚠ −{inputQty} Sira/Expired</Text>
                          </Pressable>
                          <Pressable
                            style={styles.deleteBtn}
                            onPress={() => {
                              setConfirmDialog({
                                type: 'delete',
                                title: 'Alisin ang Paninda?',
                                itemName: item.name,
                                message: `Sigurado ka bang nais mong tanggalin ang "${item.name}" sa iyong paninda? Hindi na ito maibabalik.`,
                                details: [
                                  { label: 'Kasalukuyang Stock', value: `${item.stockCount} pcs` },
                                  { label: 'Barcode', value: item.barcode || 'Wala' },
                                ],
                                confirmText: 'Oo, Alisin',
                                cancelText: 'Huwag',
                                onConfirm: async () => {
                                  setConfirmDialog(null);
                                  try {
                                    await deleteProductFromDatabase(item.id);
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                                    setExpandedProductId(null);
                                    showToast(`🗑️ Naalis ang "${item.name}" sa imbentaryo`, 'warning');
                                    setErrorMsg(null);
                                  } catch (error) {
                                    setErrorMsg(
                                      error instanceof Error
                                        ? error.message
                                        : 'Hindi maalis ang paninda. Subukang muli.'
                                    );
                                  }
                                },
                              });
                            }}
                          >
                            <Text style={styles.deleteBtnText}>🗑 Delete</Text>
                          </Pressable>
                        </View>
                      </>
                    );
                  })()}
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Pagination Controls */}
        {totalPages > 1 ? (
          <View style={styles.paginationRow}>
            <Pressable
              style={[styles.pageBtn, safeCurrentPage === 1 ? styles.pageBtnDisabled : null]}
              disabled={safeCurrentPage === 1}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setCurrentPage((p) => Math.max(1, p - 1));
              }}
            >
              <Text
                style={[
                  styles.pageBtnText,
                  safeCurrentPage === 1 ? styles.pageBtnTextDisabled : null,
                ]}
              >
                {t.previousPage}
              </Text>
            </Pressable>

            <Text style={styles.pageIndicatorText}>
              {t.pageIndicator(safeCurrentPage, totalPages)}
            </Text>

            <Pressable
              style={[
                styles.pageBtn,
                safeCurrentPage >= totalPages ? styles.pageBtnDisabled : null,
              ]}
              disabled={safeCurrentPage >= totalPages}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setCurrentPage((p) => Math.min(totalPages, p + 1));
              }}
            >
              <Text
                style={[
                  styles.pageBtnText,
                  safeCurrentPage >= totalPages ? styles.pageBtnTextDisabled : null,
                ]}
              >
                {t.nextPage}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Seasonal Forecast Navigation Card */}
        <Pressable
          style={styles.seasonalAlertBanner}
          onPress={() => router.navigate('/explore')}
        >
          <View style={styles.seasonalAlertLeft}>
            <Text style={styles.seasonalAlertTitle}>
              📈 Pagtataya ng Benta Kada Panahon
            </Text>
            <Text style={styles.seasonalAlertSub}>
              Tingnan ang buwanang benta at kasaysayan ng paninda ›
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* Edit Product Modal (Bottom Sheet with Opaque Backdrop & Confirmation Review) */}
      <Modal
        visible={!!editingProduct}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setEditingProduct(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdropContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.modalBackdropPressable}
            onPress={() => setEditingProduct(null)}
          />
          <View style={styles.modalContentCard}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderTitleGroup}>
                <View style={styles.modalHeaderIconBadge}>
                  <Ionicons name="pencil" size={16} color="#0D7A52" />
                </View>
                <View>
                  <Text style={styles.modalTitleText}>I-edit ang Paninda</Text>
                  {editingProduct ? (
                    <Text style={styles.modalSubtitleBarcode}>
                      Barcode: {editingProduct.barcode}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable
                onPress={() => setEditingProduct(null)}
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
              <Text style={styles.modalInputLabel}>Pangalan ng Paninda *</Text>
              <TextInput
                style={styles.modalInputField}
                value={editName}
                onChangeText={setEditName}
                placeholder="hal. Alaska Evap 370ml"
                placeholderTextColor="#9CA3AF"
              />

              {/* Unit of Measure / Packaging Selector */}
              <Text style={styles.modalInputLabel}>Uri ng Paninda at Pagbenta *</Text>
              <View style={styles.unitSelectorRow}>
                <Pressable
                  style={[styles.unitToggleBtn, editPackagingType === 'PACK' && styles.unitToggleBtnActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setEditPackagingType('PACK');
                    setEditUnitOfMeasure('pc');
                    if (!editPackMultiplier || editPackMultiplier === '0') setEditPackMultiplier('10');
                    if (editPieceCostParsed > 0 && (!editBundleCostPhp || parseFloat(editBundleCostPhp) === 0)) {
                      const mult = parseInt(editPackMultiplier || '10', 10);
                      setEditBundleCostPhp((editPieceCostParsed * (mult > 0 ? mult : 10)).toFixed(2));
                    }
                  }}
                >
                  <Ionicons
                    name="layers-outline"
                    size={15}
                    color={editPackagingType === 'PACK' ? '#0D7A52' : '#64748B'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.unitToggleText, editPackagingType === 'PACK' && styles.unitToggleTextActive]}>
                    📦 Naka-Pack
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.unitToggleBtn, editPackagingType === 'PIECE' && styles.unitToggleBtnActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setEditPackagingType('PIECE');
                    setEditUnitOfMeasure('pc');
                    if (editBundleCostParsed > 0) {
                      const pMult = parseInt(editPackMultiplier.replace(/[^0-9]/g, '') || '10', 10);
                      setEditCostPhp((editBundleCostParsed / (pMult > 0 ? pMult : 10)).toFixed(2));
                    }
                  }}
                >
                  <Ionicons
                    name="cube-outline"
                    size={15}
                    color={editPackagingType === 'PIECE' ? '#0D7A52' : '#64748B'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.unitToggleText, editPackagingType === 'PIECE' && styles.unitToggleTextActive]}>
                    🏷️ Tingi Lang
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.unitToggleBtn, editPackagingType === 'KG' && styles.unitToggleBtnActive]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setEditPackagingType('KG');
                    setEditUnitOfMeasure('kg');
                  }}
                >
                  <Ionicons
                    name="scale"
                    size={15}
                    color={editPackagingType === 'KG' ? '#0D7A52' : '#64748B'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[styles.unitToggleText, editPackagingType === 'KG' && styles.unitToggleTextActive]}>
                    ⚖️ Kilo (kg)
                  </Text>
                </Pressable>
              </View>

              {/* DYNAMIC EDIT INPUTS ACCORDING TO PACKAGING TYPE */}
              {editPackagingType === 'PACK' ? (
                /* PACK MODE */
                <View style={{ gap: 10 }}>
                  <View style={styles.modalTwoColGrid}>
                    <View style={styles.modalCol}>
                      <Text style={styles.modalInputLabel}>Kasalukuyang Stock (piraso) *</Text>
                      <TextInput
                        style={styles.modalInputField}
                        value={editStock}
                        onChangeText={(val) => {
                          setEditError(null);
                          setEditStock(val);
                        }}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.modalCol}>
                      <Text style={styles.modalInputLabel}>Mababang Stock Alert *</Text>
                      <TextInput
                        style={styles.modalInputField}
                        value={editLowThreshold}
                        onChangeText={setEditLowThreshold}
                        placeholder="5"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>

                  {/* Pack Cost & Multiplier */}
                  <View style={styles.costSectionCard}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#166534', marginBottom: 2 }}>
                      🧾 Puhunan sa Resibo (Wholesale Pack)
                    </Text>
                    <View style={styles.twoColRow}>
                      <View style={{ flex: 1.2 }}>
                        <Text style={styles.fieldLabel}>Presyo ng 1 Pack (₱):</Text>
                        <TextInput
                          style={styles.textInput}
                          value={editBundleCostPhp}
                          onChangeText={(val) => {
                            setEditBundleCostPhp(val);
                            const bCost = parseFloat(val.replace(/[^0-9.]/g, '') || '0');
                            const mult = parseInt(editPackMultiplier.replace(/[^0-9]/g, '') || '10', 10);
                            const costNum = bCost > 0 ? bCost / (mult > 0 ? mult : 10) : 0;
                            if (costNum > 0) {
                              setEditCostPhp(costNum.toFixed(2));
                            }
                            if (editTuboValue && costNum > 0) {
                              const tuboNum = parseFloat(editTuboValue.replace(/[^0-9.]/g, '') || '0');
                              const nextPrice =
                                editTuboMode === 'PESO'
                                  ? costNum + tuboNum
                                  : costNum * (1 + tuboNum / 100);
                              setEditPricePhp(nextPrice > 0 ? nextPrice.toFixed(2) : '');
                            }
                          }}
                          placeholder="Hal. 100.00"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={{ flex: 0.9 }}>
                        <Text style={styles.fieldLabel}>Piraso sa 1 Pack:</Text>
                        <TextInput
                          style={styles.textInput}
                          value={editPackMultiplier}
                          onChangeText={(val) => {
                            setEditPackMultiplier(val);
                            const bCost = parseFloat(editBundleCostPhp.replace(/[^0-9.]/g, '') || '0');
                            const mult = parseInt(val.replace(/[^0-9]/g, '') || '10', 10);
                            const costNum = bCost > 0 && mult > 0 ? bCost / mult : 0;
                            if (costNum > 0) {
                              setEditCostPhp(costNum.toFixed(2));
                            }
                            if (editTuboValue && costNum > 0) {
                              const tuboNum = parseFloat(editTuboValue.replace(/[^0-9.]/g, '') || '0');
                              const nextPrice =
                                editTuboMode === 'PESO'
                                  ? costNum + tuboNum
                                  : costNum * (1 + tuboNum / 100);
                              setEditPricePhp(nextPrice > 0 ? nextPrice.toFixed(2) : '');
                            }
                          }}
                          placeholder="10"
                          placeholderTextColor="#9CA3AF"
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    {/* Auto-Compute Sneak Peek Banner */}
                    {editEffectiveUnitCost > 0 || editParsedStock > 0 ? (
                      <View style={styles.sneakPeekBanner}>
                        <View style={styles.sneakPeekHeader}>
                          <Ionicons name="calculator-outline" size={14} color="#065F46" />
                          <Text style={styles.sneakPeekTitle}>⚡ Kwenta ng Puhunan at Stock:</Text>
                        </View>
                        <View style={styles.sneakPeekMetrics}>
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Puhunan / Piraso</Text>
                            <Text style={styles.sneakPeekValue}>₱{editEffectiveUnitCost.toFixed(2)}</Text>
                          </View>
                          <View style={styles.sneakPeekDivider} />
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Kasalukuyang Stock</Text>
                            <Text style={styles.sneakPeekValue}>{editParsedStock} pcs</Text>
                          </View>
                          <View style={styles.sneakPeekDivider} />
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Kabuuang Puhunan</Text>
                            <Text style={styles.sneakPeekValue}>
                              ₱{editTotalCapitalSpent.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {/* Tubo sa Tingi */}
                  <View style={styles.tuboSectionCard}>
                    <View style={styles.tuboHeaderRow}>
                      <Text style={styles.fieldLabel}>Tubo sa Bawat Piraso (Tingi):</Text>
                      <View style={styles.modeSegmentRow}>
                        <Pressable
                          style={[styles.modeSegmentBtn, editTuboMode === 'PESO' ? styles.modeSegmentBtnActive : null]}
                          onPress={() => {
                            setEditTuboMode('PESO');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            if (editTuboValue && editEffectiveUnitCost > 0) handleEditTuboChange(editTuboValue, 'PESO');
                          }}
                        >
                          <Text style={[styles.modeSegmentText, editTuboMode === 'PESO' ? styles.modeSegmentTextActive : null]}>₱ Peso</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.modeSegmentBtn, editTuboMode === 'PERCENT' ? styles.modeSegmentBtnActive : null]}
                          onPress={() => {
                            setEditTuboMode('PERCENT');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            if (editTuboValue && editEffectiveUnitCost > 0) handleEditTuboChange(editTuboValue, 'PERCENT');
                          }}
                        >
                          <Text style={[styles.modeSegmentText, editTuboMode === 'PERCENT' ? styles.modeSegmentTextActive : null]}>% Percent</Text>
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
                          (chip.isPercent && editTuboMode === 'PERCENT' && editTuboValue === chip.amount.toString()) ||
                          (!chip.isPercent && editTuboMode === 'PESO' && editTuboValue === chip.amount.toString());
                        return (
                          <Pressable
                            key={chip.label}
                            style={[styles.quickTuboChip, isSelected ? styles.quickTuboChipActive : null]}
                            onPress={() => handleEditQuickTubo(chip.amount, chip.isPercent)}
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
                      value={editTuboValue}
                      onChangeText={(val) => handleEditTuboChange(val, editTuboMode)}
                      placeholder={editTuboMode === 'PESO' ? '0.00' : '20%'}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  {/* Selling Price Tingi */}
                  <View style={styles.sellingPriceSectionCard}>
                    <Text style={styles.fieldLabel}>Presyo ng Benta sa Tingi (₱ bawat piraso) *</Text>
                    <TextInput
                      style={[styles.textInput, styles.sellingPriceInput]}
                      value={editPricePhp}
                      onChangeText={handleEditPriceChange}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />

                    {editRoundingSuggestions.length > 0 ? (
                      <View style={styles.roundingBox}>
                        <Text style={styles.roundingTitle}>🪙 Walang Barya Helper:</Text>
                        <View style={styles.roundingChipsRow}>
                          {editRoundingSuggestions.map((roundPrice: number) => (
                            <Pressable
                              key={roundPrice}
                              style={styles.roundingChip}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                handleEditPriceChange(roundPrice.toFixed(2));
                              }}
                            >
                              <Text style={styles.roundingChipText}>{t.roundToLabel(roundPrice.toString())}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {editCurrentEnteredPrice > 0 ? (
                      <View style={styles.profitSummaryBox}>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>{t.profitPerPiece}</Text>
                          <Text style={styles.profitSummaryVal}>
                            ₱{editProfitPerPiece.toFixed(2)}
                            {editProfitPerPiece > 0 && editEffectiveUnitCost > 0
                              ? ` (${((editProfitPerPiece / editEffectiveUnitCost) * 100).toFixed(0)}%)`
                              : ''}
                          </Text>
                        </View>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>Kabuuang Benta</Text>
                          <Text style={styles.profitSummaryVal}>
                            ₱{(editCurrentEnteredPrice * (editParsedStock > 0 ? editParsedStock : 1)).toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>{t.totalBatchProfit}</Text>
                          <Text style={[styles.profitSummaryVal, { color: '#0D7A52', fontWeight: '800' }]}>
                            ₱{editTotalBatchProfit.toFixed(2)}
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
                        📦 Presyo ng Benta sa Buong Pack ({parseInt(editPackMultiplier, 10) || 10} piraso)
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, color: '#4B5563', lineHeight: 16 }}>
                      Iisang barcode lang ang gagamitin by default. Kapag binili ng buo ng suki sa New Sale, awtomatikong ibabawas ang {parseInt(editPackMultiplier, 10) || 10} piraso sa stock.
                    </Text>

                    {editCurrentEnteredPrice > 0 ? (
                      <View style={{ marginTop: 2 }}>
                        <Text style={{ fontSize: 11, color: '#374151', marginBottom: 4, fontWeight: '600' }}>
                          💡 Mungkahing Presyo ng Pack (Tingi: ₱{editCurrentEnteredPrice.toFixed(2)} × {editPackMultiplier || '10'} pcs = ₱{(editCurrentEnteredPrice * (parseInt(editPackMultiplier, 10) || 10)).toFixed(2)}):
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                          {[
                            {
                              label: `₱${(editCurrentEnteredPrice * (parseInt(editPackMultiplier, 10) || 10)).toFixed(2)} (Walang Bawas)`,
                              val: (editCurrentEnteredPrice * (parseInt(editPackMultiplier, 10) || 10)).toFixed(2),
                            },
                            {
                              label: `₱${Math.max(1, editCurrentEnteredPrice * (parseInt(editPackMultiplier, 10) || 10) - 5).toFixed(2)} (-₱5 Suki Bawas)`,
                              val: Math.max(1, editCurrentEnteredPrice * (parseInt(editPackMultiplier, 10) || 10) - 5).toFixed(2),
                            },
                            {
                              label: `₱${Math.max(1, editCurrentEnteredPrice * (parseInt(editPackMultiplier, 10) || 10) - 10).toFixed(2)} (-₱10 Suki Bawas)`,
                              val: Math.max(1, editCurrentEnteredPrice * (parseInt(editPackMultiplier, 10) || 10) - 10).toFixed(2),
                            },
                          ].map((chip) => (
                            <Pressable
                              key={chip.label}
                              style={[
                                styles.quickTuboChip,
                                editPackPricePhp === chip.val ? styles.quickTuboChipActive : null,
                              ]}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setEditPackPricePhp(chip.val);
                              }}
                            >
                              <Text
                                style={[
                                  styles.quickTuboChipText,
                                  editPackPricePhp === chip.val ? styles.quickTuboChipTextActive : null,
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
                        value={editPackPricePhp}
                        onChangeText={setEditPackPricePhp}
                        placeholder={
                          editCurrentEnteredPrice > 0
                            ? (editCurrentEnteredPrice * (parseInt(editPackMultiplier, 10) || 10)).toFixed(2)
                            : 'Hal. 115.00'
                        }
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                      />
                    </View>

                    <BarcodeInputField
                      label="Hiwalay na Barcode sa Pack (Opsyonal):"
                      placeholder="Iwanang blangko kung pareho lang ang barcode"
                      value={editPackBarcode}
                      onChangeBarcode={(code) => setEditPackBarcode(code)}
                      showTingiButton={false}
                      helperText="I-scan gamit ang camera kung may sariling barcode ang packaging ng pack."
                      scannerHintText="I-tapat ang barcode ng buong pack sa reticle"
                      containerStyle={{ marginVertical: 4 }}
                    />
                  </View>
                </View>
              ) : editPackagingType === 'PIECE' ? (
                /* PIECE MODE */
                <View style={{ gap: 10 }}>
                  <View style={styles.modalTwoColGrid}>
                    <View style={styles.modalCol}>
                      <Text style={styles.modalInputLabel}>Kasalukuyang Stock (piraso) *</Text>
                      <TextInput
                        style={styles.modalInputField}
                        value={editStock}
                        onChangeText={(val) => {
                          setEditError(null);
                          setEditStock(val);
                        }}
                        placeholder="0"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={styles.modalCol}>
                      <Text style={styles.modalInputLabel}>Mababang Stock Alert *</Text>
                      <TextInput
                        style={styles.modalInputField}
                        value={editLowThreshold}
                        onChangeText={setEditLowThreshold}
                        placeholder="5"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.costSectionCard}>
                    <Text style={styles.fieldLabel}>Puhunan bawat Piraso (₱) *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editCostPhp}
                      onChangeText={(val) => {
                        setEditCostPhp(val);
                        const costNum = parseFloat(val.replace(/[^0-9.]/g, '') || '0');
                        if (editTuboValue && costNum > 0) {
                          const tuboNum = parseFloat(editTuboValue.replace(/[^0-9.]/g, '') || '0');
                          const nextPrice =
                            editTuboMode === 'PESO'
                              ? costNum + tuboNum
                              : costNum * (1 + tuboNum / 100);
                          setEditPricePhp(nextPrice > 0 ? nextPrice.toFixed(2) : '');
                        }
                      }}
                      placeholder={t.autoCostHint}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />

                    {/* Auto-Compute Sneak Peek Banner */}
                    {editEffectiveUnitCost > 0 || editParsedStock > 0 ? (
                      <View style={styles.sneakPeekBanner}>
                        <View style={styles.sneakPeekHeader}>
                          <Ionicons name="calculator-outline" size={14} color="#065F46" />
                          <Text style={styles.sneakPeekTitle}>⚡ Kwenta ng Puhunan at Stock:</Text>
                        </View>
                        <View style={styles.sneakPeekMetrics}>
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Puhunan / Piraso</Text>
                            <Text style={styles.sneakPeekValue}>₱{editEffectiveUnitCost.toFixed(2)}</Text>
                          </View>
                          <View style={styles.sneakPeekDivider} />
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Kasalukuyang Stock</Text>
                            <Text style={styles.sneakPeekValue}>{editParsedStock} pcs</Text>
                          </View>
                          <View style={styles.sneakPeekDivider} />
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Kabuuang Puhunan</Text>
                            <Text style={styles.sneakPeekValue}>
                              ₱{editTotalCapitalSpent.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.tuboSectionCard}>
                    <View style={styles.tuboHeaderRow}>
                      <Text style={styles.fieldLabel}>{t.desiredProfitLabel}</Text>
                      <View style={styles.modeSegmentRow}>
                        <Pressable
                          style={[styles.modeSegmentBtn, editTuboMode === 'PESO' ? styles.modeSegmentBtnActive : null]}
                          onPress={() => {
                            setEditTuboMode('PESO');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            if (editTuboValue && editEffectiveUnitCost > 0) handleEditTuboChange(editTuboValue, 'PESO');
                          }}
                        >
                          <Text style={[styles.modeSegmentText, editTuboMode === 'PESO' ? styles.modeSegmentTextActive : null]}>₱ Peso</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.modeSegmentBtn, editTuboMode === 'PERCENT' ? styles.modeSegmentBtnActive : null]}
                          onPress={() => {
                            setEditTuboMode('PERCENT');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            if (editTuboValue && editEffectiveUnitCost > 0) handleEditTuboChange(editTuboValue, 'PERCENT');
                          }}
                        >
                          <Text style={[styles.modeSegmentText, editTuboMode === 'PERCENT' ? styles.modeSegmentTextActive : null]}>% Percent</Text>
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
                          (chip.isPercent && editTuboMode === 'PERCENT' && editTuboValue === chip.amount.toString()) ||
                          (!chip.isPercent && editTuboMode === 'PESO' && editTuboValue === chip.amount.toString());
                        return (
                          <Pressable
                            key={chip.label}
                            style={[styles.quickTuboChip, isSelected ? styles.quickTuboChipActive : null]}
                            onPress={() => handleEditQuickTubo(chip.amount, chip.isPercent)}
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
                      value={editTuboValue}
                      onChangeText={(val) => handleEditTuboChange(val, editTuboMode)}
                      placeholder={editTuboMode === 'PESO' ? '0.00' : '20%'}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.sellingPriceSectionCard}>
                    <Text style={styles.fieldLabel}>Presyo ng Benta sa Tingi (₱) *</Text>
                    <TextInput
                      style={[styles.textInput, styles.sellingPriceInput]}
                      value={editPricePhp}
                      onChangeText={handleEditPriceChange}
                      placeholder="0.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />

                    {editRoundingSuggestions.length > 0 ? (
                      <View style={styles.roundingBox}>
                        <Text style={styles.roundingTitle}>🪙 Walang Barya Helper:</Text>
                        <View style={styles.roundingChipsRow}>
                          {editRoundingSuggestions.map((roundPrice: number) => (
                            <Pressable
                              key={roundPrice}
                              style={styles.roundingChip}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                handleEditPriceChange(roundPrice.toFixed(2));
                              }}
                            >
                              <Text style={styles.roundingChipText}>{t.roundToLabel(roundPrice.toString())}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {editCurrentEnteredPrice > 0 ? (
                      <View style={styles.profitSummaryBox}>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>{t.profitPerPiece}</Text>
                          <Text style={styles.profitSummaryVal}>
                            ₱{editProfitPerPiece.toFixed(2)}
                            {editProfitPerPiece > 0 && editEffectiveUnitCost > 0
                              ? ` (${((editProfitPerPiece / editEffectiveUnitCost) * 100).toFixed(0)}%)`
                              : ''}
                          </Text>
                        </View>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>Kabuuang Benta</Text>
                          <Text style={styles.profitSummaryVal}>
                            ₱{(editCurrentEnteredPrice * (editParsedStock > 0 ? editParsedStock : 1)).toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>{t.totalBatchProfit}</Text>
                          <Text style={[styles.profitSummaryVal, { color: '#0D7A52', fontWeight: '800' }]}>
                            ₱{editTotalBatchProfit.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : (
                /* KG MODE */
                <View style={{ gap: 10 }}>
                  <View style={styles.modalTwoColGrid}>
                    <View style={styles.modalCol}>
                      <Text style={styles.modalInputLabel}>Kasalukuyang Stock (kg) *</Text>
                      <TextInput
                        style={styles.modalInputField}
                        value={editStock}
                        onChangeText={(val) => {
                          setEditError(null);
                          setEditStock(val);
                        }}
                        placeholder="50.0"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.modalCol}>
                      <Text style={styles.modalInputLabel}>Mababang Stock Alert (kg) *</Text>
                      <TextInput
                        style={styles.modalInputField}
                        value={editLowThreshold}
                        onChangeText={setEditLowThreshold}
                        placeholder="5.0"
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.costSectionCard}>
                    <Text style={styles.fieldLabel}>Puhunan bawat Kilo (₱) *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editCostPhp}
                      onChangeText={(val) => {
                        setEditCostPhp(val);
                        const costNum = parseFloat(val.replace(/[^0-9.]/g, '') || '0');
                        if (editTuboValue && costNum > 0) {
                          const tuboNum = parseFloat(editTuboValue.replace(/[^0-9.]/g, '') || '0');
                          const nextPrice =
                            editTuboMode === 'PESO'
                              ? costNum + tuboNum
                              : costNum * (1 + tuboNum / 100);
                          setEditPricePhp(nextPrice > 0 ? nextPrice.toFixed(2) : '');
                        }
                      }}
                      placeholder="Hal. 42.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />

                    {/* Auto-Compute Sneak Peek Banner */}
                    {editEffectiveUnitCost > 0 || editParsedStock > 0 ? (
                      <View style={styles.sneakPeekBanner}>
                        <View style={styles.sneakPeekHeader}>
                          <Ionicons name="calculator-outline" size={14} color="#065F46" />
                          <Text style={styles.sneakPeekTitle}>⚡ Kwenta ng Puhunan at Stock:</Text>
                        </View>
                        <View style={styles.sneakPeekMetrics}>
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Puhunan / Kilo</Text>
                            <Text style={styles.sneakPeekValue}>₱{editEffectiveUnitCost.toFixed(2)}</Text>
                          </View>
                          <View style={styles.sneakPeekDivider} />
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Kasalukuyang Stock</Text>
                            <Text style={styles.sneakPeekValue}>{editParsedStock} kg</Text>
                          </View>
                          <View style={styles.sneakPeekDivider} />
                          <View style={styles.sneakPeekItem}>
                            <Text style={styles.sneakPeekLabel}>Kabuuang Puhunan</Text>
                            <Text style={styles.sneakPeekValue}>
                              ₱{editTotalCapitalSpent.toFixed(2)}
                            </Text>
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
                          style={[styles.modeSegmentBtn, editTuboMode === 'PESO' ? styles.modeSegmentBtnActive : null]}
                          onPress={() => {
                            setEditTuboMode('PESO');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            if (editTuboValue && editEffectiveUnitCost > 0) handleEditTuboChange(editTuboValue, 'PESO');
                          }}
                        >
                          <Text style={[styles.modeSegmentText, editTuboMode === 'PESO' ? styles.modeSegmentTextActive : null]}>₱ Peso</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.modeSegmentBtn, editTuboMode === 'PERCENT' ? styles.modeSegmentBtnActive : null]}
                          onPress={() => {
                            setEditTuboMode('PERCENT');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            if (editTuboValue && editEffectiveUnitCost > 0) handleEditTuboChange(editTuboValue, 'PERCENT');
                          }}
                        >
                          <Text style={[styles.modeSegmentText, editTuboMode === 'PERCENT' ? styles.modeSegmentTextActive : null]}>% Percent</Text>
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
                          (chip.isPercent && editTuboMode === 'PERCENT' && editTuboValue === chip.amount.toString()) ||
                          (!chip.isPercent && editTuboMode === 'PESO' && editTuboValue === chip.amount.toString());
                        return (
                          <Pressable
                            key={chip.label}
                            style={[styles.quickTuboChip, isSelected ? styles.quickTuboChipActive : null]}
                            onPress={() => handleEditQuickTubo(chip.amount, chip.isPercent)}
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
                      value={editTuboValue}
                      onChangeText={(val) => handleEditTuboChange(val, editTuboMode)}
                      placeholder={editTuboMode === 'PESO' ? '0.00' : '15%'}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <View style={styles.sellingPriceSectionCard}>
                    <Text style={styles.fieldLabel}>Presyo ng Benta bawat Kilo (₱) *</Text>
                    <TextInput
                      style={[styles.textInput, styles.sellingPriceInput]}
                      value={editPricePhp}
                      onChangeText={handleEditPriceChange}
                      placeholder="Hal. 52.00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="decimal-pad"
                    />

                    {editRoundingSuggestions.length > 0 ? (
                      <View style={styles.roundingBox}>
                        <Text style={styles.roundingTitle}>🪙 Walang Barya Helper:</Text>
                        <View style={styles.roundingChipsRow}>
                          {editRoundingSuggestions.map((roundPrice: number) => (
                            <Pressable
                              key={roundPrice}
                              style={styles.roundingChip}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                handleEditPriceChange(roundPrice.toFixed(2));
                              }}
                            >
                              <Text style={styles.roundingChipText}>{t.roundToLabel(roundPrice.toString())}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {editCurrentEnteredPrice > 0 ? (
                      <View style={styles.profitSummaryBox}>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>Tubo bawat Kilo</Text>
                          <Text style={styles.profitSummaryVal}>
                            ₱{editProfitPerPiece.toFixed(2)}
                            {editProfitPerPiece > 0 && editEffectiveUnitCost > 0
                              ? ` (${((editProfitPerPiece / editEffectiveUnitCost) * 100).toFixed(0)}%)`
                              : ''}
                          </Text>
                        </View>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>Kabuuang Benta</Text>
                          <Text style={styles.profitSummaryVal}>
                            ₱{(editCurrentEnteredPrice * (editParsedStock > 0 ? editParsedStock : 1)).toFixed(2)}
                          </Text>
                        </View>
                        <View style={styles.profitSummaryRow}>
                          <Text style={styles.profitSummaryLabel}>{t.totalBatchProfit}</Text>
                          <Text style={[styles.profitSummaryVal, { color: '#0D7A52', fontWeight: '800' }]}>
                            ₱{editTotalBatchProfit.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Kasalukuyang Kategorya */}
              <View style={[styles.modalTwoColGrid, { marginTop: 14 }]}>
                <View style={styles.modalCol}>
                  <Text style={styles.modalInputLabel}>Kasalukuyang Kategorya</Text>
                  <Text style={styles.modalSelectedCatBadge}>{editCategory}</Text>
                </View>
              </View>

              <Text style={[styles.modalInputLabel, { marginTop: 10 }]}>Pumili ng Kategorya:</Text>
              <View style={styles.modalCategoryWrap}>
                {categories.map((cat) => {
                  const isSelected = editCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      style={[
                        styles.modalCatChip,
                        isSelected ? styles.modalCatChipActive : null,
                      ]}
                      onPress={() => setEditCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.modalCatChipText,
                          isSelected ? styles.modalCatChipTextActive : null,
                        ]}
                      >
                        {isSelected ? '✓ ' : ''}{cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Petsa ng Expiry */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.modalInputLabel}>Petsa ng Expiry (YYYY-MM-DD):</Text>
                <TextInput
                  style={styles.textInput}
                  value={editExpiryDate}
                  onChangeText={setEditExpiryDate}
                  placeholder="Hal. 2026-12-31"
                  placeholderTextColor="#9CA3AF"
                  maxLength={10}
                />
              </View>


              <View style={styles.modalActionsRow}>
                <Pressable
                  style={styles.modalDismissBtn}
                  onPress={() => setEditingProduct(null)}
                >
                  <Text style={styles.modalDismissBtnText}>Kanselahin</Text>
                </Pressable>

                <Pressable
                  style={[styles.modalCommitBtn, isSubmittingEdit ? styles.btnDisabled : null]}
                  disabled={isSubmittingEdit}
                  onPress={handleSaveEditProduct}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.modalCommitBtnText}>
                    {isSubmittingEdit ? 'Sinusuri...' : 'I-save ang Pagbabago'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category Management Modal (Add, Edit, Delete with Confirmation) */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => {
          setShowCategoryModal(false);
          setEditingCategoryOldName(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdropContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.modalBackdropPressable}
            onPress={() => {
              setShowCategoryModal(false);
              setEditingCategoryOldName(null);
            }}
          />
          <View style={styles.modalContentCard}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderTitleGroup}>
                <View style={styles.modalHeaderIconBadge}>
                  <Ionicons name="folder-outline" size={16} color="#0D7A52" />
                </View>
                <View>
                  <Text style={styles.modalTitleText}>{t.manageCategories}</Text>
                  <Text style={styles.modalSubtitleBarcode}>
                    {categories.length} {categories.length === 1 ? 'kategorya' : 'mga kategorya'}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  setShowCategoryModal(false);
                  setEditingCategoryOldName(null);
                }}
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
              {categoryModalSuccess ? (
                <View style={styles.inModalSuccessBanner}>
                  <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  <Text style={styles.inModalSuccessText}>{categoryModalSuccess}</Text>
                </View>
              ) : null}

              {/* Add New Category Box */}
              <View style={styles.addCategoryBox}>
                <TextInput
                  style={styles.addCategoryInput}
                  value={newCategoryName}
                  onChangeText={(val) => {
                    setCategoryModalError(null);
                    setNewCategoryName(val);
                  }}
                  placeholder={t.newCategoryNamePlaceholder}
                  placeholderTextColor="#9CA3AF"
                />
                <Pressable
                  style={styles.addCategoryBtn}
                  onPress={handleAddNewCategory}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.addCategoryBtnText}>{t.addCategory}</Text>
                </Pressable>
              </View>


              {/* Category List */}
              <View style={styles.categoryListContainer}>
                {categories.map((cat) => {
                  const isEditingThis = editingCategoryOldName === cat;
                  return (
                    <View key={cat} style={styles.categoryListItem}>
                      {isEditingThis ? (
                        <View style={styles.categoryEditRow}>
                          <TextInput
                            style={styles.categoryEditInput}
                            value={editingCategoryNewName}
                            onChangeText={setEditingCategoryNewName}
                            autoFocus
                          />
                          <Pressable
                            style={styles.categorySaveBtn}
                            onPress={() => handleSaveCategoryEdit(cat)}
                          >
                            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          </Pressable>
                          <Pressable
                            style={styles.categoryCancelBtn}
                            onPress={() => setEditingCategoryOldName(null)}
                          >
                            <Ionicons name="close" size={16} color="#64748B" />
                          </Pressable>
                        </View>
                      ) : (
                        <View style={styles.categoryViewRow}>
                          <View style={styles.categoryNameCol}>
                            <Text style={styles.categoryNameText}>{cat}</Text>
                            <Text style={styles.categoryCountSub}>
                              {products.filter((p) => p.category === cat).length} paninda
                            </Text>
                          </View>
                          <View style={styles.categoryActionsRow}>
                            <Pressable
                              style={styles.categoryActionBtn}
                              onPress={() => {
                                setEditingCategoryOldName(cat);
                                setEditingCategoryNewName(cat);
                              }}
                              hitSlop={8}
                            >
                              <Ionicons name="pencil-outline" size={16} color="#0D7A52" />
                            </Pressable>
                            <Pressable
                              style={[
                                styles.categoryActionBtn,
                                categories.length <= 1 ? styles.btnDisabled : null,
                              ]}
                              disabled={categories.length <= 1}
                              onPress={() => handleDeleteCategory(cat)}
                              hitSlop={8}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color={categories.length <= 1 ? '#9CA3AF' : '#DC2626'}
                              />
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              <Pressable
                style={styles.categoryDoneBtn}
                onPress={() => {
                  setShowCategoryModal(false);
                  setEditingCategoryOldName(null);
                }}
              >
                <Text style={styles.categoryDoneBtnText}>{t.closeBtn}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Styled Confirmation Modal */}
      {confirmDialog ? (
        <ConfirmationModal
          visible={true}
          type={confirmDialog.type}
          title={confirmDialog.title}
          message={confirmDialog.message}
          itemName={confirmDialog.itemName}
          details={confirmDialog.details}
          confirmText={confirmDialog.confirmText}
          cancelText={confirmDialog.cancelText}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          reasonSelector={confirmDialog.reasonSelector}
        />
      ) : null}

      <PinChallengeModal
        visible={pinChallengeAction !== null}
        title="Owner PIN Required"
        subtitle="Only the Tindahan Owner can edit catalog prices and stock details"
        onSuccess={() => {
          const action = pinChallengeAction;
          setPinChallengeAction(null);
          setOperatingMode('OWNER');
          if (action) action();
        }}
        onCancel={() => setPinChallengeAction(null)}
      />
    </ScreenSafeAreaView>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
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
    fontWeight: '700',
    fontSize: 11,
  },
  headerTitle: {
    fontSize: 19,
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
  filterBadgePill: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeRed: {
    backgroundColor: '#EF4444',
  },
  filterBadgeAmber: {
    backgroundColor: '#F59E0B',
  },
  filterBadgePurple: {
    backgroundColor: '#8B5CF6',
  },
  filterBadgeGreen: {
    backgroundColor: '#10B981',
  },
  filterBadgeNeutral: {
    backgroundColor: '#0D7A52',
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  topDrawerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editProductBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  editProductBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  modalBackdropContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    width: '100%',
    height: '100%',
  },
  modalBackdropPressable: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalContentCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    width: '100%',
    maxHeight: '85%',
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
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  modalTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitleBarcode: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
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
    paddingBottom: 20,
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 8,
  },
  modalInputField: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
  },
  modalTwoColGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalCol: {
    flex: 1,
  },
  modalSelectedCatBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
    textAlign: 'center',
  },
  modalCategoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  modalCatChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  modalCatChipActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  modalCatChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  modalCatChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  modalErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  modalErrorLabel: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '700',
    flex: 1,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 10,
  },
  modalDismissBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalDismissBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  modalCommitBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#0D7A52',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D7A52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalCommitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageCatHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 4,
  },
  manageCatHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  catChipManage: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#0D7A52',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catChipManageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D7A52',
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
    marginTop: 8,
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
  inModalSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 8,
  },
  inModalSuccessText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },
  addCategoryBox: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  addCategoryInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  addCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D7A52',
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    gap: 4,
  },
  addCategoryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  categoryListContainer: {
    gap: 8,
    marginBottom: 16,
  },
  categoryListItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  categoryViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryNameCol: {
    flex: 1,
  },
  categoryNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  categoryCountSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  categoryActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  categoryActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryEditInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0D7A52',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  categorySaveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0D7A52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryDoneBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  categoryDoneBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  costSectionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  costModeHeader: {
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
  bundleHint: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
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
  costWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  costWarningText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 15,
  },
  tierSection: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  tierToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
  },
  tierToggleTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  tierContainer: {
    padding: 12,
  },
  tierSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 16,
  },
  tierCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tierCheckboxRowActive: {
    borderColor: '#0D7A52',
    backgroundColor: '#ECFDF5',
  },
  tierCheckboxLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  tierCheckboxLabelActive: {
    color: '#0D7A52',
    fontWeight: '700',
  },
  itemTiersSummaryBadge: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    marginBottom: 6,
    gap: 2,
  },
  itemTierBadgeHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 2,
  },
  itemTierBadgeText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
  },
});
