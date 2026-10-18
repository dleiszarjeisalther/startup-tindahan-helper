// src/app/settings.tsx — Screen 7: Store Settings
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { getTranslations } from '@/presentation/localization/i18n';
import { FloatingToast, ToastType } from '@/presentation/components/FloatingToast';
import {
  ConfirmationModal,
  ConfirmationType,
  ConfirmationModalDetail,
} from '@/presentation/components/ConfirmationModal';
import { PinChallengeModal } from '@/presentation/components/PinChallengeModal';
import { appKeyValueStorage } from '@/infrastructure/storage/KeyValueStorage';
import { PinSecurityEngine } from '@/domain/services/PinSecurityEngine';
import { BiometricAuthService } from '@/infrastructure/services/BiometricAuthService';

interface ConfirmationState {
  type: ConfirmationType;
  title: string;
  message: string;
  itemName?: string;
  details?: ConfirmationModalDetail[];
  confirmText?: string;
  cancelText?: string | null;
  onConfirm: () => void | Promise<void>;
}

export default function StoreSettingsScreen() {
  const router = useRouter();
  const {
    settings,
    updateSettings,
    clearAllDatabaseData,
    hasOwnerPinSet,
    isStoreSecurityEnabled,
    isStoreLocked,
    setOwnerMasterPin,
    enableStoreSecurity,
    lockStore,
    isBrownoutSaverActive,
    toggleBrownoutBatterySaver,
  } = useTindahanStore();
  const t = getTranslations(settings.language);
  const [editingField, setEditingField] = useState<'NONE' | 'NAME' | 'ADDRESS'>('NONE');
  const [draftName, setDraftName] = useState(settings.storeName);
  const [draftAddress, setDraftAddress] = useState(settings.address);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>('success');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationState | null>(null);
  const [pinChallengeAction, setPinChallengeAction] = useState<(() => void) | null>(null);

  const [biometricInfo, setBiometricInfo] = useState<{
    hasHardware: boolean;
    isEnrolled: boolean;
    typeNames: string[];
  }>({
    hasHardware: false,
    isEnrolled: false,
    typeNames: [],
  });

  useEffect(() => {
    BiometricAuthService.checkCapabilities().then((cap) => {
      setBiometricInfo({
        hasHardware: cap.hasHardware,
        isEnrolled: cap.isEnrolled,
        typeNames: cap.typeNames,
      });
    });
  }, []);

  const [defaultGcashFee, setDefaultGcashFee] = useState<number>(() =>
    appKeyValueStorage.getGcashConvenienceFee()
  );
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const showToast = (msg: string, type: ToastType = 'success') => {
    setToastMsg(msg);
    setToastType(type);
  };

  const monthNames: Record<number, string> = {
    6: t.schoolMonthJune,
    7: t.schoolMonthJuly,
    8: t.schoolMonthAugust,
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FloatingToast
        message={toastMsg}
        type={toastType}
        onDismiss={() => setToastMsg(null)}
      />
      {/* Top Bar: <- Store Settings */}
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backBtn}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/more');
            }
          }}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle}>{t.storeSettingsTitle}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Store Information */}
        <Text style={styles.sectionHeader}>{t.storeInfo}</Text>
        <View style={styles.cardGroup}>
          {/* Store Name */}
          <Pressable
            style={[styles.settingRow, styles.rowBorder]}
            onPress={() =>
              setEditingField((prev) => (prev === 'NAME' ? 'NONE' : 'NAME'))
            }
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t.storeName}</Text>
              <Text style={styles.rowValue}>{settings.storeName}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {editingField === 'NAME' ? (
            <View style={styles.editBox}>
              <TextInput
                style={styles.editInput}
                value={draftName}
                onChangeText={setDraftName}
                placeholder={t.storeName}
              />
              <Pressable
                style={styles.saveMiniBtn}
                onPress={() => {
                  if (draftName.trim()) {
                    updateSettings({ storeName: draftName.trim() });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                    showToast(t.storeNameSaved, 'success');
                  }
                  setEditingField('NONE');
                }}
              >
                <Text style={styles.saveMiniText}>{t.save}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Store Logo */}
          <View style={[styles.settingRow, styles.rowBorder]}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t.storeLogo}</Text>
              <Text style={styles.rowValue}>{t.storeLogoSub}</Text>
            </View>
            <View style={styles.logoRight}>
              <View style={styles.miniStoreAvatar}>
                <Text style={styles.miniStoreEmoji}>🏪</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </View>

          {/* Address */}
          <Pressable
            style={styles.settingRow}
            onPress={() =>
              setEditingField((prev) => (prev === 'ADDRESS' ? 'NONE' : 'ADDRESS'))
            }
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t.storeAddress}</Text>
              <Text style={styles.rowValue}>{settings.address}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {editingField === 'ADDRESS' ? (
            <View style={styles.editBox}>
              <TextInput
                style={styles.editInput}
                value={draftAddress}
                onChangeText={setDraftAddress}
                placeholder={t.storeAddress}
              />
              <Pressable
                style={styles.saveMiniBtn}
                onPress={() => {
                  if (draftAddress.trim()) {
                    updateSettings({ address: draftAddress.trim() });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                    showToast(t.storeAddressSaved, 'success');
                  }
                  setEditingField('NONE');
                }}
              >
                <Text style={styles.saveMiniText}>{t.save}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Section 2: App Settings */}
        <Text style={styles.sectionHeader}>{t.appSettings}</Text>
        <View style={styles.cardGroup}>
          {/* Language Header Row */}
          <View style={[styles.settingRow, styles.rowBorder]}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t.language}</Text>
              <Text style={styles.rowValue}>{t.activeLangBadge}</Text>
            </View>
            <Ionicons name="language-outline" size={20} color="#0D7A52" />
          </View>

          {/* Functional Language Selection Chips */}
          <View style={[styles.langButtonGroup, styles.rowBorder]}>
            <Pressable
              style={[
                styles.langChip,
                settings.language === 'English' ? styles.langChipActive : null,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                updateSettings({ language: 'English' });
                const nextT = getTranslations('English');
                showToast(nextT.langChangedToast);
              }}
            >
              <Text
                style={[
                  styles.langChipText,
                  settings.language === 'English' ? styles.langChipTextActive : null,
                ]}
              >
                {t.langEnglish} {settings.language === 'English' ? '✓' : ''}
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.langChip,
                settings.language === 'Filipino' || settings.language === 'Taglish'
                  ? styles.langChipActive
                  : null,
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                updateSettings({ language: 'Filipino' });
                const nextT = getTranslations('Filipino');
                showToast(nextT.langChangedToast);
              }}
            >
              <Text
                style={[
                  styles.langChipText,
                  settings.language === 'Filipino' || settings.language === 'Taglish'
                    ? styles.langChipTextActive
                    : null,
                ]}
              >
                {t.langFilipino} {settings.language === 'Filipino' || settings.language === 'Taglish' ? '✓' : ''}
              </Text>
            </Pressable>
          </View>

          {/* Manage Categories Shortcut Row */}
          <Pressable
            style={[styles.settingRow, styles.rowBorder]}
            onPress={() => router.push('/inventory')}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t.manageCategories}</Text>
              <Text style={styles.rowValue}>{t.manageCategoriesSub}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {/* Notifications Switch */}
          <View style={[styles.settingRow, styles.rowBorder]}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t.notifications}</Text>
              <Text style={styles.rowValue}>{t.notificationsSub}</Text>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={(val) => {
                updateSettings({ notifications: val });
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                showToast(val ? t.notificationsOnToast : t.notificationsOffToast, 'info');
              }}
              trackColor={{ false: '#D1D5DB', true: '#0D7A52' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* AMOLED True-Black Brownout Battery Saver (NFR-ENV-003) */}
          <View style={styles.settingRow}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>⚡ Brownout Battery Saver (AMOLED)</Text>
              <Text style={styles.rowValue}>
                True-black (#000000) mode para sa matagalang bentahan kapag brownout
              </Text>
            </View>
            <Switch
              value={isBrownoutSaverActive}
              onValueChange={() => {
                toggleBrownoutBatterySaver();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                showToast(
                  !isBrownoutSaverActive
                    ? '⚡ Naka-on ang Brownout Battery Saver (#000000)'
                    : 'Bumalik sa karaniwang tema',
                  'info'
                );
              }}
              trackColor={{ false: '#D1D5DB', true: '#0D7A52' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Section: Store Security & Biometrics (Single Storekeeper Model) */}
        <Text style={styles.sectionHeader}>Seguridad ng Tindahan</Text>
        <View style={styles.cardGroup}>
          {/* Main Security Lock Toggle */}
          <View style={[styles.settingRow, styles.rowBorder]}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Proteksyon ng Tindahan (Security Lock)</Text>
              <Text style={styles.rowValue}>
                I-lock ang Tubo, Utang Ledger, at Settings gamit ang Fingerprint o PIN
              </Text>
            </View>
            <Switch
              value={isStoreSecurityEnabled}
              onValueChange={(val) => {
                if (val && !hasOwnerPinSet) {
                  setPinError(null);
                  setNewPin('');
                  setConfirmPin('');
                  setPinModalVisible(true);
                  showToast('Magtakda muna ng 4-digit Master PIN para i-on ang proteksyon', 'info');
                  return;
                }
                if (!val && hasOwnerPinSet) {
                  setPinChallengeAction(() => () => {
                    enableStoreSecurity(false);
                    showToast('Bukas na ang lahat ng bahagi ng tindahan', 'info');
                  });
                  return;
                }
                enableStoreSecurity(val);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                showToast(
                  val
                    ? '🔒 Naka-on ang Proteksyon ng Tindahan'
                    : 'Bukas ang lahat ng bahagi ng tindahan',
                  'info'
                );
              }}
              trackColor={{ false: '#D1D5DB', true: '#0D7A52' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Biometrics Status Row */}
          <View style={[styles.settingRow, styles.rowBorder]}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Phone Security & Biometrics</Text>
              <Text style={styles.rowValue}>
                {biometricInfo.hasHardware && biometricInfo.isEnrolled
                  ? `✅ Suportado ang ${biometricInfo.typeNames.join(' / ') || 'Biometrics'} at Device Lock`
                  : biometricInfo.hasHardware
                  ? '⚠️ Walang nakarehistrong fingerprint/face sa phone settings'
                  : 'ℹ️ Walang biometric hardware; 4-digit PIN ang gagamitin'}
              </Text>
            </View>
            <Ionicons
              name={biometricInfo.hasHardware && biometricInfo.isEnrolled ? 'finger-print' : 'hardware-chip-outline'}
              size={22}
              color={biometricInfo.hasHardware && biometricInfo.isEnrolled ? '#0D7A52' : '#6B7280'}
            />
          </View>

          {/* Backup 4-Digit PIN Row */}
          <Pressable
            style={[styles.settingRow, isStoreSecurityEnabled ? styles.rowBorder : null]}
            onPress={() => {
              setPinError(null);
              setNewPin('');
              setConfirmPin('');
              setPinModalVisible(true);
            }}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>
                {hasOwnerPinSet ? 'Palitan ang 4-Digit Backup PIN' : 'Magtakda ng 4-Digit Backup PIN'}
              </Text>
              <Text style={styles.rowValue}>
                {hasOwnerPinSet
                  ? 'Naitakda na ang PIN bilang fallback sakaling mag-fail ang fingerprint'
                  : '⚠️ Walang backup PIN: Magtakda para sa dagdag proteksyon'}
              </Text>
            </View>
            <Ionicons name="key-outline" size={20} color="#0D7A52" />
          </Pressable>

          {/* Quick Lock / Unlock Action */}
          {isStoreSecurityEnabled ? (
            <Pressable
              style={styles.settingRow}
              onPress={() => {
                if (isStoreLocked) {
                  setPinChallengeAction(() => () => {
                    showToast('🔓 Na-unlock ang tindahan', 'success');
                  });
                } else {
                  lockStore();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  showToast('🔒 Naka-lock na muli ang tindahan', 'info');
                }
              }}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>
                  {isStoreLocked ? 'I-unlock ang Tindahan (Gamitin ang PIN)' : 'I-lock Agad ang Tindahan'}
                </Text>
                <Text style={styles.rowValue}>
                  {isStoreLocked
                    ? 'Naka-lock ang tubo, utang, at inventory. I-enter ang PIN para buksan'
                    : 'Tapusin ang 5-minutong bukas na sesyon at itago ang sensitibong datos'}
                </Text>
              </View>
              <Ionicons
                name={isStoreLocked ? 'lock-open-outline' : 'lock-closed'}
                size={20}
                color={isStoreLocked ? '#0D7A52' : '#D97706'}
              />
            </Pressable>
          ) : null}
        </View>

        {/* Section: GCash & Digital Payments (FR-TND-007) */}
        <Text style={styles.sectionHeader}>Digital Payments & QR Ph</Text>
        <View style={styles.cardGroup}>
          <View style={[styles.settingRow, styles.rowBorder]}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>GCash Convenience Fee (Patong)</Text>
              <Text style={styles.rowValue}>
                Dagdag singil sa customer pantakip sa cashout / transfer fee
              </Text>
            </View>
            <Ionicons name="wallet-outline" size={20} color="#0D7A52" />
          </View>

          {/* Surcharge Option Pills */}
          <View style={[styles.feeButtonGroup, styles.rowBorder]}>
            {[0, 2, 5].map((fee) => (
              <Pressable
                key={fee}
                style={[
                  styles.feeChip,
                  defaultGcashFee === fee ? styles.feeChipActive : null,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setDefaultGcashFee(fee);
                  appKeyValueStorage.setGcashConvenienceFee(fee, fee > 0);
                  showToast(
                    fee === 0
                      ? 'Naka-set sa Walang Dagdag (+₱0)'
                      : `Default GCash Convenience Fee: +₱${fee}`
                  );
                }}
              >
                <Text
                  style={[
                    styles.feeChipText,
                    defaultGcashFee === fee ? styles.feeChipTextActive : null,
                  ]}
                >
                  {fee === 0 ? 'Walang Dagdag (+₱0)' : `+₱${fee} Fee`}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.settingRow}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Static QR Ph Standee Support</Text>
              <Text style={styles.rowValue}>
                Tumatanggap ng GCash at Maya via counter QR standee na may Reference Number audit
              </Text>
            </View>
            <Ionicons name="qr-code-outline" size={20} color="#6B7280" />
          </View>
        </View>

        {/* Section 3: Owner Controls & Seasonal Calendar */}
        <Text style={styles.sectionHeader}>{t.ownerControlsSection}</Text>
        <View style={styles.cardGroup}>
          <Pressable
            style={[styles.settingRow, styles.rowBorder]}
            onPress={() => {
              const nextMonth =
                settings.schoolOpeningMonth === 7
                  ? 6
                  : settings.schoolOpeningMonth === 6
                  ? 8
                  : 7;
              updateSettings({ schoolOpeningMonth: nextMonth });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              showToast(t.schoolOpeningToast(monthNames[nextMonth] ?? 'July'));
            }}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t.schoolOpening}</Text>
              <Text style={styles.rowValue}>
                {monthNames[settings.schoolOpeningMonth] ?? 'July'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          <View style={[styles.settingRow, styles.rowBorder]}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t.offlineStorage}</Text>
              <Text style={styles.rowValue}>{t.offlineStorageSub}</Text>
            </View>
          </View>

          <Pressable
            style={styles.settingRow}
            onPress={() => {
              setConfirmDialog({
                type: 'danger',
                title: t.clearDataConfirmTitle,
                itemName: 'Lahat ng Datos sa Tindahan (Factory Reset)',
                message: t.clearDataConfirmMessage,
                details: [
                  { label: 'Aksyon', value: 'Buburahin ang lahat ng paninda, resibo, at talaan', highlight: true },
                ],
                confirmText: t.clearDataConfirmBtn,
                cancelText: t.cancelBtn,
                onConfirm: () => {
                  setConfirmDialog(null);
                  clearAllDatabaseData();
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  showToast(t.resetSuccess, 'warning');
                },
              });
            }}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t.clearDataTitle}</Text>
              <Text style={styles.rowValue}>{t.clearDataSub}</Text>
            </View>
            <Text style={styles.chevron}>🗑️</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Styled Confirmation Modal */}
      {confirmDialog ? (
        <ConfirmationModal
          visible={true}
          type={confirmDialog.type}
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
      {/* Master PIN Configuration Modal (FR-SEC-001) */}
      <Modal
        visible={pinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPinModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pinModalContainer}>
            <View style={styles.pinModalHeader}>
              <Ionicons name="shield-checkmark" size={32} color="#0D7A52" />
              <Text style={styles.pinModalTitle}>
                {hasOwnerPinSet ? 'Palitan ang Master PIN' : 'Magtakda ng Master PIN'}
              </Text>
              <Text style={styles.pinModalSubtitle}>
                Mag-enter ng 4-digit PIN upang protektahan ang puhunan, tubo, at cashier mode.
              </Text>
            </View>

            {pinError ? (
              <View style={styles.pinErrorBox}>
                <Ionicons name="alert-circle" size={16} color="#DC2626" />
                <Text style={styles.pinErrorText}>{pinError}</Text>
              </View>
            ) : null}

            <View style={styles.pinInputGroup}>
              <Text style={styles.pinInputLabel}>Bagong 4-Digit PIN</Text>
              <TextInput
                style={styles.pinTextInput}
                value={newPin}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9]/g, '').slice(0, 4);
                  setNewPin(cleaned);
                  setPinError(null);
                }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                placeholder="••••"
                placeholderTextColor="#9CA3AF"
                textAlign="center"
              />
            </View>

            <View style={styles.pinInputGroup}>
              <Text style={styles.pinInputLabel}>Ulitin ang 4-Digit PIN</Text>
              <TextInput
                style={styles.pinTextInput}
                value={confirmPin}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9]/g, '').slice(0, 4);
                  setConfirmPin(cleaned);
                  setPinError(null);
                }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                placeholder="••••"
                placeholderTextColor="#9CA3AF"
                textAlign="center"
              />
            </View>

            <View style={styles.pinModalActions}>
              <Pressable
                style={styles.pinCancelBtn}
                onPress={() => {
                  setPinModalVisible(false);
                  setNewPin('');
                  setConfirmPin('');
                  setPinError(null);
                }}
              >
                <Text style={styles.pinCancelBtnText}>Kanselahin</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.pinSaveBtn,
                  newPin.length !== 4 || confirmPin.length !== 4
                    ? styles.pinSaveBtnDisabled
                    : null,
                ]}
                disabled={newPin.length !== 4 || confirmPin.length !== 4}
                onPress={() => {
                  if (!PinSecurityEngine.isValidPinFormat(newPin)) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                    setPinError('Dapat eksaktong 4 na numero ang PIN (0-9)');
                    return;
                  }
                  if (newPin !== confirmPin) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                    setPinError('Hindi magkatugma ang dalawang PIN');
                    return;
                  }

                  setOwnerMasterPin(newPin);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  setPinModalVisible(false);
                  setNewPin('');
                  setConfirmPin('');
                  setPinError(null);
                  showToast('✅ Matagumpay na naitakda ang Owner Master PIN (Naka-lock)');
                }}
              >
                <Text style={styles.pinSaveBtnText}>I-save ang PIN</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <PinChallengeModal
        visible={pinChallengeAction !== null}
        title="I-verify ang Owner PIN"
        subtitle="I-enter ang 4-digit PIN upang magpatuloy"
        onSuccess={() => {
          const action = pinChallengeAction;
          setPinChallengeAction(null);
          action?.();
        }}
        onCancel={() => setPinChallengeAction(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 22,
    color: '#111827',
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 120,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
    color: '#111827',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowTextCol: {
    flex: 1,
    paddingRight: 10,
    gap: 3,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  rowValue: {
    fontSize: 13,
    color: '#6B7280',
  },
  logoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  miniStoreAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  miniStoreEmoji: {
    fontSize: 18,
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  editBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  editInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  saveMiniBtn: {
    backgroundColor: '#0D7A52',
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveMiniText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  langButtonGroup: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
  },
  langChip: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#0D7A52',
  },
  langChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  langChipTextActive: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleBadgeOwner: {
    backgroundColor: '#DCFCE7',
  },
  roleBadgeCashier: {
    backgroundColor: '#FEF3C7',
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  roleBadgeTextOwner: {
    color: '#15803D',
  },
  roleBadgeTextCashier: {
    color: '#B45309',
  },
  feeButtonGroup: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
  },
  feeChip: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#0D7A52',
  },
  feeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  feeChipTextActive: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pinModalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  pinModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  pinModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginTop: 8,
  },
  pinModalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  pinErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
  pinErrorText: {
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
    flex: 1,
  },
  pinInputGroup: {
    marginBottom: 14,
  },
  pinInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  pinTextInput: {
    height: 48,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    fontSize: 22,
    letterSpacing: 8,
    fontWeight: '800',
    color: '#111827',
  },
  pinModalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  pinCancelBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  pinSaveBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#0D7A52',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinSaveBtnDisabled: {
    opacity: 0.4,
  },
  pinSaveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
