// src/app/history.tsx — Screen: Store Activity, Stock Movement & Cash Drawer Audit Log
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Share,
} from 'react-native';
import { ScreenSafeAreaView } from '@/presentation/components/ScreenSafeAreaView';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { getTranslations } from '@/presentation/localization/i18n';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';
import {
  StockMovementRecord,
  DateRangeFilter,
  CashDrawerAdjustmentRecord,
} from '@/application/TindahanStoreService';
import { Money } from '@/domain/value-objects/Money';
import { ProductVisual } from '@/domain/entities/Product';
import { DateRangeCalendarModal } from '@/presentation/components/DateRangeCalendarModal';

export type HistoryCategoryFilter = 'ALL' | 'STOCK' | 'PRODUCT' | 'EXPENSE';

type MovementFilter =
  | 'ALL'
  | 'RESTOCK'
  | 'SALE'
  | 'HOME_USE'
  | 'DAMAGED_EXPIRED'
  | 'UNPACK_TINGI'
  | 'RETURN';

type DateFilter = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH';

export interface UnifiedActivityItem {
  id: string;
  category: 'STOCK' | 'PRODUCT' | 'EXPENSE';
  activityType: string;
  title: string;
  subtitle?: string;
  quantityDelta?: number;
  amountPhp?: number;
  previousStock?: number;
  resultingStock?: number;
  badgeLabel: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  icon: keyof typeof Ionicons.glyphMap;
  timestampMs: number;
  createdAt: string;
  reason?: string;
  referenceId?: string;
  productId?: string;
  rawMovement?: StockMovementRecord;
  rawCashAdj?: CashDrawerAdjustmentRecord;
}

