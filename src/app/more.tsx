// src/app/more.tsx — Screen 6: Menu / Profile ("Juan's Store — Owner")
import { AppUpdateMenuItem } from '@/presentation/components/AppUpdatePrompt';
import React, { useState } from 'react';
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
  } = useTindahanStore();

  const t = getTranslations(settings?.language);

  const [activeSection, setActiveSection] = useState<
    'NONE' | 'SUBSCRIPTION' | 'HELP'
  >('NONE');
  const [showGcashQrModal, setShowGcashQrModal] = useState(false);
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationState | null>(null);

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
        onPress={() => router.push('/settings')}
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
          {/* 1. Store Settings -> Screen 7 */}
          <AppUpdateMenuItem />
          <Pressable
            style={styles.menuRow}
            onPress={() => router.push('/settings')}
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
            onPress={() => router.push('/products')}
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
            onPress={() => router.push('/explore')}
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
            onPress={() => router.push('/inventory')}
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
            onPress={() => router.push('/history')}
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
            onPress={() => router.push('/utang')}
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
                  router.push('/');
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
});
