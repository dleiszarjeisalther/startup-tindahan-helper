import React, { useState, useCallback, useEffect } from 'react';
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
  Image,
} from 'react-native';
import { ScreenSafeAreaView } from '@/presentation/components/ScreenSafeAreaView';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { useIdempotentSubmit } from '@/presentation/hooks/useIdempotentSubmit';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';
import { UnitSelectionModal } from '@/presentation/components/UnitSelectionModal';
import { GcashQrModal } from '@/presentation/components/GcashQrModal';
import { ProductDTO, SellingUnitTier } from '@/domain/entities/Product';
import { PaymentTenderType, SaleTransactionRecord, CartItemDTO } from '@/application/TindahanStoreService';
import { Money } from '@/domain/value-objects/Money';
import { getTranslations } from '@/presentation/localization/i18n';
import { FloatingToast, ToastType } from '@/presentation/components/FloatingToast';
import { WeightQuantityModal, WeightQuantityProduct } from '@/presentation/components/WeightQuantityModal';
import {
  ConfirmationModal,
  ConfirmationType,
  ConfirmationModalDetail,
} from '@/presentation/components/ConfirmationModal';
import { ReceiptPrinterModal } from '@/presentation/components/ReceiptPrinterModal';
import { useLicensing } from '@/presentation/hooks/useLicensing';
import { useLicensingGate } from '@/presentation/components/LicensingGate';
import { CancelExchangeCreditModal } from '@/presentation/components/CancelExchangeCreditModal';

interface ConfirmationState {
  type: ConfirmationType;
  title: string;
  message: string;
  itemName?: string;
  details?: ConfirmationModalDetail[];
  confirmText?: string;
  cancelText?: string | null;
  onConfirm: () => void | Promise<void>;
}

interface CartItemStepperProps {
  productId: string;
  quantity: number;
  unitOfMeasure?: 'pc' | 'kg';
  formattedQuantity?: string;
  onUpdateQty: (qty: number) => void;
  onDelta: (delta: number) => void;
  onOpenWeightModal?: () => void;
}

function CartItemStepper({
  quantity,
  unitOfMeasure,
  formattedQuantity,
  onUpdateQty,
  onDelta,
  onOpenWeightModal,
}: CartItemStepperProps) {
  const [focusedText, setFocusedText] = useState<string | null>(null);

  if (unitOfMeasure === 'kg') {
    return (
      <View style={styles.kgStepperContainer}>
        <Pressable
          style={styles.kgStepperBtn}
          hitSlop={8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onDelta(-0.25);
          }}
        >
          <Text style={styles.kgStepperSymbol}>−</Text>
        </Pressable>

        <Pressable
          style={styles.kgDisplayBtn}
          onPress={onOpenWeightModal}
          hitSlop={6}
        >
          <Ionicons name="scale-outline" size={13} color="#0D7A52" style={{ marginRight: 3 }} />
          <Text style={styles.kgDisplayText}>
            {formattedQuantity || `${quantity} kg`}
          </Text>
          <Ionicons name="pencil" size={11} color="#6B7280" style={{ marginLeft: 3 }} />
        </Pressable>

        <Pressable
          style={styles.kgStepperBtn}
          hitSlop={8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            onDelta(0.25);
          }}
        >
          <Text style={styles.kgStepperSymbol}>+</Text>
        </Pressable>
      </View>
    );
  }

  const displayValue = focusedText !== null ? focusedText : String(quantity);

  const handleBlur = () => {
    if (focusedText !== null) {
      const parsed = parseInt(focusedText.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        onUpdateQty(parsed);
      }
      setFocusedText(null);
    }
  };

  const handleChangeText = (val: string) => {
    setFocusedText(val);
    const parsed = parseInt(val.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed) && parsed >= 0) {
      onUpdateQty(parsed);
    }
  };

  return (
    <View style={styles.stepperContainer}>
      <Pressable
        style={styles.stepperBtn}
        hitSlop={8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onDelta(-1);
        }}
      >
        <Text style={styles.stepperSymbol}>−</Text>
      </Pressable>

      <TextInput
        style={styles.stepperInput}
        value={displayValue}
        onChangeText={handleChangeText}
        onFocus={() => setFocusedText(String(quantity))}
        onBlur={handleBlur}
        keyboardType="number-pad"
        selectTextOnFocus
        textAlign="center"
        maxLength={4}
      />

      <Pressable
        style={styles.stepperBtn}
        hitSlop={8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          onDelta(1);
        }}
      >
        <Text style={styles.stepperSymbol}>+</Text>
      </Pressable>
    </View>
  );
}