export default function StockMovementHistoryScreen() {
  const router = useRouter();
  const { stockMovements, cashDrawerAdjustments, products, settings } = useTindahanStore();
  const t = getTranslations(settings?.language);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<HistoryCategoryFilter>('ALL');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [customDateRange, setCustomDateRange] = useState<DateRangeFilter | null>(null);
  const [dateFilterModalVisible, setDateFilterModalVisible] = useState(false);

  // Fast Product Lookup Map
  const productMap = useMemo(() => {
    const map = new Map<string, (typeof products)[0]>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  // Available Years for the Calendar Selector
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    yearSet.add(new Date().getFullYear());
    for (const mov of stockMovements) {
      const y = new Date(mov.createdAt).getFullYear();
      if (!isNaN(y)) yearSet.add(y);
    }
    for (const adj of cashDrawerAdjustments) {
      const y = new Date(adj.timestampMs).getFullYear();
      if (!isNaN(y)) yearSet.add(y);
    }
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [stockMovements, cashDrawerAdjustments]);

  // Transform and Unify All Activity Items (OOP Polymorphic Model)
  const unifiedActivities = useMemo(() => {
    const items: UnifiedActivityItem[] = [];

    // 1. Process Stock Movements & Product Add/Edit logs
    for (const mov of stockMovements) {
      const timeMs = new Date(mov.createdAt).getTime();

      if (mov.movementType === 'PRODUCT_ADD') {
        items.push({
          id: mov.id,
          category: 'PRODUCT',
          activityType: 'PRODUCT_ADD',
          title: mov.productName,
          subtitle: 'Bagong Rehistro sa Tindahan',
          quantityDelta: mov.quantityDelta,
          previousStock: mov.previousStock,
          resultingStock: mov.resultingStock,
          badgeLabel: 'BAGONG PRODUKTO',
          badgeBg: '#ECFDF5',
          badgeColor: '#059669',
          badgeBorder: '#A7F3D0',
          icon: 'add-circle-outline',
          timestampMs: timeMs,
          createdAt: mov.createdAt,
          reason: mov.reason,
          referenceId: mov.referenceId,
          productId: mov.productId,
          rawMovement: mov,
        });
      } else if (mov.movementType === 'PRODUCT_EDIT') {
        items.push({
          id: mov.id,
          category: 'PRODUCT',
          activityType: 'PRODUCT_EDIT',
          title: mov.productName,
          subtitle: 'Na-update ang Detalye',
          quantityDelta: mov.quantityDelta,
          previousStock: mov.previousStock,
          resultingStock: mov.resultingStock,
          badgeLabel: 'EDIT PRODUKTO',
          badgeBg: '#EFF6FF',
          badgeColor: '#2563EB',
          badgeBorder: '#BFDBFE',
          icon: 'create-outline',
          timestampMs: timeMs,
          createdAt: mov.createdAt,
          reason: mov.reason,
          referenceId: mov.referenceId,
          productId: mov.productId,
          rawMovement: mov,
        });
      } else {
        // Regular Stock Movement (Restock, Sale, Home Use, Damaged, Unpack, Return)
        let badgeLabel = mov.movementType as string;
        let badgeBg = '#F3F4F6';
        let badgeColor = '#374151';
        let badgeBorder = '#E5E7EB';
        let icon: keyof typeof Ionicons.glyphMap = 'cube-outline';

        switch (mov.movementType) {
          case 'RESTOCK':
            badgeLabel = t.movementRestock;
            badgeBg = '#ECFDF5';
            badgeColor = '#065F46';
            badgeBorder = '#A7F3D0';
            icon = 'arrow-down-circle-outline';
            break;
          case 'SALE':
            badgeLabel = t.movementSale;
            badgeBg = '#EFF6FF';
            badgeColor = '#1E40AF';
            badgeBorder = '#BFDBFE';
            icon = 'cart-outline';
            break;
          case 'HOME_USE':
            badgeLabel = t.movementHomeUse;
            badgeBg = '#FFFBEB';
            badgeColor = '#92400E';
            badgeBorder = '#FDE68A';
            icon = 'home-outline';
            break;
          case 'DAMAGED_EXPIRED':
            badgeLabel = t.movementDamagedExpired;
            badgeBg = '#FEF2F2';
            badgeColor = '#991B1B';
            badgeBorder = '#FECACA';
            icon = 'alert-circle-outline';
            break;
          case 'UNPACK_TINGI':
            badgeLabel = t.movementUnpackTingi;
            badgeBg = '#FAF5FF';
            badgeColor = '#6B21A8';
            badgeBorder = '#E9D5FF';
            icon = 'cube-outline';
            break;
          case 'RETURN':
            badgeLabel = t.movementReturn;
            badgeBg = '#F0FDFA';
            badgeColor = '#115E59';
            badgeBorder = '#99F6E4';
            icon = 'refresh-circle-outline';
            break;
        }

        items.push({
          id: mov.id,
          category: 'STOCK',
          activityType: mov.movementType,
          title: mov.productName,
          quantityDelta: mov.quantityDelta,
          previousStock: mov.previousStock,
          resultingStock: mov.resultingStock,
          badgeLabel,
          badgeBg,
          badgeColor,
          badgeBorder,
          icon,
          timestampMs: timeMs,
          createdAt: mov.createdAt,
          reason: mov.reason,
          referenceId: mov.referenceId,
          productId: mov.productId,
          rawMovement: mov,
        });
      }
    }

    // 2. Process Cash Drawer Gastos & Panukli
    for (const adj of cashDrawerAdjustments) {
      const isGastos = adj.type === 'GASTOS';
      items.push({
        id: adj.id,
        category: 'EXPENSE',
        activityType: adj.type,
        title: isGastos ? `Gastos sa Kaha: ${adj.category}` : `Panukli sa Kaha: ${adj.category}`,
        subtitle: adj.note || (isGastos ? 'Cash Drawer Expense / Pera palabas' : 'Cash Drawer Float / Panukli'),
        amountPhp: adj.amountPhp,
        badgeLabel: isGastos ? 'GASTOS (EXPENSE)' : 'PANUKLI (FLOAT)',
        badgeBg: isGastos ? '#FEF2F2' : '#F0FDF4',
        badgeColor: isGastos ? '#DC2626' : '#16A34A',
        badgeBorder: isGastos ? '#FECACA' : '#BBF7D0',
        icon: isGastos ? 'cash-outline' : 'wallet-outline',
        timestampMs: adj.timestampMs,
        createdAt: new Date(adj.timestampMs).toISOString(),
        reason: adj.note ? `Tala: ${adj.note}` : undefined,
        rawCashAdj: adj,
      });
    }

    // Sort newest first
    return items.sort((a, b) => b.timestampMs - a.timestampMs);
  }, [stockMovements, cashDrawerAdjustments, t]);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const cleanQuery = searchQuery.trim().toLowerCase();

    return unifiedActivities.filter((item) => {
      // 1. Category Filter
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }

      // 2. Sub-Movement Filter (only for Stock category)
      if (
        categoryFilter === 'STOCK' &&
        movementFilter !== 'ALL' &&
        item.activityType !== movementFilter
      ) {
        return false;
      }

      // 3. Date Range Filter
      if (customDateRange) {
        if (item.timestampMs < customDateRange.startMs || item.timestampMs > customDateRange.endMs) {
          return false;
        }
      } else {
        if (dateFilter === 'TODAY' && item.timestampMs < todayStart) {
          return false;
        }
        if (
          dateFilter === 'YESTERDAY' &&
          (item.timestampMs < yesterdayStart || item.timestampMs >= todayStart)
        ) {
          return false;
        }
        if (dateFilter === 'THIS_WEEK' && item.timestampMs < weekStart) {
          return false;
        }
        if (dateFilter === 'THIS_MONTH' && item.timestampMs < monthStart) {
          return false;
        }
      }

      // 4. Search Query Filter
      if (cleanQuery) {
        const matchesTitle = item.title.toLowerCase().includes(cleanQuery);
        const matchesReason = item.reason?.toLowerCase().includes(cleanQuery);
        const matchesRef = item.referenceId?.toLowerCase().includes(cleanQuery);
        const matchesSubtitle = item.subtitle?.toLowerCase().includes(cleanQuery);
        if (!matchesTitle && !matchesReason && !matchesRef && !matchesSubtitle) {
          return false;
        }
      }

      return true;
    });
  }, [unifiedActivities, categoryFilter, movementFilter, customDateRange, dateFilter, searchQuery]);

  // KPI Computations based on filtered activities
  const kpis = useMemo(() => {
    let stockInUnits = 0;
    let soldUnits = 0;
    let shrinkageUnits = 0;
    let shrinkageCentavos = 0;
    let totalExpenseCentavos = 0;

    for (const item of filteredActivities) {
      if (item.category === 'STOCK') {
        const mov = item.rawMovement;
        if (!mov) continue;
        if (
          mov.movementType === 'RESTOCK' ||
          mov.movementType === 'UNPACK_TINGI' ||
          mov.movementType === 'RETURN'
        ) {
          if (mov.quantityDelta > 0) stockInUnits += mov.quantityDelta;
        } else if (mov.movementType === 'SALE') {
          soldUnits += Math.abs(mov.quantityDelta);
        } else if (mov.movementType === 'HOME_USE' || mov.movementType === 'DAMAGED_EXPIRED') {
          const absQty = Math.abs(mov.quantityDelta);
          shrinkageUnits += absQty;
          const unitCostCentavos = Math.round((mov.unitCostPhp || 0) * 100);
          shrinkageCentavos += unitCostCentavos * absQty;
        }
      } else if (item.category === 'EXPENSE') {
        if (item.activityType === 'GASTOS' && item.amountPhp) {
          totalExpenseCentavos += Math.round(item.amountPhp * 100);
        }
      }
    }

    const shrinkageLossPhp = shrinkageCentavos / 100;
    const totalExpensePhp = totalExpenseCentavos / 100;

    return {
      stockInUnits: Math.round(stockInUnits * 100) / 100,
      soldUnits: Math.round(soldUnits * 100) / 100,
      shrinkageUnits: Math.round(shrinkageUnits * 100) / 100,
      formattedShrinkageLoss: Money.fromPhp(shrinkageLossPhp).format(),
      formattedTotalExpense: Money.fromPhp(totalExpensePhp).format(),
      totalExpensePhp,
    };
  }, [filteredActivities]);

  // Share Audit Report Handler
  const handleShareReport = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const dateLabel = customDateRange ? customDateRange.label : new Date().toLocaleDateString('en-PH');

    const lines = [
      `📊 ${settings.storeName.toUpperCase()} — STORE AUDIT & HISTORY REPORT`,
      `📅 Panahon: ${dateLabel}`,
      `---------------------------------`,
      `📦 Pumasok na Stock: +${kpis.stockInUnits} units`,
      `🛒 Naibenta sa POS: -${kpis.soldUnits} units`,
      `⚠️ Kupit at Sira: -${kpis.shrinkageUnits} units (Halaga: ${kpis.formattedShrinkageLoss})`,
      `💸 Gastos sa Kaha: ${kpis.formattedTotalExpense}`,
      `---------------------------------`,
      `MGA HULING GAWAIN / LOGS:`,
    ];

    const previewItems = filteredActivities.slice(0, 15);
    for (const item of previewItems) {
      const timeStr = new Date(item.timestampMs).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      if (item.category === 'STOCK') {
        const sign = (item.quantityDelta ?? 0) > 0 ? '+' : '';
        lines.push(`• [STOCK] ${item.title}: ${sign}${item.quantityDelta} pcs (${item.previousStock} → ${item.resultingStock}) ${timeStr}`);
      } else if (item.category === 'PRODUCT') {
        lines.push(`• [PRODUKTO] ${item.badgeLabel} — ${item.title} (${item.reason || ''}) ${timeStr}`);
      } else if (item.category === 'EXPENSE') {
        lines.push(`• [KAHA] ${item.title}: ₱${item.amountPhp?.toFixed(2)} (${item.reason || ''}) ${timeStr}`);
      }
    }

    if (filteredActivities.length > 15) {
      lines.push(`... at ${filteredActivities.length - 15} pang iba.`);
    }

    lines.push(`\nInulat mula sa ${settings.storeName} Tindahan Helper`);

    try {
      await Share.share({
        message: lines.join('\n'),
        title: `${settings.storeName} Store Audit Report`,
      });
    } catch {
      // ignored
    }
  }, [settings.storeName, kpis, filteredActivities, customDateRange]);

  const formatTimestamp = (timestampMs: number) => {
    try {
      const d = new Date(timestampMs);
      if (isNaN(d.getTime())) return '';
      const datePart = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      const timePart = d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `${datePart} • ${timePart}`;
    } catch {
      return '';
    }
  };

  return (
    <ScreenSafeAreaView style={styles.safeArea}>
      {/* Top Header Bar */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.navigate('/inventory'))}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#064E3B" />
        </Pressable>

        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle}>{t.historyTitle || 'Kasaysayan ng Tindahan'}</Text>
          <Text style={styles.headerSub}>{t.historySub || 'Talaan ng Stock, Produkto, at Gastos sa Kaha'}</Text>
        </View>

        <Pressable
          style={styles.shareBtn}
          onPress={handleShareReport}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t.shareReportBtn}
        >
          <Ionicons name="share-social-outline" size={20} color="#0D7A52" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* KPI Cards Row */}
        <View style={styles.kpiContainer}>
          {/* 1. Stock In */}
          <View style={[styles.kpiCard, styles.kpiCardStockIn]}>
            <View style={styles.kpiIconWrapperStockIn}>
              <Ionicons name="arrow-down" size={15} color="#065F46" />
            </View>
            <Text style={styles.kpiValueStockIn}>+{kpis.stockInUnits}</Text>
            <Text style={styles.kpiLabel}>{t.kpiStockIn || 'Pumasok'}</Text>
          </View>

          {/* 2. Sold */}
          <View style={[styles.kpiCard, styles.kpiCardSold]}>
            <View style={styles.kpiIconWrapperSold}>
              <Ionicons name="cart" size={15} color="#1E40AF" />
            </View>
            <Text style={styles.kpiValueSold}>-{kpis.soldUnits}</Text>
            <Text style={styles.kpiLabel}>{t.kpiStockOut || 'Benta'}</Text>
          </View>

          {/* 3. Shrinkage */}
          <View style={[styles.kpiCard, styles.kpiCardShrinkage]}>
            <View style={styles.kpiIconWrapperShrinkage}>
              <Ionicons name="warning" size={15} color="#991B1B" />
            </View>
            <Text style={styles.kpiValueShrinkage}>-{kpis.shrinkageUnits}</Text>
            <Text style={styles.kpiLabel}>{t.kpiShrinkage || 'Kupit/Sira'}</Text>
            {kpis.shrinkageUnits > 0 ? (
              <Text style={styles.kpiSubLoss}>{kpis.formattedShrinkageLoss}</Text>
            ) : null}
          </View>

          {/* 4. Cash Drawer Expense */}
          <View style={[styles.kpiCard, styles.kpiCardExpense]}>
            <View style={styles.kpiIconWrapperExpense}>
              <Ionicons name="cash-outline" size={15} color="#DC2626" />
            </View>
            <Text style={styles.kpiValueExpense}>{kpis.formattedTotalExpense}</Text>
            <Text style={styles.kpiLabel}>Gastos sa Kaha</Text>
          </View>
        </View>

        {/* Date Filter & Interactive Calendar Trigger Button (Inherited OOP Pattern) */}
        <View style={styles.calendarCardWrapper}>
          <Pressable
            style={[
              styles.calendarCard,
              customDateRange ? styles.calendarCardActive : null,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setDateFilterModalVisible(true);
            }}
          >
            <View style={styles.calendarLeftCol}>
              <Ionicons
                name={customDateRange ? 'calendar' : 'calendar-outline'}
                size={18}
                color={customDateRange ? '#0D7A52' : '#4B5563'}
              />
              <View>
                <Text style={styles.calendarLabel}>
                  {customDateRange ? 'SAKOP NA PETSA (CUSTOM)' : 'SALAIN AYON SA PETSA'}
                </Text>
                <Text
                  style={[
                    styles.calendarValueText,
                    customDateRange ? styles.calendarValueTextActive : null,
                  ]}
                >
                  {customDateRange ? customDateRange.label : 'I-tap para buksan ang Kalendaryo'}
                </Text>
              </View>
            </View>

            {customDateRange ? (
              <Pressable
                style={styles.clearCalendarBtn}
                hitSlop={10}
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setCustomDateRange(null);
                }}
              >
                <Ionicons name="close-circle" size={18} color="#0D7A52" />
                <Text style={styles.clearCalendarText}>I-reset</Text>
              </Pressable>
            ) : (
              <View style={styles.openCalendarPill}>
                <Text style={styles.openCalendarPillText}>Buksan</Text>
                <Ionicons name="chevron-forward" size={14} color="#0D7A52" />
              </View>
            )}
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Maghanap ng produkto, gastos, o dahilan..."
            placeholderTextColor="#9CA3AF"
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </Pressable>
          ) : null}
        </View>

        {/* Category Filter Chips */}
        <View style={styles.filterPillSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillContent}
          >
            {[
              { key: 'ALL', label: 'Lahat ng Tala (All)', icon: 'list-outline' },
              { key: 'STOCK', label: 'Stock Movements', icon: 'cube-outline' },
              { key: 'PRODUCT', label: 'Produkto (Add/Edit)', icon: 'pricetag-outline' },
              { key: 'EXPENSE', label: 'Gastos sa Kaha', icon: 'cash-outline' },
            ].map((cat) => {
              const active = categoryFilter === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  style={[styles.categoryPill, active && styles.categoryPillActive]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setCategoryFilter(cat.key as HistoryCategoryFilter);
                  }}
                  hitSlop={6}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={14}
                    color={active ? '#0D7A52' : '#64748B'}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]}>
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Sub-movement Type Filter Chips (When category is STOCK) */}
        {categoryFilter === 'STOCK' ? (
          <View style={styles.filterPillSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillContent}
            >
              {(
                [
                  'ALL',
                  'RESTOCK',
                  'SALE',
                  'HOME_USE',
                  'DAMAGED_EXPIRED',
                  'UNPACK_TINGI',
                  'RETURN',
                ] as MovementFilter[]
              ).map((mf) => {
                const active = movementFilter === mf;
                const label =
                  mf === 'ALL'
                    ? 'Lahat ng Paggalaw'
                    : mf === 'RESTOCK'
                    ? t.movementRestock
                    : mf === 'SALE'
                    ? t.movementSale
                    : mf === 'HOME_USE'
                    ? t.movementHomeUse
                    : mf === 'DAMAGED_EXPIRED'
                    ? t.movementDamagedExpired
                    : mf === 'UNPACK_TINGI'
                    ? t.movementUnpackTingi
                    : t.movementReturn;

                return (
                  <Pressable
                    key={mf}
                    style={[styles.typePill, active && styles.typePillActive]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setMovementFilter(mf);
                    }}
                    hitSlop={6}
                  >
                    <Text style={[styles.typePillText, active && styles.typePillTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Quick Date Filter Pills (When no custom date range is set) */}
        {!customDateRange ? (
          <View style={styles.filterPillSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillContent}
            >
              {(['ALL', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH'] as DateFilter[]).map((df) => {
                const active = dateFilter === df;
                const label =
                  df === 'ALL'
                    ? t.dateFilterAll || 'Kailanman'
                    : df === 'TODAY'
                    ? t.dateFilterToday || 'Ngayon'
                    : df === 'YESTERDAY'
                    ? t.dateFilterYesterday || 'Kahapon'
                    : df === 'THIS_WEEK'
                    ? t.dateFilterThisWeek || 'Linggong Ito'
                    : t.dateFilterThisMonth || 'Buwang Ito';

                return (
                  <Pressable
                    key={df}
                    style={[styles.datePill, active && styles.datePillActive]}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setDateFilter(df);
                    }}
                    hitSlop={6}
                  >
                    <Text style={[styles.datePillText, active && styles.datePillTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* List Header Count */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listCountText}>
            {filteredActivities.length} {filteredActivities.length === 1 ? 'record' : 'records'}
          </Text>
        </View>

        {/* Audit Log Card Items */}
        {filteredActivities.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="time-outline" size={36} color="#0D7A52" />
            </View>
            <Text style={styles.emptyTitle}>{t.emptyHistoryTitle || 'Walang Tala'}</Text>
            <Text style={styles.emptySub}>
              {t.emptyHistorySub || 'Walang nahanap na aktibidad sa napiling filter at sakop ng petsa.'}
            </Text>
          </View>
        ) : (
          filteredActivities.map((item) => {
            const product = item.productId ? productMap.get(item.productId) : undefined;
            const fallbackVisual: ProductVisual = {
              shortLabel: item.title.slice(0, 3).toUpperCase(),
              subLabel: 'ITEM',
              bgColor: '#0D7A52',
              accentColor: '#10B981',
              textColor: '#FFFFFF',
              shape: 'POUCH',
            };

            const isProduct = item.category === 'PRODUCT';
            const isExpense = item.category === 'EXPENSE';
            const isPositive = (item.quantityDelta ?? 0) > 0;

            return (
              <View key={item.id} style={styles.logCard}>
                <View style={styles.cardHeader}>
                  {/* Left: Thumbnail & Name / Title */}
                  <View style={styles.cardLeft}>
                    {isExpense ? (
                      <View
                        style={[
                          styles.expenseIconCircle,
                          {
                            backgroundColor: item.badgeBg,
                            borderColor: item.badgeBorder,
                          },
                        ]}
                      >
                        <Ionicons name={item.icon} size={20} color={item.badgeColor} />
                      </View>
                    ) : (
                      <ProductThumbnail
                        visual={product?.visual ?? fallbackVisual}
                        imageUri={product?.imageUri}
                        size="sm"
                      />
                    )}
                    <View style={styles.cardNameCol}>
                      <Text style={styles.productNameText} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.subtitle ? (
                        <Text style={styles.cardSubtitleText} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      ) : null}
                      <View style={styles.timestampRow}>
                        <Ionicons name="time-outline" size={12} color="#6B7280" style={{ marginRight: 3 }} />
                        <Text style={styles.timestampText}>{formatTimestamp(item.timestampMs)}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Right: Quantity Delta or Expense Amount */}
                  <View style={styles.deltaCol}>
                    {isExpense ? (
                      <Text
                        style={[
                          styles.deltaText,
                          item.activityType === 'GASTOS' ? styles.deltaNegative : styles.deltaPositive,
                        ]}
                      >
                        {item.activityType === 'GASTOS' ? '-' : '+'}₱{item.amountPhp?.toFixed(2)}
                      </Text>
                    ) : isProduct ? (
                      item.quantityDelta && item.quantityDelta !== 0 ? (
                        <Text
                          style={[
                            styles.deltaText,
                            item.quantityDelta > 0 ? styles.deltaPositive : styles.deltaNegative,
                          ]}
                        >
                          {item.quantityDelta > 0 ? `+${item.quantityDelta}` : `${item.quantityDelta}`}
                        </Text>
                      ) : (
                        <Ionicons name="checkmark-circle-outline" size={20} color="#059669" />
                      )
                    ) : (
                      <Text
                        style={[
                          styles.deltaText,
                          isPositive ? styles.deltaPositive : styles.deltaNegative,
                        ]}
                      >
                        {isPositive ? `+${item.quantityDelta}` : `${item.quantityDelta}`}
                      </Text>
                    )}
                    <Text style={styles.deltaUnit}>{isExpense ? 'cash' : 'units'}</Text>
                  </View>
                </View>

                {/* Card Footer Details */}
                <View style={styles.cardFooter}>
                  {/* Activity Badge */}
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor: item.badgeBg,
                        borderColor: item.badgeBorder,
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={12}
                      color={item.badgeColor}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.typeBadgeText, { color: item.badgeColor }]}>
                      {item.badgeLabel}
                    </Text>
                  </View>

                  {/* Stock Progression (if stock was tracked) */}
                  {item.previousStock !== undefined && item.resultingStock !== undefined ? (
                    <View style={styles.progressionBox}>
                      <Text style={styles.progressionText}>
                        Stock: <Text style={styles.progressionBold}>{item.previousStock}</Text>
                        {'  '}→{'  '}
                        <Text style={styles.progressionBold}>{item.resultingStock}</Text>
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Reason Note / Audit Remarks */}
                {item.reason ? (
                  <View style={styles.noteContainer}>
                    <Text style={styles.noteText} numberOfLines={3}>
                      💬 {item.reason}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Interactive Date Range Calendar Modal */}
      <DateRangeCalendarModal
        visible={dateFilterModalVisible}
        currentRange={customDateRange}
        availableYears={availableYears}
        title="Salain ang History ayon sa Petsa"
        subtitle="Pumili ng preset o sariling sakop ng petsa sa kalendaryo"
        onApply={(range) => {
          setCustomDateRange(range);
          setDateFilterModalVisible(false);
        }}
        onClose={() => setDateFilterModalVisible(false)}
      />
    </ScreenSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#F0FDF4',
    marginRight: 10,
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#064E3B',
  },
  headerSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  shareBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#F0FDF4',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiCardStockIn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  kpiIconWrapperStockIn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiValueStockIn: {
    fontSize: 15,
    fontWeight: '800',
    color: '#065F46',
  },
  kpiCardSold: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  kpiIconWrapperSold: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiValueSold: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E40AF',
  },
  kpiCardShrinkage: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  kpiIconWrapperShrinkage: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiValueShrinkage: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
  },
  kpiSubLoss: {
    fontSize: 9,
    color: '#B91C1C',
    fontWeight: '700',
    marginTop: 2,
  },
  kpiCardExpense: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FFEDD5',
  },
  kpiIconWrapperExpense: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiValueExpense: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C2410C',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4B5563',
    marginTop: 2,
    textAlign: 'center',
  },
  calendarCardWrapper: {
    marginBottom: 12,
  },
  calendarCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  calendarCardActive: {
    borderColor: '#0D7A52',
    backgroundColor: '#F0FDF4',
  },
  calendarLeftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  calendarLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  calendarValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 1,
  },
  calendarValueTextActive: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  clearCalendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  clearCalendarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D7A52',
  },
  openCalendarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  openCalendarPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D7A52',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
  },
  filterPillSection: {
    marginBottom: 10,
  },
  filterPillContent: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  categoryPillActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#0D7A52',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryPillTextActive: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  typePillActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  typePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  datePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  datePillActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  datePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
  },
  datePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listHeaderRow: {
    marginBottom: 8,
  },
  listCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  expenseIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  cardNameCol: {
    marginLeft: 10,
    flex: 1,
  },
  productNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  cardSubtitleText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  timestampText: {
    fontSize: 11,
    color: '#6B7280',
  },
  deltaCol: {
    alignItems: 'flex-end',
  },
  deltaText: {
    fontSize: 15,
    fontWeight: '800',
  },
  deltaPositive: {
    color: '#059669',
  },
  deltaNegative: {
    color: '#DC2626',
  },
  deltaUnit: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressionBox: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  progressionText: {
    fontSize: 11,
    color: '#4B5563',
  },
  progressionBold: {
    fontWeight: '700',
    color: '#111827',
  },
  noteContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noteText: {
    fontSize: 12,
    color: '#475569',
    fontStyle: 'italic',
  },
});
