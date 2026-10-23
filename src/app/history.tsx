// src/app/history.tsx — Screen: Inventory Stock Movement & Audit Log
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Share,
  Platform,
} from 'react-native';
import { ScreenSafeAreaView } from '@/presentation/components/ScreenSafeAreaView';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { getTranslations } from '@/presentation/localization/i18n';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';
import { StockMovementRecord } from '@/application/TindahanStoreService';
import { Money } from '@/domain/value-objects/Money';
import { ProductVisual } from '@/domain/entities/Product';

type MovementFilter =
  | 'ALL'
  | 'RESTOCK'
  | 'SALE'
  | 'HOME_USE'
  | 'DAMAGED_EXPIRED'
  | 'UNPACK_TINGI'
  | 'RETURN';

type DateFilter = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH';

export default function StockMovementHistoryScreen() {
  const router = useRouter();
  const { stockMovements, products, settings } = useTindahanStore();
  const t = getTranslations(settings?.language);

  const [searchQuery, setSearchQuery] = useState('');
  const [movementFilter, setMovementFilter] = useState<MovementFilter>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');

  // Fast Product Lookup Map
  const productMap = useMemo(() => {
    const map = new Map<string, (typeof products)[0]>();
    for (const p of products) {
      map.set(p.id, p);
    }
    return map;
  }, [products]);

  // Date Filtering Helpers
  const filteredMovements = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const cleanQuery = searchQuery.trim().toLowerCase();

    return stockMovements.filter((item) => {
      // 1. Movement Type Filter
      if (movementFilter !== 'ALL' && item.movementType !== movementFilter) {
        return false;
      }

      // 2. Date Filter
      const itemTime = new Date(item.createdAt).getTime();
      if (dateFilter === 'TODAY' && itemTime < todayStart) {
        return false;
      }
      if (dateFilter === 'YESTERDAY' && (itemTime < yesterdayStart || itemTime >= todayStart)) {
        return false;
      }
      if (dateFilter === 'THIS_WEEK' && itemTime < weekStart) {
        return false;
      }
      if (dateFilter === 'THIS_MONTH' && itemTime < monthStart) {
        return false;
      }

      // 3. Search Query Filter
      if (cleanQuery) {
        const matchesName = item.productName.toLowerCase().includes(cleanQuery);
        const matchesReason = item.reason?.toLowerCase().includes(cleanQuery);
        const matchesRef = item.referenceId?.toLowerCase().includes(cleanQuery);
        if (!matchesName && !matchesReason && !matchesRef) {
          return false;
        }
      }

      return true;
    });
  }, [stockMovements, movementFilter, dateFilter, searchQuery]);

  // KPI Computations based on current filter results
  const kpis = useMemo(() => {
    let stockInUnits = 0;
    let soldUnits = 0;
    let shrinkageUnits = 0;
    let shrinkageCentavos = 0;

    for (const mov of filteredMovements) {
      if (mov.movementType === 'RESTOCK' || mov.movementType === 'UNPACK_TINGI' || mov.movementType === 'RETURN') {
        if (mov.quantityDelta > 0) {
          stockInUnits += mov.quantityDelta;
        }
      } else if (mov.movementType === 'SALE') {
        soldUnits += Math.abs(mov.quantityDelta);
      } else if (mov.movementType === 'HOME_USE' || mov.movementType === 'DAMAGED_EXPIRED') {
        const absQty = Math.abs(mov.quantityDelta);
        shrinkageUnits += absQty;
        const unitCostCentavos = Math.round((mov.unitCostPhp || 0) * 100);
        shrinkageCentavos += unitCostCentavos * absQty;
      }
    }

    const shrinkageLossPhp = shrinkageCentavos / 100;

    return {
      stockInUnits: Math.round(stockInUnits * 100) / 100,
      soldUnits: Math.round(soldUnits * 100) / 100,
      shrinkageUnits: Math.round(shrinkageUnits * 100) / 100,
      formattedShrinkageLoss: Money.fromPhp(shrinkageLossPhp).format(),
    };
  }, [filteredMovements]);

  // Share Audit Report Handler
  const handleShareReport = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const dateLabel = new Date().toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const lines = [
      `📊 ${settings.storeName.toUpperCase()} — INVENTORY AUDIT TRAIL`,
      `📅 Petsa: ${dateLabel}`,
      `---------------------------------`,
      `📦 Pumasok na Stock: +${kpis.stockInUnits} units`,
      `🛒 Naibenta sa POS: -${kpis.soldUnits} units`,
      `⚠️ Kupit at Sira (Shrinkage): -${kpis.shrinkageUnits} units (Halaga: ${kpis.formattedShrinkageLoss})`,
      `---------------------------------`,
      `HULING PAGGALAW NG STOCK:`,
    ];

    const previewItems = filteredMovements.slice(0, 15);
    for (const item of previewItems) {
      const sign = item.quantityDelta > 0 ? '+' : '';
      const timeStr = new Date(item.createdAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      lines.push(
        `• [${item.movementType}] ${item.productName}: ${sign}${item.quantityDelta} pcs (${item.previousStock} → ${item.resultingStock}) ${timeStr}`
      );
    }

    if (filteredMovements.length > 15) {
      lines.push(`... at ${filteredMovements.length - 15} pang iba.`);
    }

    lines.push(`\nInulat mula sa ${settings.storeName} Tindahan Helper POS`);

    try {
      await Share.share({
        message: lines.join('\n'),
        title: `${settings.storeName} Stock Audit Report`,
      });
    } catch {
      // ignored
    }
  }, [settings.storeName, kpis, filteredMovements]);

  // Movement Type Badge Configuration
  const getBadgeConfig = (type: StockMovementRecord['movementType']) => {
    switch (type) {
      case 'RESTOCK':
        return {
          label: t.movementRestock,
          bgColor: '#ECFDF5',
          textColor: '#065F46',
          borderColor: '#A7F3D0',
          icon: 'arrow-down-circle-outline' as const,
        };
      case 'SALE':
        return {
          label: t.movementSale,
          bgColor: '#EFF6FF',
          textColor: '#1E40AF',
          borderColor: '#BFDBFE',
          icon: 'cart-outline' as const,
        };
      case 'HOME_USE':
        return {
          label: t.movementHomeUse,
          bgColor: '#FFFBEB',
          textColor: '#92400E',
          borderColor: '#FDE68A',
          icon: 'home-outline' as const,
        };
      case 'DAMAGED_EXPIRED':
        return {
          label: t.movementDamagedExpired,
          bgColor: '#FEF2F2',
          textColor: '#991B1B',
          borderColor: '#FECACA',
          icon: 'alert-circle-outline' as const,
        };
      case 'UNPACK_TINGI':
        return {
          label: t.movementUnpackTingi,
          bgColor: '#FAF5FF',
          textColor: '#6B21A8',
          borderColor: '#E9D5FF',
          icon: 'cube-outline' as const,
        };
      case 'RETURN':
        return {
          label: t.movementReturn,
          bgColor: '#F0FDFA',
          textColor: '#115E59',
          borderColor: '#99F6E4',
          icon: 'refresh-circle-outline' as const,
        };
      default:
        return {
          label: type,
          bgColor: '#F3F4F6',
          textColor: '#374151',
          borderColor: '#E5E7EB',
          icon: 'ellipse-outline' as const,
        };
    }
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
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
      return isoStr;
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
          <Text style={styles.headerTitle}>{t.historyTitle}</Text>
          <Text style={styles.headerSub}>{t.historySub}</Text>
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
              <Ionicons name="arrow-down" size={16} color="#065F46" />
            </View>
            <Text style={styles.kpiValueStockIn}>+{kpis.stockInUnits}</Text>
            <Text style={styles.kpiLabel}>{t.kpiStockIn}</Text>
          </View>

          {/* 2. Sold */}
          <View style={[styles.kpiCard, styles.kpiCardSold]}>
            <View style={styles.kpiIconWrapperSold}>
              <Ionicons name="cart" size={16} color="#1E40AF" />
            </View>
            <Text style={styles.kpiValueSold}>-{kpis.soldUnits}</Text>
            <Text style={styles.kpiLabel}>{t.kpiStockOut}</Text>
          </View>

          {/* 3. Shrinkage */}
          <View style={[styles.kpiCard, styles.kpiCardShrinkage]}>
            <View style={styles.kpiIconWrapperShrinkage}>
              <Ionicons name="warning" size={16} color="#991B1B" />
            </View>
            <Text style={styles.kpiValueShrinkage}>-{kpis.shrinkageUnits}</Text>
            <Text style={styles.kpiLabel}>{t.kpiShrinkage}</Text>
            {kpis.shrinkageUnits > 0 ? (
              <Text style={styles.kpiSubLoss}>{kpis.formattedShrinkageLoss}</Text>
            ) : null}
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t.historySearchPlaceholder}
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

        {/* Date Filter Pills */}
        <View style={styles.filterPillSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillContent}>
            {(['ALL', 'TODAY', 'YESTERDAY', 'THIS_WEEK', 'THIS_MONTH'] as DateFilter[]).map((df) => {
              const active = dateFilter === df;
              const label =
                df === 'ALL'
                  ? t.dateFilterAll
                  : df === 'TODAY'
                  ? t.dateFilterToday
                  : df === 'YESTERDAY'
                  ? t.dateFilterYesterday
                  : df === 'THIS_WEEK'
                  ? t.dateFilterThisWeek
                  : t.dateFilterThisMonth;

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
                  <Text style={[styles.datePillText, active && styles.datePillTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Movement Type Filter Chips */}
        <View style={styles.filterPillSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillContent}>
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
                  ? t.filterAll
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
                  <Text style={[styles.typePillText, active && styles.typePillTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* List Header Count */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.listCountText}>
            {filteredMovements.length} {filteredMovements.length === 1 ? 'record' : 'records'}
          </Text>
        </View>

        {/* Audit Log Card Items */}
        {filteredMovements.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="time-outline" size={36} color="#0D7A52" />
            </View>
            <Text style={styles.emptyTitle}>{t.emptyHistoryTitle}</Text>
            <Text style={styles.emptySub}>{t.emptyHistorySub}</Text>
          </View>
        ) : (
          filteredMovements.map((mov) => {
            const product = productMap.get(mov.productId);
            const badge = getBadgeConfig(mov.movementType);
            const isPositive = mov.quantityDelta > 0;
            const fallbackVisual: ProductVisual = {
              shortLabel: mov.productName.slice(0, 3).toUpperCase(),
              subLabel: 'ITEM',
              bgColor: '#0D7A52',
              accentColor: '#10B981',
              textColor: '#FFFFFF',
              shape: 'POUCH',
            };

            return (
              <View key={mov.id} style={styles.logCard}>
                <View style={styles.cardHeader}>
                  {/* Left: Thumbnail & Name */}
                  <View style={styles.cardLeft}>
                    <ProductThumbnail
                      visual={product?.visual ?? fallbackVisual}
                      imageUri={product?.imageUri}
                      size="sm"
                    />
                    <View style={styles.cardNameCol}>
                      <Text style={styles.productNameText} numberOfLines={1}>
                        {mov.productName}
                      </Text>
                      <View style={styles.timestampRow}>
                        <Ionicons name="time-outline" size={12} color="#6B7280" style={{ marginRight: 3 }} />
                        <Text style={styles.timestampText}>{formatTimestamp(mov.createdAt)}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Right: Quantity Delta Badge */}
                  <View style={styles.deltaCol}>
                    <Text
                      style={[
                        styles.deltaText,
                        isPositive ? styles.deltaPositive : styles.deltaNegative,
                      ]}
                    >
                      {isPositive ? `+${mov.quantityDelta}` : `${mov.quantityDelta}`}
                    </Text>
                    <Text style={styles.deltaUnit}>units</Text>
                  </View>
                </View>

                {/* Card Details & Metadata */}
                <View style={styles.cardFooter}>
                  {/* Movement Type Pill */}
                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor: badge.bgColor,
                        borderColor: badge.borderColor,
                      },
                    ]}
                  >
                    <Ionicons
                      name={badge.icon}
                      size={12}
                      color={badge.textColor}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.typeBadgeText, { color: badge.textColor }]}>
                      {badge.label}
                    </Text>
                  </View>

                  {/* Stock Progression */}
                  <View style={styles.progressionBox}>
                    <Text style={styles.progressionText}>
                      {t.previousStockLabel}: <Text style={styles.progressionBold}>{mov.previousStock}</Text>
                      {'  '}→{'  '}
                      {t.resultingStockLabel}: <Text style={styles.progressionBold}>{mov.resultingStock}</Text>
                    </Text>
                  </View>
                </View>

                {/* Reason Note / Reference ID */}
                {mov.reason || mov.referenceId ? (
                  <View style={styles.noteContainer}>
                    <Text style={styles.noteText} numberOfLines={2}>
                      💬 {mov.reason || mov.referenceId}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
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
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  shareBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
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
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  kpiCardStockIn: {
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  kpiCardSold: {
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
  },
  kpiCardShrinkage: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  kpiIconWrapperStockIn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiIconWrapperSold: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiIconWrapperShrinkage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiValueStockIn: {
    fontSize: 15,
    fontWeight: '800',
    color: '#065F46',
  },
  kpiValueSold: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E40AF',
  },
  kpiValueShrinkage: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  kpiSubLoss: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 1,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    padding: 0,
  },
  filterPillSection: {
    marginBottom: 10,
  },
  filterPillContent: {
    gap: 8,
    paddingVertical: 2,
  },
  datePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  datePillActive: {
    backgroundColor: '#064E3B',
    borderColor: '#064E3B',
  },
  datePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  datePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  typePillActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  typePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  typePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  listCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  cardNameCol: {
    flex: 1,
    marginLeft: 10,
  },
  productNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
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
    fontSize: 16,
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
    fontWeight: '600',
    color: '#9CA3AF',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
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
    color: '#6B7280',
  },
  progressionBold: {
    fontWeight: '700',
    color: '#1F2937',
  },
  noteContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  noteText: {
    fontSize: 11,
    color: '#4B5563',
    lineHeight: 15,
  },
});
