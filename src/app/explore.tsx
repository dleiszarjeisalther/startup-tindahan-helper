// src/app/explore.tsx — Feature C: 100% Automated Seasonal Product Forecast Dashboard
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { ScreenSafeAreaView } from '@/presentation/components/ScreenSafeAreaView';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { seasonalForecastEngine } from '@/infrastructure/container';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { getTranslations, Translations } from '@/presentation/localization/i18n';
import { FloatingToast } from '@/presentation/components/FloatingToast';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';
import { ProductDTO } from '@/domain/entities/Product';
import { SeasonalForecastResult } from '@/domain/strategies/SeasonalForecastEngine';

function getLocalizedMonths(isEnglish: boolean) {
  if (isEnglish) {
    return [
      { month: 1, name: 'January', short: 'Jan' },
      { month: 2, name: 'February', short: 'Feb' },
      { month: 3, name: 'March', short: 'Mar' },
      { month: 4, name: 'April', short: 'Apr' },
      { month: 5, name: 'May', short: 'May' },
      { month: 6, name: 'June', short: 'Jun' },
      { month: 7, name: 'July', short: 'Jul' },
      { month: 8, name: 'August', short: 'Aug' },
      { month: 9, name: 'September', short: 'Sep' },
      { month: 10, name: 'October', short: 'Oct' },
      { month: 11, name: 'November', short: 'Nov' },
      { month: 12, name: 'December', short: 'Dec' },
    ];
  }
  return [
    { month: 1, name: 'Enero', short: 'Ene' },
    { month: 2, name: 'Pebrero', short: 'Peb' },
    { month: 3, name: 'Marso', short: 'Mar' },
    { month: 4, name: 'Abril', short: 'Abr' },
    { month: 5, name: 'Mayo', short: 'May' },
    { month: 6, name: 'Hunyo', short: 'Hun' },
    { month: 7, name: 'Hulyo', short: 'Hul' },
    { month: 8, name: 'Agosto', short: 'Ago' },
    { month: 9, name: 'Setyembre', short: 'Set' },
    { month: 10, name: 'Oktubre', short: 'Okt' },
    { month: 11, name: 'Nobyembre', short: 'Nob' },
    { month: 12, name: 'Disyembre', short: 'Dis' },
  ];
}

function getPhilippineSeasonInfo(targetMonth: number, t: Translations) {
  if (targetMonth === 11 || targetMonth === 12) {
    return {
      title: t.seasonChristmasTitle,
      sub: t.seasonChristmasSub,
      badgeColor: '#FEE2E2',
      textColor: '#991B1B',
    };
  }
  if (targetMonth >= 3 && targetMonth <= 5) {
    return {
      title: t.seasonSummerTitle,
      sub: t.seasonSummerSub,
      badgeColor: '#FEF3C7',
      textColor: '#92400E',
    };
  }
  if (targetMonth === 6 || targetMonth === 7) {
    return {
      title: t.seasonSchoolTitle,
      sub: t.seasonSchoolSub,
      badgeColor: '#E0E7FF',
      textColor: '#3730A3',
    };
  }
  if (targetMonth >= 8 && targetMonth <= 10) {
    return {
      title: t.seasonRainyTitle,
      sub: t.seasonRainySub,
      badgeColor: '#E0F2FE',
      textColor: '#075985',
    };
  }
  return {
    title: t.seasonDefaultTitle,
    sub: t.seasonDefaultSub,
    badgeColor: '#F1F5F9',
    textColor: '#334155',
  };
}

