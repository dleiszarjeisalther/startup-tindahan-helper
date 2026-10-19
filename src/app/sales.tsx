// src/app/sales.tsx — Screen 5: Sales History, Cash Drawer & Financial Intelligence
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import {
  ReturnDisposition,
  CashAdjustmentType,
  DateRangeFilter,
} from '@/application/TindahanStoreService';
import { Money } from '@/domain/value-objects/Money';
import { getTranslations } from '@/presentation/localization/i18n';

import { FloatingToast, ToastType } from '@/presentation/components/FloatingToast';
import {
  ConfirmationModal,
  ConfirmationType,
  ConfirmationModalDetail,
} from '@/presentation/components/ConfirmationModal';
import { PinChallengeModal } from '@/presentation/components/PinChallengeModal';
import { ReceiptPrinterModal } from '@/presentation/components/ReceiptPrinterModal';

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

const PERIODS = ['Daily', 'Weekly', 'Monthly'] as const;

const PANUKLI_CATEGORIES = [
  'Panukli sa Umaga',
  'Dagdag Barya',
  'Paluwal Deposit',
  'Iba pa',
];

const GASTOS_CATEGORIES = [
  'Yelo / Tubig',
  'Bili ng Paninda',
  'Plastic / Kagamitan',
  'Paluwal / Personal',
  'Iba pa',
];

