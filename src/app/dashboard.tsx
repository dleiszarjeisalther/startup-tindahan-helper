import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DashboardAnalyticsEngine } from '@/domain/strategies/DashboardAnalyticsEngine';
import { ScreenSafeAreaView } from '@/presentation/components/ScreenSafeAreaView';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';

export default function DashboardScreen() {
  const { transactions, products, cashDrawerAdjustments } = useTindahanStore();
  const analytics = useMemo(
    () => new DashboardAnalyticsEngine(transactions, products, cashDrawerAdjustments),
    [transactions, products, cashDrawerAdjustments]
  );
  const metrics = useMemo(() => analytics.computeMetrics('Weekly'), [analytics]);
  const trendBars = useMemo(() => analytics.getTrendBars('Weekly'), [analytics]);
  const stockProducts = useMemo(
    () => [...products].sort((a, b) => a.stockCount - b.stockCount).slice(0, 6),
    [products]
  );
  const maxStock = Math.max(...stockProducts.map((product) => product.stockCount), 1);
  const maxUtang = Math.max(metrics.utangCreditIssued.centavos, metrics.utangCollected.centavos, 1);

  return (
    <ScreenSafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Ionicons name="stats-chart" size={22} color="#0D7A52" />
          <View>
            <Text style={styles.title}>Dashboard</Text>
            <Text style={styles.subtitle}>Buod ng tindahan sa nakaraang 7 araw</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Benta</Text>
            <Text style={styles.kpiValue}>{metrics.grossSales.format()}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Koleksyon</Text>
            <Text style={styles.kpiValue}>{metrics.utangCollected.format()}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Takbo ng Benta</Text>
          {trendBars.length === 0 ? (
            <Text style={styles.emptyText}>Wala pang benta sa panahong ito.</Text>
          ) : (
            <View style={styles.trendChart}>
              {trendBars.map((bar) => (
                <View key={bar.id} style={styles.trendItem}>
                  <View style={styles.trendBarTrack}>
                    <View style={[styles.trendBar, { height: `${Math.max(bar.heightPercent, 4)}%` }]} />
                  </View>
                  <Text style={styles.trendLabel}>{bar.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kalagayan ng Stock</Text>
          {stockProducts.length === 0 ? (
            <Text style={styles.emptyText}>Wala pang nakatalang paninda.</Text>
          ) : (
            stockProducts.map((product) => (
              <View key={product.id} style={styles.stockRow}>
                <Text style={styles.stockName} numberOfLines={1}>{product.name}</Text>
                <View style={styles.stockTrack}>
                  <View
                    style={[
                      styles.stockBar,
                      product.stockStatus !== 'IN_STOCK' && styles.stockBarWarning,
                      { width: `${Math.max((product.stockCount / maxStock) * 100, 4)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.stockValue}>{product.stockCount}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Utang at Koleksyon</Text>
          <View style={styles.debtRow}>
            <Text style={styles.debtLabel}>Naipautang</Text>
            <View style={styles.debtTrack}>
              <View style={[styles.debtBar, { width: `${Math.max((metrics.utangCreditIssued.centavos / maxUtang) * 100, 4)}%` }]} />
            </View>
            <Text style={styles.debtValue}>{metrics.utangCreditIssued.format()}</Text>
          </View>
          <View style={styles.debtRow}>
            <Text style={styles.debtLabel}>Nakolekta</Text>
            <View style={styles.debtTrack}>
              <View style={[styles.debtBar, styles.debtBarCollected, { width: `${Math.max((metrics.utangCollected.centavos / maxUtang) * 100, 4)}%` }]} />
            </View>
            <Text style={styles.debtValue}>{metrics.utangCollected.format()}</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  subtitle: { color: '#64748B', marginTop: 2 },
  kpiRow: { flexDirection: 'row', gap: 12 },
  kpiCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  kpiLabel: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  kpiValue: { color: '#0D7A52', fontSize: 20, fontWeight: '800', marginTop: 6 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginBottom: 14 },
  emptyText: { color: '#64748B', paddingVertical: 14 },
  trendChart: { height: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  trendItem: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  trendBarTrack: { height: '86%', width: '100%', justifyContent: 'flex-end', backgroundColor: '#ECFDF5', borderRadius: 8, overflow: 'hidden' },
  trendBar: { width: '100%', backgroundColor: '#0D7A52', borderRadius: 8 },
  trendLabel: { color: '#64748B', fontSize: 10 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  stockName: { width: 96, color: '#334155', fontSize: 12 },
  stockTrack: { flex: 1, height: 10, backgroundColor: '#E2E8F0', borderRadius: 5, overflow: 'hidden' },
  stockBar: { height: '100%', backgroundColor: '#0D7A52', borderRadius: 5 },
  stockBarWarning: { backgroundColor: '#F59E0B' },
  stockValue: { width: 32, textAlign: 'right', color: '#0F172A', fontWeight: '700' },
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  debtLabel: { width: 72, color: '#475569', fontSize: 12 },
  debtTrack: { flex: 1, height: 10, backgroundColor: '#E2E8F0', borderRadius: 5, overflow: 'hidden' },
  debtBar: { height: '100%', backgroundColor: '#2563EB', borderRadius: 5 },
  debtBarCollected: { backgroundColor: '#0D7A52' },
  debtValue: { width: 82, textAlign: 'right', color: '#0F172A', fontSize: 12, fontWeight: '700' },
});
