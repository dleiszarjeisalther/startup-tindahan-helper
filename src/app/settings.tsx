// src/app/settings.tsx — Screen 7: Store Settings
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '@/presentation/hooks/useTindahanStore';
import { getTranslations } from '@/presentation/localization/i18n';
import { FloatingToast, ToastType } from '@/presentation/components/FloatingToast';

export default function StoreSettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings, clearAllDatabaseData } =
    useTindahanStore();
  const t = getTranslations(settings.language);
  const [editingField, setEditingField] = useState<'NONE' | 'NAME' | 'ADDRESS'>('NONE');
  const [draftName, setDraftName] = useState(settings.storeName);
  const [draftAddress, setDraftAddress] = useState(settings.address);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<ToastType>('success');

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
          <View style={styles.settingRow}>
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
              Alert.alert(
                t.clearDataConfirmTitle,
                t.clearDataConfirmMessage,
                [
                  { text: t.cancelBtn, style: 'cancel' },
                  {
                    text: t.clearDataConfirmBtn,
                    style: 'destructive',
                    onPress: () => {
                      clearAllDatabaseData();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                      showToast(t.resetSuccess, 'warning');
                      Alert.alert(
                        t.resetSuccess,
                        t.clearDataConfirmMessage
                      );
                    },
                  },
                ]
              );
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
});