export default function SalesHistoryScreen() {
  const router = useRouter();
  const {
    getSalesSummary,
    voidEntireTransaction,
    processReturnOrExchange,
    addCashAdjustment,
    setCashInDrawer,
    deleteCashAdjustment,
    transactions,
    settings,
    isStoreSecurityEnabled,
    isStoreLocked,
    unlockStore,
  } = useTindahanStore();

  const t = getTranslations(settings?.language);

  const [selectedPeriod, setSelectedPeriod] =
    useState<(typeof PERIODS)[number]>('Daily');
  const [customDateRange, setCustomDateRange] = useState<DateRangeFilter | null>(null);
  const [showTuboPinModal, setShowTuboPinModal] = useState(false);
  const [reprintTx, setReprintTx] = useState<any | null>(null);

  // Date Range Filter Modal state
  const [dateFilterModalVisible, setDateFilterModalVisible] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<
    'TODAY' | 'YESTERDAY' | 'LAST_7' | 'THIS_MONTH' | 'LAST_MONTH' | 'YTD' | 'CUSTOM'
  >('TODAY');
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);
  const [activeDateField, setActiveDateField] = useState<'START' | 'END'>('START');

  // Styled Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationState | null>(null);

  // Compute only the years that actually exist in the database (plus current year)
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    yearSet.add(new Date().getFullYear());
    for (const tx of transactions) {
      const ms = tx.timestampMs ?? new Date(tx.dateLabel).getTime();
      if (Number.isFinite(ms) && !isNaN(ms)) {
        yearSet.add(new Date(ms).getFullYear());
      }
    }
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [transactions]);

  // Number of days in selected range for user confirmation
  const diffDays = useMemo(() => {
    if (!tempStartDate) return 1;
    const end = tempEndDate || tempStartDate;
    const s = new Date(tempStartDate.getFullYear(), tempStartDate.getMonth(), tempStartDate.getDate()).getTime();
    const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    const diffTime = Math.abs(e - s);
    return Math.max(1, Math.round(diffTime / 86400000) + 1);
  }, [tempStartDate, tempEndDate]);

  // Sales & Collections Full Overview Modal state
  const [salesOverviewModalVisible, setSalesOverviewModalVisible] = useState(false);

  const [selectedTxId, setSelectedTxId] = useState<string | null>(null);
  const [disposition, setDisposition] = useState<ReturnDisposition>('SELLABLE');
  const [returnReason, setReturnReason] = useState<string>('Defective / Wrong Item');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>('success');

  const showActionToast = (msg: string, type: ToastType = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  // Profit privacy toggle (Show or Mask with ₱ ••••••)
  const [showProfit, setShowProfit] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<
    'ALL' | 'CASH' | 'GCASH' | 'UTANG' | 'PAYMENT' | 'VOIDED'
  >('ALL');

  // Cash Drawer Modal state
  const [cashDrawerModalVisible, setCashDrawerModalVisible] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'PANUKLI' | 'GASTOS' | 'EDIT_DRAWER'>('PANUKLI');
  const [adjType, setAdjType] = useState<CashAdjustmentType>('PANUKLI');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjCategory, setAdjCategory] = useState(PANUKLI_CATEGORIES[0]);
  const [adjNote, setAdjNote] = useState('');
  const [targetDrawerAmount, setTargetDrawerAmount] = useState('');
  const [drawerEditNote, setDrawerEditNote] = useState('');
  const [isSavingDrawer, setIsSavingDrawer] = useState(false);
  const [drawerSavedMsg, setDrawerSavedMsg] = useState<string | null>(null);
  const [isJustSavedDrawer, setIsJustSavedDrawer] = useState(false);

  // Top Movers & Z-Reading Modals state
  const [topMoversModalVisible, setTopMoversModalVisible] = useState(false);
  const [zReadingModalVisible, setZReadingModalVisible] = useState(false);

  // Pagination state (10 transactions per page)
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const getPresetRange = (
    preset: 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'THIS_MONTH' | 'LAST_MONTH' | 'YTD'
  ): DateRangeFilter => {
    const now = new Date();
    if (preset === 'TODAY') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        startMs: start.getTime(),
        endMs: end.getTime(),
        label: `${t.filterToday} (${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
      };
    }
    if (preset === 'YESTERDAY') {
      const y = new Date(now.getTime() - 86400000);
      const start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
      const end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
      return {
        startMs: start.getTime(),
        endMs: end.getTime(),
        label: `${t.filterYesterday} (${y.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
      };
    }
    if (preset === 'LAST_7') {
      const p7 = new Date(now.getTime() - 6 * 86400000);
      const start = new Date(p7.getFullYear(), p7.getMonth(), p7.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        startMs: start.getTime(),
        endMs: end.getTime(),
        label: `${t.filterLast7Days} (${p7.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
      };
    }
    if (preset === 'THIS_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return {
        startMs: start.getTime(),
        endMs: end.getTime(),
        label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      };
    }
    if (preset === 'LAST_MONTH') {
      const lYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const lMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const lEnd = new Date(lYear, lMonth + 1, 0);
      const start = new Date(lYear, lMonth, 1, 0, 0, 0, 0);
      const end = new Date(lYear, lMonth, lEnd.getDate(), 23, 59, 59, 999);
      return {
        startMs: start.getTime(),
        endMs: end.getTime(),
        label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      };
    }
    // YTD
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return {
      startMs: start.getTime(),
      endMs: end.getTime(),
      label: `${t.filterYtd} (${now.getFullYear()})`,
    };
  };

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const list: ({ type: 'empty'; key: string } | { type: 'day'; date: Date; dayNum: number; key: string })[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      list.push({ type: 'empty', key: `empty-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({
        type: 'day',
        date: new Date(year, month, d),
        dayNum: d,
        key: `day-${year}-${month}-${d}`,
      });
    }
    return list;
  }, [calendarMonth]);

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleNextMonth = () => {
    const now = new Date();
    const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    if (
      next.getFullYear() > now.getFullYear() ||
      (next.getFullYear() === now.getFullYear() && next.getMonth() > now.getMonth())
    ) {
      return;
    }
    setCalendarMonth(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handlePresetSelect = (
    preset: 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'THIS_MONTH' | 'LAST_MONTH' | 'YTD'
  ) => {
    setSelectedPreset(preset);
    const range = getPresetRange(preset);
    setTempStartDate(new Date(range.startMs));
    setTempEndDate(new Date(range.endMs));
    setCalendarMonth(new Date(range.endMs));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const openDateFilterModal = () => {
    setActiveDateField('START');
    if (customDateRange) {
      setTempStartDate(new Date(customDateRange.startMs));
      setTempEndDate(new Date(customDateRange.endMs));
      setCalendarMonth(new Date(customDateRange.endMs));
      setSelectedPreset('CUSTOM');
    } else {
      const now = new Date();
      setTempStartDate(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
      setTempEndDate(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
      setCalendarMonth(now);
      setSelectedPreset('TODAY');
    }
    setDateFilterModalVisible(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleDaySelect = (dayDate: Date) => {
    const now = new Date();
    if (dayDate.getTime() > now.getTime()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedPreset('CUSTOM');

    if (activeDateField === 'START') {
      setTempStartDate(dayDate);
      // As requested: jump calendar to current date and default end date to current date
      setTempEndDate(now);
      setActiveDateField('END');
      setCalendarMonth(now);

      const formattedStart = dayDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const formattedToday = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

      setConfirmDialog({
        type: 'info',
        title: 'Pumili ng Huling Petsa (End Date)',
        message: `Naitakda na ang Simulang Petsa: ${formattedStart}.\n\nMangyaring pumili naman ngayon ng Huling Petsa sa kalendaryo. Naka-focus na ang kalendaryo sa Kasalukuyang Petsa (${formattedToday}).`,
        details: [
          { label: 'Simulang Petsa', value: formattedStart },
          { label: 'Kasalukuyang Petsa (Today)', value: formattedToday, highlight: true },
        ],
        confirmText: 'Piliin ang End Date',
        cancelText: null,
        onConfirm: () => {
          setConfirmDialog(null);
        },
      });
    } else {
      if (tempStartDate && dayDate.getTime() < tempStartDate.getTime()) {
        setTempStartDate(dayDate);
        setTempEndDate(tempStartDate);
      } else {
        setTempEndDate(dayDate);
      }
    }
  };

  const handleApplyDateRange = () => {
    if (selectedPreset === 'CUSTOM') {
      if (!tempStartDate) {
        showActionToast('Pumili ng petsa sa kalendaryo bago i-apply.', 'warning');
        return;
      }
      const s = new Date(tempStartDate.getFullYear(), tempStartDate.getMonth(), tempStartDate.getDate(), 0, 0, 0, 0);
      const effEnd = tempEndDate || tempStartDate;
      const e = new Date(effEnd.getFullYear(), effEnd.getMonth(), effEnd.getDate(), 23, 59, 59, 999);
      const isSingleDay = isSameDay(s, effEnd);
      const label = isSingleDay
        ? s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${effEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      setCustomDateRange({
        startMs: s.getTime(),
        endMs: e.getTime(),
        label,
      });
    } else {
      const range = getPresetRange(selectedPreset);
      setCustomDateRange(range);
    }
    setDateFilterModalVisible(false);
    setCurrentPage(1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    showActionToast('✓ Na-apply ang petsa', 'success');
  };

  const handleResetDateFilter = () => {
    setCustomDateRange(null);
    setSelectedPeriod('Daily');
    setSelectedPreset('TODAY');
    setTempStartDate(null);
    setTempEndDate(null);
    setDateFilterModalVisible(false);
    setCurrentPage(1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    showActionToast('✓ Naibalik sa Ngayong Araw (Daily)', 'info');
  };

  const summary = getSalesSummary(customDateRange ?? selectedPeriod);

  // Filter counts for pills
  const cashCount = summary.transactions.filter(
    (t) => t.tenderType === 'CASH' && t.status !== 'VOIDED' && t.transactionType !== 'UTANG_PAYMENT'
  ).length;
  const gcashCount = summary.transactions.filter(
    (t) => t.tenderType === 'GCASH' && t.status !== 'VOIDED'
  ).length;
  const utangCount = summary.transactions.filter(
    (t) => t.tenderType === 'UTANG' && t.status !== 'VOIDED'
  ).length;
  const paymentCount = summary.transactions.filter(
    (t) => t.transactionType === 'UTANG_PAYMENT' && t.status !== 'VOIDED'
  ).length;
  const voidedCount = summary.transactions.filter(
    (t) => t.status === 'VOIDED'
  ).length;

  const filteredTransactions = useMemo(() => {
    return summary.transactions.filter((tx) => {
      // 1. Filter pill check
      if (filterType === 'CASH') {
        if (tx.status === 'VOIDED' || tx.tenderType !== 'CASH' || tx.transactionType === 'UTANG_PAYMENT') return false;
      } else if (filterType === 'GCASH') {
        if (tx.status === 'VOIDED' || tx.tenderType !== 'GCASH') return false;
      } else if (filterType === 'UTANG') {
        if (tx.status === 'VOIDED' || tx.tenderType !== 'UTANG') return false;
      } else if (filterType === 'PAYMENT') {
        if (tx.status === 'VOIDED' || tx.transactionType !== 'UTANG_PAYMENT') return false;
      } else if (filterType === 'VOIDED') {
        if (tx.status !== 'VOIDED') return false;
      }

      // 2. Search query check
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesId = tx.id.toLowerCase().includes(query);
        const matchesCustomer = tx.customerName?.toLowerCase().includes(query);
        const matchesItem = tx.items.some((i) => i.name.toLowerCase().includes(query));
        return matchesId || matchesCustomer || matchesItem;
      }

      return true;
    });
  }, [summary.transactions, filterType, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedTransactions = filteredTransactions.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE
  );

  const handleSaveDrawerAdjustment = () => {
    const val = parseFloat(adjAmount);
    if (isNaN(val) || val <= 0) {
      setConfirmDialog({
        type: 'warning',
        title: 'Maling Halaga ng Pera',
        message: 'Mangyaring maglagay ng wastong halaga ng pera bago itala sa kahon.',
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => {
          setConfirmDialog(null);
        },
      });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    addCashAdjustment(adjType, val, adjCategory, adjNote);
    setAdjAmount('');
    setAdjNote('');

    const formatted = Money.fromPhp(val).format();
    const isPanukli = adjType === 'PANUKLI';
    const msg = `✓ Naitala ang ${isPanukli ? '+ Panukli' : '- Gastos'} na ${formatted} sa kahon!`;
    setDrawerSavedMsg(msg);
    setIsJustSavedDrawer(true);

    setTimeout(() => {
      setIsJustSavedDrawer(false);
    }, 1400);

    setTimeout(() => {
      setDrawerSavedMsg((prev) => (prev === msg ? null : prev));
    }, 3500);

    showActionToast(`✓ Naitala ang ${isPanukli ? '+ Panukli' : '- Gastos'} na ${formatted}`, 'success');
  };

  const handleSaveDirectDrawer = () => {
    if (isSavingDrawer) return;
    const cleanStr = targetDrawerAmount.trim().replace(/,/g, '');
    const val = parseFloat(cleanStr);
    if (!cleanStr || isNaN(val) || val < 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setConfirmDialog({
        type: 'danger',
        title: 'Maling Halaga',
        message: 'Mangyaring maglagay ng wastong numero para sa cash balance. Hindi maaaring negative ang halaga.',
        confirmText: 'Naintindihan',
        cancelText: null,
        onConfirm: () => {
          setConfirmDialog(null);
        },
      });
      return;
    }

    try {
      setIsSavingDrawer(true);
      const res = setCashInDrawer(val, drawerEditNote.trim() || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      const formatted = Money.fromPhp(val).format();
      const msg = res
        ? `✓ Na-update ang Cash sa Kaha sa ${formatted}!`
        : `Walang pagbabago: ${formatted} na ang kasalukuyang balance.`;
      setDrawerSavedMsg(msg);
      setIsJustSavedDrawer(true);
      setTargetDrawerAmount('');
      setDrawerEditNote('');
      showActionToast(msg, 'success');
      setTimeout(() => {
        setIsJustSavedDrawer(false);
      }, 1400);
      setTimeout(() => {
        setDrawerSavedMsg((prev) => (prev === msg ? null : prev));
      }, 3500);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showActionToast(err instanceof Error ? err.message : 'Nabigong i-update ang kaha', 'error');
    } finally {
      setIsSavingDrawer(false);
    }
  };

  const handleShareZReading = async () => {
    try {
      const nowStr = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const lines = [
        `==================================`,
        `🏪 ${settings?.storeName || "Juan's Store"} - Z-READING`,
        `📅 Petsa: ${nowStr} (${selectedPeriod})`,
        `==================================`,
        `💰 BENTA (Gross Sales): ${summary.formattedTotalSales}`,
        `📦 PUHUNAN (COGS): ${summary.formattedTotalCost}`,
        `✨ TINUBONG KITA (Profit): ${summary.formattedTubo} (${summary.profitMarginPercent}%)`,
        `----------------------------------`,
        `💵 PERA SA KAHON: ${summary.formattedCashInDrawer}`,
        `  • Panukli (Float In): ${summary.formattedStartingCash}`,
        `  • Cash Benta: ${summary.formattedCashSales}`,
        `  • Koleksyon (Utang): ${summary.formattedUtangCashCollected}`,
        `  • Gastos (Cash Out): -${summary.formattedGastos}`,
        `----------------------------------`,
        `📱 GCash Total: ${summary.formattedGcashTotal}`,
        `📝 Bagong Utang: ${summary.formattedUtangCreditIssued}`,
        `🛒 Nabentang Paninda: ${summary.totalItems} pcs`,
        `🧾 Bilang ng Resibo: ${summary.totalTransactions}`,
        summary.totalVoidedTransactions > 0
          ? `🚫 Na-Void: ${summary.formattedTotalVoided} (${summary.totalVoidedTransactions} resibo)`
          : '',
        `==================================`,
        `Tindahan Helper POS`,
      ].filter(Boolean);

      await Share.share({
        message: lines.join('\n'),
        title: `${settings?.storeName || "Juan's Store"} Z-Reading (${selectedPeriod})`,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FloatingToast
        message={toastMsg}
        type={toastType}
        onDismiss={() => setToastMsg(null)}
      />
      {/* Header: Title | Z-Reading Report | Seasonal Forecast */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>{t.salesTitle}</Text>
        <View style={styles.headerBtns}>
          <Pressable
            style={styles.zReadingBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setZReadingModalVisible(true);
            }}
          >
            <Ionicons name="document-text-outline" size={15} color="#0D7A52" style={{ marginRight: 4 }} />
            <Text style={styles.zReadingBtnText}>Z-Reading</Text>
          </Pressable>

          <Pressable
            style={styles.forecastBtn}
            onPress={() => router.push('/explore')}
          >
            <Ionicons name="trending-up" size={15} color="#0D7A52" style={{ marginRight: 4 }} />
            <Text style={styles.forecastBtnText}>Forecast</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Period Segmented Control: Daily | Weekly | Monthly */}
        <View style={styles.segmentedBar}>
          {PERIODS.map((p) => {
            const active = !customDateRange && selectedPeriod === p;
            return (
              <Pressable
                key={p}
                style={[styles.segmentPill, active ? styles.segmentPillActive : null]}
                onPress={() => {
                  setCustomDateRange(null);
                  setSelectedPeriod(p);
                  setCurrentPage(1);
                }}
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

        {/* Date Selector & Day Comparison or Mini Bar Chart */}
        {selectedPeriod === 'Daily' || customDateRange ? (
          <Pressable
            style={[styles.dateCard, customDateRange ? styles.dateCardActive : null]}
            onPress={openDateFilterModal}
          >
            <View style={styles.dateLeft}>
              <Ionicons
                name={customDateRange ? 'calendar' : 'calendar-outline'}
                size={16}
                color={customDateRange ? '#0D7A52' : '#6B7280'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.dateText, customDateRange ? styles.dateTextActive : null]}>
                {customDateRange
                  ? customDateRange.label
                  : new Date().toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
              </Text>
              <Text style={styles.dateDropdownHint}>▾</Text>
            </View>
            {customDateRange ? (
              <Pressable
                style={styles.clearDateFilterChip}
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation();
                  handleResetDateFilter();
                }}
              >
                <Ionicons name="close-circle" size={14} color="#0D7A52" />
                <Text style={styles.clearDateFilterText}>{t.resetDateFilter || 'I-reset'}</Text>
              </Pressable>
            ) : summary.dayOverDayDiffPercent !== null ? (
              <View
                style={[
                  styles.growthBadge,
                  summary.dayOverDayDiffPercent >= 0
                    ? styles.growthBadgePos
                    : styles.growthBadgeNeg,
                ]}
              >
                <Ionicons
                  name={summary.dayOverDayDiffPercent >= 0 ? 'trending-up' : 'trending-down'}
                  size={12}
                  color={summary.dayOverDayDiffPercent >= 0 ? '#059669' : '#DC2626'}
                />
                <Text
                  style={[
                    styles.growthBadgeText,
                    summary.dayOverDayDiffPercent >= 0
                      ? styles.growthBadgeTextPos
                      : styles.growthBadgeTextNeg,
                  ]}
                >
                  {summary.dayOverDayDiffPercent >= 0
                    ? `+${summary.dayOverDayDiffPercent}% vs kahapon`
                    : `${summary.dayOverDayDiffPercent}% vs kahapon`}
                </Text>
              </View>
            ) : (
              <Text style={styles.dateChevron}>›</Text>
            )}
          </Pressable>
        ) : summary.dayBuckets.length > 0 ? (
          <View style={styles.chartCard}>
            <View style={styles.chartHeaderRow}>
              <View style={styles.chartHeaderLeft}>
                <Ionicons name="bar-chart-outline" size={16} color="#0D7A52" />
                <Text style={styles.chartTitle}>
                  {selectedPeriod === 'Weekly' ? 'Benta sa Nakaraang 7 Araw' : 'Benta sa Buwang Ito'}
                </Text>
              </View>
              <Pressable
                style={styles.dateFilterTriggerBtn}
                onPress={openDateFilterModal}
              >
                <Ionicons name="calendar-outline" size={13} color="#0D7A52" style={{ marginRight: 4 }} />
                <Text style={styles.dateFilterTriggerText}>Petsa ▾</Text>
              </Pressable>
            </View>
            <View style={styles.barContainer}>
              {summary.dayBuckets.map((bucket, bIdx) => {
                const maxVal = Math.max(1, ...summary.dayBuckets.map((b) => b.totalSalesPhp));
                const heightRatio = Math.max(0.08, bucket.totalSalesPhp / maxVal);
                const barHeight = Math.round(heightRatio * 64);

                return (
                  <View key={bIdx} style={styles.barCol}>
                    {bucket.isPeak && bucket.totalSalesPhp > 0 ? (
                      <Text style={styles.peakCrown}>👑</Text>
                    ) : (
                      <View style={{ height: 14 }} />
                    )}
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: barHeight },
                          bucket.isPeak ? styles.barFillPeak : null,
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.barDayText,
                        bucket.isPeak ? styles.barDayTextPeak : null,
                      ]}
                      numberOfLines={1}
                    >
                      {bucket.dayLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* 3 KPI Summary Cards: Benta & Tubo, Koleksyon, Pera sa Kahon */}
        <View style={styles.kpiRow}>
          {/* Card 1: Benta & Tubo (Tappable for Full Sales & Collections Overview) */}
          <Pressable
            style={[styles.kpiCard, styles.kpiCardInteractive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              if (isStoreSecurityEnabled && isStoreLocked) {
                setShowTuboPinModal(true);
              } else {
                setSalesOverviewModalVisible(true);
              }
            }}
          >
            <View style={styles.kpiHeaderRow}>
              <Text style={styles.kpiLabel} numberOfLines={1}>
                {customDateRange ? 'Benta sa Panahon' : selectedPeriod === 'Daily' ? (t.bentaToday || 'Benta Today') : `${selectedPeriod} ${t.bentaToday || 'Benta'}`}
              </Text>
              <Pressable
                style={styles.eyeBtn}
                hitSlop={10}
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  if (isStoreSecurityEnabled && isStoreLocked) {
                    setShowTuboPinModal(true);
                  } else {
                    setShowProfit(!showProfit);
                  }
                }}
              >
                <Ionicons
                  name={showProfit && (!isStoreSecurityEnabled || !isStoreLocked) ? 'eye-outline' : 'eye-off-outline'}
                  size={14}
                  color="#0D7A52"
                />
              </Pressable>
            </View>
            <Text style={styles.kpiValue} numberOfLines={1}>{summary.formattedTotalSales}</Text>

            <View style={styles.kpiCardFooter}>
              <Text style={styles.tuboValue} numberOfLines={1}>
                {t.tuboLabel || 'Tubo'}: {isStoreSecurityEnabled && isStoreLocked ? '🔒 Protektado' : showProfit ? `${summary.formattedTubo} (${summary.profitMarginPercent}%)` : t.tuboHidden}
              </Text>
              <Text style={styles.kahaTapHint} numberOfLines={1}>{t.salesOverviewBtnHint || 'Buong Buod ›'}</Text>
            </View>
          </Pressable>

          {/* Card 2: Koleksyon (Tappable for Full Sales & Collections Overview) */}
          <Pressable
            style={[styles.kpiCard, styles.kpiCardInteractive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setSalesOverviewModalVisible(true);
            }}
          >
            <View style={styles.kpiHeaderRow}>
              <Text style={styles.kpiLabel} numberOfLines={1}>{t.koleksyonTitle} (Utang)</Text>
              <Ionicons name="receipt-outline" size={13} color="#0D7A52" />
            </View>
            <Text style={[styles.kpiValue, { color: '#0D7A52' }]} numberOfLines={1}>
              {summary.formattedUtangCollected}
            </Text>
            <View style={styles.kpiCardFooter}>
              <Text style={styles.kpiSubText} numberOfLines={1}>
                {summary.totalPaymentTransactions} {t.koleksyonTitle}
              </Text>
              <Text style={styles.kahaTapHint} numberOfLines={1}>{t.salesOverviewBtnHint || 'Buong Buod ›'}</Text>
            </View>
          </Pressable>

          {/* Card 3: Pera sa Kahon (Tappable for Breakdown & Float/Gastos) */}
          <Pressable
            style={[styles.kpiCard, styles.kpiCardTappable]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              setCashDrawerModalVisible(true);
            }}
          >
            <View style={styles.kpiHeaderRow}>
              <Text style={styles.kpiLabel} numberOfLines={1}>{t.cashInDrawerLabel}</Text>
              <Ionicons name="wallet-outline" size={13} color="#0D7A52" />
            </View>
            <Text style={styles.kpiValue} numberOfLines={1}>{summary.formattedCashInDrawer}</Text>
            <View style={styles.kpiCardFooter}>
              <Text style={styles.kahaTapHint} numberOfLines={1}>Breakdown & Kaha ›</Text>
            </View>
          </Pressable>
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
          <Pressable
            style={[styles.secondaryKpiItem, styles.secondaryKpiItemTappable]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setTopMoversModalVisible(true);
            }}
          >
            <Text style={styles.secondaryKpiLabel}>Items Sold</Text>
            <View style={styles.itemsSoldRow}>
              <Text style={styles.secondaryKpiVal}>{summary.totalItems}</Text>
              <View style={styles.mabentaPill}>
                <Text style={styles.mabentaPillText}>🔥 Mabenta ›</Text>
              </View>
            </View>
          </Pressable>
          <View style={styles.secondaryKpiItem}>
            <Text style={styles.secondaryKpiLabel}>Receipts</Text>
            <Text style={styles.secondaryKpiVal}>{summary.totalTransactions}</Text>
          </View>
        </View>

        {/* Recent Transactions Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <Text style={styles.sectionHint}>Tap receipt for Return / Void</Text>
        </View>

        {/* Live Search Bar */}
        <View style={styles.searchBarRow}>
          <Ionicons name="search-outline" size={16} color="#6B7280" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder={t.searchTxPlaceholder}
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setCurrentPage(1);
            }}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsScroll}
        >
          {[
            { key: 'ALL', label: `Lahat (${summary.transactions.length})` },
            { key: 'CASH', label: `Cash (${cashCount})` },
            { key: 'GCASH', label: `GCash (${gcashCount})` },
            { key: 'UTANG', label: `Utang (${utangCount})` },
            { key: 'PAYMENT', label: `Bayad Utang (${paymentCount})` },
            { key: 'VOIDED', label: `Na-Void (${voidedCount})` },
          ].map((f) => {
            const active = filterType === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterChip, active ? styles.filterChipActive : null]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setFilterType(f.key as any);
                  setCurrentPage(1);
                }}
              >
                <Text
                  style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Transactions List */}
        <View style={styles.txListCard}>
          {filteredTransactions.length === 0 ? (
            <View style={{ padding: 24, alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#475569' }}>
                {searchQuery || filterType !== 'ALL'
                  ? t.noMatchingTransactions
                  : summary.allTransactions && summary.allTransactions.length > 0
                  ? `Walang naitalang benta para sa ${selectedPeriod}`
                  : 'Wala pang naitatalang benta sa tindahan'}
              </Text>
              <Text style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
                {summary.allTransactions && summary.allTransactions.length > 0
                  ? 'Pumili ng Lingguhan o Buwanan sa itaas para makita ang mga nakaraang resibo.'
                  : 'Maglagay ng paninda sa Bagong Benta para magtala ng resibo.'}
              </Text>
            </View>
          ) : null}

          {paginatedTransactions.map((tx, idx) => {
            const isExpanded = selectedTxId === tx.id;
            const isPayment = tx.transactionType === 'UTANG_PAYMENT';
            const netPhp = Math.max(0, tx.totalPhp - tx.refundedPhp);

            if (isPayment) {
              return (
                <View
                  key={tx.id}
                  style={[
                    styles.txContainer,
                    idx < paginatedTransactions.length - 1 ? styles.txBorder : null,
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
                      <View style={styles.badgesRow}>
                        <Text
                          style={[
                            styles.txStatusTag,
                            tx.status === 'VOIDED' ? styles.tagVoid : styles.tagPayment,
                          ]}
                        >
                          {tx.status === 'VOIDED' ? 'VOIDED' : 'BAYAD UTANG'}
                        </Text>
                        <Text
                          style={[
                            styles.txMethodTag,
                            tx.tenderType === 'GCASH' ? styles.tagGcash : styles.tagCash,
                          ]}
                        >
                          {tx.tenderType}
                        </Text>
                      </View>
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
                          onPress={() => {
                            setConfirmDialog({
                              type: 'warning',
                              title: 'Kumpirmahin ang Pag-Void ng Bayad',
                              itemName: `Bayad Utang: ${tx.customerName || 'Customer'}`,
                              message: `Sigurado ka bang nais mong i-void ang bayad utang na ito? Ibabalik ang halagang ${Money.fromPhp(tx.totalPhp).format()} sa natitirang utang ni ${tx.customerName || 'Customer'}.`,
                              details: [
                                { label: 'Halagang Ibabalik sa Utang', value: Money.fromPhp(tx.totalPhp).format(), highlight: true },
                                { label: 'Customer', value: tx.customerName || 'Customer' },
                                { label: 'Paraan ng Pagbayad', value: tx.tenderType },
                              ],
                              confirmText: 'Oo, I-Void ang Bayad',
                              cancelText: 'Bumalik',
                              onConfirm: async () => {
                                setConfirmDialog(null);
                                Haptics.notificationAsync(
                                  Haptics.NotificationFeedbackType.Warning
                                ).catch(() => {});
                                await voidEntireTransaction(tx.id, 'Pambawi ng Bayad Utang');
                                showActionToast(
                                  `✓ Na-void ang bayad utang ni ${tx.customerName || 'Customer'} at naibalik ang balanse`,
                                  'warning'
                                );
                              },
                            });
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
                  idx < paginatedTransactions.length - 1 ? styles.txBorder : null,
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
                    <View style={styles.badgesRow}>
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
                      ) : null}
                      <Text
                        style={[
                          styles.txMethodTag,
                          tx.tenderType === 'CASH'
                            ? styles.tagCash
                            : tx.tenderType === 'GCASH'
                            ? styles.tagGcash
                            : tx.tenderType === 'UTANG'
                            ? styles.tagUtang
                            : styles.tagSplit,
                        ]}
                      >
                        {tx.tenderType}
                      </Text>
                      {(tx.paymentReference || (tx as any).gcashRef) ? (
                        <Text style={[styles.txMethodTag, styles.tagGcashRef]}>
                          Ref: {tx.paymentReference || (tx as any).gcashRef}
                        </Text>
                      ) : null}
                      {((tx as any).convenienceFeePhp ?? 0) > 0 ? (
                        <Text style={[styles.txMethodTag, styles.tagFeeBadge]}>
                          +₱{(tx as any).convenienceFeePhp} Fee
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.txAmountCol}>
                    <Text
                      style={[
                        styles.txAmount,
                        tx.status === 'VOIDED' ? styles.txAmountVoided : null,
                      ]}
                    >
                      {Money.fromPhp(netPhp).format()}
                    </Text>
                    {tx.status !== 'VOIDED' ? (
                      <Text style={styles.txTuboSub}>
                        {t.tuboLabel || 'Tubo'}: {showProfit ? `+₱${(tx.tuboPhp ?? 0).toFixed(2)}` : '••••'}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.txRightCol}>
                    {tx.tenderType === 'UTANG' ? (
                      <Text style={styles.customerUtangBadge} numberOfLines={1}>
                        {tx.customerName || 'Suki'} • {tx.itemCount} {tx.itemCount === 1 ? 'Item' : 'Items'}
                      </Text>
                    ) : (
                      <Text style={styles.txItemsCount} numberOfLines={1}>
                        {tx.customerName ? `${tx.customerName} • ` : ''}
                        {tx.itemCount} {tx.itemCount === 1 ? 'Item' : 'Items'}
                      </Text>
                    )}
                  </View>
                </Pressable>

                {/* Owner Guided Return / Exchange / Void Wizard */}
                {isExpanded ? (
                  <View style={styles.wizardBox}>
                    <View style={styles.wizardHeader}>
                      <Text style={styles.wizardTitle}>
                        Receipt {tx.id} • Paid via {tx.tenderType}
                        {tx.customerName ? ` (${tx.customerName})` : ''}
                      </Text>
                    </View>

                    {/* Financial Tubo & Puhunan Breakdown for this specific sale */}
                    {tx.status !== 'VOIDED' ? (
                      <View style={styles.saleFinancialCard}>
                        <View style={styles.saleFinancialCol}>
                          <Text style={styles.saleFinancialLabel}>{t.bentaToday || 'Benta'}</Text>
                          <Text style={styles.saleFinancialValue}>₱{netPhp.toFixed(2)}</Text>
                        </View>
                        <View style={styles.saleFinancialCol}>
                          <Text style={styles.saleFinancialLabel}>{t.puhunanOnSale || 'Puhunan'}</Text>
                          <Text style={styles.saleFinancialValue}>
                            {showProfit ? `₱${(tx.costPhp ?? 0).toFixed(2)}` : '••••••'}
                          </Text>
                        </View>
                        <View style={styles.saleFinancialCol}>
                          <Text style={[styles.saleFinancialLabel, { color: '#0D7A52' }]}>
                            {t.tuboOnSale || 'Tubo'}
                          </Text>
                          <Text style={[styles.saleFinancialValue, { color: '#0D7A52', fontWeight: '800' }]}>
                            {showProfit
                              ? `+₱${(tx.tuboPhp ?? 0).toFixed(2)} (${tx.profitMarginPercent ?? 0}%)`
                              : '••••••'}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {tx.voidOrReturnNote ? (
                      <Text style={styles.auditNoteText}>{tx.voidOrReturnNote}</Text>
                    ) : null}

                    {tx.status !== 'VOIDED' ? (
                      <>
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
                                  {showProfit && (item.unitCostPhp !== undefined && item.unitCostPhp > 0)
                                    ? ` • Puhunan ₱${item.unitCostPhp.toFixed(2)} (Tubo +₱${Math.max(0, item.unitPricePaidPhp - item.unitCostPhp).toFixed(2)})`
                                    : ''}
                                </Text>
                              </View>

                              {remaining > 0 ? (
                                <View style={styles.lineActionBtns}>
                                  <Pressable
                                    style={[
                                      styles.refundBtn,
                                      isUtangSale ? styles.utangDeductBtn : null,
                                    ]}
                                    onPress={() => {
                                      const amountFormatted = `₱${item.unitPricePaidPhp.toFixed(2)}`;
                                      setConfirmDialog({
                                        type: isUtangSale ? 'warning' : 'danger',
                                        title: isUtangSale
                                          ? 'Kumpirmahin ang Bawas Utang'
                                          : 'Kumpirmahin ang Refund',
                                        itemName: `1× ${item.name}`,
                                        message: isUtangSale
                                          ? `Ibabawas ang ${amountFormatted} sa natitirang utang ni ${tx.customerName || 'Customer'}.`
                                          : `Sigurado ka bang ibabalik ang bayad (${amountFormatted}) ng customer para sa 1× "${item.name}"?`,
                                        details: [
                                          { label: 'Halagang Babawiin', value: amountFormatted, highlight: true },
                                          {
                                            label: 'Kalagayan ng Paninda',
                                            value: disposition === 'SELLABLE'
                                              ? 'Maibebenta Pa (Restock sa Inventory)'
                                              : 'Sira / Expired (Quarantine)',
                                          },
                                          {
                                            label: 'Paraan ng Pagbalik',
                                            value: isUtangSale ? 'Bawas Utang (Walang Cash)' : 'Cash Refund sa Kahon',
                                          },
                                        ],
                                        confirmText: isUtangSale ? 'I-bawas sa Utang' : 'I-refund ang Pera',
                                        cancelText: 'Kanselahin',
                                        onConfirm: async () => {
                                          setConfirmDialog(null);
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
                                          showActionToast(
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
                                        },
                                      });
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
                                    onPress={() => {
                                      const creditFormatted = `₱${item.unitPricePaidPhp.toFixed(2)}`;
                                      setConfirmDialog({
                                        type: 'info',
                                        title: 'Kumpirmahin ang Palit Paninda',
                                        itemName: `1× ${item.name}`,
                                        message: `Ilalapat ang kredito na ${creditFormatted} ng panindang ito sa bagong bentahan sa checkout.`,
                                        details: [
                                          { label: 'Exchange Credit', value: creditFormatted, highlight: true },
                                          {
                                            label: 'Kalagayan ng Paninda',
                                            value: disposition === 'SELLABLE'
                                              ? 'Maibebenta Pa (Restock)'
                                              : 'Sira / Expired',
                                          },
                                        ],
                                        confirmText: 'Pumunta sa Checkout',
                                        cancelText: 'Kanselahin',
                                        onConfirm: async () => {
                                          setConfirmDialog(null);
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
                                          showActionToast(
                                            `✓ Applied ₱${res.creditPhp.toFixed(
                                              2
                                            )} Exchange Credit to New Sale`
                                          );
                                          router.push('/checkout');
                                        },
                                      });
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

                        {/* Thermal Receipt Reprint Button */}
                        <Pressable
                          style={styles.reprintReceiptBtn}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setReprintTx(tx);
                          }}
                        >
                          <Text style={styles.reprintReceiptBtnText}>
                            🖨️ Thermal Receipt Slip (58mm / 80mm)
                          </Text>
                        </Pressable>

                        {/* Owner Same-Day Void Button */}
                        <Pressable
                          style={styles.voidSaleBtn}
                          onPress={() => {
                            setConfirmDialog({
                              type: 'delete',
                              title: 'Kumpirmahin ang Pag-Void ng Resibo',
                              itemName: `Resibo #${tx.id}`,
                              message: `Sigurado ka bang nais mong i-void ang Resibo #${tx.id}? Mababawi ang benta at maibabalik ang mga paninda sa imbentaryo.`,
                              details: [
                                { label: 'Kabuuang Halaga', value: Money.fromPhp(tx.totalPhp).format(), highlight: true },
                                { label: 'Customer', value: tx.customerName || 'Walk-in' },
                                { label: 'Paraan ng Pagbayad', value: tx.tenderType },
                              ],
                              confirmText: 'Oo, I-Void ang Resibo',
                              cancelText: 'Huwag',
                              onConfirm: async () => {
                                setConfirmDialog(null);
                                Haptics.notificationAsync(
                                  Haptics.NotificationFeedbackType.Warning
                                ).catch(() => {});
                                await voidEntireTransaction(tx.id, 'Owner Entry Correction');
                                showActionToast(
                                  `✓ Na-void ang Resibo #${tx.id} at naibalik ang paninda sa imbentaryo`,
                                  'warning'
                                );
                              },
                            });
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
        </View>
      </ScrollView>

      {/* ========================================================================= */}
      {/* MODAL 1: Cash Drawer Reconciliation & Adjustment Modal (Panukli & Gastos) */}
      {/* ========================================================================= */}
      <Modal
        visible={cashDrawerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCashDrawerModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.cashDrawerTitle}</Text>
                <Text style={styles.modalSubtitle}>{t.cashDrawerSub}</Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setCashDrawerModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* Cash Drawer Breakdown Card */}
              <View style={styles.kahaBreakdownCard}>
                <View style={styles.kahaRow}>
                  <Text style={styles.kahaRowLabel}>{t.panukliStartingFloat}</Text>
                  <Text style={[styles.kahaRowVal, { color: '#0369A1' }]}>
                    +{summary.formattedStartingCash}
                  </Text>
                </View>
                <View style={styles.kahaRow}>
                  <Text style={styles.kahaRowLabel}>{t.cashSalesShort}</Text>
                  <Text style={[styles.kahaRowVal, { color: '#047857' }]}>
                    +{summary.formattedCashSales}
                  </Text>
                </View>
                <View style={styles.kahaRow}>
                  <Text style={styles.kahaRowLabel}>{t.utangCashCollectedShort}</Text>
                  <Text style={[styles.kahaRowVal, { color: '#047857' }]}>
                    +{summary.formattedUtangCashCollected}
                  </Text>
                </View>
                <View style={styles.kahaRow}>
                  <Text style={styles.kahaRowLabel}>{t.gastosCashOut}</Text>
                  <Text style={[styles.kahaRowVal, { color: '#DC2626' }]}>
                    -{summary.formattedGastos}
                  </Text>
                </View>
                <View style={styles.kahaDivider} />
                <View style={styles.kahaTotalRow}>
                  <Text style={styles.kahaTotalLabel}>{t.cashInBox}</Text>
                  <Text style={styles.kahaTotalVal}>{summary.formattedCashInDrawer}</Text>
                </View>
              </View>

              {/* Adjustment Entry Form */}
              <View style={styles.adjFormCard}>
                <Text style={styles.formSectionTitle}>Magtala sa Kaha</Text>

                {drawerSavedMsg ? (
                  <View style={styles.inModalFeedbackBanner}>
                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                    <Text style={styles.inModalFeedbackText}>{drawerSavedMsg}</Text>
                  </View>
                ) : null}

                {/* Segmented Picker: Panukli vs Gastos vs Edit Kaha */}
                <View style={styles.adjSegmentRow}>
                  <Pressable
                    style={[
                      styles.adjSegmentBtn,
                      drawerMode === 'PANUKLI' ? styles.adjSegmentBtnPanukli : null,
                    ]}
                    onPress={() => {
                      setDrawerMode('PANUKLI');
                      setAdjType('PANUKLI');
                      setAdjCategory(PANUKLI_CATEGORIES[0]);
                    }}
                  >
                    <Text
                      style={[
                        styles.adjSegmentText,
                        drawerMode === 'PANUKLI' ? styles.adjSegmentTextActive : null,
                      ]}
                    >
                      + Panukli
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.adjSegmentBtn,
                      drawerMode === 'GASTOS' ? styles.adjSegmentBtnGastos : null,
                    ]}
                    onPress={() => {
                      setDrawerMode('GASTOS');
                      setAdjType('GASTOS');
                      setAdjCategory(GASTOS_CATEGORIES[0]);
                    }}
                  >
                    <Text
                      style={[
                        styles.adjSegmentText,
                        drawerMode === 'GASTOS' ? styles.adjSegmentTextActive : null,
                      ]}
                    >
                      - Gastos
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.adjSegmentBtn,
                      drawerMode === 'EDIT_DRAWER' ? styles.adjSegmentBtnEdit : null,
                    ]}
                    onPress={() => {
                      setDrawerMode('EDIT_DRAWER');
                      setTargetDrawerAmount(summary.cashInDrawerPhp > 0 ? summary.cashInDrawerPhp.toFixed(2) : '');
                      setDrawerEditNote('');
                    }}
                  >
                    <Text
                      style={[
                        styles.adjSegmentText,
                        drawerMode === 'EDIT_DRAWER' ? styles.adjSegmentTextActive : null,
                      ]}
                    >
                      ✏️ Edit Kaha
                    </Text>
                  </Pressable>
                </View>

                {drawerMode === 'EDIT_DRAWER' ? (
                  /* Form: Direct Edit Cash in Drawer */
                  <View style={{ marginTop: 8 }}>
                    <View style={styles.editDrawerCurrentBox}>
                      <Text style={styles.editDrawerCurrentLabel}>Kasalukuyang Cash sa Kaha:</Text>
                      <Text style={styles.editDrawerCurrentVal}>{summary.formattedCashInDrawer}</Text>
                    </View>

                    <Text style={styles.inputFieldLabel}>Bagong Balance sa Kaha (₱)</Text>
                    <View style={styles.amountInputRow}>
                      <Text style={styles.pesoPrefix}>₱</Text>
                      <TextInput
                        style={styles.amountInput}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        value={targetDrawerAmount}
                        onChangeText={setTargetDrawerAmount}
                      />
                    </View>

                    {(() => {
                      const clean = targetDrawerAmount.trim().replace(/,/g, '');
                      const parsed = parseFloat(clean);
                      if (!clean || isNaN(parsed)) return null;
                      const diff = Number((parsed - summary.cashInDrawerPhp).toFixed(2));
                      if (diff > 0) {
                        return (
                          <View style={styles.diffPreviewBoxSuccess}>
                            <Text style={styles.diffPreviewTextSuccess}>
                              📈 Dagdag sa kaha: +{Money.fromPhp(diff).format()} (Panukli / Float)
                            </Text>
                          </View>
                        );
                      } else if (diff < 0) {
                        return (
                          <View style={styles.diffPreviewBoxDanger}>
                            <Text style={styles.diffPreviewTextDanger}>
                              📉 Bawas sa kaha: -{Money.fromPhp(Math.abs(diff)).format()} (Gastos / Withdrawal)
                            </Text>
                          </View>
                        );
                      }
                      return (
                        <View style={styles.diffPreviewBoxNeutral}>
                          <Text style={styles.diffPreviewTextNeutral}>Walang pagbabago sa balance</Text>
                        </View>
                      );
                    })()}

                    <Text style={styles.inputFieldLabel}>Dahilan / Note (Opsyonal)</Text>
                    <TextInput
                      style={styles.noteInput}
                      placeholder="hal. Bilang sa Kaha pagkasara"
                      placeholderTextColor="#9CA3AF"
                      value={drawerEditNote}
                      onChangeText={setDrawerEditNote}
                    />

                    <Pressable
                      style={[
                        styles.saveAdjBtn,
                        styles.saveDirectDrawerBtn,
                        isSavingDrawer ? styles.saveAdjBtnDisabled : null,
                        isJustSavedDrawer ? styles.saveAdjBtnSuccess : null,
                      ]}
                      disabled={isSavingDrawer}
                      onPress={handleSaveDirectDrawer}
                    >
                      <Ionicons
                        name={isJustSavedDrawer ? 'checkmark' : 'checkmark-done-circle-outline'}
                        size={16}
                        color="#FFFFFF"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.saveAdjBtnText}>
                        {isJustSavedDrawer ? '✓ Na-save ang Bagong Balance!' : 'I-save ang Bagong Balance sa Kaha'}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  /* Form: Panukli / Gastos Entry */
                  <View style={{ marginTop: 8 }}>
                    <Text style={styles.inputFieldLabel}>{t.amountPhpLabel}</Text>
                    <View style={styles.amountInputRow}>
                      <Text style={styles.pesoPrefix}>₱</Text>
                      <TextInput
                        style={styles.amountInput}
                        keyboardType="numeric"
                        placeholder="0.00"
                        placeholderTextColor="#9CA3AF"
                        value={adjAmount}
                        onChangeText={setAdjAmount}
                      />
                    </View>

                    {/* Category Chips */}
                    <Text style={styles.inputFieldLabel}>{t.categoryLabel}</Text>
                    <View style={styles.catChipsRow}>
                      {(adjType === 'PANUKLI' ? PANUKLI_CATEGORIES : GASTOS_CATEGORIES).map(
                        (cat) => {
                          const active = adjCategory === cat;
                          return (
                            <Pressable
                              key={cat}
                              style={[
                                styles.catChip,
                                active ? styles.catChipActive : null,
                              ]}
                              onPress={() => setAdjCategory(cat)}
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
                        }
                      )}
                    </View>

                    {/* Note Input */}
                    <Text style={styles.inputFieldLabel}>{t.noteLabel}</Text>
                    <TextInput
                      style={styles.noteInput}
                      placeholder="hal. Para sa 3 sako ng yelo"
                      placeholderTextColor="#9CA3AF"
                      value={adjNote}
                      onChangeText={setAdjNote}
                    />

                    <Pressable
                      style={[
                        styles.saveAdjBtn,
                        isJustSavedDrawer ? styles.saveAdjBtnSuccess : null,
                      ]}
                      onPress={handleSaveDrawerAdjustment}
                    >
                      <Ionicons
                        name={isJustSavedDrawer ? 'checkmark' : 'save-outline'}
                        size={16}
                        color="#FFFFFF"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.saveAdjBtnText}>
                        {isJustSavedDrawer ? '✓ Naitala Na!' : t.saveAdjustmentBtn}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Today's Adjustments History */}
              <View style={styles.drawerHistorySection}>
                <Text style={styles.historySectionTitle}>{t.drawerHistoryTitle}</Text>
                {summary.periodAdjustments.length === 0 ? (
                  <Text style={styles.noHistoryText}>{t.noDrawerAdjustments}</Text>
                ) : (
                  summary.periodAdjustments.map((item) => (
                    <View key={item.id} style={styles.drawerHistoryRow}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.adjTypeTag,
                              item.type === 'PANUKLI'
                                ? styles.tagPanukli
                                : styles.tagGastos,
                            ]}
                          >
                            {item.type === 'PANUKLI' ? '+ PANUKLI' : '- GASTOS'}
                          </Text>
                          <Text style={styles.adjCategoryText}>{item.category}</Text>
                        </View>
                        {item.note ? (
                          <Text style={styles.adjNoteText}>{item.note}</Text>
                        ) : null}
                        <Text style={styles.adjTimeText}>{item.timeLabel}</Text>
                      </View>

                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text
                          style={[
                            styles.adjAmountText,
                            item.type === 'PANUKLI'
                              ? { color: '#0369A1' }
                              : { color: '#DC2626' },
                          ]}
                        >
                          {item.type === 'PANUKLI' ? '+' : '-'}
                          {Money.fromPhp(item.amountPhp).format()}
                        </Text>
                        <Pressable
                          style={styles.deleteAdjBtn}
                          onPress={() => {
                            setConfirmDialog({
                              type: 'delete',
                              title: 'Alisin ang Tala sa Kahon?',
                              itemName: `${item.type === 'PANUKLI' ? '+ Panukli' : '- Gastos'}: ${Money.fromPhp(item.amountPhp).format()}`,
                              message: `Sigurado ka bang nais mong alisin ang ${
                                item.type === 'PANUKLI' ? '+ Panukli' : '- Gastos'
                              } na ${Money.fromPhp(item.amountPhp).format()} sa kahon?`,
                              details: [
                                { label: 'Uri', value: item.type === 'PANUKLI' ? 'Panukli (Cash In)' : 'Gastos (Cash Out)' },
                                { label: 'Halaga', value: Money.fromPhp(item.amountPhp).format(), highlight: true },
                                { label: 'Kategorya', value: item.category },
                              ],
                              confirmText: 'Oo, Alisin',
                              cancelText: 'Bumalik',
                              onConfirm: () => {
                                setConfirmDialog(null);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                                deleteCashAdjustment(item.id);
                                const delMsg = `🗑️ Naalis ang tala (${Money.fromPhp(item.amountPhp).format()}) sa kahon.`;
                                setDrawerSavedMsg(delMsg);
                                setTimeout(() => {
                                  setDrawerSavedMsg((prev) => (prev === delMsg ? null : prev));
                                }, 3000);
                                showActionToast(delMsg, 'warning');
                              },
                            });
                          }}
                        >
                          <Ionicons name="trash-outline" size={14} color="#EF4444" />
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: "Mabenta Today" Top-Moving Products Sheet                       */}
      {/* ========================================================================= */}
      <Modal
        visible={topMoversModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTopMoversModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.mabentaTitle}</Text>
                <Text style={styles.modalSubtitle}>{t.mabentaSub}</Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setTopMoversModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {summary.topSellingProducts.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: '#6B7280', fontWeight: '600' }}>
                    {t.noSalesYet}
                  </Text>
                </View>
              ) : (
                summary.topSellingProducts.map((p, idx) => (
                  <View key={p.productId} style={styles.topProductRow}>
                    <View
                      style={[
                        styles.rankBadge,
                        idx === 0
                          ? styles.rankGold
                          : idx === 1
                          ? styles.rankSilver
                          : idx === 2
                          ? styles.rankBronze
                          : null,
                      ]}
                    >
                      <Text style={styles.rankText}>#{idx + 1}</Text>
                    </View>

                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.topProdName} numberOfLines={1}>
                        {p.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.topProdUnits}>
                          {p.unitsSold} pcs {t.unitsSoldSuffix}
                        </Text>
                        <Text style={styles.topProdDot}>•</Text>
                        <Text style={styles.topProdRevenue}>
                          {Money.fromPhp(p.revenuePhp).format()}
                        </Text>
                      </View>
                    </View>

                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      {p.isOutOfStock ? (
                        <View style={styles.stockChipOut}>
                          <Text style={styles.stockChipTextOut}>Ubos na</Text>
                        </View>
                      ) : p.isLowStock ? (
                        <View style={styles.stockChipLow}>
                          <Text style={styles.stockChipTextLow}>Kakaunti na</Text>
                        </View>
                      ) : (
                        <View style={styles.stockChipIn}>
                          <Text style={styles.stockChipTextIn}>Stock: {p.currentStock}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: End-of-Day Z-Reading Summary & Sharing Receipt                   */}
      {/* ========================================================================= */}
      <Modal
        visible={zReadingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setZReadingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.zReadingTitle}</Text>
                <Text style={styles.modalSubtitle}>{t.zReadingSub}</Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setZReadingModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
              {/* Thermal Receipt Paper Card */}
              <View style={styles.receiptPaper}>
                <Text style={styles.receiptStoreName}>{settings?.storeName || "Juan's Store"}</Text>
                <Text style={styles.receiptStoreAddress}>{settings?.address || 'Enter Store Address'}</Text>
                <Text style={styles.receiptDate}>
                  {new Date().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  • {selectedPeriod} Report
                </Text>

                <View style={styles.receiptDashedLine} />

                {/* Sales & Profit */}
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>BENTA (Gross Sales)</Text>
                  <Text style={styles.receiptValBold}>{summary.formattedTotalSales}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabelSub}>Puhunan (COGS)</Text>
                  <Text style={styles.receiptValSub}>{summary.formattedTotalCost}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={[styles.receiptLabelBold, { color: '#0D7A52' }]}>
                    TINUBONG KITA (Profit)
                  </Text>
                  <Text style={[styles.receiptValBold, { color: '#0D7A52' }]}>
                    {summary.formattedTubo} ({summary.profitMarginPercent}%)
                  </Text>
                </View>

                <View style={styles.receiptDashedLine} />

                {/* Cash in Box Breakdown */}
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabelBold}>PERA SA KAHON (Cash)</Text>
                  <Text style={styles.receiptValBold}>{summary.formattedCashInDrawer}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabelSub}>  • Panukli (Float In)</Text>
                  <Text style={styles.receiptValSub}>+{summary.formattedStartingCash}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabelSub}>  • Cash Benta</Text>
                  <Text style={styles.receiptValSub}>+{summary.formattedCashSales}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabelSub}>  • Koleksyon sa Utang</Text>
                  <Text style={styles.receiptValSub}>+{summary.formattedUtangCashCollected}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabelSub}>  • Gastos / Paluwal</Text>
                  <Text style={[styles.receiptValSub, { color: '#DC2626' }]}>
                    -{summary.formattedGastos}
                  </Text>
                </View>

                <View style={styles.receiptDashedLine} />

                {/* Other Tender & Volume */}
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>GCash Total</Text>
                  <Text style={styles.receiptVal}>{summary.formattedGcashTotal}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Bagong Utang (Credit)</Text>
                  <Text style={styles.receiptVal}>{summary.formattedUtangCreditIssued}</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Nabentang Paninda</Text>
                  <Text style={styles.receiptVal}>{summary.totalItems} pcs</Text>
                </View>
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Bilang ng Resibo</Text>
                  <Text style={styles.receiptVal}>{summary.totalTransactions}</Text>
                </View>
                {summary.totalVoidedTransactions > 0 ? (
                  <View style={styles.receiptRow}>
                    <Text style={[styles.receiptLabel, { color: '#DC2626' }]}>
                      Na-Void na Benta ({summary.totalVoidedTransactions})
                    </Text>
                    <Text style={[styles.receiptVal, { color: '#DC2626' }]}>
                      {summary.formattedTotalVoided}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.receiptDashedLine} />
                <Text style={styles.receiptFooter}>
                  Generated with Tindahan Helper POS
                </Text>
              </View>

              {/* Action Buttons */}
              <Pressable
                style={styles.shareZBtn}
                onPress={handleShareZReading}
              >
                <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.shareZBtnText}>{t.shareZReadingBtn}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: Custom Date Range & Interactive Calendar Modal                  */}
      {/* ========================================================================= */}
      <Modal
        visible={dateFilterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDateFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.dateFilterTitle || 'Salain ayon sa Petsa'}</Text>
                <Text style={styles.modalSubtitle}>
                  {t.dateFilterSub || 'Pumili ng preset o sariling sakop ng petsa sa kalendaryo'}
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setDateFilterModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>
              {/* Presets Horizontal Chips */}
              <Text style={styles.filterSectionHeader}>MGA PRESET SHORTCUTS</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.datePresetsScroll}
              >
                {[
                  { key: 'TODAY', label: t.filterToday || 'Ngayon' },
                  { key: 'YESTERDAY', label: t.filterYesterday || 'Kahapon' },
                  { key: 'LAST_7', label: t.filterLast7Days || '7 Araw' },
                  { key: 'THIS_MONTH', label: t.filterThisMonth || 'Buwang Ito' },
                  { key: 'LAST_MONTH', label: t.filterLastMonth || 'Nakaraang Buwan' },
                  { key: 'YTD', label: t.filterYtd || 'Taong Ito (YTD)' },
                ].map((item) => {
                  const isSelected = selectedPreset === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      style={[
                        styles.datePresetChip,
                        isSelected ? styles.datePresetChipActive : null,
                      ]}
                      onPress={() => {
                        handlePresetSelect(item.key as any);
                        setActiveDateField('START');
                      }}
                    >
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={13} color="#0D7A52" style={{ marginRight: 4 }} />
                      ) : null}
                      <Text
                        style={[
                          styles.datePresetChipText,
                          isSelected ? styles.datePresetChipTextActive : null,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Step-by-Step Guidance & Confirmation Banner */}
              <View
                style={{
                  backgroundColor:
                    tempStartDate && tempEndDate
                      ? '#ECFDF5'
                      : activeDateField === 'START'
                      ? '#EFF6FF'
                      : '#FFFBEB',
                  borderWidth: 1.5,
                  borderColor:
                    tempStartDate && tempEndDate
                      ? '#A7F3D0'
                      : activeDateField === 'START'
                      ? '#BFDBFE'
                      : '#FDE68A',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons
                    name={
                      tempStartDate && tempEndDate
                        ? 'checkmark-circle'
                        : activeDateField === 'START'
                        ? 'calendar-outline'
                        : 'arrow-forward-circle-outline'
                    }
                    size={16}
                    color={
                      tempStartDate && tempEndDate
                        ? '#059669'
                        : activeDateField === 'START'
                        ? '#2563EB'
                        : '#D97706'
                    }
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      letterSpacing: 0.5,
                      color:
                        tempStartDate && tempEndDate
                          ? '#065F46'
                          : activeDateField === 'START'
                          ? '#1E40AF'
                          : '#92400E',
                    }}
                  >
                    {tempStartDate && tempEndDate
                      ? '✓ KUMPIRMADO: SAKOP NA PETSA'
                      : activeDateField === 'START'
                      ? 'HAKBANG 1: PILIIN ANG SIMULANG PETSA (CHOOSE START DATE)'
                      : 'HAKBANG 2: PILIIN ANG HULING PETSA (CHOOSE END DATE)'}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color:
                      tempStartDate && tempEndDate
                        ? '#047857'
                        : activeDateField === 'START'
                        ? '#1D4ED8'
                        : '#B45309',
                    lineHeight: 16,
                  }}
                >
                  {tempStartDate && tempEndDate
                    ? `${tempStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} hanggang ${tempEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${diffDays} araw). I-tap ang I-apply sa ibaba.`
                    : activeDateField === 'START'
                    ? 'I-tap ang araw sa kalendaryo kung kailan magsisimula ang benta.'
                    : `Naitakda na ang simula (${tempStartDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}). Piliin naman ang huling araw.`}
                </Text>
              </View>

              {/* Start & End Selected Info Cards (Customizable & Tappable) */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#F9FAFB',
                  borderRadius: 12,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  marginBottom: 10,
                  gap: 8,
                }}
              >
                {/* Start Date Card */}
                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: activeDateField === 'START' ? '#ECFDF5' : '#FFFFFF',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 9,
                    borderWidth: 2,
                    borderColor: activeDateField === 'START' ? '#0D7A52' : '#E5E7EB',
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setActiveDateField('START');
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#4B5563', letterSpacing: 0.5 }}>
                      {t.startDateLabel || 'SIMULANG PETSA'}
                    </Text>
                    {activeDateField === 'START' ? (
                      <View style={{ backgroundColor: '#0D7A52', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>PUMIPILI</Text>
                      </View>
                    ) : tempStartDate ? (
                      <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ fontSize: 8, fontWeight: '800', color: '#0D7A52' }}>✓ SET</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: tempStartDate ? '#111827' : '#9CA3AF' }}>
                    {tempStartDate
                      ? tempStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Pumili sa ibaba...'}
                  </Text>
                  <Text style={{ fontSize: 9, color: activeDateField === 'START' ? '#0D7A52' : '#6B7280', marginTop: 2, fontWeight: '600' }}>
                    {activeDateField === 'START' ? '👉 Piliin sa kalendaryo' : 'I-tap para baguhin'}
                  </Text>
                </Pressable>

                <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />

                {/* End Date Card */}
                <Pressable
                  style={{
                    flex: 1,
                    backgroundColor: activeDateField === 'END' ? '#ECFDF5' : '#FFFFFF',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 9,
                    borderWidth: 2,
                    borderColor: activeDateField === 'END' ? '#0D7A52' : '#E5E7EB',
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setActiveDateField('END');
                    setCalendarMonth(new Date());
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#4B5563', letterSpacing: 0.5 }}>
                      {t.endDateLabel || 'HULING PETSA'}
                    </Text>
                    {activeDateField === 'END' ? (
                      <View style={{ backgroundColor: '#0D7A52', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>PUMIPILI</Text>
                      </View>
                    ) : tempEndDate ? (
                      <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ fontSize: 8, fontWeight: '800', color: '#0D7A52' }}>✓ SET</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '800',
                      color: tempEndDate ? '#111827' : '#9CA3AF',
                    }}
                  >
                    {tempEndDate
                      ? tempEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : tempStartDate
                      ? tempStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '---'}
                  </Text>
                  <Text style={{ fontSize: 9, color: activeDateField === 'END' ? '#0D7A52' : '#6B7280', marginTop: 2, fontWeight: '600' }}>
                    {activeDateField === 'END' ? '👉 Piliin sa kalendaryo' : 'I-tap para baguhin'}
                  </Text>
                </Pressable>
              </View>

              {/* Single Day Shortcut Button */}
              {tempStartDate ? (
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#F3F4F6',
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    marginBottom: 12,
                    alignSelf: 'center',
                    gap: 6,
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setTempEndDate(tempStartDate);
                    setActiveDateField('START');
                  }}
                >
                  <Ionicons name="calendar-sharp" size={13} color="#4B5563" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151' }}>
                    Isang araw lamang ang sakop (Gawing pareho ang Simula at Huli)
                  </Text>
                </Pressable>
              ) : null}

              {/* Interactive Calendar with Database Years & 12 Months */}
              <View style={styles.calendarContainer}>
                {/* Year Selector from Database Only ("only output year that is on database") */}
                <View style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 0.5 }}>
                      TAON SA DATABASE ({availableYears.length})
                    </Text>
                    <Text style={{ fontSize: 10, color: '#9CA3AF' }}>Mula sa mga resibo sa tindahan</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {availableYears.map((yr) => {
                      const isSelectedYear = calendarMonth.getFullYear() === yr;
                      return (
                        <Pressable
                          key={yr}
                          style={{
                            flex: availableYears.length <= 3 ? 1 : undefined,
                            minWidth: 80,
                            paddingVertical: 7,
                            alignItems: 'center',
                            borderRadius: 8,
                            backgroundColor: isSelectedYear ? '#0D7A52' : '#F3F4F6',
                            borderWidth: 1.5,
                            borderColor: isSelectedYear ? '#0D7A52' : '#E5E7EB',
                          }}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            const now = new Date();
                            let targetMonth = calendarMonth.getMonth();
                            if (yr === now.getFullYear() && targetMonth > now.getMonth()) {
                              targetMonth = now.getMonth();
                            }
                            setCalendarMonth(new Date(yr, targetMonth, 1));
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontWeight: isSelectedYear ? '800' : '600',
                              color: isSelectedYear ? '#FFFFFF' : '#374151',
                            }}
                          >
                            {yr}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Month Selector */}
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', marginBottom: 6, letterSpacing: 0.5 }}>
                    BUWAN (MONTH)
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingBottom: 2 }}
                  >
                    {[
                      { m: 0, label: 'Ene' },
                      { m: 1, label: 'Peb' },
                      { m: 2, label: 'Mar' },
                      { m: 3, label: 'Abr' },
                      { m: 4, label: 'May' },
                      { m: 5, label: 'Hun' },
                      { m: 6, label: 'Hul' },
                      { m: 7, label: 'Ago' },
                      { m: 8, label: 'Set' },
                      { m: 9, label: 'Okt' },
                      { m: 10, label: 'Nob' },
                      { m: 11, label: 'Dis' },
                    ].map((item) => {
                      const isSelectedMonth = calendarMonth.getMonth() === item.m;
                      const now = new Date();
                      const isFutureMonth =
                        calendarMonth.getFullYear() === now.getFullYear() && item.m > now.getMonth();

                      return (
                        <Pressable
                          key={item.m}
                          disabled={isFutureMonth}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 16,
                            backgroundColor: isSelectedMonth
                              ? '#0D7A52'
                              : isFutureMonth
                              ? '#F9FAFB'
                              : '#F3F4F6',
                            borderWidth: 1,
                            borderColor: isSelectedMonth
                              ? '#0D7A52'
                              : isFutureMonth
                              ? '#F3F4F6'
                              : '#E5E7EB',
                            opacity: isFutureMonth ? 0.35 : 1,
                          }}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            setCalendarMonth(new Date(calendarMonth.getFullYear(), item.m, 1));
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: isSelectedMonth ? '800' : '600',
                              color: isSelectedMonth
                                ? '#FFFFFF'
                                : isFutureMonth
                                ? '#9CA3AF'
                                : '#374151',
                            }}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Month Title & Chevron Navigation */}
                <View style={styles.calendarNavRow}>
                  <Pressable
                    style={styles.calendarNavBtn}
                    onPress={handlePrevMonth}
                    hitSlop={8}
                  >
                    <Ionicons name="chevron-back" size={18} color="#1F2937" />
                  </Pressable>
                  <Text style={styles.calendarMonthTitle}>
                    {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </Text>
                  <Pressable
                    style={[
                      styles.calendarNavBtn,
                      calendarMonth.getFullYear() === new Date().getFullYear() &&
                      calendarMonth.getMonth() === new Date().getMonth()
                        ? { opacity: 0.3 }
                        : null,
                    ]}
                    onPress={handleNextMonth}
                    hitSlop={8}
                  >
                    <Ionicons name="chevron-forward" size={18} color="#1F2937" />
                  </Pressable>
                </View>

                {/* Day of Week Headers */}
                <View style={styles.calendarWeekRow}>
                  {['Li', 'Lu', 'Ma', 'Mi', 'Hu', 'Bi', 'Sa'].map((d, dIdx) => (
                    <Text key={dIdx} style={styles.calendarWeekHeader}>
                      {d}
                    </Text>
                  ))}
                </View>

                {/* Day Cells Grid */}
                <View style={styles.calendarGrid}>
                  {calendarDays.map((item) => {
                    if (item.type === 'empty') {
                      return <View key={item.key} style={styles.calendarDayCell} />;
                    }

                    const isStart = tempStartDate && isSameDay(item.date, tempStartDate);
                    const isEnd = tempEndDate && isSameDay(item.date, tempEndDate);
                    const isInRange =
                      tempStartDate &&
                      tempEndDate &&
                      item.date.getTime() > tempStartDate.getTime() &&
                      item.date.getTime() < tempEndDate.getTime();
                    const isToday = isSameDay(item.date, new Date());
                    const isFuture = item.date.getTime() > new Date().setHours(23, 59, 59, 999);

                    return (
                      <Pressable
                        key={item.key}
                        disabled={isFuture}
                        style={[
                          styles.calendarDayCell,
                          isInRange ? styles.calendarDayInRange : null,
                          isStart || isEnd ? styles.calendarDaySelected : null,
                          isStart && tempEndDate ? styles.calendarDayStartWithEnd : null,
                          isEnd ? styles.calendarDayEnd : null,
                        ]}
                        onPress={() => handleDaySelect(item.date)}
                      >
                        <View
                          style={[
                            styles.calendarDayCircle,
                            isStart || isEnd ? styles.calendarDayCircleSelected : null,
                            isToday && !isStart && !isEnd ? styles.calendarDayCircleToday : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.calendarDayText,
                              isFuture ? styles.calendarDayTextFuture : null,
                              isStart || isEnd ? styles.calendarDayTextSelected : null,
                              isToday && !isStart && !isEnd ? styles.calendarDayTextToday : null,
                            ]}
                          >
                            {item.dayNum}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Action Buttons with Clear Confirmation */}
              <View style={styles.dateFilterActionRow}>
                <Pressable
                  style={styles.dateFilterResetBtn}
                  onPress={handleResetDateFilter}
                >
                  <Ionicons name="refresh-outline" size={16} color="#4B5563" style={{ marginRight: 4 }} />
                  <Text style={styles.dateFilterResetText}>{t.resetDateFilter || 'I-reset (Ngayon)'}</Text>
                </Pressable>

                <Pressable
                  style={styles.dateFilterApplyBtn}
                  onPress={handleApplyDateRange}
                >
                  <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.dateFilterApplyText}>
                    {tempStartDate && tempEndDate
                      ? `✓ I-apply ang Sakop (${diffDays} araw)`
                      : tempStartDate
                      ? '✓ I-apply ang Petsa (1 araw)'
                      : t.applyDateFilter || 'I-apply ang Petsa'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 5: Sales & Collections Full Overview Modal                          */}
      {/* ========================================================================= */}
      <Modal
        visible={salesOverviewModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSalesOverviewModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.salesOverviewTitle || 'Buong Buod ng Benta at Koleksyon'}</Text>
                <View style={styles.modalPeriodBadgeRow}>
                  <Ionicons name="calendar-outline" size={12} color="#0D7A52" style={{ marginRight: 4 }} />
                  <Text style={styles.modalPeriodBadgeText}>{summary.periodLabel}</Text>
                </View>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setSalesOverviewModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* Section 1: Sales, Cost, Tubo & Profitability */}
              <View style={styles.overviewCard}>
                <View style={styles.overviewSectionHeader}>
                  <Ionicons name="trending-up" size={16} color="#0D7A52" />
                  <Text style={styles.overviewSectionTitle}>{t.salesSectionTitle || 'Benta, Puhunan at Tubo'}</Text>
                </View>

                {/* Primary Hero Row */}
                <View style={styles.overviewHeroRow}>
                  <View style={styles.overviewHeroBox}>
                    <Text style={styles.overviewHeroLabel}>KABUUANG BENTA</Text>
                    <Text style={styles.overviewHeroValGreen}>{summary.formattedTotalSales}</Text>
                    <Text style={styles.overviewHeroSub}>{summary.totalItems} piraso ({summary.totalTransactions} resibo)</Text>
                  </View>
                  <View style={styles.overviewHeroDivider} />
                  <View style={styles.overviewHeroBox}>
                    <Text style={styles.overviewHeroLabel}>MALINIS NA TUBO</Text>
                    <Text style={[styles.overviewHeroValGreen, { color: '#0D7A52' }]}>{summary.formattedTubo}</Text>
                    <Text style={styles.overviewHeroSub}>{summary.profitMarginPercent}% margin ({summary.markupPercent}% markup)</Text>
                  </View>
                </View>

                <View style={styles.overviewLine} />

                {/* Secondary breakdown */}
                <View style={styles.overviewRow}>
                  <Text style={styles.overviewRowLabel}>Kabuuang Puhunan (COGS)</Text>
                  <Text style={styles.overviewRowVal}>{summary.formattedTotalCost}</Text>
                </View>
                <View style={styles.overviewRow}>
                  <Text style={styles.overviewRowLabel}>{t.avgSpendPerReceipt || 'Karaniwang Gastos / Resibo'}</Text>
                  <Text style={styles.overviewRowVal}>{summary.formattedAverageSpend}</Text>
                </View>
                {summary.totalVoidedTransactions > 0 ? (
                  <View style={styles.overviewRow}>
                    <Text style={[styles.overviewRowLabel, { color: '#DC2626' }]}>
                      Na-Void na Benta ({summary.totalVoidedTransactions})
                    </Text>
                    <Text style={[styles.overviewRowVal, { color: '#DC2626' }]}>
                      {summary.formattedTotalVoided}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Section 2: Sales Tender Breakdown (Saan Galing ang Benta?) */}
              <View style={styles.overviewCard}>
                <View style={styles.overviewSectionHeader}>
                  <Ionicons name="wallet-outline" size={16} color="#2563EB" />
                  <Text style={[styles.overviewSectionTitle, { color: '#1E40AF' }]}>
                    {t.salesTenderSectionTitle || 'Paraan ng Pagbayad sa Benta'}
                  </Text>
                </View>

                <View style={styles.overviewRow}>
                  <View style={styles.overviewRowLeft}>
                    <View style={[styles.tenderDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.overviewRowLabel}>Cash Benta (Bayad Agad)</Text>
                  </View>
                  <Text style={styles.overviewRowValBold}>{summary.formattedCashSales}</Text>
                </View>
                <View style={styles.overviewRow}>
                  <View style={styles.overviewRowLeft}>
                    <View style={[styles.tenderDot, { backgroundColor: '#3B82F6' }]} />
                    <Text style={styles.overviewRowLabel}>GCash Benta (E-Wallet)</Text>
                  </View>
                  <Text style={styles.overviewRowValBold}>{summary.formattedGcashSales}</Text>
                </View>
                <View style={styles.overviewRow}>
                  <View style={styles.overviewRowLeft}>
                    <View style={[styles.tenderDot, { backgroundColor: '#F59E0B' }]} />
                    <Text style={styles.overviewRowLabel}>Ipina-Utang na Paninda (Credit)</Text>
                  </View>
                  <Text style={[styles.overviewRowValBold, { color: '#D97706' }]}>
                    {summary.formattedUtangCreditIssued}
                  </Text>
                </View>
              </View>

              {/* Section 3: Suki Utang Collections (Koleksyon sa Pautang) */}
              <View style={styles.overviewCard}>
                <View style={styles.overviewSectionHeader}>
                  <Ionicons name="receipt-outline" size={16} color="#D97706" />
                  <Text style={[styles.overviewSectionTitle, { color: '#B45309' }]}>
                    {t.collectionsSectionTitle || 'Koleksyon sa Pautang (Bayad ng Suki)'}
                  </Text>
                </View>

                <View style={styles.overviewRow}>
                  <View style={styles.overviewRowLeft}>
                    <View style={[styles.tenderDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.overviewRowLabel}>Cash na Bayad sa Utang</Text>
                  </View>
                  <Text style={styles.overviewRowValBold}>{summary.formattedUtangCashCollected}</Text>
                </View>
                <View style={styles.overviewRow}>
                  <View style={styles.overviewRowLeft}>
                    <View style={[styles.tenderDot, { backgroundColor: '#3B82F6' }]} />
                    <Text style={styles.overviewRowLabel}>GCash na Bayad sa Utang</Text>
                  </View>
                  <Text style={styles.overviewRowValBold}>{summary.formattedUtangGcashCollected}</Text>
                </View>
                <View style={styles.overviewLine} />
                <View style={styles.overviewRow}>
                  <Text style={[styles.overviewRowLabel, { fontWeight: '700' }]}>Kabuuang Nakolektang Utang</Text>
                  <Text style={[styles.overviewRowValBold, { color: '#0D7A52', fontSize: 14 }]}>
                    {summary.formattedUtangCollected}
                  </Text>
                </View>
              </View>

              {/* Section 4: Total Operational Cash Inflow (Kabuuang Pumasok na Pera) */}
              <View style={[styles.overviewCard, styles.overviewInflowCard]}>
                <View style={styles.overviewSectionHeader}>
                  <Ionicons name="cash-outline" size={16} color="#0D7A52" />
                  <Text style={styles.overviewSectionTitle}>
                    {t.totalInflowSectionTitle || 'Kabuuang Pumasok na Pera sa Negosyo'}
                  </Text>
                </View>

                <View style={styles.inflowBox}>
                  <View style={styles.inflowRow}>
                    <Text style={styles.inflowLabel}>{t.cashInflowLabel || 'Cash Benta + Cash Bayad Utang'}</Text>
                    <Text style={styles.inflowVal}>{summary.formattedTotalCashInflow}</Text>
                  </View>
                  <View style={styles.inflowRow}>
                    <Text style={styles.inflowLabel}>{t.digitalInflowLabel || 'GCash Benta + GCash Bayad Utang'}</Text>
                    <Text style={styles.inflowVal}>{summary.formattedTotalDigitalInflow}</Text>
                  </View>
                  <View style={styles.inflowDivider} />
                  <View style={styles.inflowRow}>
                    <Text style={styles.inflowGrandLabel}>{t.grandTotalInflowLabel || 'KABUUANG PUMASOK (Operating Inflow)'}</Text>
                    <Text style={styles.inflowGrandVal}>{summary.formattedGrandTotalOperatingInflow}</Text>
                  </View>
                </View>
              </View>

              {/* Close Button */}
              <Pressable
                style={styles.overviewDoneBtn}
                onPress={() => setSalesOverviewModalVisible(false)}
              >
                <Text style={styles.overviewDoneBtnText}>Isara ang Buod</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
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

      {/* Store Security Challenge Modal for Tubo / Profit Confidentiality */}
      <PinChallengeModal
        visible={showTuboPinModal}
        title="Proteksyon sa Tubo at Puhunan"
        subtitle="I-scan ang Fingerprint/Face ID o i-enter ang 4-digit PIN upang makita ang tubo"
        onSuccess={() => {
          setShowTuboPinModal(false);
          setShowProfit(true);
          unlockStore();
          showActionToast('🔓 Nabuksan ang Tubo at Puhunan');
        }}
        onCancel={() => setShowTuboPinModal(false)}
      />

      {/* 58mm / 80mm ESC/POS Thermal Receipt Reprint Modal */}
      {reprintTx ? (
        <ReceiptPrinterModal
          visible={reprintTx !== null}
          receiptData={{
            storeName: settings?.storeName || 'Tindahan Helper POS',
            receiptNumber: reprintTx.id,
            receiptId: reprintTx.id,
            timestamp: `${reprintTx.dateLabel || ''} ${reprintTx.timeLabel || ''}`.trim() || new Date().toLocaleString(),
            tenderType: reprintTx.tenderType as any,
            customerName: reprintTx.customerName,
            items: (reprintTx.items || []).map((it: any) => ({
              name: it.name,
              quantity: it.quantity,
              unitPricePhp: it.unitPricePaidPhp ?? 0,
              totalPricePhp: (it.unitPricePaidPhp ?? 0) * (it.quantity ?? 1),
            })),
            subtotalPhp: reprintTx.totalPhp - ((reprintTx as any).convenienceFeePhp ?? 0),
            convenienceFeePhp: (reprintTx as any).convenienceFeePhp ?? 0,
            totalAmountPhp: reprintTx.totalPhp,
            paymentReference: reprintTx.paymentReference || (reprintTx as any).gcashRef,
            tenderedAmountPhp: reprintTx.tenderType === 'CASH' ? reprintTx.amountTenderedPhp || reprintTx.totalPhp : undefined,
            changePhp: reprintTx.tenderType === 'CASH' ? reprintTx.changeDuePhp || 0 : undefined,
          }}
          onClose={() => setReprintTx(null)}
        />
      ) : null}
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
  headerBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  zReadingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  zReadingBtnText: {
    color: '#0D7A52',
    fontSize: 12,
    fontWeight: '800',
  },
  forecastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  forecastBtnText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 155,
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
  dateCardActive: {
    borderColor: '#0D7A52',
    backgroundColor: '#ECFDF5',
  },
  dateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  dateTextActive: {
    color: '#0D7A52',
  },
  dateDropdownHint: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  clearDateFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clearDateFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7A52',
  },
  dateChevron: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: '600',
  },
  dateFilterTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  dateFilterTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7A52',
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  growthBadgePos: {
    backgroundColor: '#ECFDF5',
  },
  growthBadgeNeg: {
    backgroundColor: '#FEF2F2',
  },
  growthBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  growthBadgeTextPos: {
    color: '#059669',
  },
  growthBadgeTextNeg: {
    color: '#DC2626',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  chartPeakSubtitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7A52',
  },
  barContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 96,
    paddingTop: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  peakCrown: {
    fontSize: 11,
    lineHeight: 14,
  },
  barTrack: {
    width: 14,
    height: 64,
    backgroundColor: '#F3F4F6',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#9CA3AF',
    borderRadius: 7,
  },
  barFillPeak: {
    backgroundColor: '#0D7A52',
  },
  barDayText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  barDayTextPeak: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 9,
    minHeight: 94,
    justifyContent: 'space-between',
  },
  kpiCardTappable: {
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#F0FDF4',
  },
  kpiCardInteractive: {
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 18,
  },
  kpiLabel: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
    flexShrink: 1,
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#111827',
    fontVariant: ['tabular-nums'],
    marginVertical: 2,
  },
  kpiCardFooter: {
    gap: 1.5,
  },
  kpiSubText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  tuboContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tuboLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
  },
  tuboLabel: {
    fontSize: 10,
    color: '#0D7A52',
    fontWeight: '700',
  },
  tuboValue: {
    fontSize: 10,
    color: '#0D7A52',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  eyeBtn: {
    padding: 2,
  },
  puhunanText: {
    fontSize: 9.5,
    color: '#6B7280',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  kahaTapHint: {
    fontSize: 10,
    color: '#0D7A52',
    fontWeight: '700',
  },
  secondaryKpiRow: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryKpiItem: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  secondaryKpiItemTappable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryKpiLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '600',
  },
  secondaryKpiVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  itemsSoldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mabentaPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  mabentaPillText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#B45309',
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
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
  },
  filterPillsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
    paddingVertical: 12,
  },
  txTimeCol: {
    width: 110,
    gap: 2,
  },
  txTime: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  txStatusTag: {
    fontSize: 9,
    fontWeight: '800',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  txMethodTag: {
    fontSize: 8,
    fontWeight: '800',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tagCash: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  tagGcash: {
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
  },
  tagUtang: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  tagSplit: {
    backgroundColor: '#F3E8FF',
    color: '#7E22CE',
  },
  tagVoid: {
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
  },
  tagPayment: {
    backgroundColor: '#DCFCE7',
    color: '#15803D',
  },
  tagReturn: {
    backgroundColor: '#FEF3C7',
    color: '#B45309',
  },
  tagGcashRef: {
    backgroundColor: '#EFF6FF',
    color: '#2563EB',
    fontWeight: '700',
  },
  tagFeeBadge: {
    backgroundColor: '#ECFDF5',
    color: '#059669',
    fontWeight: '700',
  },
  txAmountCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  txTuboSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D7A52',
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  txAmountGreen: {
    color: '#15803D',
  },
  txAmountVoided: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  txRightCol: {
    width: 100,
    alignItems: 'flex-end',
  },
  txItemsCount: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'right',
  },
  customerUtangBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
    textAlign: 'right',
  },
  wizardBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  saleFinancialCard: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 8,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginVertical: 4,
  },
  saleFinancialCol: {
    alignItems: 'center',
    flex: 1,
  },
  saleFinancialLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  saleFinancialValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  wizardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 6,
  },
  wizardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  auditNoteText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  paymentDetailText: {
    fontSize: 12,
    color: '#334155',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  dispositionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dispChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  dispChipGreen: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  dispChipAmber: {
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  dispChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  dispChipTextGreen: {
    color: '#065F46',
    fontWeight: '800',
  },
  dispChipTextAmber: {
    color: '#92400E',
    fontWeight: '800',
  },
  reasonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  reasonPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  reasonPillActive: {
    backgroundColor: '#334155',
    borderColor: '#334155',
  },
  reasonText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  reasonTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lineItemLeft: {
    flex: 1,
  },
  lineItemName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  lineItemSub: {
    fontSize: 10,
    color: '#64748B',
  },
  lineActionBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  refundBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  utangDeductBtn: {
    backgroundColor: '#FEF3C7',
  },
  refundBtnText: {
    color: '#B91C1C',
    fontSize: 11,
    fontWeight: '700',
  },
  utangDeductBtnText: {
    color: '#B45309',
  },
  exchangeBtn: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  exchangeBtnText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  returnedBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  reprintReceiptBtn: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  reprintReceiptBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  voidSaleBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  voidSaleBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B91C1C',
  },
  paginationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  pageBtnTextDisabled: {
    color: '#9CA3AF',
  },
  pageIndicatorText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '90%',
    gap: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalCloseBtn: {
    padding: 4,
  },

  // Kaha Breakdown
  kahaBreakdownCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  kahaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kahaRowLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  kahaRowVal: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  kahaDivider: {
    height: 1,
    backgroundColor: '#CBD5E1',
    marginVertical: 4,
  },
  kahaTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kahaTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  kahaTotalVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D7A52',
    fontVariant: ['tabular-nums'],
  },

  // Adj Form
  adjFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
    marginTop: 10,
  },
  formSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  adjSegmentRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  adjSegmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  adjSegmentBtnPanukli: {
    backgroundColor: '#0284C7',
  },
  adjSegmentBtnGastos: {
    backgroundColor: '#DC2626',
  },
  adjSegmentBtnEdit: {
    backgroundColor: '#059669',
  },
  editDrawerCurrentBox: {
    backgroundColor: '#F0FDF4',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginVertical: 4,
  },
  editDrawerCurrentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  editDrawerCurrentVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#15803D',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  diffPreviewBoxSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
  },
  diffPreviewTextSuccess: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  diffPreviewBoxDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
  },
  diffPreviewTextDanger: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  diffPreviewBoxNeutral: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderWidth: 1,
    padding: 8,
    borderRadius: 6,
    marginVertical: 4,
  },
  diffPreviewTextNeutral: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  saveDirectDrawerBtn: {
    backgroundColor: '#059669',
  },
  saveAdjBtnDisabled: {
    opacity: 0.6,
  },
  adjSegmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  adjSegmentTextActive: {
    color: '#FFFFFF',
  },
  inputFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    marginTop: 4,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
  },
  pesoPrefix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  catChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  catChipActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  catChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  noteInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 12,
    color: '#111827',
  },
  saveAdjBtn: {
    backgroundColor: '#0D7A52',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 6,
  },
  saveAdjBtnSuccess: {
    backgroundColor: '#059669',
  },
  saveAdjBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  inModalFeedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 10,
    gap: 8,
  },
  inModalFeedbackText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    flex: 1,
  },

  // Drawer History
  drawerHistorySection: {
    marginTop: 12,
    gap: 8,
  },
  historySectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  noHistoryText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  drawerHistoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adjTypeTag: {
    fontSize: 9,
    fontWeight: '800',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  tagPanukli: {
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
  },
  tagGastos: {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
  },
  adjCategoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  adjNoteText: {
    fontSize: 10,
    color: '#64748B',
  },
  adjTimeText: {
    fontSize: 9,
    color: '#94A3B8',
  },
  adjAmountText: {
    fontSize: 13,
    fontWeight: '800',
  },
  deleteAdjBtn: {
    padding: 2,
  },

  // Top Movers
  topProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 10,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankGold: {
    backgroundColor: '#FEF3C7',
  },
  rankSilver: {
    backgroundColor: '#E2E8F0',
  },
  rankBronze: {
    backgroundColor: '#FFEDD5',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#374151',
  },
  topProdName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  topProdUnits: {
    fontSize: 11,
    color: '#0D7A52',
    fontWeight: '700',
  },
  topProdDot: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  topProdRevenue: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  stockChipIn: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stockChipTextIn: {
    color: '#15803D',
    fontSize: 9,
    fontWeight: '700',
  },
  stockChipLow: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stockChipTextLow: {
    color: '#B45309',
    fontSize: 9,
    fontWeight: '700',
  },
  stockChipOut: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stockChipTextOut: {
    color: '#DC2626',
    fontSize: 9,
    fontWeight: '700',
  },

  // Z-Reading Receipt Paper
  receiptPaper: {
    backgroundColor: '#FAFAF9',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E7E5E4',
    gap: 6,
  },
  receiptStoreName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1C1917',
    textAlign: 'center',
  },
  receiptStoreAddress: {
    fontSize: 11,
    color: '#78716C',
    textAlign: 'center',
  },
  receiptDate: {
    fontSize: 11,
    fontWeight: '600',
    color: '#44403C',
    textAlign: 'center',
    marginTop: 2,
  },
  receiptDashedLine: {
    height: 1,
    borderWidth: 1,
    borderColor: '#D6D3D1',
    borderStyle: 'dashed',
    marginVertical: 4,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLabel: {
    fontSize: 12,
    color: '#44403C',
    fontWeight: '600',
  },
  receiptLabelBold: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1C1917',
  },
  receiptLabelSub: {
    fontSize: 11,
    color: '#78716C',
  },
  receiptVal: {
    fontSize: 12,
    color: '#1C1917',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  receiptValBold: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1C1917',
    fontVariant: ['tabular-nums'],
  },
  receiptValSub: {
    fontSize: 11,
    color: '#78716C',
    fontVariant: ['tabular-nums'],
  },
  receiptFooter: {
    fontSize: 10,
    color: '#A8A29E',
    textAlign: 'center',
    marginTop: 4,
  },
  shareZBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D7A52',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 10,
  },
  shareZBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Modal 4: Date Filter & Calendar Styles
  filterSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  datePresetsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  datePresetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  datePresetChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#0D7A52',
  },
  datePresetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  datePresetChipTextActive: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  dateRangeDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  dateRangeBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateRangeBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  dateRangeBoxVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    marginBottom: 16,
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 8,
  },
  calendarNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  calendarMonthTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  calendarWeekHeader: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayInRange: {
    backgroundColor: '#ECFDF5',
  },
  calendarDaySelected: {
    backgroundColor: '#ECFDF5',
  },
  calendarDayStartWithEnd: {
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  calendarDayEnd: {
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  calendarDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayCircleSelected: {
    backgroundColor: '#0D7A52',
  },
  calendarDayCircleToday: {
    borderWidth: 1.5,
    borderColor: '#0D7A52',
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  calendarDayTextFuture: {
    color: '#D1D5DB',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calendarDayTextToday: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  dateFilterActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  dateFilterResetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingVertical: 12,
  },
  dateFilterResetText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  dateFilterApplyBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D7A52',
    borderRadius: 10,
    paddingVertical: 12,
  },
  dateFilterApplyText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Modal 5: Sales & Collections Full Overview Styles
  modalPeriodBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  modalPeriodBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7A52',
  },
  overviewCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  overviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  overviewSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
  },
  overviewHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  overviewHeroBox: {
    flex: 1,
    alignItems: 'center',
  },
  overviewHeroDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  overviewHeroLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  overviewHeroValGreen: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  overviewHeroSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0D7A52',
    marginTop: 2,
    textAlign: 'center',
  },
  overviewLine: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  overviewRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tenderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  overviewRowLabel: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  overviewRowVal: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  overviewRowValBold: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  overviewInflowCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  inflowBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  inflowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  inflowLabel: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  inflowVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  inflowDivider: {
    height: 1,
    backgroundColor: '#D1FAE5',
    marginVertical: 6,
  },
  inflowGrandLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#065F46',
    flex: 1,
  },
  inflowGrandVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D7A52',
    fontVariant: ['tabular-nums'],
  },
  overviewDoneBtn: {
    backgroundColor: '#0D7A52',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  overviewDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
