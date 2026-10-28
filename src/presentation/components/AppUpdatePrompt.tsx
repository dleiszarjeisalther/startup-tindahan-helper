import React, { useEffect, useSyncExternalStore } from 'react';
import { AppState, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appUpdateService } from '../../infrastructure/container';
import { useTindahanStore } from '../hooks/useTindahanStore';

export function AppUpdatePrompt() {
  const state = useSyncExternalStore(appUpdateService.subscribe, appUpdateService.getSnapshot, appUpdateService.getSnapshot);
  const { cartSummary } = useTindahanStore();
  const insets = useSafeAreaInsets();

  // Safe to prompt if there's no ongoing unsaved sale items in the cart
  const isSafe = cartSummary.items.length === 0;

  useEffect(() => {
    // Check for updates when app opens
    void appUpdateService.check();

    // Check periodically (every 60s) while app is open and online for realtime detection
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        void appUpdateService.check();
      }
    }, 60000);

    // Recheck when app returns to foreground from background
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') {
        void appUpdateService.check();
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  const visible = isSafe && Boolean(state.release) && !state.dismissed && state.phase !== 'checking';
  const ready = ['ready', 'permission', 'installer'].includes(state.phase);
  const downloading = state.phase === 'downloading';
  const installing = state.phase === 'installing';
  const isError = state.phase === 'error';
  const percent = Math.floor(state.progress * 100);

  const handleOpenVideo = async () => {
    if (!state.release?.video_url) return;
    try {
      await WebBrowser.openBrowserAsync(state.release.video_url, {
        toolbarColor: '#0D7A52',
        controlsColor: '#FFFFFF',
        showTitle: true,
      });
    } catch {
      void Linking.openURL(state.release.video_url).catch(() => {});
    }
  };

  const handleManualBrowserDownload = () => {
    if (state.release?.apk_url) {
      void Linking.openURL(state.release.apk_url).catch(() => {});
    }
  };

  const handlePrimaryAction = () => {
    if (ready) {
      void appUpdateService.install();
    } else {
      void appUpdateService.download();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={appUpdateService.dismiss}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {/* Header Badge & Title */}
            <View style={styles.headerRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="sparkles" size={24} color="#059669" />
              </View>
              <View style={styles.headerTextGroup}>
                <Text style={styles.title}>
                  {state.release?.mandatory ? 'Mahalagang Update' : 'May Bagong Bersyon!'}
                </Text>
                <View style={styles.versionBadgeRow}>
                  <View style={styles.versionPillCurrent}>
                    <Text style={styles.versionTextCurrent}>
                      Kasalukuyan: v{state.installed?.version || '1.0.0'}
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={14} color="#94A3B8" />
                  <View style={styles.versionPillNew}>
                    <Text style={styles.versionTextNew}>
                      Bago: v{state.release?.version_name || ''}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Mandatory Notice */}
            {state.release?.mandatory && state.release.mandatory_reason ? (
              <View style={styles.noticeBox}>
                <Ionicons name="warning-outline" size={20} color="#B45309" style={{ marginTop: 1 }} />
                <Text style={styles.noticeText}>{state.release.mandatory_reason}</Text>
              </View>
            ) : null}

            {/* Feature Image Banner (if available) */}
            {state.release?.image_url ? (
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: state.release.image_url }}
                  style={styles.bannerImage}
                  contentFit="cover"
                  transition={300}
                />
              </View>
            ) : null}

            {/* Feature Video Format Action Card (if available) */}
            {state.release?.video_url ? (
              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [styles.videoCard, pressed && styles.videoCardPressed]}
                onPress={handleOpenVideo}
              >
                <View style={styles.videoPlayCircle}>
                  <Ionicons name="play" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
                </View>
                <View style={styles.videoTextGroup}>
                  <Text style={styles.videoTitle}>Panoorin ang Video Demo</Text>
                  <Text style={styles.videoSubtitle}>Tingnan ang aktwal na paggamit ng mga bagong feature</Text>
                </View>
                <Ionicons name="open-outline" size={18} color="#059669" />
              </Pressable>
            ) : null}

            {/* Release Notes / Feature Message */}
            <View style={styles.notesContainer}>
              <Text style={styles.notesSectionLabel}>Mga Bagong Feature at Pagbabago:</Text>
              <Text style={styles.notesText}>{state.release?.release_notes || 'May mga pagpapahusay para sa mas mabilis at maasahang paggamit ng tindahan.'}</Text>
            </View>

            {/* Download Progress Bar */}
            {downloading ? (
              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Dina-download ang update...</Text>
                  <Text style={styles.progressPercent}>{percent}%</Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${Math.max(5, percent)}%` }]} />
                </View>
              </View>
            ) : null}

            {/* Status / Instruction Message */}
            {state.message ? (
              <View style={[styles.messageBox, isError && styles.messageBoxError]}>
                <Ionicons
                  name={isError ? 'alert-circle' : ready ? 'checkmark-circle' : 'information-circle'}
                  size={18}
                  color={isError ? '#DC2626' : '#059669'}
                />
                <Text style={[styles.messageText, isError && styles.messageTextError]}>
                  {state.message}
                </Text>
              </View>
            ) : null}

            {/* Safe Data Guarantee Note */}
            <View style={styles.safetyGuaranteeRow}>
              <Ionicons name="shield-checkmark" size={16} color="#059669" />
              <Text style={styles.safetyGuaranteeText}>
                Ligtas ang iyong paninda, benta, at listahan ng utang. Hindi mawawala ang data mo.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonGroup}>
              <Pressable
                accessibilityRole="button"
                disabled={downloading || installing}
                style={[
                  styles.primaryButton,
                  (downloading || installing) && styles.disabledButton,
                  ready && styles.installButton
                ]}
                onPress={handlePrimaryAction}
              >
                <Ionicons
                  name={installing ? 'hourglass-outline' : downloading ? 'cloud-download-outline' : ready ? 'checkmark-done-circle' : 'download-outline'}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.primaryButtonText}>
                  {installing
                    ? 'Inihahanda...'
                    : downloading
                    ? `Dina-download (${percent}%)…`
                    : ready
                    ? 'I-install ang Bagong Bersyon'
                    : isError
                    ? 'Subukan Muli ang Pag-download'
                    : 'I-update Ngayon'}
                </Text>
              </Pressable>

              {/* Secondary / Dismiss Button */}
              {!state.release?.mandatory || isError ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={installing}
                  style={styles.secondaryButton}
                  onPress={appUpdateService.dismiss}
                >
                  <Text style={styles.secondaryButtonText}>
                    {downloading ? 'Ituloy ang Tindahan Habang Nagda-download' : 'Mamaya Na'}
                  </Text>
                </Pressable>
              ) : null}

              {/* Direct Browser Download Link (Emergency Fallback) */}
              {(isError || !ready) && state.release?.apk_url ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.fallbackButton}
                  onPress={handleManualBrowserDownload}
                >
                  <Ionicons name="globe-outline" size={14} color="#64748B" />
                  <Text style={styles.fallbackButtonText}>I-download nang manu-mano sa website</Text>
                </Pressable>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function AppUpdateMenuItem() {
  const state = useSyncExternalStore(appUpdateService.subscribe, appUpdateService.getSnapshot, appUpdateService.getSnapshot);
  const { cartSummary } = useTindahanStore();

  return (
    <View style={styles.menuItem}>
      <Pressable
        accessibilityRole="button"
        disabled={state.phase === 'checking'}
        style={styles.menuCheckButton}
        onPress={() => {
          if (state.release) {
            appUpdateService.show();
          } else {
            void appUpdateService.check(true);
          }
        }}
      >
        <Ionicons
          name={state.release ? 'gift' : 'sync'}
          size={18}
          color="#059669"
        />
        <Text style={styles.menuButtonText}>
          {state.phase === 'checking'
            ? 'Sinusuri kung may update…'
            : state.release
            ? 'May Bagong Update — Buksan'
            : 'Suriin ang Bagong Update'}
        </Text>
      </Pressable>

      {state.message ? <Text style={styles.menuStatusText}>{state.message}</Text> : null}
      {state.release && cartSummary.items.length > 0 ? (
        <Text style={styles.menuStatusText}>Tapusin muna ang benta bago buksan ang update.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
  },
  card: {
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#064E3B',
    letterSpacing: -0.3,
  },
  versionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  versionPillCurrent: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  versionTextCurrent: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  versionPillNew: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  versionTextNew: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    borderRadius: 16,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 18,
  },
  imageContainer: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    height: 180,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    padding: 14,
    borderRadius: 18,
  },
  videoCardPressed: {
    opacity: 0.85,
    backgroundColor: '#D1FAE5',
  },
  videoPlayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  videoTextGroup: {
    flex: 1,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#064E3B',
  },
  videoSubtitle: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  notesContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  notesSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1E293B',
  },
  progressContainer: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 4,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 14,
  },
  messageBoxError: {
    backgroundColor: '#FEF2F2',
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    color: '#166534',
    fontWeight: '500',
  },
  messageTextError: {
    color: '#991B1B',
  },
  safetyGuaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  safetyGuaranteeText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  actionButtonGroup: {
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  installButton: {
    backgroundColor: '#047857',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  fallbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  fallbackButtonText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  disabledButton: {
    opacity: 0.6,
  },
  menuItem: {
    paddingVertical: 12,
    gap: 8,
  },
  menuCheckButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#064E3B',
  },
  menuStatusText: {
    fontSize: 12,
    color: '#64748B',
    paddingHorizontal: 4,
  },
});
