import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { StoreAlert } from '@/domain/services/StoreAlertPolicy';

export interface StoreAlertsModalProps {
  visible: boolean;
  alerts: readonly StoreAlert[];
  unreadCount: number;
  onClose: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (alertId: string) => void;
  onViewAllNotifications: () => void;
  onActionAlert: (alert: StoreAlert) => void;
}

export function StoreAlertsModal({
  visible,
  alerts,
  unreadCount,
  onClose,
  onMarkAllRead,
  onMarkRead,
  onViewAllNotifications,
  onActionAlert,
}: StoreAlertsModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />

        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.bellIconContainer}>
                <Ionicons name="notifications" size={22} color="#D97706" />
                {unreadCount > 0 ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {Math.min(99, unreadCount)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.headerTextGroup}>
                <Text style={styles.modalTitle}>Kailangang Asikasuhin</Text>
                <Text style={styles.modalSubtitle}>
                  {unreadCount > 0
                    ? `${unreadCount} kailangang tingnang abiso`
                    : 'Naasikaso na ang mga abiso'}
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.closeBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onClose();
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Isara ang abiso"
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </Pressable>
          </View>

          {/* Subheader: Mark All as Read */}
          {unreadCount > 0 ? (
            <View style={styles.subHeaderBar}>
              <Pressable
                style={styles.markAllBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  onMarkAllRead();
                }}
              >
                <Ionicons name="checkmark-done" size={16} color="#0D7A52" />
                <Text style={styles.markAllText}>Markahan lahat bilang nabasa</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Alert Items List */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {alerts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#0D7A52" />
                <Text style={styles.emptyTitle}>Ayos ang Tindahan</Text>
                <Text style={styles.emptyBody}>
                  Walang kritikal na abiso o paubos na paninda sa kasalukuyan.
                </Text>
              </View>
            ) : (
              alerts.slice(0, 8).map((alert) => {
                const isStock = alert.kind === 'LOW_STOCK';
                const isUnread = !alert.isRead;

                return (
                  <View
                    key={alert.id}
                    style={[
                      styles.alertCard,
                      isUnread ? styles.alertCardUnread : styles.alertCardRead,
                    ]}
                  >
                    <View style={styles.alertCardTop}>
                      <View
                        style={[
                          styles.kindIconBox,
                          isStock ? styles.kindIconStock : styles.kindIconUtang,
                        ]}
                      >
                        <Ionicons
                          name={isStock ? 'cube-outline' : 'wallet-outline'}
                          size={18}
                          color={isStock ? '#D97706' : '#DC2626'}
                        />
                      </View>

                      <View style={styles.alertCardCopy}>
                        <View style={styles.titleLine}>
                          <Text style={styles.alertCardTitle}>{alert.title}</Text>
                          {isUnread ? (
                            <View style={styles.bagoPill}>
                              <Text style={styles.bagoPillText}>BAGO</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.alertCardMessage}>{alert.message}</Text>
                      </View>

                      {isUnread ? (
                        <Pressable
                          style={styles.checkReadBtn}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            onMarkRead(alert.id);
                          }}
                          hitSlop={8}
                          accessibilityLabel="Markahan bilang nabasa"
                        >
                          <Ionicons name="checkmark" size={16} color="#0D7A52" />
                        </Pressable>
                      ) : null}
                    </View>

                    <Pressable
                      style={[
                        styles.actionPillBtn,
                        isStock ? styles.actionPillStock : styles.actionPillUtang,
                      ]}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        onActionAlert(alert);
                      }}
                    >
                      <Text
                        style={[
                          styles.actionPillText,
                          isStock ? styles.actionTextStock : styles.actionTextUtang,
                        ]}
                      >
                        {isStock ? 'Puntahan sa Imbentaryo ›' : 'Buksan ang Suki Ledger ›'}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer Action Buttons */}
          <View style={styles.footer}>
            <Pressable
              style={styles.viewAllPageBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onViewAllNotifications();
              }}
            >
              <Text style={styles.viewAllPageText}>Tingnan ang Lahat ng Abiso ›</Text>
            </Pressable>

            <Pressable
              style={styles.dismissBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onClose();
              }}
            >
              <Text style={styles.dismissBtnText}>Isara</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bellIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  headerTextGroup: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
    paddingBottom: 4,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 12,
    color: '#0D7A52',
    fontWeight: '700',
  },
  scrollArea: {
    marginTop: 6,
    maxHeight: 380,
  },
  scrollContent: {
    paddingVertical: 6,
    gap: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D7A52',
    marginTop: 10,
  },
  emptyBody: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  alertCard: {
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
  },
  alertCardUnread: {
    backgroundColor: '#FFFDF5',
    borderColor: '#FCD34D',
  },
  alertCardRead: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  alertCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  kindIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  kindIconStock: {
    backgroundColor: '#FEF3C7',
  },
  kindIconUtang: {
    backgroundColor: '#FEE2E2',
  },
  alertCardCopy: {
    flex: 1,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  bagoPill: {
    backgroundColor: '#DC2626',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  bagoPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  alertCardMessage: {
    fontSize: 12.5,
    color: '#475569',
    marginTop: 3,
    lineHeight: 17,
  },
  checkReadBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillBtn: {
    marginTop: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  actionPillStock: {
    backgroundColor: '#FEF3C7',
  },
  actionPillUtang: {
    backgroundColor: '#FEE2E2',
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionTextStock: {
    color: '#92400E',
  },
  actionTextUtang: {
    color: '#991B1B',
  },
  footer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
  },
  viewAllPageBtn: {
    backgroundColor: '#0D7A52',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewAllPageText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  dismissBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  dismissBtnText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
});
