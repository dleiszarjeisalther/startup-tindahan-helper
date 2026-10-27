import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SaleTransactionRecord } from '../../application/TindahanStoreService';
import { useTindahanStore } from '../hooks/useTindahanStore';
import { ProductThumbnail } from './ProductThumbnail';
import { ConfirmationModal, ConfirmationModalDetail, ConfirmationType } from './ConfirmationModal';

export type ReturnDisposition = 'SELLABLE' | 'DAMAGED_QUARANTINE';
export type ReturnResolution = 'CASH_REFUND' | 'UTANG_DEDUCTION' | 'EXCHANGE_CREDIT';

export interface TransactionDetailModalProps {
  visible: boolean;
  transaction: SaleTransactionRecord | null;
  onClose: () => void;
  onProcessReturnOrExchange: (params: {
    txId: string;
    productId: string;
    returnQty: number;
    reason: string;
    disposition: ReturnDisposition;
    resolution: ReturnResolution;
  }) => Promise<{ creditPhp: number }>;
  onVoidEntireTransaction: (txId: string, reason: string) => Promise<void>;
  onReprintReceipt?: (tx: SaleTransactionRecord) => void;
  onNavigateToCartForExchange?: (creditPhp: number) => void;
  showToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
  showProfit?: boolean;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  visible,
  transaction,
  onClose,
  onProcessReturnOrExchange,
  onVoidEntireTransaction,
  onReprintReceipt,
  onNavigateToCartForExchange,
  showToast,
  showProfit = true,
}) => {
  const { products, cartSummary, cancelExchangeCredit } = useTindahanStore();
  const [selectedProductIdOverride, setSelectedProductIdOverride] = useState<string | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [disposition, setDisposition] = useState<ReturnDisposition>('SELLABLE');
  const [selectedReason, setSelectedReason] = useState<string>('Nagbago ang Isip');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Derived selected product ID: Pure, zero effect cascading render
  const defaultProductId =
    transaction?.items.find((i) => i.quantity - i.returnedQty > 0)?.productId ||
    transaction?.items[0]?.productId ||
    null;
  const selectedProductId = selectedProductIdOverride ?? defaultProductId;

  // Confirmation dialog state
  const [confirmState, setConfirmState] = useState<{
    visible: boolean;
    type: ConfirmationType;
    title: string;
    message: string;
    itemName?: string;
    details: ConfirmationModalDetail[];
    confirmText: string;
    action: () => Promise<void>;
  } | null>(null);

  if (!transaction) return null;

  const isUtangSale = transaction.tenderType === 'UTANG';
  const isVoided = transaction.status === 'VOIDED';
  const isFullyRefunded = transaction.status === 'REFUNDED';
  const netSalesPhp = Math.max(0, transaction.totalPhp - transaction.refundedPhp);

  const activeItem = transaction.items.find((i) => i.productId === selectedProductId) || null;
  const maxReturnableQty = activeItem ? Math.max(0, activeItem.quantity - activeItem.returnedQty) : 0;
  const refundAmountPhp = activeItem ? Number((activeItem.unitPricePaidPhp * returnQty).toFixed(2)) : 0;

  // Calculate remaining and total pieces across all items
  const totalUnits = transaction.items.reduce((sum, it) => sum + it.quantity, 0);
  const returnedUnits = transaction.items.reduce((sum, it) => sum + (it.returnedQty || 0), 0);
  const remainingUnits = Math.max(0, totalUnits - returnedUnits);

  const receiptNumberDisplay = transaction.id.startsWith('OR-')
    ? transaction.id
    : `OR-${transaction.id.slice(-6).toUpperCase()}`;

  const handleStepQty = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setReturnQty((prev) => {
      const next = prev + delta;
      return Math.min(maxReturnableQty, Math.max(1, next));
    });
  };

  const handleExecuteReturn = (resolution: ReturnResolution) => {
    if (!activeItem || returnQty <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    let resolutionLabel = 'Ibalik ang Pera (Cash Refund)';
    if (resolution === 'UTANG_DEDUCTION') resolutionLabel = 'Bawas Utang';
    if (resolution === 'EXCHANGE_CREDIT') resolutionLabel = 'Palit-Paninda (Kredito)';

    const conditionLabel = disposition === 'SELLABLE' ? 'Maayos (Ibenta Muli)' : 'Sira / Expired (Itabi)';

    setConfirmState({
      visible: true,
      type: 'warning',
      title: 'Kumpirmahin ang Pagbabalik',
      message: `Sigurado ka bang nais mong iproseso ang pagsauli para sa ${activeItem.name}?`,
      itemName: `${activeItem.name} (${returnQty} pc/s)`,
      details: [
        { label: 'Dami ng Isasauli', value: `${returnQty} pcs` },
        { label: 'Kalagayan', value: conditionLabel },
        { label: 'Aksyon', value: resolutionLabel },
        { label: 'Halaga', value: `₱${refundAmountPhp.toFixed(2)}` },
      ],
      confirmText: 'Itala ang Pagsauli',
      action: async () => {
        try {
          setIsSubmitting(true);
          const result = await onProcessReturnOrExchange({
            txId: transaction.id,
            productId: activeItem.productId,
            returnQty,
            reason: selectedReason,
            disposition,
            resolution,
          });

          if (resolution === 'EXCHANGE_CREDIT') {
            onClose();
            if (onNavigateToCartForExchange) {
              onNavigateToCartForExchange(result.creditPhp);
            }
          } else {
            showToast('Matagumpay na naitala ang pagsauli ng paninda!', 'success');
            setReturnQty(1);
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Hindi maiproseso ang pagsauli.';
          showToast(msg, 'error');
        } finally {
          setIsSubmitting(false);
          setConfirmState(null);
        }
      },
    });
  };

  const handleVoidWholeReceipt = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setConfirmState({
      visible: true,
      type: 'danger',
      title: 'I-void ang Buong Resibo',
      message: `Sigurado ka bang nais mong i-void ang buong resibo ${receiptNumberDisplay}? Ibabalik nito ang lahat ng natitirang stock at ituturing na kanselado ang benta.`,
      itemName: `Resibo #${receiptNumberDisplay}`,
      details: [
        { label: 'Paraan ng Bayad', value: transaction.tenderType },
        { label: 'Kabuuan', value: `₱${transaction.totalPhp.toFixed(2)}` },
        { label: 'Aksyon sa Kaha', value: isUtangSale ? 'Bawas sa Utang' : 'Bawas sa Pera sa Kaha' },
      ],
      confirmText: 'Oo, I-void ang Resibo',
      action: async () => {
        try {
          setIsSubmitting(true);
          await onVoidEntireTransaction(transaction.id, 'Customer cancellation / Void entire receipt');
          showToast(`Na-void na ang resibo #${receiptNumberDisplay}.`, 'success');
          onClose();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Hindi ma-void ang resibo.';
          showToast(msg, 'error');
        } finally {
          setIsSubmitting(false);
          setConfirmState(null);
        }
      },
    });
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdropPressable} onPress={onClose} />

          <View style={styles.modalSheet}>
            {/* Top Drag Handle */}
            <View style={styles.handleBar} />

            {/* Header Row */}
            <View style={styles.headerRow}>
              <View style={styles.headerTitleContainer}>
                <View style={styles.receiptTitleRow}>
                  <Text style={styles.headerTitle}>Resibo {receiptNumberDisplay}</Text>
                  <View
                    style={[
                      styles.tenderBadge,
                      isUtangSale ? styles.tenderBadgeUtang : styles.tenderBadgeCash,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tenderBadgeText,
                        isUtangSale ? styles.tenderBadgeTextUtang : styles.tenderBadgeTextCash,
                      ]}
                    >
                      {transaction.tenderType}
                    </Text>
                  </View>
                </View>
                <Text style={styles.headerSubtitle}>
                  {transaction.dateLabel || 'Ngayon'} • {transaction.timeLabel || ''}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  onClose();
                }}
                style={styles.closeCircleButton}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Summary Card (2-Column Box) */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryColLeft}>
                  <Text style={styles.summaryLabel}>KABUUANG BENTA (SALES)</Text>
                  <Text style={styles.summaryAmount}>₱{netSalesPhp.toFixed(2)}</Text>
                  {showProfit && transaction.tuboPhp !== undefined && (
                    <Text style={styles.summaryProfitSubtext}>
                      Tubo: +₱{Math.max(0, transaction.tuboPhp).toFixed(2)}
                    </Text>
                  )}
                </View>

                <View style={styles.summaryColRight}>
                  <Text style={styles.summaryLabelRight}>Bilang ng Paninda</Text>
                  <View style={styles.unitsPill}>
                    <Text style={styles.unitsPillText}>
                      {remainingUnits} / {totalUnits} pcs natitira
                    </Text>
                  </View>
                </View>
              </View>

              {/* Status Warning Banner if Voided or Refunded */}
              {isVoided && (
                <View style={styles.statusBannerVoided}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.statusBannerVoidedText}>
                    Kanselado (Voided) ang resibong ito.
                  </Text>
                </View>
              )}
              {isFullyRefunded && (
                <View style={styles.statusBannerRefunded}>
                  <Ionicons name="checkmark-circle" size={18} color="#D97706" />
                  <Text style={styles.statusBannerRefundedText}>
                    Buong naisauli na ang mga paninda sa resibong ito.
                  </Text>
                </View>
              )}

              {/* Active Palit-Paninda (Exchange Credit) Notice Banner for this receipt */}
              {cartSummary.exchangeCreditPhp > 0 && cartSummary.exchangeSourceReceiptId === transaction.id && (
                <View style={styles.exchangeNoticeBanner}>
                  <View style={styles.exchangeNoticeLeft}>
                    <Ionicons name="swap-horizontal" size={16} color="#2563EB" />
                    <Text style={styles.exchangeNoticeText}>
                      May Palit-Paninda (₱{cartSummary.exchangeCreditPhp.toFixed(2)}) sa Cart
                    </Text>
                  </View>
                  <Pressable
                    style={styles.exchangeNoticeCancelBtn}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      cancelExchangeCredit();
                      showToast('Naalis na ang Palit-Paninda kredito.', 'success');
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="close" size={13} color="#DC2626" />
                    <Text style={styles.exchangeNoticeCancelText}>Kanselahin</Text>
                  </Pressable>
                </View>
              )}

              {/* Items Section Header */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>BUONG TALAAN NG BINILI SA RESIBO:</Text>
                {!isVoided && !isFullyRefunded && (
                  <View style={styles.guideBadge}>
                    <Text style={styles.guideBadgeText}>Pindutin ang item para magsauli</Text>
                  </View>
                )}
              </View>

              {/* Items List Card Container */}
              <View style={styles.itemsCardContainer}>
                {transaction.items.map((item, index) => {
                  const matchedProduct = products.find((p) => p.id === item.productId);
                  const isSelected = selectedProductId === item.productId;
                  const itemRemaining = Math.max(0, item.quantity - item.returnedQty);
                  const isItemDone = itemRemaining === 0;
                  const lineTotal = item.unitPricePaidPhp * item.quantity;
                  const isLast = index === transaction.items.length - 1;

                  return (
                    <View
                      key={item.productId}
                      style={[
                        styles.itemRowWrapper,
                        !isLast && !isSelected && styles.itemRowBorder,
                      ]}
                    >
                      {/* Main Item Row Header */}
                      <Pressable
                        style={[
                          styles.itemRowPressable,
                          isSelected && styles.itemRowPressableSelected,
                        ]}
                        onPress={() => {
                          if (isVoided || isItemDone) return;
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          if (isSelected) {
                            setSelectedProductIdOverride(null);
                          } else {
                            setSelectedProductIdOverride(item.productId);
                            setReturnQty(1);
                          }
                        }}
                      >
                        {/* Thumbnail / Product Image */}
                        <View style={styles.itemThumbnailWrapper}>
                          {matchedProduct ? (
                            <ProductThumbnail
                              visual={matchedProduct.visual}
                              imageUri={matchedProduct.imageUri}
                              size="sm"
                            />
                          ) : (
                            <View style={styles.itemThumbnailBox}>
                              <Ionicons name="bag-handle-outline" size={20} color="#3B82F6" />
                            </View>
                          )}
                        </View>

                        {/* Name and Qty Info */}
                        <View style={styles.itemInfoCol}>
                          <Text style={styles.itemNameText} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.itemSubText}>
                            {item.quantity} pcs × ₱{item.unitPricePaidPhp.toFixed(2)}
                          </Text>
                          {item.returnedQty > 0 && (
                            <Text style={styles.itemReturnedText}>
                              (Naisauli: {item.returnedQty} pcs)
                            </Text>
                          )}
                        </View>

                        {/* Right Side: Total Price and Return Cue */}
                        <View style={styles.itemPriceCol}>
                          <Text style={styles.itemTotalText}>₱{lineTotal.toFixed(2)}</Text>
                          {isItemDone ? (
                            <Text style={styles.itemDoneBadgeText}>Naibalik na</Text>
                          ) : isVoided ? null : (
                            <View style={styles.isauliRow}>
                              <Text style={styles.isauliText}>
                                {isSelected ? 'Itago ▴' : 'Isauli ▾'}
                              </Text>
                              <View style={styles.chevronCircle}>
                                <Ionicons
                                  name={isSelected ? 'chevron-up' : 'chevron-down'}
                                  size={13}
                                  color="#64748B"
                                />
                              </View>
                            </View>
                          )}
                        </View>
                      </Pressable>

                      {/* Expanded Return Configuration Panel */}
                      {isSelected && !isVoided && !isItemDone && (
                        <View style={styles.returnExpandBox}>
                          {/* Stepper Row */}
                          <View style={styles.stepperContainerRow}>
                            <View>
                              <Text style={styles.stepperLabel}>Dami ng Isasauli:</Text>
                              <Text style={styles.stepperSubtext}>
                                Hanggang {itemRemaining} pcs
                              </Text>
                            </View>

                            <View style={styles.stepperControls}>
                              <Pressable
                                style={[
                                  styles.stepperBtn,
                                  returnQty <= 1 && styles.stepperBtnDisabled,
                                ]}
                                onPress={() => handleStepQty(-1)}
                                disabled={returnQty <= 1}
                              >
                                <Ionicons
                                  name="remove"
                                  size={18}
                                  color={returnQty <= 1 ? '#CBD5E1' : '#334155'}
                                />
                              </Pressable>

                              <View style={styles.stepperDisplay}>
                                <Text style={styles.stepperDisplayText}>
                                  {returnQty} {returnQty === 1 ? 'pc' : 'pcs'}
                                </Text>
                              </View>

                              <Pressable
                                style={[
                                  styles.stepperBtn,
                                  returnQty >= itemRemaining && styles.stepperBtnDisabled,
                                ]}
                                onPress={() => handleStepQty(1)}
                                disabled={returnQty >= itemRemaining}
                              >
                                <Ionicons
                                  name="add"
                                  size={18}
                                  color={returnQty >= itemRemaining ? '#CBD5E1' : '#334155'}
                                />
                              </Pressable>
                            </View>
                          </View>

                          {/* Item Condition Picker */}
                          <Text style={styles.configSectionTitle}>
                            KALAGAYAN NG PANINDA:
                          </Text>
                          <View style={styles.conditionOptionsRow}>
                            <Pressable
                              style={[
                                styles.conditionOptionCard,
                                disposition === 'SELLABLE' && styles.conditionOptionCardActiveGreen,
                              ]}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setDisposition('SELLABLE');
                              }}
                            >
                              <Ionicons
                                name="checkmark-circle"
                                size={16}
                                color={disposition === 'SELLABLE' ? '#16A34A' : '#94A3B8'}
                              />
                              <Text
                                style={[
                                  styles.conditionOptionText,
                                  disposition === 'SELLABLE' && styles.conditionOptionTextActiveGreen,
                                ]}
                              >
                                Maayos (Ibenta Muli)
                              </Text>
                            </Pressable>

                            <Pressable
                              style={[
                                styles.conditionOptionCard,
                                disposition === 'DAMAGED_QUARANTINE' && styles.conditionOptionCardActiveRed,
                              ]}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setDisposition('DAMAGED_QUARANTINE');
                              }}
                            >
                              <Ionicons
                                name="warning"
                                size={16}
                                color={disposition === 'DAMAGED_QUARANTINE' ? '#DC2626' : '#94A3B8'}
                              />
                              <Text
                                style={[
                                  styles.conditionOptionText,
                                  disposition === 'DAMAGED_QUARANTINE' && styles.conditionOptionTextActiveRed,
                                ]}
                              >
                                Sira / Expired (Itabi)
                              </Text>
                            </Pressable>
                          </View>

                          {/* Reason Chips */}
                          <Text style={styles.configSectionTitle}>DAHILAN NG PAGSAULI:</Text>
                          <View style={styles.reasonChipsRow}>
                            {[
                              'Nagbago ang Isip',
                              'Sira / Depekto',
                              'Maling Naibigay',
                              'Expired na Paninda',
                            ].map((reason) => {
                              const isChipActive = selectedReason === reason;
                              return (
                                <Pressable
                                  key={reason}
                                  style={[
                                    styles.reasonChip,
                                    isChipActive && styles.reasonChipActive,
                                  ]}
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                    setSelectedReason(reason);
                                  }}
                                >
                                  <Text
                                    style={[
                                      styles.reasonChipText,
                                      isChipActive && styles.reasonChipTextActive,
                                    ]}
                                  >
                                    {reason}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          {/* Action Dispatch Buttons */}
                          <View style={styles.actionButtonsContainer}>
                            {isUtangSale ? (
                              <View style={styles.actionButtonGroup}>
                                <Pressable
                                  style={[styles.btnAction, styles.btnUtangDeduction]}
                                  onPress={() => handleExecuteReturn('UTANG_DEDUCTION')}
                                  disabled={isSubmitting}
                                >
                                  <Ionicons name="book-outline" size={16} color="#FFFFFF" />
                                  <Text style={styles.btnActionText}>
                                    Bawas Utang (₱{refundAmountPhp.toFixed(2)})
                                  </Text>
                                </Pressable>

                                <Pressable
                                  style={[styles.btnAction, styles.btnExchange]}
                                  onPress={() => handleExecuteReturn('EXCHANGE_CREDIT')}
                                  disabled={isSubmitting}
                                >
                                  <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
                                  <Text style={styles.btnActionText}>
                                    Palit-Paninda (Credit)
                                  </Text>
                                </Pressable>
                              </View>
                            ) : (
                              <View style={styles.actionButtonGroup}>
                                <Pressable
                                  style={[styles.btnAction, styles.btnCashRefund]}
                                  onPress={() => handleExecuteReturn('CASH_REFUND')}
                                  disabled={isSubmitting}
                                >
                                  <Ionicons name="cash-outline" size={16} color="#FFFFFF" />
                                  <Text style={styles.btnActionText}>
                                    Ibalik ang Pera (₱{refundAmountPhp.toFixed(2)})
                                  </Text>
                                </Pressable>

                                <Pressable
                                  style={[styles.btnAction, styles.btnExchange]}
                                  onPress={() => handleExecuteReturn('EXCHANGE_CREDIT')}
                                  disabled={isSubmitting}
                                >
                                  <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
                                  <Text style={styles.btnActionText}>
                                    Palit-Paninda (Credit)
                                  </Text>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Bottom Action Buttons (Print & Void) */}
              <View style={styles.bottomButtonsSection}>
                {/* Reprint Thermal Receipt Button */}
                {onReprintReceipt && (
                  <Pressable
                    style={styles.btnPrintReceipt}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      onReprintReceipt(transaction);
                    }}
                  >
                    <Ionicons name="print-outline" size={20} color="#065F46" />
                    <Text style={styles.btnPrintReceiptText}>
                      I-print / Tingnan ang Resibo
                    </Text>
                  </Pressable>
                )}

                {/* Void Whole Receipt Link (100% consistent with Alisin ang Paninda) */}
                {!isVoided && (
                  <View style={styles.bottomLinksRow}>
                    <Pressable
                      style={styles.bottomLinkTouchable}
                      onPress={handleVoidWholeReceipt}
                      disabled={isSubmitting}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                      <Text style={styles.deleteLinkText}>I-void ang Buong Resibo</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      {confirmState && (
        <ConfirmationModal
          visible={confirmState.visible}
          type={confirmState.type}
          title={confirmState.title}
          message={confirmState.message}
          itemName={confirmState.itemName}
          details={confirmState.details}
          confirmText={confirmState.confirmText}
          cancelText="Huwag Ituloy"
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  receiptTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  tenderBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tenderBadgeCash: {
    backgroundColor: '#DCFCE7',
  },
  tenderBadgeUtang: {
    backgroundColor: '#FEF3C7',
  },
  tenderBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tenderBadgeTextCash: {
    color: '#166534',
  },
  tenderBadgeTextUtang: {
    color: '#B45309',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  closeCircleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 28,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryColLeft: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  summaryProfitSubtext: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
    marginTop: 2,
  },
  summaryColRight: {
    alignItems: 'flex-end',
  },
  summaryLabelRight: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  unitsPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  unitsPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  statusBannerVoided: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  statusBannerVoidedText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  statusBannerRefunded: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  statusBannerRefundedText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  guideBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  guideBadgeText: {
    color: '#047857',
    fontSize: 10,
    fontWeight: '700',
  },
  itemsCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  itemRowWrapper: {
    backgroundColor: '#FFFFFF',
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemRowPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  itemRowPressableSelected: {
    backgroundColor: '#F8FAFC',
  },
  itemThumbnailWrapper: {
    width: 40,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemThumbnailBox: {
    width: 40,
    height: 46,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfoCol: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  itemNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  itemSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  itemReturnedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 1,
  },
  itemPriceCol: {
    alignItems: 'flex-end',
  },
  itemTotalText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  itemDoneBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  isauliRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 4,
  },
  isauliText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D7A52',
  },
  chevronCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  returnExpandBox: {
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  stepperContainerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepperLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  stepperSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.4,
    backgroundColor: '#F1F5F9',
  },
  stepperDisplay: {
    minWidth: 56,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0D7A52',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  stepperDisplayText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  configSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  conditionOptionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  conditionOptionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  conditionOptionCardActiveGreen: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  conditionOptionCardActiveRed: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  conditionOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  conditionOptionTextActiveGreen: {
    color: '#166534',
    fontWeight: '700',
  },
  conditionOptionTextActiveRed: {
    color: '#991B1B',
    fontWeight: '700',
  },
  reasonChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reasonChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#0D7A52',
  },
  reasonChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  reasonChipTextActive: {
    color: '#0D7A52',
    fontWeight: '700',
  },
  actionButtonsContainer: {
    marginTop: 2,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  btnAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 8,
  },
  btnCashRefund: {
    backgroundColor: '#0D7A52',
  },
  btnUtangDeduction: {
    backgroundColor: '#D97706',
  },
  btnExchange: {
    backgroundColor: '#2563EB',
  },
  btnActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomButtonsSection: {
    gap: 10,
    marginTop: 4,
  },
  btnPrintReceipt: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnPrintReceiptText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#065F46',
  },
  exchangeNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  exchangeNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  exchangeNoticeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
    flex: 1,
  },
  exchangeNoticeCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  exchangeNoticeCancelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  bottomLinksRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingBottom: 16,
  },
  bottomLinkTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  deleteLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
});
