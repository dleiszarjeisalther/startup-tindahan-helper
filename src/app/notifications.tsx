import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ScreenSafeAreaView } from '@/presentation/components/ScreenSafeAreaView';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { StoreAlertKind } from '@/domain/services/StoreAlertPolicy';

type AlertFilter = 'ALL' | StoreAlertKind;

const FILTERS: { key: AlertFilter; label: string }[] = [
  { key: 'ALL', label: 'Lahat' },
  { key: 'LOW_STOCK', label: 'Stock' },
  { key: 'OVERDUE_UTANG', label: 'Utang' },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    activeAlerts,
    unreadAlertCount,
    notificationPreferences,
    markAlertRead,
    markAllAlertsRead,
  } = useTindahanStore();
  const [filter, setFilter] = useState<AlertFilter>('ALL');
  const visibleAlerts = useMemo(
    () => activeAlerts.filter((alert) => filter === 'ALL' || alert.kind === filter),
    [activeAlerts, filter]
  );

  return (
    <ScreenSafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.iconButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityRole="button"
          accessibilityLabel="Bumalik"
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Kailangang Asikasuhin</Text>
          <Text style={styles.subtitle}>{unreadAlertCount} hindi pa nababasa</Text>
        </View>
        <Pressable
          style={styles.readAllButton}
          onPress={() => {
            markAllAlertsRead();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }}
          disabled={unreadAlertCount === 0}
          accessibilityRole="button"
          accessibilityLabel="Markahan lahat bilang nabasa"
        >
          <Text style={[styles.readAllText, unreadAlertCount === 0 && styles.disabledText]}>
            Nabasa lahat
          </Text>
        </Pressable>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.filterButton, filter === item.key && styles.filterButtonActive]}
            onPress={() => setFilter(item.key)}
          >
            <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!notificationPreferences.inAppEnabled ? (
          <View style={styles.emptyCard}>
            <Ionicons name="notifications-off-outline" size={42} color="#94A3B8" />
            <Text style={styles.emptyTitle}>Naka-off ang in-app alerts</Text>
            <Text style={styles.emptyBody}>I-on ito sa Settings para makita ang stock at utang alerts.</Text>
            <Pressable style={styles.settingsButton} onPress={() => router.push('/settings')}>
              <Text style={styles.settingsButtonText}>Buksan ang Settings</Text>
            </Pressable>
          </View>
        ) : visibleAlerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={46} color="#0D7A52" />
            <Text style={styles.emptyTitle}>Ayos ang tindahan</Text>
            <Text style={styles.emptyBody}>Walang alert na kailangang aksyunan ngayon.</Text>
          </View>
        ) : (
          visibleAlerts.map((alert) => (
            <Pressable
              key={alert.id}
              style={[styles.alertCard, !alert.isRead && styles.alertCardUnread]}
              onPress={() => {
                markAlertRead(alert.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                router.push(alert.targetRoute);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${alert.title}. ${alert.message}`}
            >
              <View
                style={[
                  styles.alertIcon,
                  alert.kind === 'LOW_STOCK' ? styles.stockIcon : styles.utangIcon,
                ]}
              >
                <Ionicons
                  name={alert.kind === 'LOW_STOCK' ? 'cube-outline' : 'wallet-outline'}
                  size={22}
                  color={alert.kind === 'LOW_STOCK' ? '#B45309' : '#B91C1C'}
                />
              </View>
              <View style={styles.alertCopy}>
                <View style={styles.alertTitleRow}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  {!alert.isRead ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={styles.alertMessage}>{alert.message}</Text>
                <Text style={styles.alertAction}>
                  {alert.kind === 'LOW_STOCK' ? 'Tingnan sa Inventory' : 'Buksan ang Suki Ledger'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </Pressable>
          ))
        )}
      </ScrollView>
    </ScreenSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  subtitle: { marginTop: 2, fontSize: 12, color: '#64748B' },
  readAllButton: { minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' },
  readAllText: { fontSize: 12, fontWeight: '800', color: '#0D7A52' },
  disabledText: { color: '#94A3B8' },
  filters: { flexDirection: 'row', gap: 8, padding: 12, backgroundColor: '#FFFFFF' },
  filterButton: {
    minHeight: 48,
    minWidth: 82,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  filterButtonActive: { backgroundColor: '#0D7A52' },
  filterText: { color: '#475569', fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  content: { padding: 14, paddingBottom: 110, gap: 10 },
  alertCard: {
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  alertCardUnread: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  alertIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stockIcon: { backgroundColor: '#FEF3C7' },
  utangIcon: { backgroundColor: '#FEE2E2' },
  alertCopy: { flex: 1, gap: 4 },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  alertTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626' },
  alertMessage: { fontSize: 13, lineHeight: 18, color: '#475569' },
  alertAction: { fontSize: 12, fontWeight: '800', color: '#0D7A52', marginTop: 2 },
  emptyCard: {
    marginTop: 42,
    padding: 28,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: { marginTop: 12, fontSize: 17, fontWeight: '800', color: '#111827' },
  emptyBody: { marginTop: 6, fontSize: 13, lineHeight: 19, color: '#64748B', textAlign: 'center' },
  settingsButton: {
    minHeight: 48,
    marginTop: 16,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#0D7A52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButtonText: { color: '#FFFFFF', fontWeight: '800' },
});
