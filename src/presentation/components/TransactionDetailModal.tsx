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
import { ConfirmationModal, ConfirmationModalDetail } from './ConfirmationModal';

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
  const [selectedProductIdOverride, setSelectedProductIdOverride] = useState<string | null>(null);
  const [returnQty, setReturnQty] = useState<number>(1);
  const [disposition, setDisposition] = useState<ReturnDisposition>('SELLABLE');
  const [selectedReason, setSelectedReason] = useState<string>('Changed Mind');
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

    const resolutionLabel =
      resolution === 'CASH_REFUND'
        ? 'Ibalik ang Bayad (Cash Refund)'
        : resolution === 'UTANG_DEDUCTION'
        ? 'Bawas Utang'
        : 'Palit-Paninda (Exchange Credit)';

    const details: ConfirmationModalDetail[] = [
      { label: 'Paninda', value: `${returnQty}× ${activeItem.name}` },
      { label: 'Halagang Babawiin', value: `₱${refundAmountPhp.toFixed(2)}`, highlight: true },
      {
        label: 'Kalagayan',
        value: disposition === 'SELLABLE' ? 'Maayos (Ibabalik sa Paninda)' : 'Sira / Expired (Talaan ng Bawas)',
      },
      { label: 'Paraan', value: resolutionLabel },
    ];

    setConfirmState({
      visible: true,
      title: 'Kumpirmahin ang Pagbabalik',
      message: `Sigurado ka bang nais mong itala ang pagbabalik ng ${returnQty}× "${activeItem.name}"?`,
      itemName: `${returnQty}× ${activeItem.name}`,
      details,
      confirmText: 'Itala ang Pagbabalik',
      action: async () => {
        setIsSubmitting(true);
        try {
          const res = await onProcessReturnOrExchange({
            txId: transaction.id,
            productId: activeItem.productId,
            returnQty,
            reason: selectedReason,
            disposition,
            resolution,
          });

          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

          if (resolution === 'EXCHANGE_CREDIT') {
            showToast(`✓ Naitala ang ₱${res.creditPhp.toFixed(2)} bilang palit-paninda`, 'success');
            onClose();
            if (onNavigateToCartForExchange) {
              onNavigateToCartForExchange(res.creditPhp);
            }
          } else if (resolution === 'UTANG_DEDUCTION') {
            showToast(
              `✓ Nabawas ang ₱${res.creditPhp.toFixed(2)} sa utang ni ${transaction.customerName || 'Suki'}`,
              'success'
            );
          } else {
            showToast(`✓ Naibalik ang ₱${res.creditPhp.toFixed(2)} sa customer`, 'success');
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Hindi maiproseso ang pagbabalik.';
          showToast(errMsg, 'error');
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
      title: 'I-void ang Buong Resibo?',
      message: `Sigurado ka bang nais mong i-void ang buong resibo ${transaction.id}? Ibabalik ang mga paninda at aalisin ang benta sa talaan.`,
      details: [
        { label: 'Resibo', value: transaction.id },
        { label: 'Kabuuang Halaga', value: `₱${transaction.totalPhp.toFixed(2)}`, highlight: true },
        { label: 'Paraan ng Bayad', value: transaction.tenderType },
      ],
      confirmText: 'Oo, I-void ang Resibo',
      action: async () => {
        setIsSubmitting(true);
        try {
          await onVoidEntireTransaction(transaction.id, 'Customer cancellation / cashier void');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          showToast(`✓ Na-void ang resibo ${transaction.id}`, 'warning');
          onClose();
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Hindi ma-void ang resibo.';
          showToast(errMsg, 'error');
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
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.backdropDismiss} onPress={onClose} />
          <View style={styles.modalSheet}>
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.headerTitleRow}>
                  <Text style={styles.headerTitle}>Resibo {transaction.id}</Text>
                  <View
                    style={[
                      styles.tenderBadge,
                      transaction.tenderType === 'CASH'
                        ? styles.tenderBadgeCash
                        : transaction.tenderType === 'UTANG'
                        ? styles.tenderBadgeUtang
                        : styles.tenderBadgeGcash,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tenderBadgeText,
                        transaction.tenderType === 'CASH'
                          ? styles.tenderTextCash
                          : transaction.tenderType === 'UTANG'
                          ? styles.tenderTextUtang
                          : styles.tenderTextGcash,
                      ]}
                    >
                      {transaction.tenderType}
                    </Text>
                  </View>
                </View>
                <Text style={styles.headerSub}>
                  {transaction.dateLabel} • {transaction.timeLabel}
                  {transaction.customerName ? ` • ${transaction.customerName}` : ''}
                </Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Financial Audit Breakdown Card */}
              <View style={styles.financialCard}>
                <View style={styles.finCol}>
                  <Text style={styles.finLabel}>Benta (Sales)</Text>
                  <Text style={styles.finVal}>₱{netSalesPhp.toFixed(2)}</Text>
                  {transaction.refundedPhp > 0 && (
                    <Text style={styles.refundedSub}>(-₱{transaction.refundedPhp.toFixed(2)})</Text>
                  )}
                </View>
                {showProfit && transaction.costPhp !== undefined && (
                  <View style={styles.finCol}>
                    <Text style={styles.finLabel}>Puhunan (Cost)</Text>
                    <Text style={styles.finVal}>₱{transaction.costPhp.toFixed(2)}</Text>
                  </View>
                )}
                {showProfit && transaction.tuboPhp !== undefined && (
                  <View style={styles.finCol}>
                    <Text style={styles.finLabel}>Tubo (Profit)</Text>
                    <Text style={[styles.finVal, styles.tuboVal]}>
                      +₱{transaction.tuboPhp.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>

              {/* Status Note Banner */}
              {transaction.voidOrReturnNote ? (
                <View style={styles.noteBanner}>
                  <Ionicons name="information-circle-outline" size={16} color="#0D7A52" />
                  <Text style={styles.noteBannerText}>{transaction.voidOrReturnNote}</Text>
                </View>
              ) : null}

              {/* Status Warning Banner if Voided or Fully Refunded */}
              {isVoided ? (
                <View style={styles.voidedBanner}>
                  <Ionicons name="alert-circle" size={18} color="#DC2626" />
                  <Text style={styles.voidedBannerText}>
                    Ang resibong ito ay na-void na. Hindi na ito maaaring baguhin o i-refund.
                  </Text>
                </View>
              ) : isFullyRefunded ? (
                <View style={styles.refundedBanner}>
                  <Ionicons name="checkmark-circle" size={18} color="#15803D" />
                  <Text style={styles.refundedBannerText}>
                    Lahat ng paninda sa resibong ito ay naisauli at na-refund na.
                  </Text>
                </View>
              ) : null}

              {/* Section 1: Item Selection & Return Stepper */}
              {!isVoided && !isFullyRefunded && (
                <View style={styles.sectionBox}>
                  <Text style={styles.sectionTitle}>1. Pumili ng Isasauling Paninda:</Text>

                  {/* Item Selection Pills */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemPickerScroll}>
                    {transaction.items.map((item) => {
                      const remaining = Math.max(0, item.quantity - item.returnedQty);
                      const isSelected = item.productId === selectedProductId;
                      return (
                        <Pressable
                          key={item.productId}
                          style={[
                            styles.itemPickerChip,
                            isSelected && styles.itemPickerChipActive,
                            remaining === 0 && styles.itemPickerChipDisabled,
                          ]}
                          onPress={() => {
                            if (remaining > 0) {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                              setSelectedProductIdOverride(item.productId);
                              setReturnQty(1);
                            }
                          }}
                        >
                          <Text
                            style={[
                              styles.itemPickerChipTitle,
                              isSelected && styles.itemPickerChipTitleActive,
                              remaining === 0 && styles.itemPickerChipTitleDisabled,
                            ]}
                            numberOfLines={1}
                          >
                            {item.name}
                          </Text>
                          <Text
                            style={[
                              styles.itemPickerChipSub,
                              isSelected && styles.itemPickerChipSubActive,
                            ]}
                          >
                            {remaining === 0
                              ? 'Naibalik na'
                              : `${remaining}/${item.quantity} ${item.unitOfMeasure === 'kg' ? 'kg' : 'pcs'}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {/* Active Returnable Item Card */}
                  {activeItem && maxReturnableQty > 0 ? (
                    <View style={styles.activeItemCard}>
                      <View style={styles.activeItemHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.activeItemName}>{activeItem.name}</Text>
                          <Text style={styles.activeItemPrice}>
                            Presyo noong Binili: ₱{activeItem.unitPricePaidPhp.toFixed(2)}
                            {activeItem.unitOfMeasure === 'kg' ? '/kg' : '/pc'}
                          </Text>
                        </View>
                        <View style={styles.activeItemBadge}>
                          <Text style={styles.activeItemBadgeText}>
                            {maxReturnableQty} natitira
                          </Text>
                        </View>
                      </View>

                      {/* Interactive Stepper */}
                      <View style={styles.stepperContainer}>
                        <Text style={styles.stepperLabel}>Dami ng Ibabalik (Return Qty):</Text>
                        <View style={styles.stepperControls}>
                          <Pressable
                            style={[styles.stepBtn, returnQty <= 1 && styles.stepBtnDisabled]}
                            onPress={() => handleStepQty(-1)}
                            disabled={returnQty <= 1}
                          >
                            <Text style={styles.stepBtnText}>−</Text>
                          </Pressable>

                          <View style={styles.stepDisplay}>
                            <Text style={styles.stepDisplayText}>{returnQty}</Text>
                          </View>

                          <Pressable
                            style={[styles.stepBtn, returnQty >= maxReturnableQty && styles.stepBtnDisabled]}
                            onPress={() => handleStepQty(1)}
                            disabled={returnQty >= maxReturnableQty}
                          >
                            <Text style={styles.stepBtnText}>+</Text>
                          </Pressable>

                          {maxReturnableQty > 1 && (
                            <Pressable
                              style={styles.allChip}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setReturnQty(maxReturnableQty);
                              }}
                            >
                              <Text style={styles.allChipText}>Lahat ({maxReturnableQty})</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>

                      {/* Item Condition Picker */}
                      <Text style={styles.subFieldLabel}>Kalagayan ng Isinauling Paninda:</Text>
                      <View style={styles.conditionRow}>
                        <Pressable
                          style={[
                            styles.conditionBtn,
                            disposition === 'SELLABLE' && styles.conditionBtnActiveSellable,
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setDisposition('SELLABLE');
                          }}
                        >
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={16}
                            color={disposition === 'SELLABLE' ? '#15803D' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.conditionBtnText,
                              disposition === 'SELLABLE' && styles.conditionTextActiveSellable,
                            ]}
                          >
                            ✓ Maayos (Babalik sa Paninda)
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.conditionBtn,
                            disposition === 'DAMAGED_QUARANTINE' && styles.conditionBtnActiveDamaged,
                          ]}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setDisposition('DAMAGED_QUARANTINE');
                          }}
                        >
                          <Ionicons
                            name="warning-outline"
                            size={16}
                            color={disposition === 'DAMAGED_QUARANTINE' ? '#B91C1C' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.conditionBtnText,
                              disposition === 'DAMAGED_QUARANTINE' && styles.conditionTextActiveDamaged,
                            ]}
                          >
                            ⚠ May Sira / Expired
                          </Text>
                        </Pressable>
                      </View>

                      {/* Reason Tag Chips */}
                      <Text style={styles.subFieldLabel}>Dahilan ng Pagbabalik:</Text>
                      <View style={styles.reasonRow}>
                        {['Changed Mind', 'Defective / May Sira', 'Wrong Item', 'Pabor sa Suki'].map((reason) => {
                          const isActive = selectedReason === reason;
                          return (
                            <Pressable
                              key={reason}
                              style={[styles.reasonChip, isActive && styles.reasonChipActive]}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setSelectedReason(reason);
                              }}
                            >
                              <Text style={[styles.reasonChipText, isActive && styles.reasonChipTextActive]}>
                                {reason}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>

                      {/* Step 2: Resolution Actions */}
                      <View style={styles.resolutionContainer}>
                        <View style={styles.resHeaderRow}>
                          <Text style={styles.resTitle}>Paraan ng Pagbawi:</Text>
                          <Text style={styles.resAmount}>
                            Kabuuan: ₱{refundAmountPhp.toFixed(2)}
                          </Text>
                        </View>

                        <View style={styles.actionBtnGrid}>
                          {isUtangSale ? (
                            <Pressable
                              style={[styles.btnAction, styles.btnUtangDeduct]}
                              onPress={() => handleExecuteReturn('UTANG_DEDUCTION')}
                              disabled={isSubmitting}
                            >
                              <Ionicons name="document-text-outline" size={16} color="#4C1D95" />
                              <Text style={styles.btnUtangDeductText}>
                                Bawas Utang (₱{refundAmountPhp.toFixed(2)})
                              </Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              style={[styles.btnAction, styles.btnRefund]}
                              onPress={() => handleExecuteReturn('CASH_REFUND')}
                              disabled={isSubmitting}
                            >
                              <Ionicons name="cash-outline" size={16} color="#991B1B" />
                              <Text style={styles.btnRefundText}>
                                Ibalik ang Bayad (₱{refundAmountPhp.toFixed(2)})
                              </Text>
                            </Pressable>
                          )}

                          <Pressable
                            style={[styles.btnAction, styles.btnExchange]}
                            onPress={() => handleExecuteReturn('EXCHANGE_CREDIT')}
                            disabled={isSubmitting}
                          >
                            <Ionicons name="swap-horizontal" size={16} color="#1E40AF" />
                            <Text style={styles.btnExchangeText}>
                              Palit-Paninda (₱{refundAmountPhp.toFixed(2)})
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.allReturnedCard}>
                      <Text style={styles.allReturnedText}>
                        Lahat ng piraso sa item na ito ay naisauli na.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Complete Items Receipt List */}
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>Buong Talaan ng Binili sa Resibo:</Text>
                {transaction.items.map((item, idx) => {
                  const remaining = Math.max(0, item.quantity - item.returnedQty);
                  return (
                    <View key={`${item.productId}_${idx}`} style={styles.receiptLineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.receiptLineName}>{item.name}</Text>
                        <Text style={styles.receiptLineSub}>
                          {item.quantity} {item.unitOfMeasure === 'kg' ? 'kg' : 'pcs'} × ₱
                          {item.unitPricePaidPhp.toFixed(2)}
                          {item.returnedQty > 0 ? ` (Naibalik: ${item.returnedQty})` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.receiptLineTotal}>
                          ₱{(item.quantity * item.unitPricePaidPhp).toFixed(2)}
                        </Text>
                        {remaining === 0 ? (
                          <Text style={styles.badgeLineReturned}>Naibalik Lahat</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {/* Bottom Actions Footer */}
            <View style={styles.modalFooter}>
              {onReprintReceipt && (
                <Pressable
                  style={styles.btnPrintReceipt}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    onReprintReceipt(transaction);
                  }}
                >
                  <Ionicons name="print-outline" size={16} color="#0D7A52" />
                  <Text style={styles.btnPrintReceiptText}>I-print / Tingnan ang Resibo</Text>
                </Pressable>
              )}

              {!isVoided && !isFullyRefunded && (
                <Pressable
                  style={styles.btnVoidReceipt}
                  onPress={handleVoidWholeReceipt}
                  disabled={isSubmitting}
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Text style={styles.btnVoidReceiptText}>I-void ang Buong Resibo</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirmation Dialog Component */}
      {confirmState && (
        <ConfirmationModal
          visible={confirmState.visible}
          type="warning"
          title={confirmState.title}
          message={confirmState.message}
          itemName={confirmState.itemName}
          details={confirmState.details}
          confirmText={confirmState.confirmText}
          cancelText="Kanselahin"
          isLoading={isSubmitting}
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  tenderBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tenderBadgeCash: {
    backgroundColor: '#DCFCE7',
  },
  tenderBadgeUtang: {
    backgroundColor: '#EDE9FE',
  },
  tenderBadgeGcash: {
    backgroundColor: '#DBEAFE',
  },
  tenderBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tenderTextCash: {
    color: '#15803D',
  },
  tenderTextUtang: {
    color: '#6D28D9',
  },
  tenderTextGcash: {
    color: '#1E40AF',
  },
  headerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    maxHeight: 520,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  financialCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  finCol: {
    alignItems: 'center',
  },
  finLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  finVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  tuboVal: {
    color: '#0D7A52',
  },
  refundedSub: {
    fontSize: 10,
    color: '#DC2626',
    fontWeight: '700',
    marginTop: 1,
  },
  noteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    padding: 8,
  },
  noteBannerText: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '600',
    flex: 1,
  },
  voidedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 10,
  },
  voidedBannerText: {
    fontSize: 11.5,
    color: '#B91C1C',
    fontWeight: '700',
    flex: 1,
  },
  refundedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 10,
    padding: 10,
  },
  refundedBannerText: {
    fontSize: 11.5,
    color: '#15803D',
    fontWeight: '700',
    flex: 1,
  },
  sectionBox: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  itemPickerScroll: {
    flexDirection: 'row',
    gap: 8,
  },
  itemPickerChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  itemPickerChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  itemPickerChipDisabled: {
    opacity: 0.5,
  },
  itemPickerChipTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  itemPickerChipTitleActive: {
    color: '#065F46',
    fontWeight: '800',
  },
  itemPickerChipTitleDisabled: {
    textDecorationLine: 'line-through',
  },
  itemPickerChipSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  itemPickerChipSubActive: {
    color: '#047857',
    fontWeight: '600',
  },
  activeItemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0D7A52',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  activeItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  activeItemName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeItemPrice: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  activeItemBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeItemBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D7A52',
  },
  stepperContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  stepDisplay: {
    width: 38,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0D7A52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisplayText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D7A52',
  },
  allChip: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  allChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
  },
  subFieldLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  conditionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  conditionBtnActiveSellable: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  conditionBtnActiveDamaged: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  conditionBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
  },
  conditionTextActiveSellable: {
    color: '#15803D',
    fontWeight: '800',
  },
  conditionTextActiveDamaged: {
    color: '#991B1B',
    fontWeight: '800',
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reasonChip: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reasonChipActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  reasonChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  reasonChipTextActive: {
    color: '#FFFFFF',
  },
  resolutionContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    gap: 8,
    marginTop: 4,
  },
  resHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  resAmount: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D7A52',
  },
  actionBtnGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  btnAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  btnRefund: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  btnRefundText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991B1B',
  },
  btnUtangDeduct: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  btnUtangDeductText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4C1D95',
  },
  btnExchange: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  btnExchangeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E40AF',
  },
  allReturnedCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  allReturnedText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  receiptLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  receiptLineName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  receiptLineSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  receiptLineTotal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  badgeLineReturned: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  btnPrintReceipt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnPrintReceiptText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  btnVoidReceipt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    paddingVertical: 9,
  },
  btnVoidReceiptText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626',
  },
});