export default function CheckoutNewSaleScreen() {
  const router = useRouter();
  const {
    products,
    cartSummary,
    heldCarts,
    utangCustomers,
    settings,
    addToCart,
    setCartItemQuantity,
    undoRemoveCartItem,
    setDiscountPhp,
    clearCart,
    convertExchangeCreditToCashRefund,
    undoExchangeCreditReturn,
    parkCurrentCart,
    restoreHeldCart,
    deleteHeldCart,
    completeSale,
    cartRevision,
    version,
    updateProductDetails,
    updateSettings,
  } = useTindahanStore();

  const t = getTranslations(settings?.language);
  const { isFeatureLocked, updateClockCheck } = useLicensing();
  const { openUpgradeModal } = useLicensingGate();

  const [tenderType, setTenderType] = useState<PaymentTenderType>('CASH');
  // User-input Payment Amount Received (TextInput) — starts empty so user can optionally type cash bill handed
  const [paymentInputText, setPaymentInputText] = useState<string>('');
  // User-input Discount (TextInput)
  const [discountInputText, setDiscountInputText] = useState<string>(
    cartSummary.discountPhp > 0 ? String(cartSummary.discountPhp) : ''
  );
  // User-input GCash Reference #
  const [gcashRefInput, setGcashRefInput] = useState<string>('');
  const [showGcashQrModal, setShowGcashQrModal] = useState<boolean>(false);
  const [copiedGcashInfo, setCopiedGcashInfo] = useState<boolean>(false);
  // Utang customer selection or custom input
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [chargeShortfallToUtang, setChargeShortfallToUtang] = useState(false);
  const [holdModalVisible, setHoldModalVisible] = useState(false);
  const [holdCustomerName, setHoldCustomerName] = useState('');
  const [heldCartsModalVisible, setHeldCartsModalVisible] = useState(false);
  const [completedTx, setCompletedTx] = useState<SaleTransactionRecord | null>(null);
  const [convenienceFeePhp, setConvenienceFeePhp] = useState<number>(0);
  const [showPrinterModal, setShowPrinterModal] = useState<boolean>(false);
  const [weightModalProduct, setWeightModalProduct] = useState<WeightQuantityProduct | null>(null);
  const [unitModalSelection, setUnitModalSelection] = useState<{ product: ProductDTO; item: CartItemDTO } | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>('success');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationState | null>(null);
  const [showCancelExchangeModal, setShowCancelExchangeModal] = useState<boolean>(false);

  const handleDismissToast = useCallback(() => {
    setToastMsg(null);
  }, []);

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  }, []);

  useEffect(() => {
    if (__DEV__) console.debug('[StoreRender]', { surface: 'Checkout', version, cartCount: cartSummary.totalCount });
  }, [version, cartSummary.totalCount]);

  const resetSaleForm = useCallback(() => {
    setCompletedTx(null);
    setPaymentInputText('');
    setDiscountInputText('');
    setSelectedCustomer('');
    setGcashRefInput('');
    setChargeShortfallToUtang(false);
  }, []);



  const visibleCompletedTx = cartSummary.totalCount === 0 ? completedTx : null;

  const runCartAction = useCallback((action: () => void, afterCommit?: () => void) => {
    try {
      action();
      afterCommit?.();
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const errorMsg =
        error instanceof Error ? error.message : 'Could not save the cart. Please try again.';
      const isInsufficient =
        errorMsg.toLowerCase().includes('insufficient') ||
        errorMsg.toLowerCase().includes('kulang') ||
        errorMsg.toLowerCase().includes('stock');
      setConfirmDialog({
        type: isInsufficient ? 'warning' : 'danger',
        title: isInsufficient ? 'Kulang ang Stock' : 'May Error sa Cart',
        message: errorMsg,
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
    }
  }, [setConfirmDialog]);

  const handleUnitSwitch = (
    newUnit: 'piece' | 'pack' | 'box',
    multiplier: number,
    price: number,
    fellBackToPiece?: boolean
  ) => {
    if (!unitModalSelection) return;
    const { product, item } = unitModalSelection;
    if (item.unit !== newUnit || fellBackToPiece) {
      runCartAction(() => {
        // Proportional quantity conversion (cart-scoped only; does NOT modify product in SQLite catalog)
        // - From piece to pack: 20 pcs -> 2 packs, 1 to 9 pcs -> 1 pack
        // - From pack to piece: 2 packs -> 20 pcs
        const mult = multiplier > 0 ? multiplier : (item.unitMultiplier || 10);
        let targetQty = item.quantity;
        if (item.unit === 'piece' && newUnit === 'pack') {
          targetQty = Math.max(1, Math.floor(item.quantity / mult));
        } else if (item.unit === 'pack' && newUnit === 'piece') {
          targetQty = Math.max(1, item.quantity * mult);
        }

        // 3. Reset the old unit cart entry to 0
        setCartItemQuantity(item.cartKey ?? item.productId, 0);
        // 4. Add the new unit cart entry with the desired quantity
        const result = addToCart(product.id, targetQty, newUnit);
        if (result?.fellBackToPiece || fellBackToPiece) {
          showToast(
            `⚠️ Kulang ang stock para sa buong ${newUnit}. Pinalitan sa Per Piece (${product.name}).`
          );
        } else {
          showToast(
            `✓ Pinalitan sa ${
              newUnit === 'pack'
                ? 'Whole Pack'
                : newUnit === 'box'
                ? 'Whole Box'
                : 'Per Piece'
            } (${product.name})`
          );
        }
      });
    }
    setUnitModalSelection(null);
  };

  const handleSaveUnitConfig = async (tiers: SellingUnitTier[]) => {
    if (!unitModalSelection) return;
    try {
      await updateProductDetails(unitModalSelection.product.id, { sellingTiers: tiers });
      showToast(`✓ Na-update ang pack settings para sa ${unitModalSelection.product.name}`);
    } catch (e) {
      console.error('[Checkout Screen] Failed to save tiers:', e);
    }
  };

  useEffect(() => {
    if (
      cartSummary.discountPhp === 0 &&
      discountInputText !== '' &&
      discountInputText !== '0' &&
      discountInputText !== '0.00'
    ) {
      const timer = setTimeout(() => {
        setDiscountInputText('');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [cartSummary.discountPhp, discountInputText]);

  const hasUserTypedPayment = paymentInputText.trim() !== '';
  const parsedPaymentPhp = parseFloat(paymentInputText.replace(/[^0-9.]/g, '')) || 0;

  // Exact payment fallback: If user hasn't typed an amount, default to exact cash payment
  const effectivePaymentPhp =
    tenderType === 'UTANG'
      ? 0
      : hasUserTypedPayment
      ? parsedPaymentPhp
      : cartSummary.totalPhp;

  const shortfallPhp = Math.max(0, cartSummary.totalPhp - effectivePaymentPhp);
  const changeDuePhp =
    tenderType === 'CASH' && effectivePaymentPhp > cartSummary.totalPhp
      ? Number((effectivePaymentPhp - cartSummary.totalPhp).toFixed(2))
      : 0;

  const isUnderpaid =
    (tenderType === 'CASH' || tenderType === 'GCASH') &&
    hasUserTypedPayment &&
    parsedPaymentPhp < cartSummary.totalPhp &&
    !chargeShortfallToUtang;

  const handleDiscountChange = (raw: string) => {
    setDiscountInputText(raw);
    const val = parseFloat(raw.replace(/[^0-9.]/g, ''));
    setDiscountPhp(Number.isFinite(val) ? val : 0);
  };

  const { trigger: executeCompleteSale, isSubmitting } = useIdempotentSubmit(async () => {
    try {
      const tx = await completeSale({
        tenderType,
        amountTenderedPhp: tenderType === 'UTANG' ? 0 : effectivePaymentPhp,
        expectedCartRevision: cartRevision,
        gcashRef: tenderType === 'GCASH' ? gcashRefInput.trim() || undefined : undefined,
        paymentReference: tenderType === 'GCASH' ? gcashRefInput.trim() || undefined : undefined,
        convenienceFeePhp: tenderType === 'GCASH' ? convenienceFeePhp : 0,
        customerName:
          tenderType === 'UTANG' || chargeShortfallToUtang
            ? selectedCustomer.trim()
            : undefined,
        chargeShortfallToUtang,
        isOneTimeBulkOrder: false,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      updateClockCheck();
      setCompletedTx(tx);
      setPaymentInputText('');
      setDiscountInputText('0.00');
      setGcashRefInput('');
      setConvenienceFeePhp(0);
      setChargeShortfallToUtang(false);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const msg = err instanceof Error ? err.message : 'May naganap na error sa pagproseso ng bayad.';
      setConfirmDialog({
        type: 'danger',
        title: 'Error sa Pagbenta',
        message: msg,
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
    }
  });

  const handleCompleteSale = () => {
    if (cartSummary.items.length === 0) return;

    if (isFeatureLocked()) {
      openUpgradeModal();
      return;
    }

    if (isUnderpaid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const msg = `Kulang ang bayad ng ₱${shortfallPhp.toFixed(2)}. Magbayad ng hindi bababa sa ${cartSummary.formattedTotal} o i-on ang "I-charge sa Utang ang Kulang".`;
      setConfirmDialog({
        type: 'warning',
        title: 'Kulang ang Bayad',
        message: msg,
        details: [
          { label: 'Halaga ng Bibilhin', value: cartSummary.formattedTotal },
          { label: 'Naibigay na Pera', value: `₱${parsedPaymentPhp.toFixed(2)}` },
          { label: 'Kulang na Bayad', value: `₱${shortfallPhp.toFixed(2)}`, highlight: true },
        ],
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
      return;
    }

    if ((tenderType === 'UTANG' || chargeShortfallToUtang) && !selectedCustomer.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      const msg = 'Kailangan ilagay o piliin ang Pangalan ng Customer para sa Utang credit.';
      setConfirmDialog({
        type: 'warning',
        title: 'Kailangan ang Pangalan',
        message: msg,
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => setConfirmDialog(null),
      });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setConfirmDialog({
      type: 'success',
      title: 'Kumpirmahin ang Pagbenta',
      message: `Nais mo bang kumpletuhin ang transaksyon para sa ${cartSummary.totalCount} na paninda?`,
      details: [
        { label: 'Kabuuang Halaga', value: cartSummary.formattedTotal, highlight: true },
        {
          label: 'Dami ng Paninda',
          value: `${cartSummary.totalCount} ${cartSummary.totalCount === 1 ? 'item' : 'items'}`,
        },
        {
          label: 'Paraan ng Bayad',
          value:
            tenderType === 'CASH'
              ? 'Cash'
              : tenderType === 'GCASH'
              ? 'GCash'
              : 'Suki Utang',
        },
        ...(tenderType === 'CASH'
          ? [
              { label: 'Halagang Iniabot', value: `₱${effectivePaymentPhp.toFixed(2)}` },
              ...(changeDuePhp > 0
                ? [{ label: 'Sukli sa Suki', value: `₱${changeDuePhp.toFixed(2)}`, highlight: true }]
                : []),
            ]
          : []),
        ...(tenderType === 'GCASH'
          ? [
              ...(gcashRefInput.trim()
                ? [{ label: 'GCash Ref #', value: gcashRefInput.trim() }]
                : []),
              ...(convenienceFeePhp > 0
                ? [{ label: 'Convenience Fee', value: `₱${convenienceFeePhp.toFixed(2)}` }]
                : []),
            ]
          : []),
        ...(tenderType === 'UTANG' || chargeShortfallToUtang
          ? [
              { label: 'Pangalan ng Suki', value: selectedCustomer.trim() },
              ...(chargeShortfallToUtang
                ? [{ label: 'I-uutang na Kulang', value: `₱${shortfallPhp.toFixed(2)}`, highlight: true }]
                : []),
            ]
          : []),
      ],
      confirmText: 'Oo, Tapusin ang Benta',
      cancelText: 'Bumalik',
      onConfirm: async () => {
        setConfirmDialog(null);
        await executeCompleteSale();
      },
    });
  };

  return (
    <ScreenSafeAreaView style={styles.safeArea}>
      <FloatingToast
        message={toastMsg}
        type={toastType}
        onDismiss={handleDismissToast}
      />
      {/* Top Bar: <- New Sale  |  Trash Icon */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              router.navigate('/');
            }}
            hitSlop={10}
          >
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </Pressable>
          <Text style={styles.headerTitle}>{t.newSaleTitle}</Text>
        </View>

        <View style={styles.headerRight}>
          {cartSummary.totalCount > 0 ? (
            <Pressable
              style={styles.parkBtnHeader}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setHoldCustomerName('');
                setHoldModalVisible(true);
              }}
              hitSlop={6}
            >
              <Ionicons name="pause-circle-outline" size={13} color="#0D7A52" style={{ marginRight: 3 }} />
              <Text style={styles.parkBtnHeaderText}>{t.holdCartBtn}</Text>
            </Pressable>
          ) : null}

          {heldCarts && heldCarts.length > 0 ? (
            <Pressable
              style={styles.restoreParkedBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setHeldCartsModalVisible(true);
              }}
            >
              <Ionicons name="cube-outline" size={13} color="#92400E" style={{ marginRight: 3 }} />
              <Text style={styles.restoreParkedText}>
                {t.heldCartsTitle} ({heldCarts.length})
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.trashBtn}
            onPress={() => {
              if (cartSummary.totalCount > 0 || cartSummary.items.length > 0) {
                setConfirmDialog({
                  type: 'delete',
                  title: 'I-clear ang Buong Cart?',
                  message: `Sigurado ka bang nais mong alisin ang lahat ng ${cartSummary.totalCount} paninda (${cartSummary.formattedTotal}) sa New Sale?`,
                  details: [
                    { label: 'Bilang ng Paninda', value: `${cartSummary.totalCount} items` },
                    { label: 'Kabuuang Halaga', value: cartSummary.formattedTotal, highlight: true },
                  ],
                  confirmText: 'Oo, I-clear ang Cart',
                  cancelText: 'Kanselahin',
                  onConfirm: () => {
                    setConfirmDialog(null);
                    runCartAction(clearCart, () => {
                      resetSaleForm();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                      showToast('✓ Na-clear ang mga paninda sa checkout.', 'warning');
                    });
                  },
                });
              }
            }}
            hitSlop={10}
          >
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
          </Pressable>
        </View>
      </View>

      {/* Forgiving UX: Undo Toast when an item is decremented to 0 */}
      {cartSummary.lastRemovedItem ? (
        <View style={styles.undoBanner}>
          <Text style={styles.undoText}>
            Removed {cartSummary.lastRemovedItem.name}
          </Text>
          <Pressable style={styles.undoBtn} onPress={() => runCartAction(undoRemoveCartItem)}>
            <Text style={styles.undoBtnText}>UNDO</Text>
          </Pressable>
        </View>
      ) : null}


      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cart Line Items Card (Matches Screen 3 Prototype) */}
        <View style={styles.cartCard}>
          {cartSummary.items.length === 0 ? (
            <View style={styles.emptyCartBox}>
              <Text style={styles.emptyCartTitle}>{t.emptyCartTitle}</Text>
              <Text style={styles.emptyCartSub}>
                {t.emptyCartSub}
              </Text>
              <Pressable
                style={styles.emptyCartScanBtn}
                onPress={() => router.navigate('/')}
                hitSlop={8}
              >
                <Ionicons name="barcode-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyCartScanBtnText}>Scan or Pick Items to Sell</Text>
              </Pressable>
            </View>
          ) : (
            cartSummary.items.map((item, idx) => {
              const prod = products.find((p) => p.id === item.productId);
              return (
                <View
                  key={item.cartKey ?? item.productId}
                  style={[
                    styles.cartItemRow,
                    idx < cartSummary.items.length - 1 ? styles.cartItemBorder : null,
                  ]}
                >
                  <Pressable
                    style={styles.thumbBox}
                    onPress={() => {
                      if (prod && prod.unitOfMeasure !== 'kg') {
                        setUnitModalSelection({ product: prod, item });
                      }
                    }}
                  >
                    {prod ? (
                      <ProductThumbnail
                        visual={prod.visual}
                        imageUri={prod.imageUri}
                        size="md"
                      />
                    ) : null}
                  </Pressable>

                  <View style={styles.itemCenterCol}>
                    <Pressable
                      onPress={() => {
                        if (prod && prod.unitOfMeasure !== 'kg') {
                          setUnitModalSelection({ product: prod, item });
                        }
                      }}
                    >
                      <Text style={styles.itemName}>
                        {item.name}
                      </Text>
                      {prod?.unitOfMeasure !== 'kg' ? (
                        <View style={styles.cartUnitSwitchRow}>
                          <View
                            style={[
                              styles.cartUnitBadge,
                              item.unit === 'pack' ? styles.cartUnitBadgePack : styles.cartUnitBadgePiece,
                            ]}
                          >
                            <Ionicons
                              name={item.unit === 'pack' ? 'layers' : item.unit === 'box' ? 'cube' : 'pricetag'}
                              size={11}
                              color={item.unit === 'pack' ? '#0D7A52' : '#374151'}
                            />
                            <Text
                              style={[
                                styles.cartUnitBadgeText,
                                item.unit === 'pack' ? styles.cartUnitBadgeTextPack : null,
                              ]}
                            >
                              {item.unit === 'pack'
                                ? `Whole Pack (${item.unitMultiplier ?? 10} pcs)`
                                : item.unit === 'box'
                                ? `Whole Box (${item.unitMultiplier ?? 1} pcs)`
                                : 'Per Piece'}
                            </Text>
                            <Text style={styles.cartUnitBadgePalitanText}>• Palitan ›</Text>
                          </View>
                        </View>
                      ) : null}
                    </Pressable>
                    <View style={styles.unitPriceRow}>
                      <Text style={styles.itemUnitPrice}>
                        {item.formattedUnitPrice}
                        {item.unit && item.unit !== 'piece' ? ` / ${item.unit}` : ''}
                      </Text>
                      {item.bundleApplied ? (
                        <Text style={styles.bundleTag}> (2 for ₱24 promo)</Text>
                      ) : null}
                    </View>

                    {/* Editable Quantity Stepper */}
                    <CartItemStepper
                      productId={item.productId}
                      quantity={item.quantity}
                      unitOfMeasure={item.unitOfMeasure ?? prod?.unitOfMeasure}
                      formattedQuantity={item.formattedQuantity}
                      onOpenWeightModal={() => {
                        if (prod) {
                          setWeightModalProduct({
                            id: prod.id,
                            name: prod.name,
                            defaultPricePhp: prod.defaultPricePhp,
                            stockCount: prod.stockCount,
                            formattedPrice: prod.formattedPrice,
                            unitOfMeasure: prod.unitOfMeasure,
                          });
                        }
                      }}
                      onUpdateQty={(qty) =>
                        runCartAction(() =>
                          setCartItemQuantity(item.cartKey ?? item.productId, qty, item.unit)
                        )
                      }
                      onDelta={(delta) =>
                        runCartAction(() => {
                          const result = addToCart(item.productId, delta, item.unit);
                          if (result?.fellBackToPiece) {
                            showToast(
                              `⚠️ Kulang ang stock para sa dagdag na ${item.unit}. Inilagay bilang piraso (${item.name}).`
                            );
                          }
                        })
                      }
                    />
                  </View>

                  <Text style={styles.itemLineTotal}>{item.formattedLineTotal}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Subtotal / User-Input Discount / Total Summary (Matches Screen 3 Prototype) */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{cartSummary.formattedSubtotal}</Text>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Discount (₱)</Text>
            <View style={styles.discountInputBox}>
              <Text style={styles.pesoPrefix}>₱</Text>
              <TextInput
                style={styles.discountInput}
                value={discountInputText}
                onChangeText={handleDiscountChange}
                keyboardType="decimal-pad"
                selectTextOnFocus
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {cartSummary.exchangeCreditPhp > 0 ? (
            <View style={styles.summaryRow}>
              <View style={styles.exchangeLeftGroup}>
                <Text style={styles.exchangeLabel}>
                  Palit-Paninda ({cartSummary.exchangeSourceReceiptId})
                </Text>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setShowCancelExchangeModal(true);
                  }}
                  style={styles.cancelExchangePill}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={12} color="#DC2626" />
                  <Text style={styles.cancelExchangePillText}>Kanselahin</Text>
                </Pressable>
              </View>
              <Text style={styles.exchangeValue}>
                −{cartSummary.formattedExchangeCredit}
              </Text>
            </View>
          ) : null}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{cartSummary.formattedTotal}</Text>
          </View>
        </View>

        {/* USER-INPUT PAYMENT SECTION (Fixes POS-07B Payment Input Issue) */}
        <View style={styles.tenderBox}>
          <Text style={styles.tenderSectionTitle}>
            Payment Method &amp; Customer Tender Input
          </Text>

          <View style={styles.tenderTabs}>
            {(['CASH', 'GCASH', 'UTANG'] as PaymentTenderType[]).map((mode) => {
              const active = tenderType === mode;
              return (
                <Pressable
                  key={mode}
                  style={[styles.tenderTab, active ? styles.tenderTabActive : null]}
                  onPress={() => {
                    setTenderType(mode);
                    if (mode === 'GCASH' && cartSummary.totalPhp > 0) {
                      setPaymentInputText(cartSummary.totalPhp.toFixed(2));
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.tenderTabText,
                      active ? styles.tenderTabTextActive : null,
                    ]}
                  >
                    {mode === 'UTANG'
                      ? t.tenderUtang
                      : mode === 'CASH'
                      ? t.tenderCash
                      : t.tenderGcash}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tenderType === 'CASH' || tenderType === 'GCASH' ? (
            <View style={styles.paymentInputSection}>
              <Text style={styles.paymentFieldLabel}>
                {tenderType === 'CASH'
                  ? 'Cash Amount Received from Customer (₱) *'
                  : 'GCash Amount Received (₱) *'}
              </Text>

              <View
                style={[
                  styles.paymentInputRow,
                  isUnderpaid ? styles.paymentInputRowError : styles.paymentInputRowValid,
                ]}
              >
                <Text style={styles.paymentPesoSign}>₱</Text>
                <TextInput
                  style={styles.paymentTextInput}
                  value={paymentInputText}
                  onChangeText={(txt) => {
                    setPaymentInputText(txt);
                  }}
                  placeholder={cartSummary.totalPhp.toFixed(2)}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
                {paymentInputText.length > 0 ? (
                  <Pressable
                    onPress={() => setPaymentInputText('')}
                    hitSlop={8}
                    style={styles.clearInputBtn}
                  >
                    <Text style={styles.clearInputText}>✕</Text>
                  </Pressable>
                ) : null}
              </View>

              {/* Quick-Fill Denomination Helper Chips (Populates the User Input Box) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cashBillsRow}
              >
                {[cartSummary.totalPhp, 20, 50, 100, 200, 500, 1000].map((bill, idx) => {
                  const isExact = idx === 0;
                  const selected = isExact
                    ? !hasUserTypedPayment || Math.abs(parsedPaymentPhp - bill) < 0.01
                    : hasUserTypedPayment && Math.abs(parsedPaymentPhp - bill) < 0.01;
                  return (
                    <Pressable
                      key={`${bill}_${idx}`}
                      style={[styles.billPill, selected ? styles.billPillActive : null]}
                      onPress={() => {
                        if (isExact) {
                          setPaymentInputText('');
                        } else {
                          setPaymentInputText(bill.toFixed(2));
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.billPillText,
                          selected ? styles.billPillTextActive : null,
                        ]}
                      >
                        {isExact ? `Exact (${cartSummary.formattedTotal})` : `₱${bill}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* GCash QR Standee, Reference & Surcharge Selector */}
              {tenderType === 'GCASH' ? (
                <View style={{ marginBottom: 10 }}>
                  {/* Digital QR Standee Card */}
                  <View style={styles.gcashStandeeCard}>
                    <View style={styles.gcashStandeeLeft}>
                      <Pressable
                        style={styles.qrThumbWrap}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setShowGcashQrModal(true);
                        }}
                      >
                        <Image
                          source={{
                            uri:
                              settings.gcashQrImageUri && settings.gcashQrImageUri.trim().length > 0
                                ? settings.gcashQrImageUri
                                : 'https://tindahanhelper.wuaze.com/assets/images/gcash_qr.png',
                          }}
                          style={styles.qrThumbImage}
                          resizeMode="contain"
                        />
                        <View style={styles.qrExpandBadge}>
                          <Ionicons name="expand" size={10} color="#FFFFFF" />
                        </View>
                      </Pressable>

                      <View style={{ flex: 1 }}>
                        <View style={styles.qrPhTagRow}>
                          <View style={styles.qrPhSmallPill}>
                            <Text style={styles.qrPhSmallPillText}>QR Ph Interoperable</Text>
                          </View>
                        </View>
                        <Text style={styles.gcashCardOwner} numberOfLines={1}>
                          {settings.gcashAccountName || settings.storeName || 'Tindahan'}
                        </Text>
                        <Text style={styles.gcashCardNum}>
                          {settings.gcashNumber || '0917 123 4567'}
                        </Text>
                      </View>
                    </View>

                    {/* Quick Buttons: Fullscreen, Download, Copy */}
                    <View style={styles.gcashCardActionRow}>
                      <Pressable
                        style={styles.gcashCardViewBtn}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setShowGcashQrModal(true);
                        }}
                      >
                        <Ionicons name="scan" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.gcashCardViewBtnText}>Ipakita ang QR</Text>
                      </Pressable>

                      <Pressable
                        style={styles.gcashCardDownloadBtn}
                        onPress={async () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                          try {
                            const uri =
                              settings.gcashQrImageUri && settings.gcashQrImageUri.trim().length > 0
                                ? settings.gcashQrImageUri
                                : 'https://tindahanhelper.wuaze.com/assets/images/gcash_qr.png';
                            if (Platform.OS === 'web') {
                              const a = document.createElement('a');
                              a.href = uri;
                              a.download = `gcash-qr-${Date.now()}.png`;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              showToast('✓ Na-download ang QR Code!');
                              return;
                            }
                            let shareUri = uri;
                            if (uri.startsWith('http')) {
                              const file = await File.downloadFileAsync(uri, Paths.cache);
                              shareUri = file.uri;
                            }
                            await Sharing.shareAsync(shareUri, {
                              mimeType: 'image/png',
                              dialogTitle: 'I-save o Ibahagi ang GCash QR Code',
                            });
                            showToast('✓ Na-save o naibahagi ang QR Code!');
                          } catch (err) {
                            console.warn('[Checkout] Share error:', err);
                            showToast('⚠️ Hindi ma-download ang QR Code.');
                          }
                        }}
                      >
                        <Ionicons name="download-outline" size={14} color="#005CE6" style={{ marginRight: 4 }} />
                        <Text style={styles.gcashCardDownloadBtnText}>I-download</Text>
                      </Pressable>

                      <Pressable
                        style={[styles.gcashCardCopyBtn, copiedGcashInfo && styles.gcashCardCopyBtnActive]}
                        onPress={async () => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          const num = settings.gcashNumber || '09171234567';
                          await Clipboard.setStringAsync(num.replace(/[^0-9]/g, ''));
                          setCopiedGcashInfo(true);
                          showToast(`✓ Nakopya ang numero: ${num}`);
                          setTimeout(() => setCopiedGcashInfo(false), 2000);
                        }}
                      >
                        <Ionicons
                          name={copiedGcashInfo ? 'checkmark' : 'copy-outline'}
                          size={14}
                          color={copiedGcashInfo ? '#059669' : '#334155'}
                          style={{ marginRight: 4 }}
                        />
                        <Text
                          style={[
                            styles.gcashCardCopyBtnText,
                            copiedGcashInfo && { color: '#059669' },
                          ]}
                        >
                          {copiedGcashInfo ? 'Kopya na' : 'Kopyahin'}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Maya & Bank Transfer Guide Banner */}
                    <Pressable
                      style={styles.mayaHintRow}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setShowGcashQrModal(true);
                      }}
                    >
                      <Ionicons name="help-circle-outline" size={15} color="#0284C7" />
                      <Text style={styles.mayaHintText}>
                        Puwede ring bayaran gamit ang <Text style={{ fontWeight: '800' }}>Maya</Text> o <Text style={{ fontWeight: '800' }}>Bank Transfer (InstaPay)</Text>. Pindutin para sa gabay ›
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.gcashRefBox}>
                    <Text style={styles.paymentFieldLabel}>
                      Convenience Surcharge (GCash Cash-In / Surcharge):
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginVertical: 6 }}>
                      {[0, 2, 5].map((fee) => (
                        <Pressable
                          key={fee}
                          style={[
                            styles.billPill,
                            convenienceFeePhp === fee ? styles.billPillActive : null,
                          ]}
                          onPress={() => setConvenienceFeePhp(fee)}
                        >
                          <Text
                            style={[
                              styles.billPillText,
                              convenienceFeePhp === fee ? styles.billPillTextActive : null,
                            ]}
                          >
                            {fee === 0 ? 'Walang Dagdag (+₱0)' : `+₱${fee}`}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    {convenienceFeePhp > 0 && (
                      <Text style={{ fontSize: 12, color: '#0D7A52', fontWeight: '700', marginBottom: 6 }}>
                        Total na sisingilin sa GCash: ₱{(cartSummary.totalPhp + convenienceFeePhp).toFixed(2)}
                      </Text>
                    )}
                    <Text style={styles.paymentFieldLabel}>
                      GCash Ref # (Last 4 to 13 digits):
                    </Text>
                    <TextInput
                      style={styles.gcashRefInput}
                      value={gcashRefInput}
                      onChangeText={setGcashRefInput}
                      placeholder="e.g. 4829 or 100234829"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="number-pad"
                      maxLength={13}
                    />
                  </View>
                </View>
              ) : null}

              {/* Dynamic Payment Status: Exact Amount / Change Due / Shortfall */}
              {!hasUserTypedPayment ? (
                <View style={styles.exactDueCard}>
                  <Text style={styles.exactDueLabel}>Payment Mode:</Text>
                  <Text style={styles.exactDueValue}>
                    Exact Payment ({cartSummary.formattedTotal})
                  </Text>
                </View>
              ) : parsedPaymentPhp >= cartSummary.totalPhp && cartSummary.totalPhp > 0 ? (
                <View style={styles.changeDueCard}>
                  <Text style={styles.changeDueLabel}>Change Due (Sukli):</Text>
                  <Text style={styles.changeDueValue}>
                    {Money.fromPhp(changeDuePhp).format()}
                  </Text>
                </View>
              ) : cartSummary.totalPhp > 0 ? (
                <View style={styles.shortfallCard}>
                  <Text style={styles.shortfallText}>
                    ⚠️ Short by {Money.fromPhp(shortfallPhp).format()} (Customer paid ₱
                    {parsedPaymentPhp.toFixed(2)} of {cartSummary.formattedTotal})
                  </Text>
                  <Pressable
                    style={styles.shortfallUtangToggle}
                    onPress={() => setChargeShortfallToUtang((prev) => !prev)}
                  >
                    <Ionicons
                      name={chargeShortfallToUtang ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={chargeShortfallToUtang ? '#0D7A52' : '#6B7280'}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.shortfallUtangLabel}>
                      Charge remaining {Money.fromPhp(shortfallPhp).format()} deficit to
                      Customer Utang (Split Cash + Utang)
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {tenderType === 'UTANG' || chargeShortfallToUtang ? (
            <View style={styles.utangPickerRow}>
              <Text style={styles.utangLabel}>
                Suki Customer Name (Select or Type Below):
              </Text>
              <TextInput
                style={styles.customerNameInput}
                value={selectedCustomer}
                onChangeText={setSelectedCustomer}
                placeholder="Type customer name (e.g. Aling Nena)..."
                placeholderTextColor="#9CA3AF"
              />
              <View style={styles.utangChips}>
                {utangCustomers.map((c) => {
                  const active = selectedCustomer === c.name;
                  return (
                    <Pressable
                      key={c.id}
                      style={[styles.utangChip, active ? styles.utangChipActive : null]}
                      onPress={() => setSelectedCustomer(c.name)}
                    >
                      <Text
                        style={[
                          styles.utangChipText,
                          active ? styles.utangChipTextActive : null,
                        ]}
                      >
                        {c.name} (Bal: ₱{c.balancePhp})
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

        </View>


        {/* Primary Action CTAs (Matches Screen 3 Prototype: Solid Green "Complete Sale" + Outlined "+ Add More Items") */}
        <View style={styles.ctaContainer}>
          <Pressable
            style={[
              styles.completeSaleBtn,
              cartSummary.items.length === 0 || isSubmitting || isUnderpaid
                ? styles.completeSaleBtnDisabled
                : null,
            ]}
            disabled={cartSummary.items.length === 0 || isSubmitting || isUnderpaid}
            onPress={() => handleCompleteSale()}
          >
            <Ionicons name="cart" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.completeSaleText}>
              {isSubmitting
                ? t.savingToDb
                : changeDuePhp > 0
                ? `${t.completeSaleBtn} (${t.changeGiven} ₱${changeDuePhp.toFixed(2)})`
                : `${t.completeSaleBtn} (${cartSummary.formattedTotal})`}
            </Text>
          </Pressable>

          <Pressable
            style={styles.addMoreBtn}
            onPress={() => router.navigate('/')}
          >
            <Ionicons name="add" size={20} color="#0D7A52" style={{ marginRight: 4 }} />
            <Text style={styles.addMoreText}>{t.addMoreItemsBtn}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Official Transaction Receipt Modal on Completion */}
      {visibleCompletedTx ? (
        <View style={styles.receiptOverlay}>
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <View style={styles.receiptIconCircle}>
                <Ionicons name="checkmark" size={26} color="#15803D" />
              </View>
              <Text style={styles.receiptTitle}>Sale Recorded</Text>
              <Text style={styles.receiptSub}>Matagumpay na naitala ang benta sa tindahan</Text>
            </View>

            <View style={styles.receiptBody}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Receipt ID:</Text>
                <Text style={styles.receiptValueBold}>{visibleCompletedTx.id}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Date & Time:</Text>
                <Text style={styles.receiptValue}>
                  {visibleCompletedTx.dateLabel} • {visibleCompletedTx.timeLabel}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Payment Method:</Text>
                <Text style={styles.receiptValueBold}>{visibleCompletedTx.tenderType}</Text>
              </View>
              {visibleCompletedTx.customerName ? (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Customer:</Text>
                  <Text style={styles.receiptValue}>{visibleCompletedTx.customerName}</Text>
                </View>
              ) : null}
              <View style={styles.receiptDivider} />
              <View style={styles.receiptRow}>
                <Text style={styles.receiptTotalLabel}>Total Amount:</Text>
                <Text style={styles.receiptTotalValue}>{visibleCompletedTx.formattedTotal}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Amount Tendered:</Text>
                <Text style={styles.receiptValue}>
                  ₱{visibleCompletedTx.amountTenderedPhp.toFixed(2)}
                </Text>
              </View>
              {visibleCompletedTx.changeDuePhp > 0 ? (
                <View style={[styles.receiptRow, styles.receiptChangeRow]}>
                  <Text style={styles.receiptChangeLabel}>{t.changeGiven}</Text>
                  <Text style={styles.receiptChangeValue}>
                    ₱{visibleCompletedTx.changeDuePhp.toFixed(2)}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.receiptBtnRow}>
              <Pressable
                style={styles.receiptPrimaryBtn}
                onPress={() => {
                  resetSaleForm();
                  router.navigate('/');
                }}
              >
                <Ionicons name="barcode-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.receiptPrimaryBtnText}>{t.nextSaleBtn}</Text>
              </Pressable>
              <Pressable
                style={styles.receiptSecondaryBtn}
                onPress={() => {
                  resetSaleForm();
                  router.navigate('/sales');
                }}
              >
                <Ionicons name="receipt-outline" size={18} color="#334155" style={{ marginRight: 6 }} />
                <Text style={styles.receiptSecondaryBtnText}>{t.viewSalesHistoryBtn}</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.receiptPrintSlipBtn}
              onPress={() => setShowPrinterModal(true)}
            >
              <Ionicons name="print-outline" size={18} color="#0D7A52" style={{ marginRight: 6 }} />
              <Text style={styles.receiptPrintSlipBtnText}>🖨️ Print Thermal Slip (58mm / 80mm)</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {/* Hold Cart Modal with Customer Name / Note */}
      <Modal
        visible={holdModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setHoldModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.holdModalCard}>
            <View style={styles.holdModalHeader}>
              <View style={styles.holdIconCircle}>
                <Ionicons name="pause-circle" size={24} color="#D97706" />
              </View>
              <Text style={styles.holdModalTitle}>{t.holdCartModalTitle}</Text>
              <Text style={styles.holdModalSubtitle}>
                {cartSummary.totalCount} items • {cartSummary.formattedTotal}
              </Text>
            </View>

            <View style={styles.holdModalBody}>
              <Text style={styles.holdInputLabel}>{t.customerNameOrNote}</Text>
              <TextInput
                style={styles.holdTextInput}
                value={holdCustomerName}
                onChangeText={setHoldCustomerName}
                placeholder="Hal. Aling Maria, Kuya Bert, Suki"
                placeholderTextColor="#9CA3AF"
                autoFocus
                maxLength={40}
              />
            </View>

            <View style={styles.holdModalBtns}>
              <Pressable
                style={styles.holdCancelBtn}
                onPress={() => setHoldModalVisible(false)}
              >
                <Text style={styles.holdCancelText}>{t.cancel}</Text>
              </Pressable>

              <Pressable
                style={styles.holdSubmitBtn}
                onPress={() => {
                  const count = cartSummary.totalCount;
                  const total = cartSummary.formattedTotal;
                  const name = holdCustomerName.trim() || `Customer #${(heldCarts?.length || 0) + 1}`;
                  runCartAction(() => parkCurrentCart(name), () => {
                    setHoldModalVisible(false);
                    setHoldCustomerName('');
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                    showToast(`✓ Naitabi ang cart para kay "${name}" (${count} paninda, ${total}).`, 'success');
                  });
                }}
              >
                <Text style={styles.holdSubmitText}>{t.confirmHoldBtn}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Held Carts Queue Modal */}
      <Modal
        visible={heldCartsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setHeldCartsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.heldQueueCard}>
            <View style={styles.heldQueueHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="cube" size={20} color="#0D7A52" />
                <Text style={styles.heldQueueTitle}>
                  {t.heldCartsTitle} ({heldCarts?.length || 0})
                </Text>
              </View>
              <Pressable
                onPress={() => setHeldCartsModalVisible(false)}
                hitSlop={10}
                style={styles.closeModalBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView style={styles.heldQueueList} showsVerticalScrollIndicator={false}>
              {(!heldCarts || heldCarts.length === 0) ? (
                <View style={styles.emptyHeldBox}>
                  <Text style={styles.emptyHeldText}>{t.noHeldCarts}</Text>
                </View>
              ) : (
                heldCarts.map((hc) => (
                  <View key={hc.id} style={styles.heldCartItem}>
                    <View style={styles.heldCartTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.heldCustomerName} numberOfLines={1}>
                          👤 {hc.customerName}
                        </Text>
                        <Text style={styles.heldTimeLabel}>
                          🕒 {hc.timeLabel} • {hc.totalCount} items
                        </Text>
                      </View>
                      <Text style={styles.heldTotalText}>
                        ₱{hc.totalPhp.toFixed(2)}
                      </Text>
                    </View>

                    <Text style={styles.heldItemsSummary} numberOfLines={2}>
                      {hc.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                    </Text>

                    <View style={styles.heldActionsRow}>
                      <Pressable
                        style={styles.heldDeleteBtn}
                        onPress={() => {
                          setConfirmDialog({
                            type: 'delete',
                            title: t.deleteHeldCartTitle,
                            itemName: `Nakatabing Cart: ${hc.customerName}`,
                            message: `Sigurado ka bang nais mong burahin ang nakatabing cart ni ${hc.customerName}?`,
                            details: [
                              { label: 'Customer', value: hc.customerName },
                              { label: 'Bilang ng Paninda', value: `${hc.totalCount} items` },
                              { label: 'Kabuuang Halaga', value: Money.fromPhp(hc.totalPhp).format(), highlight: true },
                            ],
                            confirmText: t.delete,
                            cancelText: t.cancel,
                            onConfirm: () => {
                              setConfirmDialog(null);
                              deleteHeldCart(hc.id);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
                              showToast('✓ Nabura ang nakatabing cart', 'warning');
                            },
                          });
                        }}
                      >
                        <Ionicons name="trash-outline" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                        <Text style={styles.heldDeleteText}>{t.delete}</Text>
                      </Pressable>

                      <Pressable
                        style={styles.heldRestoreBtn}
                        onPress={() => {
                          const doRestore = () => {
                            runCartAction(() => restoreHeldCart(hc.id), () => {
                              setHeldCartsModalVisible(false);
                              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                              showToast(`✓ Naibalik ang cart ni "${hc.customerName}" sa checkout`, 'success');
                            });
                          };

                          if (cartSummary.totalCount > 0) {
                            setConfirmDialog({
                              type: 'warning',
                              title: 'Palitan ang Cart?',
                              itemName: `Cart ni ${hc.customerName}`,
                              message: `May laman ang kasalukuyang cart (${cartSummary.totalCount} paninda). Papalitan ito ng cart ni ${hc.customerName}. Nais mo bang magpatuloy?`,
                              details: [
                                { label: 'Kasalukuyang Cart', value: `${cartSummary.totalCount} items (${cartSummary.formattedTotal})` },
                                { label: 'Ipapalit na Cart', value: `${hc.totalCount} items (${Money.fromPhp(hc.totalPhp).format()})`, highlight: true },
                              ],
                              confirmText: 'Palitan & I-restore',
                              cancelText: t.cancel,
                              onConfirm: () => {
                                setConfirmDialog(null);
                                doRestore();
                              },
                            });
                          } else {
                            doRestore();
                          }
                        }}
                      >
                        <Ionicons name="arrow-undo-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.heldRestoreText}>{t.restoreBtn}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

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
          runCartAction(() => setCartItemQuantity(productId, qty));
        }}
      />

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
        />
      ) : null}

      <ReceiptPrinterModal
        visible={showPrinterModal}
        receiptData={
          completedTx
            ? {
                storeName: settings.storeName || 'Tindahan Helper',
                storeAddress: settings.address,
                tinNumber: settings.tinNumber,
                receiptNumber: completedTx.id,
                timestamp: `${completedTx.dateLabel} ${completedTx.timeLabel}`,
                customerName: completedTx.customerName,
                items: completedTx.items.map((i) => ({
                  name: i.name,
                  quantity: i.quantity,
                  unitPricePhp: i.unitPricePaidPhp,
                  totalPricePhp: i.lineTotalPhp,
                  unitName: i.unitOfMeasure,
                })),
                subtotalPhp: completedTx.totalPhp,
                discountPhp: 0,
                totalAmountPhp: completedTx.totalPhp,
                tenderType: completedTx.tenderType,
                tenderedAmountPhp: completedTx.amountTenderedPhp,
                changePhp: completedTx.changeDuePhp,
                paymentReference: completedTx.paymentReference ?? completedTx.gcashRef,
                convenienceFeePhp: completedTx.convenienceFeePhp ?? 0,
              }
            : null
        }
        onClose={() => setShowPrinterModal(false)}
      />

      <CancelExchangeCreditModal
        visible={showCancelExchangeModal}
        creditPhp={cartSummary.exchangeCreditPhp}
        sourceReceiptId={cartSummary.exchangeSourceReceiptId}
        onClose={() => setShowCancelExchangeModal(false)}
        onConvertToCashRefund={async () => {
          try {
            await convertExchangeCreditToCashRefund();
            showToast('💵 Naibalik na ang pera mula sa kaha.', 'success');
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Hindi ma-refund.';
            showToast(`⚠️ ${msg}`, 'error');
          }
        }}
        onUndoReturn={async () => {
          try {
            await undoExchangeCreditReturn();
            showToast('🔄 Nabawi na ang pagsauli. Naibalik ang paninda sa resibo.', 'info');
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Hindi mabawi ang pagsauli.';
            showToast(`⚠️ ${msg}`, 'error');
          }
        }}
      />

      <UnitSelectionModal
        visible={unitModalSelection !== null}
        product={unitModalSelection?.product ?? null}
        currentUnit={unitModalSelection?.item.unit ?? 'piece'}
        onClose={() => setUnitModalSelection(null)}
        onSelectUnit={handleUnitSwitch}
        onSaveTierConfig={handleSaveUnitConfig}
      />

      <GcashQrModal
        visible={showGcashQrModal}
        onClose={() => setShowGcashQrModal(false)}
        qrImageUri={settings.gcashQrImageUri}
        gcashNumber={settings.gcashNumber || '0917 123 4567'}
        gcashAccountName={settings.gcashAccountName || settings.storeName || 'Tindahan'}
        onUpdateQrImage={async (uri) => {
          updateSettings({ gcashQrImageUri: uri });
          showToast('✓ Na-update ang QR code ng tindahan!');
        }}
      />
    </ScreenSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: '#111827',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  parkBtnHeader: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  parkBtnHeaderText: {
    color: '#0D7A52',
    fontSize: 11,
    fontWeight: '700',
  },
  restoreParkedBtn: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  restoreParkedText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
  },
  trashBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashIcon: {
    fontSize: 18,
  },
  confirmBanner: {
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  confirmBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  parkBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  parkBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  clearConfirmBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearConfirmText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cancelConfirmBtn: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cancelConfirmText: {
    color: '#374151',
    fontSize: 11,
    fontWeight: '700',
  },
  undoBanner: {
    backgroundColor: '#1F2937',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  undoText: {
    color: '#F9FAFB',
    fontSize: 12,
    fontWeight: '600',
  },
  undoBtn: {
    backgroundColor: '#0D7A52',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  undoBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  completedBanner: {
    backgroundColor: '#DCFCE7',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  completedText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  completedLink: {
    color: '#0D7A52',
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 8,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 130,
  },
  cartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  emptyCartBox: {
    paddingVertical: 28,
    alignItems: 'center',
    gap: 4,
  },
  emptyCartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  emptyCartSub: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  emptyCartScanBtn: {
    marginTop: 12,
    backgroundColor: '#0D7A52',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartScanBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  cartItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  thumbBox: {
    width: 52,
    height: 60,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCenterCol: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  cartUnitSwitchRow: {
    marginTop: 2,
    marginBottom: 2,
    flexDirection: 'row',
  },
  cartUnitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cartUnitBadgePack: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  cartUnitBadgePiece: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  cartUnitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  cartUnitBadgeTextPack: {
    color: '#0D7A52',
  },
  cartUnitBadgePalitanText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D7A52',
    marginLeft: 2,
  },
  unitPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemUnitPrice: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  bundleTag: {
    fontSize: 11,
    color: '#0D7A52',
    fontWeight: '700',
  },
  kgStepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 4,
    height: 32,
    gap: 6,
  },
  kgStepperBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kgStepperSymbol: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  kgDisplayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  kgDisplayText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D7A52',
    fontVariant: ['tabular-nums'],
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 4,
    height: 32,
    gap: 12,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSymbol: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
  },
  stepperQty: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    minWidth: 16,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  stepperInput: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    minWidth: 36,
    maxWidth: 60,
    height: 28,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  itemLineTotal: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  summarySection: {
    paddingHorizontal: 4,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  discountInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 34,
    minWidth: 90,
  },
  pesoPrefix: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
    marginRight: 2,
  },
  discountInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'right',
    paddingVertical: 0,
    fontVariant: ['tabular-nums'],
  },
  exchangeLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cancelExchangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  cancelExchangePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  exchangeLabel: {
    fontSize: 13,
    color: '#0D7A52',
    fontWeight: '700',
  },
  exchangeValue: {
    fontSize: 14,
    color: '#0D7A52',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  tenderBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  tenderSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  tenderTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tenderTab: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tenderTabActive: {
    backgroundColor: '#0D7A52',
  },
  tenderTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  tenderTabTextActive: {
    color: '#FFFFFF',
  },
  paymentInputSection: {
    gap: 8,
  },
  paymentFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  paymentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
  },
  paymentInputRowValid: {
    borderColor: '#0D7A52',
  },
  paymentInputRowError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  paymentPesoSign: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D7A52',
    marginRight: 6,
  },
  paymentTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  clearInputBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  clearInputText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#6B7280',
  },
  cashBillsRow: {
    gap: 6,
  },
  billPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  billPillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#0D7A52',
  },
  billPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    fontVariant: ['tabular-nums'],
  },
  billPillTextActive: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  gcashStandeeCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  gcashStandeeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrThumbWrap: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#005CE6',
    padding: 3,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrThumbImage: {
    width: '100%',
    height: '100%',
  },
  qrExpandBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#005CE6',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPhTagRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  qrPhSmallPill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  qrPhSmallPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1D4ED8',
    textTransform: 'uppercase',
  },
  gcashCardOwner: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  gcashCardNum: {
    fontSize: 13,
    fontWeight: '700',
    color: '#005CE6',
    marginTop: 1,
  },
  gcashCardActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  gcashCardViewBtn: {
    flex: 1.2,
    backgroundColor: '#005CE6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  gcashCardViewBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  gcashCardDownloadBtn: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  gcashCardDownloadBtnText: {
    color: '#005CE6',
    fontSize: 11.5,
    fontWeight: '800',
  },
  gcashCardCopyBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  gcashCardCopyBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  gcashCardCopyBtnText: {
    color: '#334155',
    fontSize: 11.5,
    fontWeight: '700',
  },
  mayaHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  mayaHintText: {
    fontSize: 10.5,
    color: '#0369A1',
    flex: 1,
    lineHeight: 14,
  },
  gcashRefBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  gcashRefInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  changeDueCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  changeDueLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  changeDueValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D7A52',
    fontVariant: ['tabular-nums'],
  },
  shortfallCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  shortfallText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  shortfallUtangToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shortfallUtangLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7F1D1D',
    flex: 1,
  },
  utangPickerRow: {
    gap: 6,
  },
  utangLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  customerNameInput: {
    height: 42,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  utangChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  utangChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  utangChipActive: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#D97706',
  },
  utangChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  utangChipTextActive: {
    color: '#92400E',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 12,
  },
  errorBoxText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '800',
  },
  ctaContainer: {
    gap: 10,
    marginTop: 4,
  },
  completeSaleBtn: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0D7A52',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0D7A52',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  completeSaleBtnDisabled: {
    opacity: 0.5,
  },
  completeSaleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  addMoreBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0D7A52',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreText: {
    color: '#0D7A52',
    fontSize: 15,
    fontWeight: '800',
  },
  exactDueCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  exactDueLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  exactDueValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#15803D',
  },
  receiptOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    paddingHorizontal: 20,
  },
  receiptCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 22,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  receiptHeader: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  receiptIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  receiptCheckMark: {
    fontSize: 26,
    color: '#15803D',
    fontWeight: '900',
  },
  receiptTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },
  receiptSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  receiptBody: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  receiptValue: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '700',
  },
  receiptValueBold: {
    fontSize: 13,
    color: '#0D7A52',
    fontWeight: '800',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  receiptTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  receiptTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D7A52',
  },
  receiptChangeRow: {
    backgroundColor: '#ECFDF5',
    padding: 6,
    borderRadius: 8,
  },
  receiptChangeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  receiptChangeValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#059669',
  },
  receiptBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  receiptPrimaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0D7A52',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  receiptSecondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptSecondaryBtnText: {
    color: '#334155',
    fontWeight: '800',
    fontSize: 13,
  },
  receiptPrintSlipBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#0D7A52',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  receiptPrintSlipBtnText: {
    color: '#0D7A52',
    fontWeight: '800',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  holdModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  holdModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  holdIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  holdModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  holdModalSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  holdModalBody: {
    marginBottom: 20,
  },
  holdInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  holdTextInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  holdModalBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  holdCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  holdSubmitBtn: {
    flex: 1.5,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdSubmitText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  heldQueueCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  heldQueueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  heldQueueTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  closeModalBtn: {
    padding: 4,
  },
  heldQueueList: {
    marginTop: 10,
  },
  emptyHeldBox: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyHeldText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  heldCartItem: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heldCartTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heldCustomerName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  heldTimeLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  heldTotalText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D7A52',
  },
  heldItemsSummary: {
    fontSize: 12,
    color: '#475569',
    marginTop: 6,
    lineHeight: 16,
  },
  heldActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  heldDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  heldDeleteText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  heldRestoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0D7A52',
  },
  heldRestoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
