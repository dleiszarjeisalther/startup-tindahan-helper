// src/app/sales.tsx — Screen 5: Sales History (+ Owner Return / Void / Exchange Wizard)
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { ReturnDisposition } from '@/application/TindahanStoreService';
import { Money } from '@/domain/value-objects/Money';
import { getTranslations } from '@/presentation/localization/i18n';

const PERIODS = ['Daily', 'Weekly', 'Monthly'] as const;

export default function SalesHistoryScreen() {
  const router = useRouter();
  const {
    getSalesSummary,
    voidEntireTransaction,
    processReturnOrExchange,
    settings,
  } = useTindahanStore();

  const t = getTranslations(settings?.language);

  const [selectedPeriod, setSelectedPeriod] =
    useState<(typeof PERIODS)[number]>('Daily');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [disposition, setDisposition] = useState<ReturnDisposition>('SELLABLE');
  const [returnReason, setReturnReason] = useState<string>('Defective / Wrong Item');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const summary = getSalesSummary(selectedPeriod);


  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header: Sales | Seasonal Forecast Quick Button */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{t.salesTitle}</Text>
        <Pressable
          style={styles.forecastBtn}
          onPress={() => router.push('/explore')}
        >
          <Ionicons name="trending-up" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.forecastBtnText}>Seasonal Forecast</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Period Segmented Control: Daily | Weekly | Monthly (Matches Screen 5 Prototype) */}
        <View style={styles.segmentedBar}>
          {PERIODS.map((p) => {
            const active = selectedPeriod === p;
            return (
              <Pressable
                key={p}
                style={[styles.segmentPill, active ? styles.segmentPillActive : null]}
                onPress={() => setSelectedPeriod(p)}
              >
                <Text
                  style={[
                    styles.segmentPillText,
                    active ? styles.segmentPillTextActive : null,
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Date Selector Card: Dynamic Current Date */}
        <View style={styles.dateCard}>
          <View style={styles.dateLeft}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
          </View>
          <Text style={styles.dateChevron}>›</Text>
        </View>

        {/* 3 KPI Summary Cards: Benta, Koleksyon, Pera sa Kahon */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>
              {selectedPeriod === 'Daily' ? 'Benta Today' : `${selectedPeriod} Benta`}
            </Text>
            <Text style={styles.kpiValue}>{summary.formattedTotalSales}</Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Koleksyon (Utang)</Text>
            <Text style={[styles.kpiValue, { color: '#0D7A52' }]}>
              {summary.formattedUtangCollected}
            </Text>
          </View>

          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Pera sa Kahon</Text>
            <Text style={styles.kpiValue}>{summary.formattedCashInDrawer}</Text>
          </View>
        </View>

        {/* Secondary Financial & Inventory Breakdown */}
        <View style={styles.secondaryKpiRow}>
          <View style={styles.secondaryKpiItem}>
            <Text style={styles.secondaryKpiLabel}>GCash Total</Text>
            <Text style={styles.secondaryKpiVal}>{summary.formattedGcashTotal}</Text>
          </View>
          <View style={styles.secondaryKpiItem}>
            <Text style={styles.secondaryKpiLabel}>Bagong Utang</Text>
            <Text style={styles.secondaryKpiVal}>{summary.formattedUtangCreditIssued}</Text>
          </View>
          <View style={styles.secondaryKpiItem}>
            <Text style={styles.secondaryKpiLabel}>Items Sold</Text>
            <Text style={styles.secondaryKpiVal}>{summary.totalItems}</Text>
          </View>
          <View style={styles.secondaryKpiItem}>
            <Text style={styles.secondaryKpiLabel}>Receipts</Text>
            <Text style={styles.secondaryKpiVal}>{summary.totalTransactions}</Text>
          </View>
        </View>

        {actionMsg ? (
          <View style={styles.actionToast}>
            <Text style={styles.actionToastText}>{actionMsg}</Text>
          </View>
        ) : null}

        {/* Recent Transactions Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Text style={styles.sectionHint}>Tap receipt for Return / Exchange / Void</Text>
        </View>

        <View style={styles.txListCard}>
          {summary.transactions.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569' }}>
                {summary.allTransactions && summary.allTransactions.length > 0
                  ? `No sales recorded for ${selectedPeriod}`
                  : 'No sales recorded in database yet'}
              </Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
                {summary.allTransactions && summary.allTransactions.length > 0
                  ? 'Switch period above to Weekly or Monthly to view earlier receipts, or record a new sale in "New Sale".'
                  : 'Add products to your cart and complete a sale in "New Sale" to record receipts in SQLite.'}
              </Text>
            </View>
          ) : null}
          {summary.transactions.map((tx, idx) => {
            const isExpanded = selectedTxId === tx.id;
            const isPayment = tx.transactionType === 'UTANG_PAYMENT';
            const netPhp = Math.max(0, tx.totalPhp - tx.refundedPhp);

            if (isPayment) {
              return (
                <View
                  key={tx.id}
                  style={[
                    styles.txContainer,
                    idx < summary.transactions.length - 1 ? styles.txBorder : null,
                  ]}
                >
                  <Pressable
                    style={styles.txRow}
                    onPress={() =>
                      setSelectedTxId((prev) => (prev === tx.id ? null : tx.id))
                    }
                  >
                    <View style={styles.txTimeCol}>
                      <Text style={styles.txTime}>{tx.timeLabel}</Text>
                      <Text
                        style={[
                          styles.txStatusTag,
                          tx.status === 'VOIDED' ? styles.tagVoid : styles.tagPayment,
                        ]}
                      >
                        {tx.status === 'VOIDED' ? 'VOIDED' : 'BAYAD UTANG'}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.txAmount,
                        styles.txAmountGreen,
                        tx.status === 'VOIDED' ? styles.txAmountVoided : null,
                      ]}
                    >
                      +{Money.fromPhp(tx.totalPhp).format()}
                    </Text>

                    <Text style={styles.txItemsCount} numberOfLines={1}>
                      {tx.customerName || 'Customer'}
                    </Text>
                  </Pressable>

                  {isExpanded ? (
                    <View style={styles.wizardBox}>
                      <View style={styles.wizardHeader}>
                        <Text style={styles.wizardTitle}>
                          Koleksyon #{tx.id} • Bayad via {tx.tenderType}
                        </Text>
                      </View>

                      <Text style={styles.paymentDetailText}>
                        Customer: <Text style={{ fontWeight: '800' }}>{tx.customerName || 'Customer'}</Text>
                      </Text>
                      <Text style={styles.paymentDetailText}>
                        Halaga: <Text style={{ fontWeight: '800', color: '#15803D' }}>{Money.fromPhp(tx.totalPhp).format()}</Text>
                      </Text>

                      {tx.voidOrReturnNote ? (
                        <Text style={styles.auditNoteText}>{tx.voidOrReturnNote}</Text>
                      ) : null}

                      {tx.status !== 'VOIDED' ? (
                        <Pressable
                          style={styles.voidSaleBtn}
                          onPress={async () => {
                            Haptics.notificationAsync(
                              Haptics.NotificationFeedbackType.Warning
                            ).catch(() => {});
                            await voidEntireTransaction(tx.id, 'Pambawi ng Bayad Utang');
                            setActionMsg(
                              `✓ Na-void ang bayad utang ni ${tx.customerName || 'Customer'} at naibalik ang balanse`
                            );
                          }}
                        >
                          <Text style={styles.voidSaleBtnText}>
                            🚫 Void Payment (Ibalik ang Balanse sa Utang)
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            }

            return (
              <View
                key={tx.id}
                style={[
                  styles.txContainer,
                  idx < summary.transactions.length - 1 ? styles.txBorder : null,
                ]}
              >
                <Pressable
                  style={styles.txRow}
                  onPress={() =>
                    setSelectedTxId((prev) => (prev === tx.id ? null : tx.id))
                  }
                >
                  <View style={styles.txTimeCol}>
                    <Text style={styles.txTime}>{tx.timeLabel}</Text>
                    {tx.status !== 'COMPLETED' ? (
                      <Text
                        style={[
                          styles.txStatusTag,
                          tx.status === 'VOIDED'
                            ? styles.tagVoid
                            : styles.tagReturn,
                        ]}
                      >
                        {tx.status}
                      </Text>
                    ) : tx.tenderType === 'UTANG' ? (
                      <Text style={[styles.txStatusTag, styles.tagUtang]}>UTANG</Text>
                    ) : null}
                  </View>

                  <Text
                    style={[
                      styles.txAmount,
                      tx.status === 'VOIDED' ? styles.txAmountVoided : null,
                    ]}
                  >
                    {Money.fromPhp(netPhp).format()}
                  </Text>

                  <Text style={styles.txItemsCount}>
                    {tx.itemCount} {tx.itemCount === 1 ? 'Item' : 'Items'}
                  </Text>
                </Pressable>

                {/* Owner Guided Return / Exchange / Void Wizard (POS-01, POS-02, POS-03, POS-04) */}
                {isExpanded ? (
                  <View style={styles.wizardBox}>
                    <View style={styles.wizardHeader}>
                      <Text style={styles.wizardTitle}>
                        Receipt {tx.id} • Paid via {tx.tenderType}
                        {tx.customerName ? ` (${tx.customerName})` : ''}
                      </Text>
                    </View>

                    {tx.voidOrReturnNote ? (
                      <Text style={styles.auditNoteText}>{tx.voidOrReturnNote}</Text>
                    ) : null}

                    {tx.status !== 'VOIDED' ? (
                      <>
                        {/* Step 1: Mandatory Condition Disposition Gate (POS-03) */}
                        <Text style={styles.stepLabel}>
                          1. Returned Item Condition (Prevents Phantom Stock):
                        </Text>
                        <View style={styles.dispositionRow}>
                          <Pressable
                            style={[
                              styles.dispChip,
                              disposition === 'SELLABLE' ? styles.dispChipGreen : null,
                            ]}
                            onPress={() => setDisposition('SELLABLE')}
                          >
                            <Text
                              style={[
                                styles.dispChipText,
                                disposition === 'SELLABLE'
                                  ? styles.dispChipTextGreen
                                  : null,
                              ]}
                            >
                              ✓ Sellable (Restock +1)
                            </Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.dispChip,
                              disposition === 'DAMAGED_QUARANTINE'
                                ? styles.dispChipAmber
                                : null,
                            ]}
                            onPress={() => setDisposition('DAMAGED_QUARANTINE')}
                          >
                            <Text
                              style={[
                                styles.dispChipText,
                                disposition === 'DAMAGED_QUARANTINE'
                                  ? styles.dispChipTextAmber
                                  : null,
                              ]}
                            >
                              ⚠ Damaged/Expired (Quarantine)
                            </Text>
                          </Pressable>
                        </View>

                        {/* Reason Pills */}
                        <View style={styles.reasonRow}>
                          {['Defective / Spoiled', 'Wrong Item', 'Changed Mind'].map(
                            (r) => (
                              <Pressable
                                key={r}
                                style={[
                                  styles.reasonPill,
                                  returnReason === r ? styles.reasonPillActive : null,
                                ]}
                                onPress={() => setReturnReason(r)}
                              >
                                <Text
                                  style={[
                                    styles.reasonText,
                                    returnReason === r ? styles.reasonTextActive : null,
                                  ]}
                                >
                                  {r}
                                </Text>
                              </Pressable>
                            )
                          )}
                        </View>

                        {/* Step 2: Line items with capped Refund & Instant Exchange buttons */}
                        <Text style={styles.stepLabel}>
                          2. Select Item to Refund or Exchange (Capped at Receipt Price):
                        </Text>
                        {tx.items.map((item) => {
                          const remaining = item.quantity - item.returnedQty;
                          const isUtangSale = tx.tenderType === 'UTANG';

                          return (
                            <View key={item.productId} style={styles.lineItemRow}>
                              <View style={styles.lineItemLeft}>
                                <Text style={styles.lineItemName}>
                                  {item.name} ({remaining}/{item.quantity} left)
                                </Text>
                                <Text style={styles.lineItemSub}>
                                  Paid ₱{item.unitPricePaidPhp.toFixed(2)}/pc
                                </Text>
                              </View>

                              {remaining > 0 ? (
                                <View style={styles.lineActionBtns}>
                                  <Pressable
                                    style={[
                                      styles.refundBtn,
                                      isUtangSale ? styles.utangDeductBtn : null,
                                    ]}
                                    onPress={async () => {
                                      Haptics.notificationAsync(
                                        Haptics.NotificationFeedbackType.Success
                                      ).catch(() => {});
                                      const res = await processReturnOrExchange({
                                        txId: tx.id,
                                        productId: item.productId,
                                        returnQty: 1,
                                        reason: returnReason,
                                        disposition,
                                        resolution: isUtangSale
                                          ? 'UTANG_DEDUCTION'
                                          : 'CASH_REFUND',
                                      });
                                      setActionMsg(
                                        isUtangSale
                                          ? `✓ Nabawas ang ₱${res.creditPhp.toFixed(2)} sa utang ni ${
                                              tx.customerName || 'Customer'
                                            } para sa 1× ${item.name}`
                                          : `✓ Refunded ₱${res.creditPhp.toFixed(2)} for 1× ${
                                              item.name
                                            } (${
                                              disposition === 'SELLABLE'
                                                ? 'Restocked to Inventory'
                                                : 'Quarantined as Damaged'
                                            })`
                                      );
                                    }}
                                  >
                                    <Text
                                      style={[
                                        styles.refundBtnText,
                                        isUtangSale ? styles.utangDeductBtnText : null,
                                      ]}
                                    >
                                      {isUtangSale ? 'Bawas Utang 1×' : 'Refund 1×'}
                                    </Text>
                                  </Pressable>

                                  <Pressable
                                    style={styles.exchangeBtn}
                                    onPress={async () => {
                                      Haptics.notificationAsync(
                                        Haptics.NotificationFeedbackType.Success
                                      ).catch(() => {});
                                      const res = await processReturnOrExchange({
                                        txId: tx.id,
                                        productId: item.productId,
                                        returnQty: 1,
                                        reason: returnReason,
                                        disposition,
                                        resolution: 'EXCHANGE_CREDIT',
                                      });
                                      setActionMsg(
                                        `✓ Applied ₱${res.creditPhp.toFixed(
                                          2
                                        )} Exchange Credit to New Sale`
                                      );
                                      router.push('/checkout');
                                    }}
                                  >
                                    <Text style={styles.exchangeBtnText}>
                                      🔄 Exchange
                                    </Text>
                                  </Pressable>
                                </View>
                              ) : (
                                <Text style={styles.returnedBadge}>Returned</Text>
                              )}
                            </View>
                          );
                        })}

                        {/* Owner Same-Day Void Button (POS-01) */}
                        <Pressable
                          style={styles.voidSaleBtn}
                          onPress={async () => {
                            Haptics.notificationAsync(
                              Haptics.NotificationFeedbackType.Warning
                            ).catch(() => {});
                            await voidEntireTransaction(tx.id, 'Owner Entry Correction');
                            setActionMsg(
                              `✓ Voided ${tx.id} and restored sellable stock to Inventory`
                            );
                          }}
                        >
                          <Text style={styles.voidSaleBtnText}>
                            🚫 Void Entire Receipt (Owner Entry Error)
                          </Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
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
  forecastBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  forecastBtnText: {
    color: '#0D7A52',
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 120,
    gap: 14,
  },
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    padding: 4,
  },
  segmentPill: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentPillActive: {
    backgroundColor: '#0D7A52',
  },
  segmentPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  segmentPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  dateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  calendarIcon: {
    fontSize: 15,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  dateChevron: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: '600',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 4,
  },
  kpiLabel: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  actionToast: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionToastText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  sectionHint: {
    fontSize: 11,
    color: '#0D7A52',
    fontWeight: '600',
  },
  txListCard: {
    backgroundColor: '#FFFFFF',
  },
  txContainer: {
    paddingVertical: 2,
  },
  txBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  txTimeCol: {
    width: 96,
    gap: 2,
  },
  txTime: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  txStatusTag: {
    fontSize: 9,
    fontWeight: '800',
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagVoid: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  tagReturn: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  txAmountVoided: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  txItemsCount: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
    width: 70,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  wizardBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  wizardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wizardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  auditNoteText: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '700',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginTop: 2,
  },
  dispositionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dispChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
  },
  dispChipGreen: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#16A34A',
  },
  dispChipAmber: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#D97706',
  },
  dispChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  dispChipTextGreen: {
    color: '#15803D',
    fontWeight: '800',
  },
  dispChipTextAmber: {
    color: '#B45309',
    fontWeight: '800',
  },
  reasonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  reasonPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  reasonPillActive: {
    backgroundColor: '#0D7A52',
  },
  reasonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#334155',
  },
  reasonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  lineItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lineItemLeft: {
    flex: 1,
  },
  lineItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  lineItemSub: {
    fontSize: 11,
    color: '#64748B',
  },
  lineActionBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  refundBtn: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  refundBtnText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '800',
  },
  exchangeBtn: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  exchangeBtnText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '800',
  },
  returnedBadge: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  voidSaleBtn: {
    marginTop: 4,
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  voidSaleBtnText: {
    color: '#991B1B',
    fontSize: 11,
    fontWeight: '800',
  },
  tagPayment: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  tagUtang: {
    backgroundColor: '#EFF6FF',
    color: '#1D4ED8',
  },
  txAmountGreen: {
    color: '#15803D',
  },
  secondaryKpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  secondaryKpiItem: {
    alignItems: 'center',
    gap: 2,
  },
  secondaryKpiLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  secondaryKpiVal: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  utangDeductBtn: {
    backgroundColor: '#DBEAFE',
  },
  utangDeductBtnText: {
    color: '#1D4ED8',
  },
  paymentDetailText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 18,
  },
});
