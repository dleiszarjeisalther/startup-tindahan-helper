import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { DashboardAnalyticsEngine } from '@/domain/strategies/DashboardAnalyticsEngine';
import { ScreenSafeAreaView } from '@/presentation/components/ScreenSafeAreaView';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';

const graphPercent = (value: number, maximum: number): `${number}%` =>
  `${Math.max(Math.round((value * 100) / Math.max(maximum, 1)), value > 0 ? 4 : 0)}%`;

export default function DashboardScreen() {
  const router = useRouter();
  const { transactions, products, cashDrawerAdjustments } = useTindahanStore();
  const analytics = useMemo(
    () => new DashboardAnalyticsEngine(transactions, products, cashDrawerAdjustments),
    [transactions, products, cashDrawerAdjustments]
  );
  const metrics = useMemo(() => analytics.computeMetrics('Weekly'), [analytics]);
  const trendBars = useMemo(() => analytics.getTrendBars('Weekly'), [analytics]);
  const stockProducts = useMemo(
    () => [...products].sort((a, b) => a.stockCount - b.stockCount).slice(0, 8),
    [products]
  );
  const maxStock = Math.max(...stockProducts.map((product) => product.stockCount), 1);
  const maxUtang = Math.max(metrics.utangCreditIssued.centavos, metrics.utangCollected.centavos, 1);
  const hasUtangActivity =
    metrics.utangCreditIssued.centavos > 0 || metrics.utangCollected.centavos > 0;

  return (
    <ScreenSafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Bumalik"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>Buod ng tindahan sa nakaraang 7 araw</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Takbo ng Benta</Text>
          {metrics.grossSales.centavos === 0 ? (
            <Text style={styles.emptyText}>Wala pang benta sa nakaraang 7 araw.</Text>
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
          <Text style={styles.totalText}>Kabuuang Benta: {metrics.grossSales.format()}</Text>
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
                      product.stockCount === 0 && styles.stockBarEmpty,
                      { width: product.stockCount === 0 ? '4%' : graphPercent(product.stockCount, maxStock) },
                    ]}
                  />
                </View>
                <Text style={styles.stockValue}>{product.stockCount}</Text>
              </View>
            ))
          )}
          {stockProducts.length > 0 ? (
            <Text style={styles.helperText}>Dilaw: mababa ang stock · Pula: ubos na</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Utang at Koleksyon</Text>
          {!hasUtangActivity ? (
            <Text style={styles.emptyText}>Wala pang naitalang Utang o koleksyon.</Text>
          ) : (
            <>
              <View style={styles.debtRow}>
                <Text style={styles.debtLabel}>Naipautang</Text>
                <View style={styles.debtTrack}>
                  <View style={[styles.debtBar, { width: graphPercent(metrics.utangCreditIssued.centavos, maxUtang) }]} />
                </View>
                <Text style={styles.debtValue}>{metrics.utangCreditIssued.format()}</Text>
              </View>
              <View style={styles.debtRow}>
                <Text style={styles.debtLabel}>Nakolekta</Text>
                <View style={styles.debtTrack}>
                  <View style={[styles.debtBar, styles.debtBarCollected, { width: graphPercent(metrics.utangCollected.centavos, maxUtang) }]} />
                </View>
                <Text style={styles.debtValue}>{metrics.utangCollected.format()}</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: '#0D7A52' },
  backButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.16)' },
  title: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { color: '#D1FAE5', marginTop: 2, fontSize: 12 },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { color: '#0F172A', fontSize: 16, fontWeight: '800', marginBottom: 14 },
  emptyText: { color: '#64748B', paddingVertical: 18, textAlign: 'center' },
  totalText: { color: '#0D7A52', fontSize: 13, fontWeight: '800', marginTop: 12 },
  trendChart: { height: 160, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 7 },
  trendItem: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  trendBarTrack: { height: '86%', width: '100%', justifyContent: 'flex-end', backgroundColor: '#ECFDF5', borderRadius: 8, overflow: 'hidden' },
  trendBar: { width: '100%', backgroundColor: '#0D7A52', borderRadius: 8 },
  trendLabel: { color: '#64748B', fontSize: 10 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  stockName: { width: 96, color: '#334155', fontSize: 12 },
  stockTrack: { flex: 1, height: 12, backgroundColor: '#E2E8F0', borderRadius: 6, overflow: 'hidden' },
  stockBar: { height: '100%', backgroundColor: '#0D7A52', borderRadius: 6 },
  stockBarWarning: { backgroundColor: '#F59E0B' },
  stockBarEmpty: { backgroundColor: '#DC2626', width: 5 },
  stockValue: { width: 32, textAlign: 'right', color: '#0F172A', fontWeight: '700' },
  helperText: { color: '#64748B', fontSize: 11, marginTop: 10 },
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  debtLabel: { width: 72, color: '#475569', fontSize: 12 },
  debtTrack: { flex: 1, height: 12, backgroundColor: '#E2E8F0', borderRadius: 6, overflow: 'hidden' },
  debtBar: { height: '100%', backgroundColor: '#2563EB', borderRadius: 6 },
  debtBarCollected: { backgroundColor: '#0D7A52' },
  debtValue: { width: 82, textAlign: 'right', color: '#0F172A', fontSize: 12, fontWeight: '700' },
});