export default function SeasonalForecastScreen() {
  const router = useRouter();
  const {
    products,
    settings,
    adjustInventoryStock,
    getMonthlySalesHistory,
    updateSettings,
  } = useTindahanStore();

  const t = getTranslations(settings.language);
  const isEnglish = settings.language === 'English';
  const localizedMonths = getLocalizedMonths(isEnglish);

  const currentMonth = new Date().getMonth() + 1; // 1-12
  const defaultTargetMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  const [selectedTargetMonth, setSelectedTargetMonth] = useState<number>(defaultTargetMonth);
  const [restockToast, setRestockToast] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<{
    forecast: SeasonalForecastResult;
    product: ProductDTO;
  } | null>(null);

  // Compute forecasts for all SQLite products automatically without manual user input
  const allForecasts = products.map((p) => {
    const history = getMonthlySalesHistory(p.id);
    const forecast = seasonalForecastEngine.evaluateProductSeasonality(
      p.id,
      p.name,
      history,
      selectedTargetMonth,
      p.stockCount
    );
    return { product: p, forecast };
  });

  const seasonInfo = getPhilippineSeasonInfo(selectedTargetMonth, t);
  const totalRecommendedRestockUnits = allForecasts.reduce(
    (sum, item) => sum + item.forecast.recommendedRestockQty,
    0
  );

  const seasonPresets = [
    {
      id: 'next',
      month: defaultTargetMonth,
      label: t.seasonPresetNext(localizedMonths[defaultTargetMonth - 1]?.short ?? ''),
    },
    { id: 'pasko', month: 12, label: t.seasonPresetChristmas },
    { id: 'summer', month: 4, label: t.seasonPresetSummer },
    { id: 'school', month: 7, label: t.seasonPresetSchool },
    { id: 'rainy', month: 9, label: t.seasonPresetRainy },
  ];

  // Helper to render horizontal sales chart bars in modal
  const renderHorizontalChartBars = () => {
    if (!detailItem) return null;
    const history = getMonthlySalesHistory(detailItem.product.id);

    // Find highest units sold in any month for proportional scaling
    const maxUnits = Math.max(
      1,
      ...localizedMonths.map((m) => {
        const row = history.find((h) => h.month === m.month);
        return row ? Math.max(0, row.grossUnitsSold - row.voidedUnits - row.returnedChangedMindUnits) : 0;
      })
    );

    return localizedMonths.map((m) => {
      const row = history.find((h) => h.month === m.month);
      const units = row
        ? Math.max(0, row.grossUnitsSold - row.voidedUnits - row.returnedChangedMindUnits)
        : 0;

      const isTarget = m.month === selectedTargetMonth;
      const barPercent = Math.min(100, Math.max(units > 0 ? 12 : 3, Math.round((units / maxUnits) * 100)));

      return (
        <View key={m.month} style={styles.chartBarRow}>
          <View style={styles.chartLabelCol}>
            <Text style={[styles.chartMonthText, isTarget ? styles.chartMonthTextTarget : null]}>
              {m.short}
            </Text>
            {isTarget ? <Text style={styles.chartTargetPill}>{t.chartTargetTag}</Text> : null}
          </View>
          <View style={styles.chartTrackCol}>
            <View style={styles.chartTrack}>
              <View
                style={[
                  styles.chartFill,
                  { width: `${barPercent}%` },
                  isTarget ? styles.chartFillTarget : units > 0 ? styles.chartFillActive : styles.chartFillZero,
                ]}
              />
            </View>
          </View>
          <Text style={[styles.chartUnitText, isTarget ? styles.chartUnitTextTarget : null]}>
            {t.unitsSoldLabel(units)}
          </Text>
        </View>
      );
    });
  };

  return (
    <ScreenSafeAreaView style={styles.safeArea}>
      <FloatingToast
        message={restockToast}
        type="success"
        onDismiss={() => setRestockToast(null)}
      />

      {/* Screen Header */}
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/sales');
            }
          }}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle}>{t.seasonalForecastTitle}</Text>
          <Text style={styles.headerSubtitle}>
            {t.seasonalForecastSub}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Automated Seasonal Intelligence Banner */}
        <View style={[styles.seasonBannerCard, { backgroundColor: seasonInfo.badgeColor }]}>
          <View style={styles.seasonBannerHeader}>
            <Text style={[styles.seasonBannerTitle, { color: seasonInfo.textColor }]}>
              {seasonInfo.title}
            </Text>
            <View style={styles.autoTag}>
              <Text style={styles.autoTagText}>{t.seasonAutoBadge}</Text>
            </View>
          </View>
          <Text style={[styles.seasonBannerSub, { color: seasonInfo.textColor }]}>
            {seasonInfo.sub}
          </Text>
        </View>

        {/* 1-Tap Target Season Switcher Pills */}
        <View style={styles.seasonSwitcherCard}>
          <Text style={styles.switcherLabel}>
            {t.seasonPromptLabel}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.seasonPillsRow}
          >
            {seasonPresets.map((preset) => {
              const active = selectedTargetMonth === preset.month;
              return (
                <Pressable
                  key={preset.id}
                  style={[styles.seasonPill, active ? styles.seasonPillActive : null]}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedTargetMonth(preset.month);
                  }}
                >
                  <Text style={[styles.seasonPillText, active ? styles.seasonPillTextActive : null]}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Wholesale Budget & Restock Summary */}
        <View style={styles.budgetCard}>
          <View style={styles.budgetHeader}>
            <View>
              <Text style={styles.budgetTitle}>💰 {t.wholesaleBudgetSectionTitle}</Text>
              <Text style={styles.budgetSub}>
                {t.totalNeededToRestock(totalRecommendedRestockUnits)}
              </Text>
            </View>
            <Text style={styles.budgetAmount}>₱{settings.wholesaleBudgetPhp}</Text>
          </View>
          <View style={styles.budgetPills}>
            {[1500, 3000, 5000].map((b) => {
              const active = settings.wholesaleBudgetPhp === b;
              return (
                <Pressable
                  key={b}
                  style={[styles.budgetPill, active ? styles.budgetPillActive : null]}
                  onPress={() => updateSettings({ wholesaleBudgetPhp: b })}
                >
                  <Text
                    style={[
                      styles.budgetPillText,
                      active ? styles.budgetPillTextActive : null,
                    ]}
                  >
                    {t.budgetPillLabel(b)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{t.emptyInventoryTitle}</Text>
            <Text style={styles.emptySub}>
              {t.emptyInventorySub}
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => router.push('/inventory')}
            >
              <Text style={styles.emptyBtnText}>{t.addProductsInventoryBtn}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.listHeaderRow}>
              <Text style={styles.listSectionTitle}>
                {t.recommendedRestockHeader(allForecasts.length)}
              </Text>
              <Text style={styles.listSectionSub}>
                {t.tapToViewChartHint}
              </Text>
            </View>

            {/* Dynamic Forecast Cards with ProductThumbnail */}
            {allForecasts.map(({ product: p, forecast: fc }) => {
              const historyCount = getMonthlySalesHistory(fc.productId).length;
              const is24m = fc.confidenceTier === 'VERIFIED_RECURRING_24M_PLUS';
              const ordinaryPct =
                fc.forecastedUnits > 0
                  ? Math.min(
                      100,
                      Math.max(
                        10,
                        Math.round(
                          (fc.ordinaryMonthlyAverage / fc.forecastedUnits) * 100
                        )
                      )
                    )
                  : 20;

              const targetMonthName = localizedMonths[fc.targetMonth - 1]?.short ?? `Month #${fc.targetMonth}`;

              return (
                <Pressable
                  key={fc.productId}
                  style={styles.card}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setDetailItem({ forecast: fc, product: p });
                  }}
                >
                  {/* Top Row: Thumbnail + Title + Badges */}
                  <View style={styles.cardHeaderRow}>
                    <ProductThumbnail
                      visual={p.visual}
                      imageUri={p.imageUri}
                      size="md"
                    />
                    <View style={styles.cardInfoCol}>
                      <View style={styles.badgeRow}>
                        <View style={styles.peakBadge}>
                          <Text style={styles.peakBadgeText}>
                            🔥 {fc.peakVsOrdinaryMultiplier}× {t.vsOrdinaryMonths}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.confidenceBadge,
                            is24m ? styles.confGreen : styles.confBlue,
                          ]}
                        >
                          <Text
                            style={[
                              styles.confidenceText,
                              is24m ? styles.confTextGreen : styles.confTextBlue,
                            ]}
                          >
                            {historyCount > 0 ? t.monthsHistoryCount(historyCount) : t.categoryPriorTag}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.productTitle} numberOfLines={2}>
                        {fc.productName}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.explanation} numberOfLines={2}>
                    {fc.explanation}
                  </Text>

                  {/* Comparison Bar */}
                  <View style={styles.comparisonBox}>
                    <View style={styles.barGroup}>
                      <Text style={styles.barLabel}>
                        {t.ordinarySalesAvgLabel(fc.ordinaryMonthlyAverage)}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[styles.barFillOrdinary, { width: `${ordinaryPct}%` }]}
                        />
                      </View>
                    </View>

                    <View style={styles.barGroup}>
                      <Text style={styles.barLabelPeak}>
                        {t.expectedInMonthLabel(targetMonthName, fc.forecastedUnits)}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFillPeak,
                            { width: fc.forecastedUnits > 0 ? '100%' : '10%' },
                          ]}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Metrics Row */}
                  <View style={styles.metricsRow}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>{t.seasonMultiplierLabel}</Text>
                      <Text style={styles.metricValue}>{fc.seasonalIndex}×</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>{t.currentStockLabel}</Text>
                      <Text style={styles.metricValue}>{fc.currentStock}</Text>
                    </View>
                    <View style={styles.metricItemHighlight}>
                      <Text style={styles.metricLabelHighlight}>{t.recommendedLabel}</Text>
                      <Text style={styles.metricValueHighlight}>
                        +{fc.recommendedRestockQty}
                      </Text>
                    </View>
                  </View>

                  {/* 1-Tap Restock Action on Card */}
                  {fc.recommendedRestockQty > 0 ? (
                    <Pressable
                      style={styles.restockActionBtn}
                      onPress={async () => {
                        Haptics.notificationAsync(
                          Haptics.NotificationFeedbackType.Success
                        ).catch(() => {});
                        await adjustInventoryStock({
                          productId: fc.productId,
                          mode: 'RESTOCK',
                          quantity: fc.recommendedRestockQty,
                        });
                        setRestockToast(
                          t.restockSuccessToast(fc.recommendedRestockQty, fc.productName)
                        );
                      }}
                    >
                      <Text style={styles.restockActionText}>
                        {t.restockActionBtnLabel(fc.recommendedRestockQty)}
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.inStockBadge}>
                      <Text style={styles.inStockBadgeText}>
                        {t.inStockSufficientBadge(fc.currentStock)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.tapToViewRow}>
                    <Text style={styles.tapToViewText}>
                      {t.tapToViewChartHint}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Tap-to-View Modal with 12-Month Horizontal Sales Bar Chart */}
      <Modal
        visible={!!detailItem}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setDetailItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                {detailItem ? (
                  <ProductThumbnail
                    visual={detailItem.product.visual}
                    imageUri={detailItem.product.imageUri}
                    size="lg"
                  />
                ) : null}
                <View style={styles.modalHeaderTextCol}>
                  <Text style={styles.modalTitle} numberOfLines={2}>
                    {detailItem?.product.name}
                  </Text>
                  <Text style={styles.modalBarcode}>
                    Barcode: {detailItem?.product.barcode}
                  </Text>
                  <Text style={styles.modalStockLabel}>
                    {t.currentStockLabel}: <Text style={styles.boldDark}>{detailItem?.product.stockCount} {t.unitsSoldLabel(detailItem?.product.stockCount ?? 0)}</Text>
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setDetailItem(null)}
                hitSlop={12}
              >
                <Ionicons name="close" size={24} color="#475569" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {/* Season Explanation Card */}
              <View style={styles.modalExplanationCard}>
                <Text style={styles.modalExplTitle}>
                  {t.modalProductAnalysisTitle}
                </Text>
                <Text style={styles.modalExplText}>
                  {detailItem?.forecast.explanation}
                </Text>
                <View style={styles.modalKpiRow}>
                  <View style={styles.modalKpiItem}>
                    <Text style={styles.modalKpiLabel}>{t.ordinarySalesAvgLabel(detailItem?.forecast.ordinaryMonthlyAverage ?? 0).split(':')[0]}</Text>
                    <Text style={styles.modalKpiVal}>
                      {detailItem?.forecast.ordinaryMonthlyAverage} {t.perMonthLabel}
                    </Text>
                  </View>
                  <View style={styles.modalKpiItem}>
                    <Text style={styles.modalKpiLabel}>{t.seasonMultiplierLabel}</Text>
                    <Text style={styles.modalKpiVal}>
                      {detailItem ? localizedMonths[detailItem.forecast.targetMonth - 1]?.short : ''} ({detailItem?.forecast.seasonalIndex}×)
                    </Text>
                  </View>
                  <View style={[styles.modalKpiItem, styles.modalKpiHighlight]}>
                    <Text style={styles.modalKpiLabelHighlight}>{t.recommendedLabel}</Text>
                    <Text style={styles.modalKpiValHighlight}>
                      +{detailItem?.forecast.recommendedRestockQty}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 12-Month Horizontal Bar Chart */}
              <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>
                  {t.modalChartTitle}
                </Text>
                <Text style={styles.chartSubtitle}>
                  {t.modalChartSub}
                </Text>

                <View style={styles.chartBarsContainer}>
                  {renderHorizontalChartBars()}
                </View>
              </View>
            </ScrollView>

            {/* Modal Bottom Action */}
            <View style={styles.modalFooter}>
              {detailItem && detailItem.forecast.recommendedRestockQty > 0 ? (
                <Pressable
                  style={styles.modalRestockBtn}
                  onPress={async () => {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success
                    ).catch(() => {});
                    await adjustInventoryStock({
                      productId: detailItem.product.id,
                      mode: 'RESTOCK',
                      quantity: detailItem.forecast.recommendedRestockQty,
                    });
                    setRestockToast(
                      t.restockSuccessToast(detailItem.forecast.recommendedRestockQty, detailItem.product.name)
                    );
                    setDetailItem(null);
                  }}
                >
                  <Text style={styles.modalRestockBtnText}>
                    {t.modalRestockBtnLabel(detailItem.forecast.recommendedRestockQty)}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.modalCloseDoneBtn}
                  onPress={() => setDetailItem(null)}
                >
                  <Text style={styles.modalCloseDoneBtnText}>
                    {t.modalStockSufficientCloseBtn}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScreenSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  headerRow: {
    backgroundColor: '#0D7A52',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#D1FAE5',
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 130,
  },
  seasonBannerCard: {
    borderRadius: 16,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  seasonBannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seasonBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  autoTag: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  autoTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D7A52',
  },
  seasonBannerSub: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  seasonSwitcherCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  switcherLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  seasonPillsRow: {
    gap: 8,
  },
  seasonPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  seasonPillActive: {
    backgroundColor: '#0D7A52',
  },
  seasonPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  seasonPillTextActive: {
    color: '#FFFFFF',
  },
  budgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  budgetAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D7A52',
  },
  budgetSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  budgetPills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  budgetPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  budgetPillActive: {
    backgroundColor: '#0D7A52',
  },
  budgetPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  budgetPillTextActive: {
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyBtn: {
    marginTop: 6,
    backgroundColor: '#0D7A52',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  listHeaderRow: {
    marginTop: 4,
    gap: 2,
  },
  listSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  listSectionSub: {
    fontSize: 11,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  cardInfoCol: {
    flex: 1,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  peakBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  peakBadgeText: {
    color: '#92400E',
    fontWeight: '800',
    fontSize: 10,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  confGreen: { backgroundColor: '#DCFCE7' },
  confBlue: { backgroundColor: '#DBEAFE' },
  confidenceText: {
    fontSize: 10,
    fontWeight: '800',
  },
  confTextGreen: { color: '#166534' },
  confTextBlue: { color: '#1E40AF' },
  productTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  explanation: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  comparisonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  barGroup: {
    gap: 3,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  barLabelPeak: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0D7A52',
  },
  barTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFillOrdinary: {
    height: '100%',
    backgroundColor: '#94A3B8',
    borderRadius: 4,
  },
  barFillPeak: {
    height: '100%',
    backgroundColor: '#0D7A52',
    borderRadius: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 8,
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricItemHighlight: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingVertical: 4,
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  metricLabelHighlight: {
    fontSize: 10,
    color: '#065F46',
    fontWeight: '700',
  },
  metricValueHighlight: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0D7A52',
    marginTop: 1,
  },
  restockActionBtn: {
    backgroundColor: '#0D7A52',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  restockActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  inStockBadge: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  inStockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7A52',
  },
  tapToViewRow: {
    alignItems: 'center',
    paddingTop: 2,
  },
  tapToViewText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284C7',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
    alignItems: 'center',
  },
  modalHeaderTextCol: {
    flex: 1,
    gap: 2,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalBarcode: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  modalStockLabel: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  boldDark: {
    fontWeight: '800',
    color: '#0D7A52',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalExplanationCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    marginBottom: 14,
  },
  modalExplTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D7A52',
  },
  modalExplText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  modalKpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  modalKpiItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalKpiHighlight: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  modalKpiLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  modalKpiVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  modalKpiLabelHighlight: {
    fontSize: 10,
    color: '#065F46',
    fontWeight: '700',
  },
  modalKpiValHighlight: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0D7A52',
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    marginBottom: 20,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  chartSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  chartBarsContainer: {
    gap: 8,
  },
  chartBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chartLabelCol: {
    width: 65,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chartMonthText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  chartMonthTextTarget: {
    color: '#C2410C',
    fontWeight: '900',
  },
  chartTargetPill: {
    fontSize: 8,
    fontWeight: '800',
    color: '#C2410C',
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  chartTrackCol: {
    flex: 1,
  },
  chartTrack: {
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    overflow: 'hidden',
  },
  chartFill: {
    height: '100%',
    borderRadius: 6,
  },
  chartFillTarget: {
    backgroundColor: '#EA580C',
  },
  chartFillActive: {
    backgroundColor: '#0D7A52',
  },
  chartFillZero: {
    backgroundColor: '#E2E8F0',
  },
  chartUnitText: {
    width: 75,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
  },
  chartUnitTextTarget: {
    color: '#EA580C',
    fontWeight: '900',
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  modalRestockBtn: {
    backgroundColor: '#0D7A52',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalRestockBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  modalCloseDoneBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseDoneBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
});
