// src/app/utang.tsx — Dedicated Suki Utang Ledger Screen (Digital Utang Notebook)
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { getTranslations } from '@/presentation/localization/i18n';
import { Money } from '@/domain/value-objects/Money';
import { UtangCustomerRecord } from '@/application/TindahanStoreService';
import { FloatingToast } from '@/presentation/components/FloatingToast';
import {
  ConfirmationModal,
  ConfirmationType,
  ConfirmationModalDetail,
} from '@/presentation/components/ConfirmationModal';

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

type FilterType = 'ALL' | 'WITH_DEBT' | 'PAID' | 'OVER_LIMIT';

export default function SukiUtangLedgerScreen() {
  const router = useRouter();
  const {
    utangCustomers,
    transactions,
    settings,
    addUtangCustomer,
    updateUtangCustomer,
    addManualUtangEntry,
    deleteUtangCustomer,
    recordUtangPayment,
  } = useTindahanStore();

  const t = getTranslations(settings?.language);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustLimit, setNewCustLimit] = useState('500');
  const [newCustInitial, setNewCustInitial] = useState('0');
  const [addModalError, setAddModalError] = useState<string | null>(null);

  // Styled Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationState | null>(null);

  // Selected Suki for Ledger/Statement
  const [selectedCustomer, setSelectedCustomer] = useState<UtangCustomerRecord | null>(null);

  // Payment Modal State
  const [payingCustomer, setPayingCustomer] = useState<UtangCustomerRecord | null>(null);
  const [payAmountText, setPayAmountText] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'GCASH'>('CASH');
  const [payError, setPayError] = useState<string | null>(null);

  // Manual Utang Modal State
  const [manualUtangCustomer, setManualUtangCustomer] = useState<UtangCustomerRecord | null>(null);
  const [manualUtangAmountText, setManualUtangAmountText] = useState('');
  const [manualUtangNoteText, setManualUtangNoteText] = useState('');
  const [manualUtangError, setManualUtangError] = useState<string | null>(null);

  // Edit Customer Modal State
  const [editingCustomer, setEditingCustomer] = useState<UtangCustomerRecord | null>(null);
  const [editCustName, setEditCustName] = useState('');
  const [editCustLimit, setEditCustLimit] = useState('');
  const [editCustError, setEditCustError] = useState<string | null>(null);

  // Toast / Feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // Top Dashboard Metrics
  const totalReceivablesPhp = useMemo(() => {
    const sum = utangCustomers.reduce((acc, c) => acc + (c.balancePhp > 0 ? c.balancePhp : 0), 0);
    return Number(sum.toFixed(2));
  }, [utangCustomers]);

  const activeDebtorsCount = useMemo(() => {
    return utangCustomers.filter((c) => c.balancePhp > 0).length;
  }, [utangCustomers]);

  const overLimitCount = useMemo(() => {
    return utangCustomers.filter((c) => c.balancePhp > c.creditLimitPhp && c.creditLimitPhp > 0).length;
  }, [utangCustomers]);

  // Filtered Suki List
  const filteredCustomers = useMemo(() => {
    return utangCustomers
      .filter((c) => {
        if (activeFilter === 'WITH_DEBT' && c.balancePhp <= 0) return false;
        if (activeFilter === 'PAID' && c.balancePhp > 0) return false;
        if (activeFilter === 'OVER_LIMIT' && (c.balancePhp <= c.creditLimitPhp || c.creditLimitPhp <= 0)) {
          return false;
        }
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return c.name.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        // Sort highest unpaid balance first
        if (b.balancePhp !== a.balancePhp) return b.balancePhp - a.balancePhp;
        return a.name.localeCompare(b.name);
      });
  }, [utangCustomers, activeFilter, searchQuery]);

  // Customer Transaction History for Statement View
  const selectedCustomerTxList = useMemo(() => {
    if (!selectedCustomer) return [];
    const nameLower = selectedCustomer.name.trim().toLowerCase();
    return transactions.filter(
      (tx) => tx.customerName && tx.customerName.trim().toLowerCase() === nameLower
    );
  }, [selectedCustomer, transactions]);

  // Add Suki Handler
  const handleAddSuki = () => {
    const cleanName = newCustName.trim();
    if (!cleanName) {
      setAddModalError('Pangalan ng suki ay kailangan.');
      return;
    }
    const limit = parseFloat(newCustLimit.replace(/[^0-9.]/g, '') || '500');
    const initial = parseFloat(newCustInitial.replace(/[^0-9.]/g, '') || '0');

    addUtangCustomer(cleanName, isNaN(limit) ? 500 : limit, isNaN(initial) ? 0 : initial);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showToast(`✓ Nailista na si ${cleanName} sa Suki Ledger!`);
    setShowAddModal(false);
    setNewCustName('');
    setNewCustLimit('500');
    setNewCustInitial('0');
    setAddModalError(null);
  };

  // Edit Suki Handler
  const handleSaveEditSuki = () => {
    if (!editingCustomer) return;
    const cleanName = editCustName.trim();
    if (!cleanName) {
      setEditCustError('Pangalan ng suki ay kailangan.');
      return;
    }
    const limit = parseFloat(editCustLimit.replace(/[^0-9.]/g, '') || '500');

    updateUtangCustomer(editingCustomer.id, {
      name: cleanName,
      creditLimitPhp: isNaN(limit) ? 500 : limit,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showToast(`✓ Na-update ang profile ni ${cleanName}`);
    if (selectedCustomer?.id === editingCustomer.id) {
      setSelectedCustomer((prev) => (prev ? { ...prev, name: cleanName, creditLimitPhp: limit } : null));
    }
    setEditingCustomer(null);
  };

  // Open Payment Modal
  const handleOpenPayment = (cust: UtangCustomerRecord) => {
    setPayingCustomer(cust);
    setPayAmountText(cust.balancePhp > 0 ? cust.balancePhp.toFixed(2) : '');
    setPayMethod('CASH');
    setPayError(null);
  };

  // Submit Payment Handler
  const handleSubmitPayment = () => {
    if (!payingCustomer) return;
    const amount = parseFloat(payAmountText.replace(/[^0-9.]/g, '') || '0');
    if (isNaN(amount) || amount <= 0) {
      setPayError('Maglagay ng wastong halaga ng ibinayad.');
      return;
    }

    recordUtangPayment(payingCustomer.id, amount, payMethod);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showToast(`✓ Naitala ang bayad na ₱${amount.toFixed(2)} ni ${payingCustomer.name}!`);

    // Update statement view if currently open
    if (selectedCustomer?.id === payingCustomer.id) {
      setSelectedCustomer((prev) =>
        prev ? { ...prev, balancePhp: Math.max(0, prev.balancePhp - amount) } : null
      );
    }

    setPayingCustomer(null);
    setPayAmountText('');
    setPayError(null);
  };

  // Submit Manual Utang Entry Handler
  const handleSubmitManualUtang = () => {
    if (!manualUtangCustomer) return;
    const amount = parseFloat(manualUtangAmountText.replace(/[^0-9.]/g, '') || '0');
    if (isNaN(amount) || amount <= 0) {
      setManualUtangError('Maglagay ng wastong halaga ng bagong utang.');
      return;
    }

    const note = manualUtangNoteText.trim() || 'Bagong Utang';
    addManualUtangEntry(manualUtangCustomer.id, amount, note);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showToast(`✓ Naitala ang utang na ₱${amount.toFixed(2)} ni ${manualUtangCustomer.name}!`);

    if (selectedCustomer?.id === manualUtangCustomer.id) {
      setSelectedCustomer((prev) =>
        prev ? { ...prev, balancePhp: prev.balancePhp + amount } : null
      );
    }

    setManualUtangCustomer(null);
    setManualUtangAmountText('');
    setManualUtangNoteText('');
    setManualUtangError(null);
  };

  // Delete Customer Handler
  const handleDeleteCustomer = (cust: UtangCustomerRecord) => {
    if (cust.balancePhp > 0) {
      setConfirmDialog({
        type: 'warning',
        title: 'May Utang Pa ang Suki',
        itemName: cust.name,
        message: `May natitirang utang pa si ${cust.name} na ₱${cust.balancePhp.toFixed(2)}. Kailangang mabayaran muna ang utang bago mabura sa talaan.`,
        details: [
          { label: 'Suki', value: cust.name },
          { label: 'Natitirang Utang', value: `₱${cust.balancePhp.toFixed(2)}`, highlight: true },
        ],
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => {
          setConfirmDialog(null);
        },
      });
      return;
    }

    setConfirmDialog({
      type: 'delete',
      title: 'Kumpirmahin ang Pagbura',
      itemName: cust.name,
      message: `Nais mo bang burahin si "${cust.name}" mula sa iyong listahan ng mga suki?`,
      details: [
        { label: 'Suki', value: cust.name },
        { label: 'Kasalukuyang Balanse', value: '₱0.00' },
      ],
      confirmText: '✓ Oo, Burahin',
      cancelText: 'Kanselahin',
      onConfirm: () => {
        setConfirmDialog(null);
        deleteUtangCustomer(cust.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showToast(`✓ Nabura na si ${cust.name}`);
        if (selectedCustomer?.id === cust.id) {
          setSelectedCustomer(null);
        }
      },
    });
  };

  // Share Friendly Reminder via SMS / Messenger
  const handleShareReminder = async (cust: UtangCustomerRecord) => {
    try {
      const storeName = settings.storeName || 'Tindahan';
      const balanceStr = cust.balancePhp.toFixed(2);
      const msg = t.reminderMessageTemplate(storeName, cust.name, balanceStr);
      await Share.share({
        message: msg,
        title: `Paalala sa Utang - ${cust.name}`,
      });
    } catch (err) {
      console.warn('Share reminder error:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FloatingToast
        message={toastMsg}
        type="success"
        onDismiss={() => setToastMsg(null)}
      />
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerTitle}>{t.utangLedgerTitle}</Text>
          <Text style={styles.headerSubtitle}>{t.utangLedgerSub}</Text>
        </View>

        <Pressable
          style={styles.addSukiTopBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setShowAddModal(true);
          }}
          hitSlop={8}
        >
          <Ionicons name="person-add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.addSukiTopBtnText}>{t.addSukiBtn}</Text>
        </Pressable>
      </View>

      {/* Toast Notification */}
      {toastMsg ? (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top Summary Receivables Dashboard Cards */}
        <View style={styles.summaryDashboard}>
          <View style={styles.receivablesMainCard}>
            <View style={styles.receivablesHeader}>
              <Ionicons name="book-outline" size={18} color="#065F46" />
              <Text style={styles.receivablesLabel}>{t.totalReceivables}</Text>
            </View>
            <Text style={styles.receivablesAmount}>
              {Money.fromPhp(totalReceivablesPhp).format()}
            </Text>
            <Text style={styles.receivablesSubHint}>
              Pera na nasa labas na kailangang kolektahin
            </Text>
          </View>

          <View style={styles.metricsTwoCol}>
            <View style={styles.metricMiniCard}>
              <Text style={styles.metricMiniLabel}>{t.activeDebtors}</Text>
              <Text style={styles.metricMiniValue}>
                {activeDebtorsCount}{' '}
                <Text style={styles.metricMiniDenom}>/ {utangCustomers.length} suki</Text>
              </Text>
            </View>

            <View style={[styles.metricMiniCard, overLimitCount > 0 ? styles.metricAlertCard : null]}>
              <Text style={[styles.metricMiniLabel, overLimitCount > 0 ? styles.textRed : null]}>
                {t.overLimitCount}
              </Text>
              <Text style={[styles.metricMiniValue, overLimitCount > 0 ? styles.textRed : null]}>
                {overLimitCount} {overLimitCount === 1 ? 'suki' : 'mga suki'}
              </Text>
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#6B7280" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t.searchSukiPlaceholder}
              placeholderTextColor="#9CA3AF"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterPillsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsContent}>
            <Pressable
              style={[styles.filterChip, activeFilter === 'ALL' ? styles.filterChipActive : null]}
              onPress={() => setActiveFilter('ALL')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'ALL' ? styles.filterChipTextActive : null]}>
                {t.filterAllSuki} ({utangCustomers.length})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.filterChip, activeFilter === 'WITH_DEBT' ? styles.filterChipActive : null]}
              onPress={() => setActiveFilter('WITH_DEBT')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'WITH_DEBT' ? styles.filterChipTextActive : null]}>
                {t.filterWithDebt} ({activeDebtorsCount})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.filterChip, activeFilter === 'OVER_LIMIT' ? styles.filterChipAlertActive : null]}
              onPress={() => setActiveFilter('OVER_LIMIT')}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === 'OVER_LIMIT' ? styles.filterChipTextActive : overLimitCount > 0 ? styles.textRed : null,
                ]}
              >
                {t.filterOverLimit} ({overLimitCount})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.filterChip, activeFilter === 'PAID' ? styles.filterChipActive : null]}
              onPress={() => setActiveFilter('PAID')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'PAID' ? styles.filterChipTextActive : null]}>
                {t.filterFullyPaid} ({utangCustomers.length - activeDebtorsCount})
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Suki Cards List */}
        <View style={styles.sukiListContainer}>
          {filteredCustomers.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Ionicons name="person-circle-outline" size={48} color="#94A3B8" />
              <Text style={styles.emptyStateTitle}>{t.noSukiFound}</Text>
              <Text style={styles.emptyStateSub}>{t.noSukiSub}</Text>
              <Pressable
                style={styles.emptyStateAddBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setShowAddModal(true);
                }}
              >
                <Ionicons name="person-add" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.emptyStateAddBtnText}>{t.addSukiBtn}</Text>
              </Pressable>
            </View>
          ) : (
            filteredCustomers.map((cust) => {
              const hasDebt = cust.balancePhp > 0;
              const isOverLimit = cust.balancePhp > cust.creditLimitPhp && cust.creditLimitPhp > 0;
              const ratio = cust.creditLimitPhp > 0 ? Math.min(1, cust.balancePhp / cust.creditLimitPhp) : 0;

              return (
                <View key={cust.id} style={[styles.sukiCard, isOverLimit ? styles.sukiCardOverLimit : null]}>
                  {/* Top Customer Info Row */}
                  <View style={styles.sukiCardTopRow}>
                    <View style={styles.sukiAvatarCircle}>
                      <Text style={styles.sukiAvatarText}>{cust.name.charAt(0).toUpperCase()}</Text>
                    </View>

                    <View style={styles.sukiInfoCol}>
                      <View style={styles.sukiNameRow}>
                        <Text style={styles.sukiNameText}>{cust.name}</Text>
                        {isOverLimit ? (
                          <View style={styles.overLimitBadge}>
                            <Text style={styles.overLimitBadgeText}>⚠️ Lagpas sa Limit</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.sukiLastUpdatedText}>{cust.lastUpdated || 'Wala pang transaksyon'}</Text>
                    </View>

                    <View style={styles.sukiBalanceCol}>
                      <Text style={styles.sukiBalanceLabel}>{t.currentBalanceLabel}</Text>
                      <Text
                        style={[
                          styles.sukiBalanceAmount,
                          hasDebt ? (isOverLimit ? styles.textRed : styles.textAmber) : styles.textGreen,
                        ]}
                      >
                        {Money.fromPhp(cust.balancePhp).format()}
                      </Text>
                    </View>
                  </View>

                  {/* Credit Limit Progress Bar */}
                  <View style={styles.creditLimitProgressRow}>
                    <View style={styles.limitBarTrack}>
                      <View
                        style={[
                          styles.limitBarFill,
                          { width: `${Math.round(ratio * 100)}%` },
                          isOverLimit ? styles.bgRed : ratio > 0.7 ? styles.bgAmber : styles.bgGreen,
                        ]}
                      />
                    </View>
                    <Text style={styles.limitBarText}>
                      Limit: ₱{cust.creditLimitPhp.toFixed(2)}
                    </Text>
                  </View>

                  {/* Suki Card Action Buttons Row */}
                  <View style={styles.sukiActionsRow}>
                    <Pressable
                      style={styles.actionBtnStatement}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setSelectedCustomer(cust);
                      }}
                    >
                      <Ionicons name="document-text-outline" size={15} color="#0D7A52" style={{ marginRight: 4 }} />
                      <Text style={styles.actionBtnStatementText}>{t.viewStatementBtn}</Text>
                    </Pressable>

                    {hasDebt ? (
                      <Pressable
                        style={styles.actionBtnPayment}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          handleOpenPayment(cust);
                        }}
                      >
                        <Ionicons name="cash-outline" size={15} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.actionBtnPaymentText}>{t.recordPaymentBtn}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={styles.actionBtnManualUtang}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setManualUtangCustomer(cust);
                          setManualUtangAmountText('');
                          setManualUtangNoteText('');
                          setManualUtangError(null);
                        }}
                      >
                        <Ionicons name="add-circle-outline" size={15} color="#475569" style={{ marginRight: 4 }} />
                        <Text style={styles.actionBtnManualUtangText}>{t.manualUtangBtn}</Text>
                      </Pressable>
                    )}

                    {hasDebt ? (
                      <Pressable
                        style={styles.actionBtnShare}
                        onPress={() => handleShareReminder(cust)}
                        hitSlop={6}
                      >
                        <Ionicons name="chatbubble-ellipses-outline" size={16} color="#0D7A52" />
                      </Pressable>
                    ) : (
                      <Pressable
                        style={styles.actionBtnDelete}
                        onPress={() => handleDeleteCustomer(cust)}
                        hitSlop={6}
                      >
                        <Ionicons name="trash-outline" size={16} color="#94A3B8" />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 1. STATEMENT & LEDGER TIMELINE MODAL */}
      <Modal
        visible={!!selectedCustomer}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setSelectedCustomer(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdropContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdropPressable} onPress={() => setSelectedCustomer(null)} />
          <View style={styles.modalContentCard}>
            <View style={styles.modalDragHandle} />

            {selectedCustomer ? (
              <>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalHeaderTitleGroup}>
                    <View style={styles.modalHeaderIconBadge}>
                      <Ionicons name="book" size={18} color="#0D7A52" />
                    </View>
                    <View>
                      <Text style={styles.modalTitleText}>{selectedCustomer.name}</Text>
                      <Text style={styles.modalSubtitleBarcode}>
                        Limit: ₱{selectedCustomer.creditLimitPhp.toFixed(2)} • Kasalukuyang Utang: ₱
                        {selectedCustomer.balancePhp.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.modalHeaderRightActions}>
                    <Pressable
                      style={styles.modalHeaderIconBtn}
                      onPress={() => {
                        setEditingCustomer(selectedCustomer);
                        setEditCustName(selectedCustomer.name);
                        setEditCustLimit(selectedCustomer.creditLimitPhp.toString());
                        setEditCustError(null);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="pencil" size={17} color="#475569" />
                    </Pressable>
                    <Pressable
                      style={styles.modalCloseCircle}
                      onPress={() => setSelectedCustomer(null)}
                      hitSlop={10}
                    >
                      <Ionicons name="close" size={20} color="#64748B" />
                    </Pressable>
                  </View>
                </View>

                {/* Quick Action Strip inside Ledger */}
                <View style={styles.statementActionStrip}>
                  <Pressable
                    style={styles.stripBtnAddUtang}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setManualUtangCustomer(selectedCustomer);
                      setManualUtangAmountText('');
                      setManualUtangNoteText('');
                      setManualUtangError(null);
                    }}
                  >
                    <Ionicons name="add-circle" size={16} color="#065F46" style={{ marginRight: 4 }} />
                    <Text style={styles.stripBtnText}>{t.manualUtangBtn}</Text>
                  </Pressable>

                  {selectedCustomer.balancePhp > 0 ? (
                    <Pressable
                      style={styles.stripBtnPay}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        handleOpenPayment(selectedCustomer);
                      }}
                    >
                      <Ionicons name="cash" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.stripBtnPayText}>{t.recordPaymentBtn}</Text>
                    </Pressable>
                  ) : null}

                  {selectedCustomer.balancePhp > 0 ? (
                    <Pressable
                      style={styles.stripBtnShare}
                      onPress={() => handleShareReminder(selectedCustomer)}
                    >
                      <Ionicons name="share-social-outline" size={16} color="#0D7A52" />
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.stripBtnDelete}
                      onPress={() => handleDeleteCustomer(selectedCustomer)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </Pressable>
                  )}
                </View>

                {/* Statement Timeline List */}
                <Text style={styles.statementTimelineTitle}>📜 Talaan ng Lahat ng Transaksyon</Text>

                <ScrollView
                  style={styles.statementScrollArea}
                  contentContainerStyle={styles.statementScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {selectedCustomerTxList.length === 0 ? (
                    <View style={styles.emptyStatementBox}>
                      <Ionicons name="receipt-outline" size={36} color="#CBD5E1" />
                      <Text style={styles.emptyStatementText}>
                        Wala pang nakatalang benta o bayad para kay {selectedCustomer.name}.
                      </Text>
                    </View>
                  ) : (
                    selectedCustomerTxList.map((tx) => {
                      const isPayment = tx.transactionType === 'UTANG_PAYMENT';
                      const isReturn = tx.status === 'REFUNDED' || tx.status === 'PARTIAL_RETURN';

                      return (
                        <View key={tx.id} style={styles.timelineItemCard}>
                          <View style={styles.timelineItemHeader}>
                            <View style={styles.timelineTypeBadge}>
                              <Text
                                style={[
                                  styles.timelineTypeBadgeText,
                                  isPayment ? styles.textGreen : isReturn ? styles.textBlue : styles.textAmber,
                                ]}
                              >
                                {isPayment ? '💵 BAYAD' : isReturn ? '↩️ BAWAS UTANG' : '🛍️ UTANG'}
                              </Text>
                            </View>
                            <Text style={styles.timelineDateText}>
                              {tx.dateLabel} • {tx.timeLabel}
                            </Text>
                          </View>

                          <View style={styles.timelineItemBody}>
                            <View style={styles.timelineDetailCol}>
                              <Text style={styles.timelineReceiptId}>{tx.id}</Text>
                              {tx.voidOrReturnNote ? (
                                <Text style={styles.timelineNoteText}>Note: {tx.voidOrReturnNote}</Text>
                              ) : null}
                              {tx.items && tx.items.length > 0 ? (
                                <Text style={styles.timelineItemsText}>
                                  {tx.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                                </Text>
                              ) : null}
                            </View>

                            <Text
                              style={[
                                styles.timelineAmountText,
                                isPayment ? styles.textGreen : isReturn ? styles.textBlue : styles.textAmber,
                              ]}
                            >
                              {isPayment || isReturn ? '-' : '+'}{Money.fromPhp(tx.totalPhp).format()}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 2. RECORD PAYMENT MODAL */}
      <Modal
        visible={!!payingCustomer}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setPayingCustomer(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdropContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdropPressable} onPress={() => setPayingCustomer(null)} />
          <View style={styles.modalContentCard}>
            <View style={styles.modalDragHandle} />

            {payingCustomer ? (
              <>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalHeaderTitleGroup}>
                    <View style={styles.modalHeaderIconBadge}>
                      <Ionicons name="cash" size={18} color="#0D7A52" />
                    </View>
                    <View>
                      <Text style={styles.modalTitleText}>Magtala ng Bayad sa Utang</Text>
                      <Text style={styles.modalSubtitleBarcode}>
                        Suki: {payingCustomer.name} • Utang: ₱{payingCustomer.balancePhp.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.modalCloseCircle}
                    onPress={() => setPayingCustomer(null)}
                    hitSlop={10}
                  >
                    <Ionicons name="close" size={20} color="#64748B" />
                  </Pressable>
                </View>

                {/* Tender Method Switch */}
                <Text style={styles.modalInputLabel}>Paraan ng Pagbabayad:</Text>
                <View style={styles.payMethodToggleRow}>
                  <Pressable
                    style={[styles.payMethodBtn, payMethod === 'CASH' ? styles.payMethodBtnActive : null]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setPayMethod('CASH');
                    }}
                  >
                    <Text style={[styles.payMethodBtnText, payMethod === 'CASH' ? styles.payMethodBtnTextActive : null]}>
                      💵 Pera (Cash)
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.payMethodBtn, payMethod === 'GCASH' ? styles.payMethodBtnActive : null]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setPayMethod('GCASH');
                    }}
                  >
                    <Text style={[styles.payMethodBtnText, payMethod === 'GCASH' ? styles.payMethodBtnTextActive : null]}>
                      📱 GCash
                    </Text>
                  </Pressable>
                </View>

                {/* Quick Amount Chips */}
                <Text style={[styles.modalInputLabel, { marginTop: 12 }]}>Mabilisang Pindot:</Text>
                <View style={styles.quickChipsWrap}>
                  {payingCustomer.balancePhp > 0 ? (
                    <Pressable
                      style={styles.quickPayChip}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setPayAmountText(payingCustomer.balancePhp.toFixed(2));
                      }}
                    >
                      <Text style={styles.quickPayChipText}>
                        Buong Utang (₱{payingCustomer.balancePhp.toFixed(2)})
                      </Text>
                    </Pressable>
                  ) : null}
                  {[50, 100, 200, 500].map((amt) => (
                    <Pressable
                      key={amt}
                      style={styles.quickPayChip}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setPayAmountText(amt.toString());
                      }}
                    >
                      <Text style={styles.quickPayChipText}>₱{amt}</Text>
                    </Pressable>
                  ))}
                </View>

                {/* Amount Input */}
                <Text style={[styles.modalInputLabel, { marginTop: 12 }]}>Halagang Ibinayad (₱) *</Text>
                <TextInput
                  style={styles.modalInputField}
                  value={payAmountText}
                  onChangeText={(val) => {
                    setPayError(null);
                    setPayAmountText(val);
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  autoFocus={true}
                />

                {payError ? (
                  <View style={styles.modalErrorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#DC2626" />
                    <Text style={styles.modalErrorLabel}>{payError}</Text>
                  </View>
                ) : null}

                <View style={styles.modalActionsRow}>
                  <Pressable style={styles.modalDismissBtn} onPress={() => setPayingCustomer(null)}>
                    <Text style={styles.modalDismissBtnText}>Kanselahin</Text>
                  </Pressable>

                  <Pressable style={styles.modalCommitBtn} onPress={handleSubmitPayment}>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalCommitBtnText}>I-save ang Bayad</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 3. MANUAL UTANG ENTRY MODAL */}
      <Modal
        visible={!!manualUtangCustomer}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setManualUtangCustomer(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdropContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdropPressable} onPress={() => setManualUtangCustomer(null)} />
          <View style={styles.modalContentCard}>
            <View style={styles.modalDragHandle} />

            {manualUtangCustomer ? (
              <>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalHeaderTitleGroup}>
                    <View style={styles.modalHeaderIconBadge}>
                      <Ionicons name="add-circle" size={18} color="#0D7A52" />
                    </View>
                    <View>
                      <Text style={styles.modalTitleText}>Magtala ng Bagong Utang</Text>
                      <Text style={styles.modalSubtitleBarcode}>
                        Suki: {manualUtangCustomer.name} • Kasalukuyang Utang: ₱
                        {manualUtangCustomer.balancePhp.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.modalCloseCircle}
                    onPress={() => setManualUtangCustomer(null)}
                    hitSlop={10}
                  >
                    <Ionicons name="close" size={20} color="#64748B" />
                  </Pressable>
                </View>

                <Text style={styles.modalInputLabel}>Halaga ng Bagong Utang (₱) *</Text>
                <TextInput
                  style={styles.modalInputField}
                  value={manualUtangAmountText}
                  onChangeText={(val) => {
                    setManualUtangError(null);
                    setManualUtangAmountText(val);
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                  autoFocus={true}
                />

                <Text style={[styles.modalInputLabel, { marginTop: 12 }]}>Paninda / Paliwanag (Note):</Text>
                <TextInput
                  style={styles.modalInputField}
                  value={manualUtangNoteText}
                  onChangeText={setManualUtangNoteText}
                  placeholder="hal. 1kg Bigas, 2 itlog, 1 mantika"
                  placeholderTextColor="#9CA3AF"
                />

                {manualUtangError ? (
                  <View style={styles.modalErrorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#DC2626" />
                    <Text style={styles.modalErrorLabel}>{manualUtangError}</Text>
                  </View>
                ) : null}

                <View style={styles.modalActionsRow}>
                  <Pressable style={styles.modalDismissBtn} onPress={() => setManualUtangCustomer(null)}>
                    <Text style={styles.modalDismissBtnText}>Kanselahin</Text>
                  </Pressable>

                  <Pressable style={styles.modalCommitBtn} onPress={handleSubmitManualUtang}>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalCommitBtnText}>I-save ang Utang</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 4. ADD NEW SUKI MODAL */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdropContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdropPressable} onPress={() => setShowAddModal(false)} />
          <View style={styles.modalContentCard}>
            <View style={styles.modalDragHandle} />

            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderTitleGroup}>
                <View style={styles.modalHeaderIconBadge}>
                  <Ionicons name="person-add" size={18} color="#0D7A52" />
                </View>
                <View>
                  <Text style={styles.modalTitleText}>Maglista ng Bagong Suki</Text>
                  <Text style={styles.modalSubtitleBarcode}>
                    Magtala ng regular na kostumer at credit limit
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.modalCloseCircle}
                onPress={() => setShowAddModal(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <Text style={styles.modalInputLabel}>Pangalan ng Suki *</Text>
            <TextInput
              style={styles.modalInputField}
              value={newCustName}
              onChangeText={(val) => {
                setAddModalError(null);
                setNewCustName(val);
              }}
              placeholder="hal. Aling Nena o Mang Juan"
              placeholderTextColor="#9CA3AF"
              autoFocus={true}
            />

            <View style={styles.modalTwoColGrid}>
              <View style={styles.modalCol}>
                <Text style={styles.modalInputLabel}>Credit Limit (₱)</Text>
                <TextInput
                  style={styles.modalInputField}
                  value={newCustLimit}
                  onChangeText={setNewCustLimit}
                  placeholder="500"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.modalCol}>
                <Text style={styles.modalInputLabel}>Umpisang Utang (₱)</Text>
                <TextInput
                  style={styles.modalInputField}
                  value={newCustInitial}
                  onChangeText={setNewCustInitial}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {addModalError ? (
              <View style={styles.modalErrorContainer}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.modalErrorLabel}>{addModalError}</Text>
              </View>
            ) : null}

            <View style={styles.modalActionsRow}>
              <Pressable style={styles.modalDismissBtn} onPress={() => setShowAddModal(false)}>
                <Text style={styles.modalDismissBtnText}>Kanselahin</Text>
              </Pressable>

              <Pressable style={styles.modalCommitBtn} onPress={handleAddSuki}>
                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalCommitBtnText}>I-lista ang Suki</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 5. EDIT SUKI DETAILS MODAL */}
      <Modal
        visible={!!editingCustomer}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setEditingCustomer(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdropContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdropPressable} onPress={() => setEditingCustomer(null)} />
          <View style={styles.modalContentCard}>
            <View style={styles.modalDragHandle} />

            {editingCustomer ? (
              <>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalHeaderTitleGroup}>
                    <View style={styles.modalHeaderIconBadge}>
                      <Ionicons name="pencil" size={18} color="#0D7A52" />
                    </View>
                    <View>
                      <Text style={styles.modalTitleText}>I-edit ang Profile ng Suki</Text>
                      <Text style={styles.modalSubtitleBarcode}>
                        Kasalukuyang Utang: ₱{editingCustomer.balancePhp.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <Pressable
                    style={styles.modalCloseCircle}
                    onPress={() => setEditingCustomer(null)}
                    hitSlop={10}
                  >
                    <Ionicons name="close" size={20} color="#64748B" />
                  </Pressable>
                </View>

                <Text style={styles.modalInputLabel}>Pangalan ng Suki *</Text>
                <TextInput
                  style={styles.modalInputField}
                  value={editCustName}
                  onChangeText={(val) => {
                    setEditCustError(null);
                    setEditCustName(val);
                  }}
                  placeholder="Customer Name"
                  placeholderTextColor="#9CA3AF"
                />

                <Text style={[styles.modalInputLabel, { marginTop: 12 }]}>Credit Limit (₱)</Text>
                <TextInput
                  style={styles.modalInputField}
                  value={editCustLimit}
                  onChangeText={setEditCustLimit}
                  placeholder="500"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="decimal-pad"
                />

                {editCustError ? (
                  <View style={styles.modalErrorContainer}>
                    <Ionicons name="alert-circle" size={16} color="#DC2626" />
                    <Text style={styles.modalErrorLabel}>{editCustError}</Text>
                  </View>
                ) : null}

                <View style={styles.modalActionsRow}>
                  <Pressable style={styles.modalDismissBtn} onPress={() => setEditingCustomer(null)}>
                    <Text style={styles.modalDismissBtnText}>Kanselahin</Text>
                  </Pressable>

                  <Pressable style={styles.modalCommitBtn} onPress={handleSaveEditSuki}>
                    <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalCommitBtnText}>I-save</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
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
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  headerTitleGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  addSukiTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D7A52',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
  },
  addSukiTopBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  toastBanner: {
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastText: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  summaryDashboard: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  receivablesMainCard: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
  },
  receivablesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  receivablesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  receivablesAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#065F46',
    letterSpacing: -0.5,
  },
  receivablesSubHint: {
    fontSize: 11,
    color: '#047857',
    marginTop: 4,
  },
  metricsTwoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  metricMiniCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  metricAlertCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  metricMiniLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  metricMiniValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricMiniDenom: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  textGreen: {
    color: '#15803D',
  },
  textAmber: {
    color: '#D97706',
  },
  textRed: {
    color: '#DC2626',
  },
  textBlue: {
    color: '#2563EB',
  },
  bgGreen: {
    backgroundColor: '#16A34A',
  },
  bgAmber: {
    backgroundColor: '#F59E0B',
  },
  bgRed: {
    backgroundColor: '#DC2626',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
  },
  filterPillsRow: {
    marginTop: 10,
  },
  filterPillsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  filterChipAlertActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sukiListContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 12,
  },
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 10,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginTop: 10,
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyStateAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D7A52',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyStateAddBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  sukiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    gap: 10,
  },
  sukiCardOverLimit: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFBFB',
  },
  sukiCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sukiAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sukiAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#065F46',
  },
  sukiInfoCol: {
    flex: 1,
  },
  sukiNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  sukiNameText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  overLimitBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  overLimitBadgeText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '800',
  },
  sukiLastUpdatedText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sukiBalanceCol: {
    alignItems: 'flex-end',
  },
  sukiBalanceLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  sukiBalanceAmount: {
    fontSize: 18,
    fontWeight: '900',
  },
  creditLimitProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  limitBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  limitBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  limitBarText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  sukiActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionBtnStatement: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnStatementText: {
    color: '#0D7A52',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtnPayment: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D7A52',
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnPaymentText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  actionBtnManualUtang: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnManualUtangText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnShare: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDelete: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdropContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  modalBackdropPressable: {
    flex: 1,
  },
  modalContentCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  modalDragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalHeaderIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitleBarcode: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  modalHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalHeaderIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statementActionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  stripBtnAddUtang: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingVertical: 8,
    borderRadius: 8,
  },
  stripBtnText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '800',
  },
  stripBtnPay: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D7A52',
    paddingVertical: 8,
    borderRadius: 8,
  },
  stripBtnPayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  stripBtnShare: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripBtnDelete: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statementTimelineTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 8,
  },
  statementScrollArea: {
    maxHeight: 340,
  },
  statementScrollContent: {
    paddingBottom: 20,
    gap: 8,
  },
  emptyStatementBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyStatementText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  timelineItemCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  timelineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineTypeBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timelineTypeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  timelineDateText: {
    fontSize: 11,
    color: '#64748B',
  },
  timelineItemBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineDetailCol: {
    flex: 1,
    marginRight: 10,
  },
  timelineReceiptId: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  timelineNoteText: {
    fontSize: 11,
    color: '#0D7A52',
    fontStyle: 'italic',
  },
  timelineItemsText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  timelineAmountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
    marginTop: 4,
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
    marginTop: 6,
  },
  modalCol: {
    flex: 1,
  },
  payMethodToggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  payMethodBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  payMethodBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#0D7A52',
  },
  payMethodBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  payMethodBtnTextActive: {
    color: '#065F46',
    fontWeight: '800',
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPayChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickPayChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
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
    marginTop: 10,
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
    marginTop: 18,
  },
  modalDismissBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 13,
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
    flex: 1.8,
    flexDirection: 'row',
    backgroundColor: '#0D7A52',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  modalCommitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
