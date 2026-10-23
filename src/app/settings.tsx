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
  Image,
  Linking,
} from 'react-native';
import { ScreenSafeAreaView } from '@/presentation/components/ScreenSafeAreaView';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
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
import { GcashQrModal } from '@/presentation/components/GcashQrModal';
import { PrivacyPolicyModal } from '@/presentation/components/PrivacyPolicyModal';
import { appKeyValueStorage } from '@/infrastructure/storage/KeyValueStorage';
import { PinSecurityEngine } from '@/domain/services/PinSecurityEngine';
import { BiometricAuthService } from '@/infrastructure/services/BiometricAuthService';
import * as Clipboard from 'expo-clipboard';
import { useLicensing } from '@/presentation/hooks/useLicensing';
import { useLicensingGate } from '@/presentation/components/LicensingGate';

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
    exportDatabaseBackup,
    restoreDatabaseBackup,
    hasOwnerPinSet,
    isStoreSecurityEnabled,
    isStoreLocked,
    setOwnerMasterPin,
    enableStoreSecurity,
    lockStore,
    isBrownoutSaverActive,
    toggleBrownoutBatterySaver,
    setPhoneNotificationsEnabled,
    retryNotificationSchedule,
    notificationScheduleError,
  } = useTindahanStore();
  const t = getTranslations(settings.language);
  const licensing = useLicensing();
  const { openUpgradeModal } = useLicensingGate();
  const [copiedId, setCopiedId] = useState(false);
  const [editingField, setEditingField] = useState<
    'NONE' | 'NAME' | 'ADDRESS' | 'TIN' | 'GCASH_NUM' | 'GCASH_NAME'
  >('NONE');
  const [draftName, setDraftName] = useState(settings.storeName);
  const [draftAddress, setDraftAddress] = useState(settings.address);
  const [draftTin, setDraftTin] = useState(settings.tinNumber ?? '');
  const [draftGcashNum, setDraftGcashNum] = useState(settings.gcashNumber ?? '');
  const [draftGcashName, setDraftGcashName] = useState(settings.gcashAccountName ?? '');
  const [showGcashQrModal, setShowGcashQrModal] = useState(false);
  const [showPrivacyPolicyModal, setShowPrivacyPolicyModal] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>('success');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationState | null>(null);
  const [pinChallengeAction, setPinChallengeAction] = useState<(() => void) | null>(null);
  const [draftNotificationTime, setDraftNotificationTime] = useState('');

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

  const handleExportBackup = async () => {
    if (isBackingUp) return;
    try {
      setIsBackingUp(true);
      const res = await exportDatabaseBackup();
      if (res.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        showToast(
          `✓ Na-export ang backup! (${res.recordCounts?.products ?? 0} paninda, ${res.recordCounts?.sales_transactions ?? 0} benta)`,
          'success'
        );
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        showToast(res.error || 'Hindi natuloy ang export.', 'warning');
      }
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showToast(err instanceof Error ? err.message : 'Nabigong mag-export', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = () => {
    if (isRestoring) return;
    setConfirmDialog({
      type: 'danger',
      title: 'I-restore ang Database Backup?',
      itemName: 'Kasalukuyang Datos ng Tindahan',
      message:
        'Babala: Papalitan nito ang lahat ng kasalukuyang paninda, benta, at suki ng datos mula sa backup file. Hindi ito mababawi.',
      details: [
        {
          label: 'Paalala',
          value: 'Siguraduhing valid at pinakabagong backup file ang pipiliin.',
          highlight: true,
        },
      ],
      confirmText: 'Piliin ang Backup File',
      cancelText: t.cancelBtn,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          setIsRestoring(true);
          const res = await restoreDatabaseBackup();
          if (res.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            showToast(
              `✓ Naibalik ang datos! (${res.recordCounts?.products ?? 0} paninda, ${res.recordCounts?.sales_transactions ?? 0} benta)`,
              'success'
            );
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            showToast(res.error || 'Hindi natuloy ang pag-restore.', 'warning');
          }
        } catch (err) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
          showToast(err instanceof Error ? err.message : 'Nabigong mag-restore', 'error');
        } finally {
          setIsRestoring(false);
        }
      },
    });
  };

  const monthNames: Record<number, string> = {
    6: t.schoolMonthJune,
    7: t.schoolMonthJuly,
    8: t.schoolMonthAugust,
  };

  return (
    <ScreenSafeAreaView style={styles.safeArea}>
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
        {/* Section 0: Licensing & Pro Status */}
        <Text style={styles.sectionHeader}>Lisensya at Tindahan ID</Text>
        <View style={styles.cardGroup}>
          <View style={[styles.settingRow, styles.rowBorder]}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Tindahan ID</Text>
              <Text style={[styles.rowValue, { fontWeight: '800', letterSpacing: 1, color: '#111827' }]}>
                {licensing.deviceId}
              </Text>
            </View>
            <Pressable
              style={{
                backgroundColor: '#D1FAE5',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              }}
              onPress={async () => {
                await Clipboard.setStringAsync(licensing.deviceId);
                setCopiedId(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                showToast('Nakopya ang Tindahan ID!', 'success');
                setTimeout(() => setCopiedId(false), 2000);
              }}
            >
              <Ionicons
                name={copiedId ? 'checkmark' : 'copy-outline'}
                size={14}
                color="#059669"
              />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#059669' }}>
                {copiedId ? 'Nakopya' : 'Kopyahin'}
              </Text>
            </Pressable>
          </View>

          <View style={[styles.settingRow, !licensing.isLicensed ? styles.rowBorder : null]}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Status ng Lisensya</Text>
              <Text
                style={[
                  styles.rowValue,
                  {
                    color: licensing.isLicensed
                      ? '#059669'
                      : licensing.isTrialExpired
                      ? '#DC2626'
                      : '#D97706',
                    fontWeight: '700',
                  },
                ]}
              >
                {licensing.isLicensed
                  ? 'PRO LIFETIME ACTIVE 🟢'
                  : licensing.isTrialExpired
                  ? 'TAPOS NA ANG TRIAL 🔴'
                  : `LIBRENG TRIAL (${licensing.timeRemainingLabel} natitira) 🟡`}
              </Text>
            </View>
          </View>

          {/* Sync Button */}
          {!licensing.isLicensed ? (
            <Pressable
              style={[styles.settingRow, styles.rowBorder]}
              onPress={async () => {
                const updated = await licensing.syncTrialStatusWithServer();
                Haptics.notificationAsync(
                  updated ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning
                ).catch(() => {});
                setToastType(updated ? 'success' : 'info');
                setToastMsg(
                  updated
                    ? 'Matagumpay na na-sync ang pinakabagong trial expiry mula sa Supabase!'
                    : 'Up to date na ang trial status mula sa server.'
                );
              }}
            >
              <View style={styles.rowTextCol}>
                <Text style={styles.rowTitle}>I-sync ang Trial sa Server</Text>
                <Text style={styles.rowValue}>Kunin ang live na trial expiry mula sa Supabase</Text>
              </View>
              <Ionicons name="cloud-download-outline" size={20} color="#0284C7" />
            </Pressable>
          ) : null}

          {!licensing.isLicensed ? (
            <Pressable
              style={[styles.settingRow, { backgroundColor: '#ECFDF5', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 }]}
              onPress={openUpgradeModal}
            >
              <View style={styles.rowTextCol}>
                <Text style={[styles.rowTitle, { color: '#059669', fontWeight: '800' }]}>
                  {licensing.isTrialExpired ? 'I-unlock ang App (Magbayad / PIN)' : 'I-upgrade sa Pro Lifetime Access'}
                </Text>
                <Text style={[styles.rowValue, { color: '#047857' }]}>
                  I-submit ang GCash o i-enter ang 6-digit PIN ›
                </Text>
              </View>
              <Ionicons name="key" size={20} color="#059669" />
            </Pressable>
          ) : null}
        </View>

        {/* Section 1: Store Information */}
        <Text style={styles.sectionHeader}>{t.storeInfo}</Text>
        <View style={styles.cardGroup}>
          {/* Store Name */}
          <Pressable
            style={[styles.settingRow, styles.rowBorder]}
            onPress={() => {
              setDraftName(settings.storeName);
              setEditingField((prev) => (prev === 'NAME' ? 'NONE' : 'NAME'));
            }}
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
            style={[styles.settingRow, styles.rowBorder]}
            onPress={() => {
              setDraftAddress(settings.address);
              setEditingField((prev) => (prev === 'ADDRESS' ? 'NONE' : 'ADDRESS'));
            }}
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

          {/* TIN Number (Tax Identification Number) for BIR Compliance */}
          <Pressable
            style={styles.settingRow}
            onPress={() => {
              setDraftTin(settings.tinNumber ?? '');
              setEditingField((prev) => (prev === 'TIN' ? 'NONE' : 'TIN'));
            }}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>TIN Number (BIR Customer Sales Slip)</Text>
              <Text style={styles.rowValue}>
                {settings.tinNumber && settings.tinNumber.trim().length > 0
                  ? settings.tinNumber
                  : 'Walang TIN (Opsyonal — i-click upang maglagay)'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {editingField === 'TIN' ? (
            <View style={styles.editBox}>
              <TextInput
                style={styles.editInput}
                value={draftTin}
                onChangeText={setDraftTin}
                placeholder="Hal. 123-456-789-000"
                keyboardType="numbers-and-punctuation"
              />
              <Pressable
                style={styles.saveMiniBtn}
                onPress={() => {
                  updateSettings({ tinNumber: draftTin.trim() });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  showToast('✓ Naitakda ang TIN number para sa resibo', 'success');
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
            onPress={() => router.navigate('/inventory')}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>{t.manageCategories}</Text>
              <Text style={styles.rowValue}>{t.manageCategoriesSub}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {/* In-app notification center */}
          <View style={[styles.settingRow, styles.rowBorder]}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>In-app alerts</Text>
              <Text style={styles.rowValue}>Low stock at overdue utang sa notification center</Text>
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

          {/* Local phone notifications */}
          <View style={[styles.settingRow, styles.rowBorder]}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Phone notifications</Text>
              <Text style={styles.rowValue}>Private daily summary sa notification tray</Text>
            </View>
            <Switch
              value={settings.phoneNotifications}
              onValueChange={async (val) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                const changed = await setPhoneNotificationsEnabled(val);
                if (!changed && val) {
                  showToast('Kailangan ang notification permission ng phone.', 'error');
                } else {
                  showToast(val ? 'Naka-on ang phone summaries.' : 'Naka-off ang phone summaries.', 'info');
                }
              }}
              trackColor={{ false: '#D1D5DB', true: '#0D7A52' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.notificationScheduleBox, styles.rowBorder]}>
            <Text style={styles.rowTitle}>Oras ng daily summary</Text>
            <Text style={styles.rowValue}>Magdagdag ng hanggang 3 oras sa 24-hour format.</Text>
            <View style={styles.notificationTimeInputRow}>
              <TextInput
                style={styles.notificationTimeInput}
                value={draftNotificationTime}
                onChangeText={setDraftNotificationTime}
                placeholder="hal. 12:00"
                placeholderTextColor="#9CA3AF"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
              <Pressable
                style={styles.addTimeButton}
                disabled={settings.notificationTimes.length >= 3}
                onPress={() => {
                  const clean = draftNotificationTime.trim();
                  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clean)) {
                    showToast('Gamitin ang format na HH:MM, hal. 07:00.', 'error');
                    return;
                  }
                  if (settings.notificationTimes.includes(clean)) {
                    showToast('Nakalista na ang oras na ito.', 'info');
                    return;
                  }
                  updateSettings({ notificationTimes: [...settings.notificationTimes, clean] });
                  setDraftNotificationTime('');
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                }}
              >
                <Text style={styles.addTimeButtonText}>Idagdag</Text>
              </Pressable>
            </View>
            <View style={styles.notificationTimeChips}>
              {settings.notificationTimes.map((time) => (
                <View key={time} style={styles.notificationTimeChip}>
                  <Ionicons name="time-outline" size={17} color="#0D7A52" />
                  <Text style={styles.notificationTimeText}>{time}</Text>
                  <Pressable
                    style={styles.removeTimeButton}
                    disabled={settings.notificationTimes.length === 1}
                    onPress={() =>
                      updateSettings({
                        notificationTimes: settings.notificationTimes.filter((item) => item !== time),
                      })
                    }
                    accessibilityLabel={`Alisin ang ${time}`}
                  >
                    <Ionicons
                      name="close"
                      size={18}
                      color={settings.notificationTimes.length === 1 ? '#CBD5E1' : '#64748B'}
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>

          {notificationScheduleError ? (
            <View style={styles.notificationErrorBox}>
              <Ionicons name="warning-outline" size={20} color="#B91C1C" />
              <View style={styles.notificationErrorCopy}>
                <Text style={styles.notificationErrorTitle}>Hindi ma-schedule ang phone alerts</Text>
                <Text style={styles.notificationErrorText}>{notificationScheduleError}</Text>
              </View>
              <Pressable
                style={styles.notificationRetryButton}
                onPress={async () => {
                  await retryNotificationSchedule();
                  showToast('Sinubukang muli ang notification schedule.', 'info');
                }}
              >
                <Text style={styles.notificationRetryText}>Retry</Text>
              </Pressable>
              <Pressable style={styles.notificationSettingsButton} onPress={() => Linking.openSettings()}>
                <Ionicons name="settings-outline" size={18} color="#B91C1C" />
              </Pressable>
            </View>
          ) : null}

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

          {/* QR Standee Card with Preview and Action Buttons */}
          <View style={[styles.settingRow, styles.rowBorder]}>
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Counter GCash / QR Ph Standee</Text>
              <Text style={styles.rowValue}>
                I-display sa customer counter o i-download para i-print
              </Text>
            </View>
            {settings.gcashQrImageUri ? (
              <Image
                source={{ uri: settings.gcashQrImageUri }}
                style={styles.settingsQrThumb}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.settingsQrPlaceholder}>
                <Ionicons name="qr-code" size={22} color="#0D7A52" />
              </View>
            )}
          </View>

          {/* QR Actions: View Fullscreen & Upload / Change */}
          <View style={[styles.qrActionRow, styles.rowBorder]}>
            <Pressable
              style={styles.qrActionBtnSecondary}
              onPress={() => setShowGcashQrModal(true)}
            >
              <Ionicons name="expand-outline" size={16} color="#0D7A52" />
              <Text style={styles.qrActionBtnTextSecondary}>I-view / I-download</Text>
            </Pressable>

            <Pressable
              style={styles.qrActionBtnPrimary}
              onPress={async () => {
                try {
                  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (!perm.granted) {
                    showToast('Kailangan ng pahintulot sa gallery.', 'warning');
                    return;
                  }
                  const res = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.9,
                  });
                  if (!res.canceled && res.assets && res.assets.length > 0) {
                    const newUri = res.assets[0].uri;
                    updateSettings({ gcashQrImageUri: newUri });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                    showToast('✓ Na-update ang QR Standee image!', 'success');
                  }
                } catch {
                  showToast('Hindi napili ang larawan.', 'error');
                }
              }}
            >
              <Ionicons name="image-outline" size={16} color="#FFFFFF" />
              <Text style={styles.qrActionBtnTextPrimary}>Palitan ang QR</Text>
            </Pressable>
          </View>

          {/* GCash Registered Mobile Number */}
          <Pressable
            style={[styles.settingRow, styles.rowBorder]}
            onPress={() => {
              setDraftGcashNum(settings.gcashNumber ?? '');
              setEditingField((prev) => (prev === 'GCASH_NUM' ? 'NONE' : 'GCASH_NUM'));
            }}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>GCash Registered Mobile Number</Text>
              <Text style={styles.rowValue}>
                {settings.gcashNumber && settings.gcashNumber.trim().length > 0
                  ? settings.gcashNumber
                  : 'Walang nakatakdang numero (Hal. 0917 123 4567)'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {editingField === 'GCASH_NUM' ? (
            <View style={styles.editBox}>
              <TextInput
                style={styles.editInput}
                value={draftGcashNum}
                onChangeText={setDraftGcashNum}
                placeholder="Hal. 0917 123 4567"
                keyboardType="phone-pad"
              />
              <Pressable
                style={styles.saveMiniBtn}
                onPress={() => {
                  updateSettings({ gcashNumber: draftGcashNum.trim() });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  showToast('✓ Na-save ang GCash mobile number', 'success');
                  setEditingField('NONE');
                }}
              >
                <Text style={styles.saveMiniText}>{t.save}</Text>
              </Pressable>
            </View>
          ) : null}

          {/* GCash Registered Account Name */}
          <Pressable
            style={styles.settingRow}
            onPress={() => {
              setDraftGcashName(settings.gcashAccountName ?? '');
              setEditingField((prev) => (prev === 'GCASH_NAME' ? 'NONE' : 'GCASH_NAME'));
            }}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>GCash Registered Account Name</Text>
              <Text style={styles.rowValue}>
                {settings.gcashAccountName && settings.gcashAccountName.trim().length > 0
                  ? settings.gcashAccountName
                  : 'Walang nakatakdang pangalan (Hal. Juan Dela Cruz)'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {editingField === 'GCASH_NAME' ? (
            <View style={styles.editBox}>
              <TextInput
                style={styles.editInput}
                value={draftGcashName}
                onChangeText={setDraftGcashName}
                placeholder="Hal. Juan Dela Cruz"
              />
              <Pressable
                style={styles.saveMiniBtn}
                onPress={() => {
                  updateSettings({ gcashAccountName: draftGcashName.trim() });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  showToast('✓ Na-save ang GCash account name', 'success');
                  setEditingField('NONE');
                }}
              >
                <Text style={styles.saveMiniText}>{t.save}</Text>
              </Pressable>
            </View>
          ) : null}
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

          {/* Privacy Policy / Data Privacy Act Compliance */}
          <Pressable
            style={[styles.settingRow, styles.rowBorder]}
            onPress={() => setShowPrivacyPolicyModal(true)}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Patakaran sa Privacy (Data Privacy Act RA 10173)</Text>
              <Text style={styles.rowValue}>
                100% offline, ligtas ang listahan ng utang at benta sa cellphone mo
              </Text>
            </View>
            <Ionicons name="shield-checkmark-outline" size={20} color="#0D7A52" />
          </Pressable>

          {/* Backup Database Row */}
          <Pressable
            style={[styles.settingRow, styles.rowBorder]}
            disabled={isBackingUp}
            onPress={handleExportBackup}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Backup / I-export ang Database</Text>
              <Text style={styles.rowValue}>
                {isBackingUp
                  ? 'Kasalukuyang nag-eexport ng backup...'
                  : 'I-save ang mga paninda, benta, at suki sa Google Drive o storage'}
              </Text>
            </View>
            <Text style={styles.chevron}>{isBackingUp ? '⏳' : '📤'}</Text>
          </Pressable>

          {/* Restore Database Row */}
          <Pressable
            style={[styles.settingRow, styles.rowBorder]}
            disabled={isRestoring}
            onPress={handleRestoreBackup}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle}>Restore / Ibalik ang Database</Text>
              <Text style={styles.rowValue}>
                {isRestoring
                  ? 'Kasalukuyang nag-rerestore...'
                  : 'Ibalik ang mga talaan mula sa na-export na backup file'}
              </Text>
            </View>
            <Text style={styles.chevron}>{isRestoring ? '⏳' : '📥'}</Text>
          </Pressable>

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

      <GcashQrModal
        visible={showGcashQrModal}
        onClose={() => setShowGcashQrModal(false)}
        qrImageUri={settings.gcashQrImageUri}
        gcashNumber={settings.gcashNumber || '0917 123 4567'}
        gcashAccountName={settings.gcashAccountName || settings.storeName}
        onUpdateQrImage={(newUri) => {
          updateSettings({ gcashQrImageUri: newUri });
          showToast('✓ Na-update ang GCash QR image!', 'success');
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
  notificationScheduleBox: { paddingVertical: 14, gap: 8 },
  notificationTimeInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  notificationTimeInput: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#F8FAFC',
  },
  addTimeButton: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#0D7A52',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTimeButtonText: { color: '#FFFFFF', fontWeight: '800' },
  notificationTimeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  notificationTimeChip: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    borderRadius: 24,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  notificationTimeText: { marginLeft: 6, color: '#065F46', fontWeight: '800' },
  removeTimeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  notificationErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#FEF2F2',
  },
  notificationErrorCopy: { flex: 1 },
  notificationErrorTitle: { color: '#991B1B', fontSize: 12, fontWeight: '900' },
  notificationErrorText: { color: '#B91C1C', fontSize: 11, marginTop: 2 },
  notificationRetryButton: {
    minHeight: 48,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationRetryText: { color: '#B91C1C', fontWeight: '900' },
  notificationSettingsButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
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
  settingsQrThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingsQrPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  qrActionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
  },
  qrActionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 9,
    borderRadius: 10,
  },
  qrActionBtnTextSecondary: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0D7A52',
  },
  qrActionBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0D7A52',
    paddingVertical: 9,
    borderRadius: 10,
  },
  qrActionBtnTextPrimary: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
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
