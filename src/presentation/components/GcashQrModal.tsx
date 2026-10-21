// src/presentation/components/GcashQrModal.tsx
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export interface GcashQrModalProps {
  visible: boolean;
  onClose: () => void;
  qrImageUri?: string;
  gcashNumber?: string;
  gcashAccountName?: string;
  onUpdateQrImage?: (uri: string) => void | Promise<void>;
}

// High-quality fallback QR Ph logo SVG / graphic illustration placeholder
const DEFAULT_GCASH_STAND_IN = 'https://tindahanhelper.wuaze.com/assets/images/gcash_qr.png';

export function GcashQrModal({
  visible,
  onClose,
  qrImageUri,
  gcashNumber = '0917 123 4567',
  gcashAccountName = 'Tindahan Owner',
  onUpdateQrImage,
}: GcashQrModalProps) {
  const [copiedField, setCopiedField] = useState<'number' | 'name' | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [showMayaGuide, setShowMayaGuide] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  if (!visible) return null;

  const activeQrUri = qrImageUri && qrImageUri.trim().length > 0 ? qrImageUri : DEFAULT_GCASH_STAND_IN;
  const isCustomUploaded = Boolean(qrImageUri && qrImageUri.trim().length > 0);

  const triggerToast = (msg: string) => {
    setStatusToast(msg);
    setTimeout(() => setStatusToast(null), 3000);
  };

  const handleCopy = async (text: string, field: 'number' | 'name') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const clean = text.replace(/[^0-9]/g, '');
    await Clipboard.setStringAsync(field === 'number' && clean.length >= 10 ? clean : text);
    setCopiedField(field);
    triggerToast(field === 'number' ? `✓ Nakopya ang numero: ${text}` : `✓ Nakopya ang pangalan: ${text}`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleDownloadOrShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsSharing(true);

    try {
      if (Platform.OS === 'web') {
        // Trigger browser download via anchor tag
        const link = document.createElement('a');
        link.href = activeQrUri;
        link.download = `tindahan-gcash-qr-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        triggerToast('✓ Na-download ang QR Code sa iyong browser!');
        setIsSharing(false);
        return;
      }

      // Check if native sharing is available
      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        triggerToast('⚠️ Hindi suportado ang file sharing sa device na ito.');
        setIsSharing(false);
        return;
      }

      let shareableUri = activeQrUri;

      // If remote HTTP URL, download to cache first
      if (activeQrUri.startsWith('http://') || activeQrUri.startsWith('https://')) {
        const file = await File.downloadFileAsync(activeQrUri, Paths.cache);
        shareableUri = file.uri;
      }

      await Sharing.shareAsync(shareableUri, {
        mimeType: 'image/png',
        dialogTitle: 'I-save o Ibahagi ang GCash QR Code',
        UTI: 'public.png',
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      triggerToast('✓ Na-save o naibahagi ang QR Code!');
    } catch (err) {
      console.warn('[GcashQrModal] Share error:', err);
      triggerToast('⚠️ Hindi natapos ang pag-download ng QR code.');
    } finally {
      setIsSharing(false);
    }
  };

  const handlePickNewImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const chosenUri = result.assets[0].uri;
        if (onUpdateQrImage) {
          await onUpdateQrImage(chosenUri);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          triggerToast('✓ Na-update ang iyong tindahan GCash QR Code!');
        }
      }
    } catch (err) {
      console.warn('[GcashQrModal] Pick image error:', err);
      triggerToast('⚠️ Hindi na-upload ang larawan.');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <View style={styles.gcashLogoWrap}>
              <Ionicons name="qr-code" size={22} color="#005CE6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>GCash &amp; QR Ph Standee</Text>
              <Text style={styles.headerSubtitle}>I-scan ng customer para magbayad</Text>
            </View>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color="#4B5563" />
          </Pressable>
        </View>

        {statusToast ? (
          <View style={styles.toastBanner}>
            <Text style={styles.toastBannerText}>{statusToast}</Text>
          </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Main QR Card Container */}
          <View style={styles.qrCard}>
            <View style={styles.qrHeaderRow}>
              <View style={styles.qrPhBadge}>
                <Text style={styles.qrPhBadgeText}>QR Ph Interoperable</Text>
              </View>
              <Text style={styles.storeDisplayName} numberOfLines={1}>
                {gcashAccountName}
              </Text>
            </View>

            {/* QR Image Frame */}
            <View style={styles.imageFrame}>
              <Image
                source={{ uri: activeQrUri }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>

            {/* Uploaded Indicator */}
            {!isCustomUploaded && (
              <View style={styles.sampleBadge}>
                <Text style={styles.sampleBadgeText}>
                  Default Sample QR • I-upload ang sarili mong QR standee sa ibaba
                </Text>
              </View>
            )}

            {/* Account Details with Copy Buttons */}
            <View style={styles.accountBox}>
              <View style={styles.accountRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>GCASH MOBILE NUMBER:</Text>
                  <Text style={styles.fieldValueNumber}>{gcashNumber}</Text>
                </View>
                <Pressable
                  style={[styles.copyBtn, copiedField === 'number' && styles.copyBtnActive]}
                  onPress={() => handleCopy(gcashNumber, 'number')}
                >
                  <Ionicons
                    name={copiedField === 'number' ? 'checkmark' : 'copy-outline'}
                    size={14}
                    color={copiedField === 'number' ? '#059669' : '#005CE6'}
                  />
                  <Text
                    style={[
                      styles.copyBtnText,
                      copiedField === 'number' && styles.copyBtnTextActive,
                    ]}
                  >
                    {copiedField === 'number' ? 'Kopya na' : 'Kopyahin'}
                  </Text>
                </Pressable>
              </View>

              <View style={[styles.accountRow, { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>ACCOUNT NAME:</Text>
                  <Text style={styles.fieldValueName}>{gcashAccountName}</Text>
                </View>
                <Pressable
                  style={[styles.copyBtn, copiedField === 'name' && styles.copyBtnActive]}
                  onPress={() => handleCopy(gcashAccountName, 'name')}
                >
                  <Ionicons
                    name={copiedField === 'name' ? 'checkmark' : 'copy-outline'}
                    size={14}
                    color={copiedField === 'name' ? '#059669' : '#005CE6'}
                  />
                  <Text
                    style={[
                      styles.copyBtnText,
                      copiedField === 'name' && styles.copyBtnTextActive,
                    ]}
                  >
                    {copiedField === 'name' ? 'Kopya na' : 'Kopyahin'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Action Buttons: Download & Upload */}
            <View style={styles.buttonActionRow}>
              <Pressable
                style={[styles.downloadBtn, isSharing && styles.btnDisabled]}
                onPress={handleDownloadOrShare}
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.downloadBtnText}>I-download / I-save ang QR</Text>
                  </>
                )}
              </Pressable>

              {onUpdateQrImage ? (
                <Pressable style={styles.uploadBtn} onPress={handlePickNewImage}>
                  <Ionicons name="cloud-upload-outline" size={17} color="#0D7A52" />
                  <Text style={styles.uploadBtnText}>
                    {isCustomUploaded ? 'Palitan ang QR' : 'I-upload ang Aking QR'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* Maya & Bank Transfer (InstaPay) Guide Accordion */}
          <View style={styles.guideCard}>
            <Pressable
              style={styles.guideHeader}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShowMayaGuide(!showMayaGuide);
              }}
            >
              <View style={styles.guideHeaderLeft}>
                <View style={styles.bankIconCircle}>
                  <Ionicons name="card-outline" size={18} color="#0D7A52" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guideHeaderTitle}>
                    Pano kung Maya o Bangko ang gamit ng suki?
                  </Text>
                  <Text style={styles.guideHeaderSubtitle}>
                    Gabay sa QR Ph Scan at InstaPay Bank Transfer
                  </Text>
                </View>
              </View>
              <Ionicons
                name={showMayaGuide ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </Pressable>

            {showMayaGuide ? (
              <View style={styles.guideContent}>
                {/* Method 1: QR Ph Scan */}
                <View style={styles.methodBox}>
                  <View style={styles.methodTitleRow}>
                    <Ionicons name="scan-circle-outline" size={18} color="#005CE6" />
                    <Text style={styles.methodTitle}>Paraan 1: I-scan gamit ang QR Ph</Text>
                  </View>
                  <Text style={styles.methodDescription}>
                    Kung ang iyong QR code ay may maliit na logo ng <Text style={styles.bold}>QR Ph</Text> sa gitna (asul, pula, at dilaw), puwede itong i-scan nang direkta gamit ang:
                  </Text>
                  <View style={styles.pillRow}>
                    {['Maya', 'BDO', 'BPI', 'UnionBank', 'SeaBank', 'GoTyme', 'RCBC'].map((app) => (
                      <View key={app} style={styles.appPill}>
                        <Text style={styles.appPillText}>{app}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.methodSubtext}>
                    Buksan lang ng customer ang kanilang app ➔ Piliin ang &quot;Scan to Pay / QR&quot; ➔ I-scan ang standee na ito.
                  </Text>
                </View>

                {/* Method 2: Bank Transfer via InstaPay */}
                <View style={[styles.methodBox, { marginTop: 10 }]}>
                  <View style={styles.methodTitleRow}>
                    <Ionicons name="swap-horizontal-outline" size={18} color="#059669" />
                    <Text style={styles.methodTitle}>Paraan 2: Bank Transfer (InstaPay to GCash)</Text>
                  </View>
                  <Text style={styles.methodDescription}>
                    Kung personal GCash QR ito o ayaw mag-scan ng camera ng customer, puwede silang mag-transfer mula sa Maya o anumang bangko:
                  </Text>
                  <View style={styles.stepsList}>
                    <Text style={styles.stepItem}>
                      1. Sa Maya / Banking App, pumunta sa <Text style={styles.bold}>Bank Transfer</Text>.
                    </Text>
                    <Text style={styles.stepItem}>
                      2. Piliin ang <Text style={styles.bold}>GCash</Text> (o <Text style={styles.bold}>G-Xchange / GXI</Text>).
                    </Text>
                    <Text style={styles.stepItem}>
                      3. Ilagay ang Account Number: <Text style={styles.bold}>{gcashNumber}</Text>.
                    </Text>
                    <Text style={styles.stepItem}>
                      4. Ilagay ang Account Name: <Text style={styles.bold}>{gcashAccountName}</Text>.
                    </Text>
                    <Text style={styles.stepItem}>
                      5. I-send ang bayad via <Text style={styles.bold}>InstaPay</Text> (real-time papasok).
                    </Text>
                  </View>
                  <View style={styles.tipNotice}>
                    <Ionicons name="information-circle-outline" size={16} color="#065F46" />
                    <Text style={styles.tipNoticeText}>
                      Humingi ng screenshot o tingnan ang GCash Reference Number upang makumpirma sa POS.
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>

        {/* Footer Dismiss Button */}
        <View style={styles.footer}>
          <Pressable style={styles.dismissBtn} onPress={onClose}>
            <Text style={styles.dismissBtnText}>Isara</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  gcashLogoWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
  },
  closeBtn: {
    padding: 6,
  },
  toastBanner: {
    backgroundColor: '#065F46',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastBannerText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  qrHeaderRow: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  qrPhBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  qrPhBadgeText: {
    fontSize: 10.5,
    color: '#1D4ED8',
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  storeDisplayName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  imageFrame: {
    width: 250,
    height: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#005CE6',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#005CE6',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  qrImage: {
    width: '100%',
    height: '100%',
  },
  sampleBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 10,
  },
  sampleBadgeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
  accountBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 9.5,
    color: '#64748B',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  fieldValueNumber: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  fieldValueName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  copyBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#005CE6',
  },
  copyBtnTextActive: {
    color: '#059669',
  },
  buttonActionRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  downloadBtn: {
    flex: 1,
    backgroundColor: '#005CE6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 2,
  },
  downloadBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  uploadBtn: {
    flex: 1,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  uploadBtnText: {
    color: '#0D7A52',
    fontSize: 13,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  guideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  guideHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bankIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideHeaderTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  guideHeaderSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  guideContent: {
    padding: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  methodBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  methodTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  methodDescription: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 17,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 8,
  },
  appPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  appPillText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#334155',
  },
  methodSubtext: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
  },
  stepsList: {
    gap: 4,
    marginVertical: 6,
  },
  stepItem: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 17,
  },
  tipNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  tipNoticeText: {
    fontSize: 11,
    color: '#065F46',
    flex: 1,
    lineHeight: 15,
  },
  bold: {
    fontWeight: '700',
    color: '#0F172A',
  },
  footer: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  dismissBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  dismissBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
