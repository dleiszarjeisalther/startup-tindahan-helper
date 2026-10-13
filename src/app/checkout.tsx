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
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { useIdempotentSubmit } from '@/presentation/hooks/useIdempotentSubmit';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';
import { PaymentTenderType, SaleTransactionRecord } from '@/application/TindahanStoreService';
import { Money } from '@/domain/value-objects/Money';
import { getTranslations } from '@/presentation/localization/i18n';

export default function CheckoutNewSaleScreen() {
  const router = useRouter();
  const {
    products,
    cartSummary,
    utangCustomers,
    settings,
    addToCart,
    undoRemoveCartItem,
    setDiscountPhp,
    clearCart,
    parkCurrentCart,
    restoreParkedCart,
    completeSale,
  } = useTindahanStore();

  const t = getTranslations(settings?.language);

  const [tenderType, setTenderType] = useState<PaymentTenderType>('CASH');
  // User-input Payment Amount Received (TextInput) — starts empty so user can optionally type cash bill handed
  const [paymentInputText, setPaymentInputText] = useState<string>('');
  // User-input Discount (TextInput)
  const [discountInputText, setDiscountInputText] = useState<string>(
    cartSummary.discountPhp > 0 ? String(cartSummary.discountPhp) : ''
  );
  // User-input GCash Reference #
  const [gcashRefInput, setGcashRefInput] = useState<string>('');
  // Utang customer selection or custom input
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [chargeShortfallToUtang, setChargeShortfallToUtang] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [completedTx, setCompletedTx] = useState<SaleTransactionRecord | null>(null);
  const [paymentErrorMsg, setPaymentErrorMsg] = useState<string | null>(null);

  const resetSaleForm = useCallback(() => {
    setCompletedTx(null);
    setPaymentInputText('');
    setDiscountInputText('');
    setSelectedCustomer('');
    setGcashRefInput('');
    setChargeShortfallToUtang(false);
    setPaymentErrorMsg(null);
  }, []);

  // Self-healing synchronization: If store count diverges from items (e.g. count > 0 but items empty),
  // immediately purge the cart to ensure clean state when starting a new sale.
  useEffect(() => {
    if (cartSummary.totalCount > 0 && cartSummary.items.length === 0) {
      clearCart();
    }
  }, [cartSummary.totalCount, cartSummary.items.length, clearCart]);

  useFocusEffect(
    useCallback(() => {
      // Whenever New Sale tab comes into focus, ensure clean input state if cart was empty
      if (cartSummary.totalCount === 0) {
        setPaymentInputText('');
        setDiscountInputText('');
        setSelectedCustomer('');
        setGcashRefInput('');
        setPaymentErrorMsg(null);
      }
    }, [cartSummary.totalCount])
  );

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

  const { trigger: handleCompleteSale, isSubmitting } = useIdempotentSubmit(async () => {
    setPaymentErrorMsg(null);
    if (cartSummary.items.length === 0) return;

    if (isUnderpaid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPaymentErrorMsg(
        `⚠️ Payment entered (₱${parsedPaymentPhp.toFixed(
          2
        )}) is short by ₱${shortfallPhp.toFixed(
          2
        )}. Please input at least ${cartSummary.formattedTotal} or enable "Charge Deficit to Utang".`
      );
      return;
    }

    if ((tenderType === 'UTANG' || chargeShortfallToUtang) && !selectedCustomer.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPaymentErrorMsg('⚠️ Please enter a Customer Name for Utang credit.');
      return;
    }

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const tx = await completeSale({
        tenderType,
        amountTenderedPhp: tenderType === 'UTANG' ? 0 : effectivePaymentPhp,
        gcashRef: tenderType === 'GCASH' ? gcashRefInput.trim() || undefined : undefined,
        customerName:
          tenderType === 'UTANG' || chargeShortfallToUtang
            ? selectedCustomer.trim()
            : undefined,
        chargeShortfallToUtang,
        isOneTimeBulkOrder: false,
      });

      setCompletedTx(tx);
      setPaymentInputText('');
      setDiscountInputText('0.00');
      setGcashRefInput('');
      setChargeShortfallToUtang(false);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPaymentErrorMsg(err instanceof Error ? err.message : 'Payment error');
    }
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Bar: <- New Sale  |  Trash Icon */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
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
          <Text style={styles.headerTitle}>{t.newSaleTitle}</Text>
        </View>

        <View style={styles.headerRight}>
          {cartSummary.hasParkedCart ? (
            <Pressable
              style={styles.restoreParkedBtn}
              onPress={restoreParkedCart}
            >
              <Text style={styles.restoreParkedText}>Restore Held Cart</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.trashBtn}
            onPress={() => {
              if (cartSummary.totalCount > 0 || cartSummary.items.length > 0) {
                setShowClearConfirm((prev) => !prev);
              }
            }}
            hitSlop={10}
          >
            <Ionicons name="trash-outline" size={20} color="#DC2626" />
          </Pressable>
        </View>
      </View>

      {/* Owner Guard on Trash / Clear Cart */}
      {showClearConfirm ? (
        <View style={styles.confirmBanner}>
          <Text style={styles.confirmBannerTitle}>
            Owner Action: Clear or Hold {cartSummary.totalCount} items ({cartSummary.formattedTotal})?
          </Text>
          <View style={styles.confirmActions}>
            <Pressable
              style={styles.parkBtn}
              onPress={() => {
                parkCurrentCart();
                setShowClearConfirm(false);
              }}
            >
              <Ionicons name="pause-circle-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.parkBtnText}>Hold / Park Cart</Text>
            </Pressable>
            <Pressable
              style={styles.clearConfirmBtn}
              onPress={() => {
                clearCart();
                resetSaleForm();
                setShowClearConfirm(false);
              }}
            >
              <Ionicons name="trash-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.clearConfirmText}>Clear Sale</Text>
            </Pressable>
            <Pressable
              style={styles.cancelConfirmBtn}
              onPress={() => setShowClearConfirm(false)}
            >
              <Text style={styles.cancelConfirmText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Forgiving UX: Undo Toast when an item is decremented to 0 */}
      {cartSummary.lastRemovedItem ? (
        <View style={styles.undoBanner}>
          <Text style={styles.undoText}>
            Removed {cartSummary.lastRemovedItem.name}
          </Text>
          <Pressable style={styles.undoBtn} onPress={undoRemoveCartItem}>
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
            </View>
          ) : (
            cartSummary.items.map((item, idx) => {
              const prod = products.find((p) => p.id === item.productId);
              return (
                <View
                  key={item.productId}
                  style={[
                    styles.cartItemRow,
                    idx < cartSummary.items.length - 1 ? styles.cartItemBorder : null,
                  ]}
                >
                  <View style={styles.thumbBox}>
                    {prod ? (
                      <ProductThumbnail
                        visual={prod.visual}
                        imageUri={prod.imageUri}
                        size="md"
                      />
                    ) : null}
                  </View>

                  <View style={styles.itemCenterCol}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <View style={styles.unitPriceRow}>
                      <Text style={styles.itemUnitPrice}>{item.formattedUnitPrice}</Text>
                      {item.bundleApplied ? (
                        <Text style={styles.bundleTag}> (2 for ₱24 promo)</Text>
                      ) : null}
                    </View>

                    {/* - 2 + Quantity Stepper */}
                    <View style={styles.stepperContainer}>
                      <Pressable
                        style={styles.stepperBtn}
                        hitSlop={8}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                            () => {}
                          );
                          addToCart(item.productId, -1);
                        }}
                      >
                        <Text style={styles.stepperSymbol}>−</Text>
                      </Pressable>

                      <Text style={styles.stepperQty}>{item.quantity}</Text>

                      <Pressable
                        style={styles.stepperBtn}
                        hitSlop={8}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                            () => {}
                          );
                          addToCart(item.productId, 1);
                        }}
                      >
                        <Text style={styles.stepperSymbol}>+</Text>
                      </Pressable>
                    </View>
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
              <Text style={styles.exchangeLabel}>
                Exchange Credit ({cartSummary.exchangeSourceReceiptId})
              </Text>
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
                    setPaymentErrorMsg(null);
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
                    setPaymentErrorMsg(null);
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
                        setPaymentErrorMsg(null);
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

              {/* GCash Reference Input (Mitigates Fake GCash Screenshot Scams) */}
              {tenderType === 'GCASH' ? (
                <View style={styles.gcashRefBox}>
                  <Text style={styles.paymentFieldLabel}>
                    GCash Ref # (Last 4 digits):
                  </Text>
                  <TextInput
                    style={styles.gcashRefInput}
                    value={gcashRefInput}
                    onChangeText={setGcashRefInput}
                    placeholder="e.g. 4829"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="number-pad"
                    maxLength={13}
                  />
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

        {paymentErrorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{paymentErrorMsg}</Text>
          </View>
        ) : null}

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
            onPress={() => router.push('/')}
          >
            <Ionicons name="add" size={20} color="#0D7A52" style={{ marginRight: 4 }} />
            <Text style={styles.addMoreText}>{t.addMoreItemsBtn}</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Official Transaction Receipt Modal on Completion */}
      {completedTx ? (
        <View style={styles.receiptOverlay}>
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <View style={styles.receiptIconCircle}>
                <Ionicons name="checkmark" size={26} color="#15803D" />
              </View>
              <Text style={styles.receiptTitle}>Sale Recorded</Text>
              <Text style={styles.receiptSub}>Successfully saved to SQLite Database</Text>
            </View>

            <View style={styles.receiptBody}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Receipt ID:</Text>
                <Text style={styles.receiptValueBold}>{completedTx.id}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Date & Time:</Text>
                <Text style={styles.receiptValue}>
                  {completedTx.dateLabel} • {completedTx.timeLabel}
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Payment Method:</Text>
                <Text style={styles.receiptValueBold}>{completedTx.tenderType}</Text>
              </View>
              {completedTx.customerName ? (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Customer:</Text>
                  <Text style={styles.receiptValue}>{completedTx.customerName}</Text>
                </View>
              ) : null}
              <View style={styles.receiptDivider} />
              <View style={styles.receiptRow}>
                <Text style={styles.receiptTotalLabel}>Total Amount:</Text>
                <Text style={styles.receiptTotalValue}>{completedTx.formattedTotal}</Text>
              </View>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Amount Tendered:</Text>
                <Text style={styles.receiptValue}>
                  ₱{completedTx.amountTenderedPhp.toFixed(2)}
                </Text>
              </View>
              {completedTx.changeDuePhp > 0 ? (
                <View style={[styles.receiptRow, styles.receiptChangeRow]}>
                  <Text style={styles.receiptChangeLabel}>{t.changeGiven}</Text>
                  <Text style={styles.receiptChangeValue}>
                    ₱{completedTx.changeDuePhp.toFixed(2)}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.receiptBtnRow}>
              <Pressable
                style={styles.receiptPrimaryBtn}
                onPress={() => {
                  clearCart();
                  resetSaleForm();
                  router.push('/');
                }}
              >
                <Ionicons name="barcode-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.receiptPrimaryBtnText}>{t.nextSaleBtn}</Text>
              </Pressable>
              <Pressable
                style={styles.receiptSecondaryBtn}
                onPress={() => {
                  clearCart();
                  resetSaleForm();
                  router.push('/sales');
                }}
              >
                <Ionicons name="receipt-outline" size={18} color="#334155" style={{ marginRight: 6 }} />
                <Text style={styles.receiptSecondaryBtnText}>{t.viewSalesHistoryBtn}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
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
});
