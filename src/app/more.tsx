// src/app/more.tsx — Screen 6: Menu / Profile ("Juan's Store — Owner")
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
  Share,
} from 'react-native';
import { ScreenSafeAreaView } from '@/presentation/components/ScreenSafeAreaView';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { getTranslations } from '@/presentation/localization/i18n';
import {
  ConfirmationModal,
  ConfirmationType,
  ConfirmationModalDetail,
} from '@/presentation/components/ConfirmationModal';
import { GcashQrModal } from '@/presentation/components/GcashQrModal';
import { PrivacyPolicyModal } from '@/presentation/components/PrivacyPolicyModal';
import {
  DashboardAnalyticsEngine,
  DateRangeFilter,
  TrendBarPoint,
} from '@/domain/strategies/DashboardAnalyticsEngine';
import { DateRangeCalendarModal } from '@/presentation/components/DateRangeCalendarModal';
import { PinChallengeModal } from '@/presentation/components/PinChallengeModal';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';

interface ConfirmationState {
  type?: ConfirmationType;
  title: string;
  message: string;
  itemName?: string;
  details?: ConfirmationModalDetail[];
  confirmText?: string;
  cancelText?: string | null;
  onConfirm: () => void | Promise<void>;
}

export default function MenuProfileScreen() {
  const router = useRouter();
  const {
    settings,
    updateSettings,
    utangCustomers,
    transactions,
    products,
    cashDrawerAdjustments,
    isStoreSecurityEnabled,
    isStoreLocked,
  } = useTindahanStore();

  const t = getTranslations(settings?.language);

  const [activeSection, setActiveSection] = useState<
    'NONE' | 'SUBSCRIPTION' | 'HELP'
  >('NONE');
  const [showGcashQrModal, setShowGcashQrModal] = useState(false);
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationState | null>(null);

  // Analytics Dashboard state
  const [selectedPeriod, setSelectedPeriod] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [customDateRange, setCustomDateRange] = useState<DateRangeFilter | null>(null);
  const [dateFilterModalVisible, setDateFilterModalVisible] = useState(false);
  const [selectedTrendBar, setSelectedTrendBar] = useState<TrendBarPoint | null>(null);
  const [showProfit, setShowProfit] = useState(false);
  const [showTuboPinModal, setShowTuboPinModal] = useState(false);

  // Compute available transaction years for calendar picker
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

  // Instantiate OOP Analytics Engine
  const analyticsEngine = useMemo(() => {
    return new DashboardAnalyticsEngine(transactions, products, cashDrawerAdjustments);
  }, [transactions, products, cashDrawerAdjustments]);

  const currentFilter = customDateRange ?? selectedPeriod;
  const metrics = useMemo(() => analyticsEngine.computeMetrics(currentFilter), [analyticsEngine, currentFilter]);
  const trendBars = useMemo(() => analyticsEngine.getTrendBars(currentFilter), [analyticsEngine, currentFilter]);
  const topProducts = useMemo(() => analyticsEngine.getTopSellingProducts(currentFilter, 5), [analyticsEngine, currentFilter]);
  const paymentDist = useMemo(() => analyticsEngine.getPaymentDistribution(currentFilter), [analyticsEngine, currentFilter]);

  const handleOpenFeedback = async () => {
    const feedbackUrl = 'https://tindahanhelper.wuaze.com/feedback.php';
    setConfirmDialog({
      type: 'info',
      title: '💬 Mag-iwan ng Feedback & Mungkahi',
      message:
        'Kailangan ng aktibong internet connection (Wi-Fi o Mobile Data) para ma-access ang online feedback page ng Tindahan Helper.\n\nNais mo bang buksan ang browser?',
      confirmText: 'Magpatuloy',
      cancelText: 'Kanselahin',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await WebBrowser.openBrowserAsync(feedbackUrl, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
            toolbarColor: '#0F172A',
          });
        } catch {
          try {
            await Linking.openURL(feedbackUrl);
          } catch {
            setConfirmDialog({
              type: 'warning',
              title: 'Hindi Mabuksan ang Browser',
              message:
                'Pakibisita ang https://tindahanhelper.wuaze.com/feedback.php sa iyong phone browser.',
              confirmText: 'Naintindihan',
              cancelText: null,
              onConfirm: () => setConfirmDialog(null),
            });
          }
        }
      },
    });
  };

  return (
    <ScreenSafeAreaView style={styles.safeArea}>
      {/* Top Emerald Green Owner Profile Banner */}
      <Pressable
        style={styles.greenBanner}
        onPress={() => router.navigate('/settings')}
      >
        <View style={styles.storeAvatar}>
          <View style={styles.awningTop}>
            <Text style={styles.awningText}>TINDAHAN</Text>
          </View>
          <Text style={styles.storeEmoji}>🏪</Text>
        </View>

        <View style={styles.ownerTextCol}>
          <Text style={styles.storeNameText}>{settings.storeName}</Text>
          <Text style={styles.ownerRoleText}>{settings.ownerTitle}</Text>
        </View>

        <Text style={styles.bannerChevron}>›</Text>
      </Pressable>

      {/* White Rounded Sheet with Menu Items */}
      <View style={styles.menuSheet}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ========================================================================= */}
          {/* DASHBOARD WITH ANALYTICS CHARTS (ABOVE STORE SETTINGS)                    */}
          {/* ========================================================================= */}
          <View style={styles.dashboardSection}>
            {/* Header: Title and subtitle */}
            <View style={styles.dashboardHeaderRow}>
              <View style={styles.dashboardTitleCol}>
                <View style={styles.dashboardTitleBadgeRow}>
                  <Ionicons name="stats-chart" size={17} color="#0D7A52" />
                  <Text style={styles.dashboardTitle}>Dashboard &amp; Benta Analytics</Text>
                </View>
                <Text style={styles.dashboardSubTitle}>
                  {customDateRange
                    ? customDateRange.label
                    : selectedPeriod === 'Daily'
                    ? 'Benta at Kita Ngayong Araw'
                    : selectedPeriod === 'Weekly'
                    ? 'Benta sa Nakaraang 7 Araw'
                    : 'Benta sa Buwang Ito'}
                </Text>
              </View>
            </View>

            {/* Date Range Filter Controls */}
            <View style={styles.filterBarContainer}>
              <View style={styles.filterSegmentedGroup}>
                {(['Daily', 'Weekly', 'Monthly'] as const).map((period) => {
                  const isActive = !customDateRange && selectedPeriod === period;
                  const label =
                    period === 'Daily' ? 'Arawan' : period === 'Weekly' ? 'Lingguhan' : 'Buwanan';
                  return (
                    <Pressable
                      key={period}
                      style={[styles.filterPill, isActive && styles.filterPillActive]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setCustomDateRange(null);
                        setSelectedPeriod(period);
                        setSelectedTrendBar(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.filterPillText,
                          isActive && styles.filterPillTextActive,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Calendar Button */}
              <Pressable
                style={[
                  styles.calendarFilterBtn,
                  customDateRange ? styles.calendarFilterBtnActive : null,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setDateFilterModalVisible(true);
                }}
              >
                <Ionicons
                  name={customDateRange ? 'calendar' : 'calendar-outline'}
                  size={15}
                  color={customDateRange ? '#FFFFFF' : '#0D7A52'}
                />
                <Text
                  style={[
                    styles.calendarFilterBtnText,
                    customDateRange ? styles.calendarFilterBtnTextActive : null,
                  ]}
                >
                  {customDateRange ? 'May Filter' : 'Petsa'}
                </Text>
              </Pressable>

              {customDateRange ? (
                <Pressable
                  style={styles.clearDateFilterChip}
                  hitSlop={8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setCustomDateRange(null);
                    setSelectedTrendBar(null);
                  }}
                >
                  <Ionicons name="close-circle" size={14} color="#0D7A52" />
                  <Text style={styles.clearDateFilterText}>I-reset</Text>
                </Pressable>
              ) : null}
            </View>

            {/* Financial KPI 2x2 Grid */}
            <View style={styles.kpiGrid}>
              {/* Card 1: Gross Sales */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardTop}>
                  <Text style={styles.kpiLabel}>Kabuuang Benta</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="cash-outline" size={13} color="#059669" />
                  </View>
                </View>
                <Text style={styles.kpiMainValue} numberOfLines={1}>
                  {metrics.grossSales.format()}
                </Text>
                <Text style={styles.kpiDetailSub} numberOfLines={1}>
                  {metrics.transactionCount} resibo • {metrics.itemsSold} naibenta
                </Text>
              </View>

              {/* Card 2: Net Profit (Tubo) with security masking */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardTop}>
                  <Text style={styles.kpiLabel}>Tinubong Kita</Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      if (isStoreSecurityEnabled && isStoreLocked) {
                        setShowTuboPinModal(true);
                      } else {
                        setShowProfit(!showProfit);
                      }
                    }}
                  >
                    <Ionicons
                      name={
                        showProfit && (!isStoreSecurityEnabled || !isStoreLocked)
                          ? 'eye-outline'
                          : 'eye-off-outline'
                      }
                      size={15}
                      color="#0D7A52"
                    />
                  </Pressable>
                </View>
                <Text style={[styles.kpiMainValue, { color: '#0D7A52' }]} numberOfLines={1}>
                  {isStoreSecurityEnabled && isStoreLocked
                    ? '₱ ••••••'
                    : showProfit
                    ? metrics.netProfit.format()
                    : '₱ ••••••'}
                </Text>
                <Text style={styles.kpiDetailSub} numberOfLines={1}>
                  {isStoreSecurityEnabled && isStoreLocked
                    ? '🔒 Protektado'
                    : showProfit
                    ? `${metrics.profitMarginPercent}% tubo (margin)`
                    : 'Pindutin para makita'}
                </Text>
              </View>

              {/* Card 3: Cash In Drawer */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardTop}>
                  <Text style={styles.kpiLabel}>Pera sa Kahon</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#F0FDF4' }]}>
                    <Ionicons name="wallet-outline" size={13} color="#16A34A" />
                  </View>
                </View>
                <Text style={styles.kpiMainValue} numberOfLines={1}>
                  {metrics.cashInDrawer.format()}
                </Text>
                <Text style={styles.kpiDetailSub} numberOfLines={1}>
                  Cash sa kaha on-hand
                </Text>
              </View>

              {/* Card 4: Utang Collected */}
              <View style={styles.kpiCard}>
                <View style={styles.kpiCardTop}>
                  <Text style={styles.kpiLabel}>Koleksyon sa Utang</Text>
                  <View style={[styles.kpiIconWrap, { backgroundColor: '#EFF6FF' }]}>
                    <Ionicons name="receipt-outline" size={13} color="#2563EB" />
                  </View>
                </View>
                <Text style={[styles.kpiMainValue, { color: '#2563EB' }]} numberOfLines={1}>
                  {metrics.utangCollected.format()}
                </Text>
                <Text style={styles.kpiDetailSub} numberOfLines={1}>
                  {metrics.utangCreditIssued.centavos > 0
                    ? `+${metrics.utangCreditIssued.format()} ipinautang`
                    : 'Bayad mula sa suki'}
                </Text>
              </View>
            </View>

            {/* Revenue Trend Visual Bar Chart */}
            <View style={styles.chartContainerCard}>
              <View style={styles.chartHeaderRow}>
                <View style={styles.chartHeaderLeft}>
                  <Ionicons name="bar-chart-outline" size={15} color="#0D7A52" />
                  <Text style={styles.chartTitle}>Daloy ng Benta (Sales Trend)</Text>
                </View>
                {selectedTrendBar ? (
                  <Pressable
                    style={styles.selectedBarBadge}
                    onPress={() => setSelectedTrendBar(null)}
                  >
                    <Text style={styles.selectedBarBadgeText}>
                      {selectedTrendBar.label}: {selectedTrendBar.sales.format()}
                    </Text>
                    <Ionicons name="close-circle" size={12} color="#0D7A52" style={{ marginLeft: 3 }} />
                  </Pressable>
                ) : (
                  <Text style={styles.chartSubtitleHint}>Pindutin ang bar</Text>
                )}
              </View>

              {metrics.grossSales.centavos === 0 ? (
                <View style={styles.emptyChartBox}>
                  <Ionicons name="trending-up-outline" size={22} color="#94A3B8" />
                  <Text style={styles.emptyChartText}>Walang naitalang benta sa panahong ito.</Text>
                </View>
              ) : (
                <View style={styles.barChartRow}>
                  {trendBars.map((bar) => {
                    const isSelected = selectedTrendBar?.id === bar.id;
                    return (
                      <Pressable
                        key={bar.id}
                        style={styles.barColumn}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setSelectedTrendBar(isSelected ? null : bar);
                        }}
                      >
                        {/* Peak Crown */}
                        <View style={styles.barCrownBox}>
                          {bar.isPeak && bar.sales.centavos > 0 ? (
                            <Text style={styles.barCrownEmoji}>👑</Text>
                          ) : null}
                        </View>

                        {/* Track and Fill */}
                        <View style={[styles.barTrack, isSelected && styles.barTrackSelected]}>
                          <View
                            style={[
                              styles.barFill,
                              { height: `${Math.max(bar.heightPercent, 5)}%` },
                              bar.isPeak ? styles.barFillPeak : null,
                              isSelected ? styles.barFillSelected : null,
                            ]}
                          />
                        </View>

                        {/* Label */}
                        <Text
                          style={[styles.barXLabel, isSelected && styles.barXLabelSelected]}
                          numberOfLines={1}
                        >
                          {bar.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Payment Method Distribution Bar (Cash vs GCash vs Utang) */}
            <View style={styles.paymentDistCard}>
              <View style={styles.paymentDistHeader}>
                <Ionicons name="pie-chart-outline" size={15} color="#0D7A52" />
                <Text style={styles.paymentDistTitle}>Paraan ng Pagbayad</Text>
              </View>

              {paymentDist.total.centavos === 0 ? (
                <Text style={styles.emptyDistText}>Wala pang benta sa panahong ito.</Text>
              ) : (
                <>
                  {/* Segmented Stacked Bar */}
                  <View style={styles.segmentedProgressBar}>
                    {paymentDist.items.map((item) => {
                      if (item.percentage <= 0) return null;
                      return (
                        <View
                          key={item.tenderType}
                          style={[
                            styles.segmentBarSlice,
                            {
                              width: `${item.percentage}%`,
                              backgroundColor: item.color,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>

                  {/* Legend */}
                  <View style={styles.paymentLegendRow}>
                    {paymentDist.items.map((item) => (
                      <View key={item.tenderType} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                        <View>
                          <Text style={styles.legendLabel}>{item.label}</Text>
                          <Text style={styles.legendValue}>
                            {item.amount.format()} ({item.percentage}%)
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>

            {/* Top 5 Best-Selling Products Leaderboard */}
            <View style={styles.leaderboardCard}>
              <View style={styles.leaderboardHeader}>
                <View style={styles.leaderboardTitleRow}>
                  <Ionicons name="trophy-outline" size={16} color="#D97706" />
                  <Text style={styles.leaderboardTitle}>Top Pinakamabenta</Text>
                </View>
                <Text style={styles.leaderboardSubtitle}>Ayon sa dami ng naibenta</Text>
              </View>

              {topProducts.length === 0 ? (
                <View style={styles.emptyLeaderboardBox}>
                  <Text style={styles.emptyLeaderboardText}>
                    Wala pang nabentang paninda sa panahong ito.
                  </Text>
                </View>
              ) : (
                topProducts.map((prod, index) => {
                  const medalEmojis = ['🥇', '🥈', '🥉', '4', '5'];
                  return (
                    <View
                      key={prod.productId}
                      style={[
                        styles.leaderboardRow,
                        index < topProducts.length - 1 && styles.leaderboardRowBorder,
                      ]}
                    >
                      {/* Rank Medal / Number */}
                      <View style={styles.rankContainer}>
                        <Text style={styles.rankText}>{medalEmojis[index]}</Text>
                      </View>

                      {/* Product Thumbnail */}
                      <View style={styles.thumbnailWrapper}>
                        <ProductThumbnail
                          visual={
                            prod.visual || {
                              bgColor: '#059669',
                              accentColor: '#10B981',
                              textColor: '#FFFFFF',
                              shortLabel: prod.name.substring(0, 2),
                              subLabel: '',
                              shape: 'POUCH',
                            }
                          }
                          imageUri={prod.imageUri}
                          size="sm"
                        />
                      </View>

                      {/* Product Info */}
                      <View style={styles.productInfoCol}>
                        <Text style={styles.productName} numberOfLines={1}>
                          {prod.name}
                        </Text>
                        <View style={styles.stockBadgeRow}>
                          {prod.isOutOfStock ? (
                            <Text style={styles.outOfStockTag}>Ubos na</Text>
                          ) : prod.isLowStock ? (
                            <Text style={styles.lowStockTag}>
                              {prod.currentStock} {prod.unitLabel} natitira
                            </Text>
                          ) : (
                            <Text style={styles.inStockTag}>
                              {prod.currentStock} {prod.unitLabel} stock
                            </Text>
                          )}
                        </View>
                      </View>

                      {/* Sales Numbers */}
                      <View style={styles.productSalesCol}>
                        <Text style={styles.productQtySold}>
                          {prod.unitsSold} {prod.unitLabel}
                        </Text>
                        <Text style={styles.productRevenue}>
                          {prod.revenue.format()}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </View>

          {/* 1. Store Settings -> Screen 7 */}
          <Pressable
            style={styles.menuRow}
            onPress={() => router.navigate('/settings')}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="settings-outline" size={22} color="#0D7A52" />
              <Text style={styles.menuLabel}>{t.storeSettingsTitle}</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>

          {/* 2. Products -> Screen 2 */}
          <Pressable
            style={styles.menuRow}
            onPress={() => router.navigate('/products')}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="pricetags-outline" size={22} color="#0D7A52" />
              <Text style={styles.menuLabel}>Products</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>

          {/* 3. Sales Reports -> Feature C: Seasonal Product Forecast */}
          <Pressable
            style={styles.menuRow}
            onPress={() => router.navigate('/explore')}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="bar-chart-outline" size={22} color="#0D7A52" />
              <Text style={styles.menuLabel}>Sales Reports</Text>
            </View>
            <View style={styles.menuRightGroup}>
              <View style={styles.forecastTag}>
                <Text style={styles.forecastTagText}>Seasonal Forecast</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </View>
          </Pressable>

          {/* 4. Inventory -> Screen 4 */}
          <Pressable
            style={styles.menuRow}
            onPress={() => router.navigate('/inventory')}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="cube-outline" size={22} color="#0D7A52" />
              <Text style={styles.menuLabel}>{t.inventoryTitle}</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>

          {/* 5. Stock Movement History & Audit Log */}
          <Pressable
            style={styles.menuRow}
            onPress={() => router.navigate('/history')}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="time-outline" size={22} color="#0D7A52" />
              <Text style={styles.menuLabel}>{t.historyTitle}</Text>
            </View>
            <View style={styles.menuRightGroup}>
              <View style={styles.forecastTag}>
                <Text style={styles.forecastTagText}>Audit Log</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </View>
          </Pressable>

          {/* 6. Suki Utang Ledger (Dedicated Screen) */}
          <Pressable
            style={styles.menuRow}
            onPress={() => router.navigate('/utang')}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="people-outline" size={22} color="#0D7A52" />
              <Text style={styles.menuLabel}>Suki Utang Ledger</Text>
            </View>
            <View style={styles.menuRightGroup}>
              <Text style={styles.subHintText}>
                {utangCustomers.length} suki
              </Text>
              <Text style={styles.menuChevron}>›</Text>
            </View>
          </Pressable>

          {/* 7. GCash & QR Ph Standee */}
          <Pressable
            style={styles.menuRow}
            onPress={() => setShowGcashQrModal(true)}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="qr-code-outline" size={22} color="#0D7A52" />
              <View>
                <Text style={styles.menuLabel}>GCash &amp; QR Ph Standee</Text>
                <Text style={styles.menuSubLabel}>I-view o i-download ang counter QR code</Text>
              </View>
            </View>
            <View style={styles.menuRightGroup}>
              <View style={styles.forecastTag}>
                <Text style={styles.forecastTagText}>Counter QR</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </View>
          </Pressable>

          {/* 8. Subscription [Free] */}
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              setActiveSection((prev) =>
                prev === 'SUBSCRIPTION' ? 'NONE' : 'SUBSCRIPTION'
              )
            }
          >
            <View style={styles.menuLeft}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#0D7A52" />
              <Text style={styles.menuLabel}>Subscription</Text>
            </View>
            <View style={styles.menuRightGroup}>
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>Free</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </View>
          </Pressable>

          {activeSection === 'SUBSCRIPTION' ? (
            <View style={styles.inlinePanel}>
              <Text style={styles.inlinePanelTitle}>
                ✓ Ligtas na Offline Mode (Nakatago sa Telepono)
              </Text>
              <Text style={styles.inlinePanelBody}>
                Lahat ng paninda, benta, resibo, at talaan ng utang ay ligtas na nakatago sa iyong telepono kahit walang internet.
              </Text>
            </View>
          ) : null}

          {/* 9. Help & Support */}
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              setActiveSection((prev) => (prev === 'HELP' ? 'NONE' : 'HELP'))
            }
          >
            <View style={styles.menuLeft}>
              <Ionicons name="help-circle-outline" size={22} color="#0D7A52" />
              <Text style={styles.menuLabel}>Help &amp; Support</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>

          {activeSection === 'HELP' ? (
            <View style={styles.inlinePanel}>
              <Text style={styles.inlinePanelTitle}>
                Owner POS Mitigations Active:
              </Text>
              <Text style={styles.inlinePanelBody}>
                • Dual Barcode Registration (Camera Scan + Manual Input + Tingi Code){'\n'}
                • Receipt-Linked Returns with Sellable vs. Damaged Quarantine Gate{'\n'}
                • Instant Exchange Credit &amp; Same-Day Owner Void{'\n'}
                • 12m / 24m+ YoY Seasonal Product Forecast (Feature C)
              </Text>
            </View>
          ) : null}

          {/* 10. Patakaran sa Privacy (Data Privacy Act RA 10173) */}
          <Pressable
            style={styles.menuRow}
            onPress={() => setShowPrivacyPolicyModal(true)}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#0D7A52" />
              <View>
                <Text style={styles.menuLabel}>Patakaran sa Privacy (DPA RA 10173)</Text>
                <Text style={styles.menuSubLabel}>100% offline, ligtas ang datos sa cellphone mo</Text>
              </View>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>

          {/* 8. Feedback & Suggestions (Task 10) */}
          <Pressable
            style={styles.menuRow}
            onPress={handleOpenFeedback}
          >
            <View style={styles.menuLeft}>
              <Ionicons name="chatbubbles-outline" size={22} color="#0D7A52" />
              <View>
                <Text style={styles.menuLabel}>Feedback &amp; Mga Mungkahi</Text>
                <Text style={styles.menuSubLabel}>Ibahagi ang iyong mga kahilingan online</Text>
              </View>
            </View>
            <View style={styles.menuRightGroup}>
              <View style={styles.onlineBadge}>
                <Text style={styles.onlineBadgeText}>Online</Text>
              </View>
              <Text style={styles.menuChevron}>›</Text>
            </View>
          </Pressable>

          {/* 9. Developer / Creator Contact Section (Task 11) */}
          <View style={styles.creatorCard}>
            <View style={styles.creatorTopRow}>
              <View style={styles.creatorIconWrap}>
                <Ionicons name="call-outline" size={18} color="#0D7A52" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.creatorTitle}>Developer / Creator Contact</Text>
                <Text style={styles.creatorSubtitle}>
                  May tanong, feedback, o kailangan ng tulong?
                </Text>
              </View>
            </View>

            <View style={styles.creatorBodyRow}>
              <View>
                <Text style={styles.creatorPhoneLabel}>Official Helpline:</Text>
                <Text style={styles.creatorPhoneNumber}>0991 658 9854</Text>
              </View>

              <View style={styles.creatorButtonsRow}>
                <Pressable
                  style={styles.creatorBtnCopy}
                  onPress={() => {
                    try {
                      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText('09916589854').catch(() => {});
                      }
                      Share.share({ message: '09916589854' }).catch(() => {});
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                      setToastMsg('✓ Na-kopyang numero: 0991 658 9854');
                      setTimeout(() => setToastMsg(null), 2500);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <Ionicons name="copy-outline" size={14} color="#0D7A52" />
                  <Text style={styles.creatorBtnCopyText}>Kopyahin</Text>
                </Pressable>

                <Pressable
                  style={styles.creatorBtnDial}
                  onPress={async () => {
                    try {
                      await Linking.openURL('tel:09916589854');
                    } catch {
                      setConfirmDialog({
                        type: 'warning',
                        title: 'Hindi Mabuksan ang Dialer',
                        message:
                          'Maaaring i-dial nang mano-mano ang 09916589854 sa iyong telepono.',
                        confirmText: 'Naintindihan',
                        cancelText: null,
                        onConfirm: () => setConfirmDialog(null),
                      });
                    }
                  }}
                >
                  <Ionicons name="call" size={14} color="#FFFFFF" />
                  <Text style={styles.creatorBtnDialText}>Tawagan</Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* 10. Log Out */}
          <Pressable
            style={[styles.menuRow, styles.menuRowNoBorder]}
            onPress={() => {
              setConfirmDialog({
                type: 'warning',
                title: 'Mag-Log Out?',
                message: 'Nais mo bang bumalik sa POS Scan cashier screen?',
                confirmText: 'Oo, Mag-Log Out',
                cancelText: 'Kanselahin',
                onConfirm: () => {
                  setConfirmDialog(null);
                  router.navigate('/');
                },
              });
            }}
          >
            <View style={styles.menuLeft}>
              <Text style={styles.menuIcon}>↪️</Text>
              <Text style={styles.menuLabel}>Log Out</Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>
        </ScrollView>
      </View>

      {toastMsg ? (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      ) : null}

      {/* Styled Confirmation / Alert Modal */}
      {confirmDialog ? (
        <ConfirmationModal
          visible={true}
          type={confirmDialog.type ?? 'info'}
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

      <GcashQrModal
        visible={showGcashQrModal}
        onClose={() => setShowGcashQrModal(false)}
        qrImageUri={settings.gcashQrImageUri}
        gcashNumber={settings.gcashNumber || '0917 123 4567'}
        gcashAccountName={settings.gcashAccountName || settings.storeName}
        onUpdateQrImage={(newUri) => {
          updateSettings({ gcashQrImageUri: newUri });
          setToastMsg('✓ Na-update ang GCash QR image!');
          setTimeout(() => setToastMsg(null), 2500);
        }}
      />

      <PrivacyPolicyModal
        visible={showPrivacyPolicyModal}
        onClose={() => setShowPrivacyPolicyModal(false)}
      />

      {/* Date Range Calendar Modal */}
      <DateRangeCalendarModal
        visible={dateFilterModalVisible}
        currentRange={customDateRange}
        availableYears={availableYears}
        title="Salain ang Dashboard ayon sa Petsa"
        subtitle="Pumili ng preset o sariling sakop ng petsa sa kalendaryo"
        onApply={(range) => {
          setCustomDateRange(range);
          setDateFilterModalVisible(false);
        }}
        onClose={() => setDateFilterModalVisible(false)}
      />

      {/* PIN Security Modal for Viewing Hidden Profit (Tubo) */}
      <PinChallengeModal
        visible={showTuboPinModal}
        title="Seguridad ng Kita (Tubo)"
        subtitle="I-enter ang PIN o i-scan ang daliri/mukha upang makita ang tubo"
        onSuccess={() => {
          setShowTuboPinModal(false);
          setShowProfit(true);
        }}
        onCancel={() => setShowTuboPinModal(false)}
      />
    </ScreenSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0D7A52',
  },
  greenBanner: {
    backgroundColor: '#0D7A52',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  storeAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  awningTop: {
    backgroundColor: '#DC2626',
    width: '100%',
    paddingVertical: 2,
    alignItems: 'center',
  },
  awningText: {
    color: '#FFFFFF',
    fontSize: 6,
    fontWeight: '900',
  },
  storeEmoji: {
    fontSize: 26,
    marginTop: 2,
  },
  ownerTextCol: {
    flex: 1,
    gap: 2,
  },
  storeNameText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  ownerRoleText: {
    color: '#D1FAE5',
    fontSize: 14,
    fontWeight: '600',
  },
  bannerChevron: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  menuSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -18,
    paddingTop: 10,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 130,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuRowNoBorder: {
    borderBottomWidth: 0,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  menuRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  forecastTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  forecastTagText: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '800',
  },
  subHintText: {
    fontSize: 11,
    color: '#0D7A52',
    fontWeight: '700',
  },
  freeBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  freeBadgeText: {
    color: '#15803D',
    fontSize: 12,
    fontWeight: '800',
  },
  menuChevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  inlinePanel: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  inlinePanelTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D7A52',
  },
  inlinePanelBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  menuSubLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  onlineBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  onlineBadgeText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '800',
  },
  creatorCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    marginVertical: 10,
    gap: 12,
  },
  creatorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  creatorIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  creatorTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  creatorSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  creatorBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 10,
  },
  creatorPhoneLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#64748B',
  },
  creatorPhoneNumber: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0D7A52',
    letterSpacing: 0.5,
  },
  creatorButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creatorBtnCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  creatorBtnCopyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7A52',
  },
  creatorBtnDial: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#0D7A52',
  },
  creatorBtnDialText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#111827',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Dashboard & Analytics Styles
  dashboardSection: {
    paddingBottom: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  dashboardHeaderRow: {
    marginBottom: 10,
  },
  dashboardTitleCol: {
    gap: 2,
  },
  dashboardTitleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dashboardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  dashboardSubTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  filterBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  filterSegmentedGroup: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
  },
  filterPill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  calendarFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  calendarFilterBtnActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  calendarFilterBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7A52',
  },
  calendarFilterBtnTextActive: {
    color: '#FFFFFF',
  },
  clearDateFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  clearDateFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7A52',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  kpiCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  kpiIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiMainValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  kpiDetailSub: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  chartContainerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  chartSubtitleHint: {
    fontSize: 10,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  selectedBarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  selectedBarBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0D7A52',
  },
  emptyChartBox: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyChartText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 100,
    paddingTop: 8,
    gap: 6,
    justifyContent: 'space-around',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
  },
  barCrownBox: {
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barCrownEmoji: {
    fontSize: 10,
  },
  barTrack: {
    flex: 1,
    width: 20,
    backgroundColor: '#E2E8F0',
    borderRadius: 5,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: 1.5,
  },
  barTrackSelected: {
    borderColor: '#0D7A52',
    borderWidth: 1.5,
  },
  barFill: {
    width: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3.5,
  },
  barFillPeak: {
    backgroundColor: '#0D7A52',
  },
  barFillSelected: {
    backgroundColor: '#047857',
  },
  barXLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
  },
  barXLabelSelected: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  paymentDistCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  paymentDistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  paymentDistTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyDistText: {
    fontSize: 11,
    color: '#94A3B8',
    marginVertical: 4,
  },
  segmentedProgressBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  segmentBarSlice: {
    height: '100%',
  },
  paymentLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
  legendValue: {
    fontSize: 11,
    color: '#0F172A',
    fontWeight: '700',
  },
  leaderboardCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  leaderboardHeader: {
    marginBottom: 8,
  },
  leaderboardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leaderboardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  leaderboardSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 1,
  },
  emptyLeaderboardBox: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  emptyLeaderboardText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 8,
  },
  leaderboardRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  rankContainer: {
    width: 20,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 13,
  },
  thumbnailWrapper: {
    width: 40,
    height: 46,
    borderRadius: 6,
    overflow: 'hidden',
  },
  productInfoCol: {
    flex: 1,
  },
  productName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  stockBadgeRow: {
    flexDirection: 'row',
    marginTop: 1,
  },
  outOfStockTag: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
  },
  lowStockTag: {
    fontSize: 9,
    fontWeight: '700',
    color: '#D97706',
  },
  inStockTag: {
    fontSize: 9,
    fontWeight: '600',
    color: '#059669',
  },
  productSalesCol: {
    alignItems: 'flex-end',
  },
  productQtySold: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7A52',
  },
  productRevenue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
});
