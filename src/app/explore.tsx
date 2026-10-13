// src/app/explore.tsx — Feature C: Seasonal Product Forecast Dashboard (SQLite Backed)
import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { seasonalForecastEngine } from '@/infrastructure/container';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';

export default function SeasonalForecastScreen() {
  const router = useRouter();
  const {
    products,
    settings,
    adjustInventoryStock,
    getMonthlySalesHistory,
    addOrUpdateMonthlySalesRecord,
    updateSettings,
  } = useTindahanStore();

  const [restockToast, setRestockToast] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.id ?? ''
  );
  const [histYear, setHistYear] = useState<string>(String(new Date().getFullYear()));
  const [histMonth, setHistMonth] = useState<string>(String(settings.schoolOpeningMonth));
  const [histUnitsSold, setHistUnitsSold] = useState<string>('');
  const [histOosDays, setHistOosDays] = useState<string>('0');

  const activeProductId =
    products.some((p) => p.id === selectedProductId)
      ? selectedProductId
      : products[0]?.id ?? '';

  const allForecasts = products.map((p) => {
    const history = getMonthlySalesHistory(p.id);
    return seasonalForecastEngine.evaluateProductSeasonality(
      p.id,
      p.name,
      history,
      settings.schoolOpeningMonth,
      p.stockCount,
      3.0
    );
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle}>Seasonal Product Forecast</Text>
          <Text style={styles.headerSubtitle}>
            Feature C • SQLite Monthly History &amp; YoY Comparison
          </Text>
        </View>
      </View>

      {restockToast ? (
        <View style={styles.toastBanner}>
          <Text style={styles.toastText}>{restockToast}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Owner Wholesale Budget Prioritizer */}
        <View style={styles.budgetCard}>
          <View style={styles.budgetHeader}>
            <Text style={styles.budgetTitle}>
              💰 Owner Wholesale Restock Budget
            </Text>
            <Text style={styles.budgetAmount}>₱{settings.wholesaleBudgetPhp}</Text>
          </View>
          <Text style={styles.budgetSub}>
            Target Peak Month: Month #{settings.schoolOpeningMonth}
          </Text>
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
                    ₱{b} Budget
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {products.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Products in Database Yet</Text>
            <Text style={styles.emptySub}>
              Add products in Inventory or Products first, then complete sales or log monthly sales records here to compute Seasonal Product Forecasts.
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => router.push('/inventory')}
            >
              <Text style={styles.emptyBtnText}>+ Add Products in Inventory</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Add Monthly Sales History Record to SQLite */}
            <View style={styles.logCard}>
              <Text style={styles.logTitle}>
                + Log Monthly Sales Record to SQLite Database
              </Text>
              <Text style={styles.logSub}>
                Select a product and record monthly sales to build 12m / 24m+ seasonal history:
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.prodChipRow}
              >
                {products.map((p) => {
                  const active = p.id === activeProductId;
                  return (
                    <Pressable
                      key={p.id}
                      style={[styles.prodChip, active ? styles.prodChipActive : null]}
                      onPress={() => setSelectedProductId(p.id)}
                    >
                      <Text
                        style={[
                          styles.prodChipText,
                          active ? styles.prodChipTextActive : null,
                        ]}
                      >
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.fourColRow}>
                <View style={styles.colItem}>
                  <Text style={styles.inputLabel}>Year</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={histYear}
                    onChangeText={setHistYear}
                    keyboardType="number-pad"
                    placeholder="2025"
                  />
                </View>
                <View style={styles.colItem}>
                  <Text style={styles.inputLabel}>Month (1-12)</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={histMonth}
                    onChangeText={setHistMonth}
                    keyboardType="number-pad"
                    placeholder="7"
                  />
                </View>
                <View style={styles.colItem}>
                  <Text style={styles.inputLabel}>Units Sold *</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={histUnitsSold}
                    onChangeText={setHistUnitsSold}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                </View>
                <View style={styles.colItem}>
                  <Text style={styles.inputLabel}>OOS Days</Text>
                  <TextInput
                    style={styles.inputBox}
                    value={histOosDays}
                    onChangeText={setHistOosDays}
                    keyboardType="number-pad"
                    placeholder="0"
                  />
                </View>
              </View>

              <Pressable
                style={styles.saveHistBtn}
                onPress={() => {
                  if (!activeProductId) return;
                  const yr = parseInt(histYear, 10) || new Date().getFullYear();
                  const mo = Math.min(12, Math.max(1, parseInt(histMonth, 10) || 1));
                  const sold = Math.max(0, parseInt(histUnitsSold, 10) || 0);
                  const oos = Math.min(29, Math.max(0, parseInt(histOosDays, 10) || 0));

                  addOrUpdateMonthlySalesRecord(activeProductId, {
                    year: yr,
                    month: mo,
                    grossUnitsSold: sold,
                    voidedUnits: 0,
                    returnedChangedMindUnits: 0,
                    outOfStockDays: oos,
                    totalDaysInMonth: 30,
                  });
                  Haptics.notificationAsync(
                    Haptics.NotificationFeedbackType.Success
                  ).catch(() => {});
                  setHistUnitsSold('');
                  setRestockToast(
                    `✓ Saved ${yr}-${String(mo).padStart(2, '0')} (${sold} units) to SQLite`
                  );
                }}
              >
                <Text style={styles.saveHistBtnText}>
                  ✓ Save Monthly Record to Database
                </Text>
              </Pressable>
            </View>

            {/* Dynamic Forecast Cards for User's SQLite Products */}
            {allForecasts.map((fc) => {
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

              return (
                <View key={fc.productId} style={styles.card}>
                  <View style={styles.badgeRow}>
                    <View style={styles.peakBadge}>
                      <Text style={styles.peakBadgeText}>
                        🔥 {fc.peakVsOrdinaryMultiplier}× vs Ordinary Months
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
                        {historyCount} mo in DB ({fc.confidenceTier})
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.productTitle}>{fc.productName}</Text>
                  <Text style={styles.explanation}>{fc.explanation}</Text>

                  <View style={styles.comparisonBox}>
                    <View style={styles.barGroup}>
                      <Text style={styles.barLabel}>
                        Ordinary Months Avg ({fc.ordinaryMonthlyAverage} units/mo)
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[styles.barFillOrdinary, { width: `${ordinaryPct}%` }]}
                        />
                      </View>
                    </View>

                    <View style={styles.barGroup}>
                      <Text style={styles.barLabelPeak}>
                        Target Month #{fc.targetMonth} Forecast ({fc.forecastedUnits} units)
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

                  <View style={styles.metricsRow}>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Seasonal Index</Text>
                      <Text style={styles.metricValue}>{fc.seasonalIndex}×</Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Text style={styles.metricLabel}>Current Stock</Text>
                      <Text style={styles.metricValue}>{fc.currentStock}</Text>
                    </View>
                    <View style={styles.metricItemHighlight}>
                      <Text style={styles.metricLabelHighlight}>Recommended</Text>
                      <Text style={styles.metricValueHighlight}>
                        +{fc.recommendedRestockQty}
                      </Text>
                    </View>
                  </View>

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
                          `✓ Restocked +${fc.recommendedRestockQty} ${fc.productName} in Database`
                        );
                      }}
                    >
                      <Text style={styles.restockActionText}>
                        + Restock Recommended ({fc.recommendedRestockQty} units) to Inventory
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
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
  toastBanner: {
    backgroundColor: '#DCFCE7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#86EFAC',
  },
  toastText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 130,
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
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    gap: 8,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D7A52',
  },
  logSub: {
    fontSize: 11,
    color: '#64748B',
  },
  prodChipRow: {
    gap: 8,
    paddingVertical: 4,
  },
  prodChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  prodChipActive: {
    backgroundColor: '#0D7A52',
  },
  prodChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  prodChipTextActive: {
    color: '#FFFFFF',
  },
  fourColRow: {
    flexDirection: 'row',
    gap: 8,
  },
  colItem: {
    flex: 1,
    gap: 4,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  inputBox: {
    height: 38,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 8,
    backgroundColor: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  saveHistBtn: {
    backgroundColor: '#0D7A52',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  saveHistBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  peakBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  peakBadgeText: {
    color: '#92400E',
    fontWeight: '800',
    fontSize: 11,
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  confGreen: {
    backgroundColor: '#DCFCE7',
  },
  confBlue: {
    backgroundColor: '#DBEAFE',
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '800',
  },
  confTextGreen: {
    color: '#166534',
  },
  confTextBlue: {
    color: '#1E40AF',
  },
  productTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  explanation: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  comparisonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  barGroup: {
    gap: 4,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  barLabelPeak: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D7A52',
  },
  barTrack: {
    height: 10,
    backgroundColor: '#E2E8F0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFillOrdinary: {
    height: '100%',
    backgroundColor: '#94A3B8',
    borderRadius: 5,
  },
  barFillPeak: {
    height: '100%',
    backgroundColor: '#0D7A52',
    borderRadius: 5,
  },
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
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
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  metricLabelHighlight: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '700',
  },
  metricValueHighlight: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D7A52',
    marginTop: 2,
  },
  restockActionBtn: {
    backgroundColor: '#0D7A52',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  restockActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
