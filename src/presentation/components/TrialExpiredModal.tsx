// src/presentation/components/TrialExpiredModal.tsx
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLicensing } from '../hooks/useLicensing';

interface TrialExpiredModalProps {
  visible: boolean;
  canDismiss?: boolean;
  onClose?: () => void;
}

export function TrialExpiredModal({
  visible,
  canDismiss = false,
  onClose,
}: TrialExpiredModalProps) {
  const {
    deviceId,
    isLicensed,
    isTrialExpired,
    isClockTampered,
    isQuotaExceeded,
    completedSalesCount,
    maxTrialSales,
    gcashNumber,
    gcashName,
    proPrice,
    verifyPin,
    submitPaymentProof,
    checkOnlineApproval,
  } = useLicensing();

  const [enteredPin, setEnteredPin] = useState('');
  const [gcashRef, setGcashRef] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ uri: string; base64?: string } | null>(null);
  const [submittingRef, setSubmittingRef] = useState(false);
  const [checkingApproval, setCheckingApproval] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pickReceiptImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedImage({
          uri: asset.uri,
          base64: asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined,
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch {
      setErrorMessage('Hindi mabuksan ang gallery ng litrato. Pakisuyong subukan muli.');
    }
  };

  const copyToClipboard = async (text: string, fieldName: string) => {
    await Clipboard.setStringAsync(text);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleVerifyPin = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!enteredPin.trim() || enteredPin.trim().length !== 6) {
      setErrorMessage('Pakilagay ang 6-digit activation PIN.');
      return;
    }

    const res = verifyPin(enteredPin);
    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSuccessMessage(res.message);
      if (onClose) {
        setTimeout(onClose, 1500);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrorMessage(res.message);
    }
  };

  const handleSubmitGcashRef = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!gcashRef.trim() || gcashRef.trim().length < 6) {
      setErrorMessage('Pakilagay ang wastong GCash Reference Number.');
      return;
    }

    setSubmittingRef(true);
    const res = await submitPaymentProof({
      gcashReference: gcashRef.trim(),
      receiptBase64: selectedImage?.base64,
    });
    setSubmittingRef(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSuccessMessage(res.message);
      setGcashRef('');
      setSelectedImage(null);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErrorMessage(res.message);
    }
  };

  const handleCheckApproval = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setCheckingApproval(true);

    const res = await checkOnlineApproval();
    setCheckingApproval(false);

    if (res.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setSuccessMessage(res.message);
      if (onClose) {
        setTimeout(onClose, 1500);
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setErrorMessage(res.message);
    }
  };

  if (!visible) return null;

  const isStrictLock = isTrialExpired && !isLicensed && !canDismiss;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={() => {
        if (!isStrictLock && onClose) onClose();
      }}
    >
      <View style={styles.container}>
        {/* Dismiss Button (Only if user opened manually before expiry) */}
        {!isStrictLock && onClose && (
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        )}

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Header Icon */}
          <View style={styles.lockBadge}>
            <Ionicons
              name={
                isClockTampered
                  ? 'warning'
                  : isQuotaExceeded
                  ? 'trending-up'
                  : 'lock-closed'
              }
              size={44}
              color={
                isClockTampered
                  ? '#D97706'
                  : isQuotaExceeded
                  ? '#2563EB'
                  : '#DC2626'
              }
            />
          </View>

          <Text style={styles.title}>
            {isClockTampered
              ? 'Naantala ang Oras ng Device'
              : isQuotaExceeded
              ? `Naabot ang Limit (${completedSalesCount}/${maxTrialSales} Benta)`
              : isTrialExpired
              ? 'Tapos Na ang Libreng Trial'
              : 'I-upgrade sa Pro Lifetime Access'}
          </Text>

          <Text style={styles.subtitle}>
            {isClockTampered
              ? 'Napansin na nabago ang orasan ng device. Pakitama ang system date at oras upang magpatuloy, o i-enter ang Pro PIN.'
              : isQuotaExceeded
              ? `Lumalago ang iyong tindahan! Naka-${completedSalesCount} benta ka na habang nasa Libreng Trial (limit: ${maxTrialSales}). I-upgrade sa Pro Lifetime Access para sa walang limitasyong benta!`
              : isTrialExpired
              ? 'Upang patuloy na magamit ang POS Checkout, Imbentaryo, at Listahan ng Utang nang walang limitasyon, magbayad sa GCash upang makuha ang iyong PIN.'
              : 'Magkaroon ng permanenteng access sa lahat ng features nang walang anumang buwanang bayarin!'}
          </Text>

          {/* Pricing Highlight Pill */}
          <View style={styles.pricingPill}>
            <Text style={styles.pricingTitle}>LIFETIME ACCESS</Text>
            <Text style={styles.pricingAmount}>₱{proPrice.toFixed(0)}</Text>
            <Text style={styles.pricingSub}>Isang beses lang babayaran • Walang monthly fees</Text>
          </View>

          {/* Device ID Card */}
          <View style={styles.deviceIdCard}>
            <View>
              <Text style={styles.deviceIdLabel}>Iyong Tindahan ID (Ibigay sa Admin):</Text>
              <Text style={styles.deviceIdValue}>{deviceId}</Text>
            </View>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={() => copyToClipboard(deviceId, 'deviceId')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={copiedField === 'deviceId' ? 'checkmark' : 'copy-outline'}
                size={16}
                color="#059669"
              />
              <Text style={styles.copyBtnText}>
                {copiedField === 'deviceId' ? 'Nakopya!' : 'Kopyahin'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Feedback Alerts */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {successMessage && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={18} color="#059669" />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          {/* Step 1: GCash Details */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNum}>1</Text>
              </View>
              <Text style={styles.cardTitle}>Magbayad sa GCash</Text>
            </View>

            <View style={styles.qrRow}>
              <Image
                source={{ uri: 'https://tindahanhelper.wuaze.com/assets/images/gcash_qr.png' }}
                style={styles.qrImage}
                resizeMode="contain"
              />
              <View style={styles.gcashDetails}>
                <Text style={styles.gcashInfoLabel}>GCash Number:</Text>
                <View style={styles.gcashNumRow}>
                  <Text style={styles.gcashNumText}>{gcashNumber}</Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(gcashNumber.replace(/\s+/g, ''), 'gcashNumber')}
                  >
                    <Ionicons
                      name={copiedField === 'gcashNumber' ? 'checkmark' : 'copy-outline'}
                      size={18}
                      color="#0284C7"
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.gcashInfoLabel}>Account Name:</Text>
                <Text style={styles.gcashNameText}>{gcashName}</Text>
                <Text style={styles.gcashInfoLabel}>Amount:</Text>
                <Text style={styles.gcashAmountText}>₱{proPrice.toFixed(2)}</Text>
              </View>
            </View>

            {/* GCash Reference Submit */}
            <View style={styles.refSubmitSection}>
              <Text style={styles.inputLabel}>GCash Reference Number (Pagkatapos Magbayad):</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.refInput}
                  placeholder="Hal. 1029384756"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={gcashRef}
                  onChangeText={setGcashRef}
                />
                <TouchableOpacity
                  style={[styles.submitRefBtn, submittingRef && styles.btnDisabled]}
                  onPress={handleSubmitGcashRef}
                  disabled={submittingRef}
                  activeOpacity={0.8}
                >
                  {submittingRef ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.submitRefBtnText}>I-submit</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* GCash Screenshot Attachment */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>GCash Screenshot o Resibo (Opsyonal):</Text>
                {selectedImage ? (
                  <View style={styles.screenshotPreviewBox}>
                    <Image source={{ uri: selectedImage.uri }} style={styles.screenshotThumbnail} resizeMode="cover" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#065F46' }}>Naka-attach na ang screenshot</Text>
                      <Text style={{ fontSize: 11, color: '#6B7280' }}>Mas mabilis itong ma-verify ni Admin</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeImageBtn}
                      onPress={() => setSelectedImage(null)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.attachImageBtn}
                    onPress={pickReceiptImage}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="image-outline" size={18} color="#0369A1" />
                    <Text style={styles.attachImageBtnText}>Mag-attach ng GCash Screenshot</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Check Online Approval Button */}
            <TouchableOpacity
              style={styles.checkApprovalBtn}
              onPress={handleCheckApproval}
              disabled={checkingApproval}
              activeOpacity={0.8}
            >
              {checkingApproval ? (
                <ActivityIndicator size="small" color="#0369A1" />
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons name="refresh" size={16} color="#0369A1" />
                  <Text style={styles.checkApprovalBtnText}>Suriin kung Na-approve Na</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Step 2: Enter PIN (Offline backup) */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNum}>2</Text>
              </View>
              <Text style={styles.cardTitle}>Opsyonal: 6-Digit PIN (Offline Backup)</Text>
            </View>
            <Text style={styles.pinInstructions}>
              Kapag may internet ka, <Text style={{ fontWeight: '700', color: '#059669' }}>awtomatiko nang magiging Pro ang app kapag na-approve ni Admin</Text> nang hindi na kailangang mag-type ng PIN. Gamitin lamang ang kahon sa ibaba kung walang internet at may natanggap kang PIN sa SMS:
            </Text>

            <View style={styles.pinInputWrapper}>
              <TextInput
                style={styles.pinInput}
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                maxLength={6}
                value={enteredPin}
                onChangeText={setEnteredPin}
              />
            </View>

            <TouchableOpacity
              style={styles.activateBtn}
              onPress={handleVerifyPin}
              activeOpacity={0.85}
            >
              <Ionicons name="key-outline" size={18} color="#FFFFFF" />
              <Text style={styles.activateBtnText}>I-activate ang Tindahan Helper Pro</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.supportNote}>
            <Ionicons name="help-circle-outline" size={18} color="#6B7280" />
            <Text style={styles.supportText}>
              May tanong o kailangan ng tulong? I-message ang aming support sa GCash number {gcashNumber}.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  lockBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  pricingPill: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  pricingTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 1,
  },
  pricingAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#065F46',
    marginVertical: 2,
  },
  pricingSub: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  deviceIdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  deviceIdLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  deviceIdValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    letterSpacing: 1,
    marginTop: 2,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: '#065F46',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  qrRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  qrImage: {
    width: 110,
    height: 110,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  gcashDetails: {
    flex: 1,
  },
  gcashInfoLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  gcashNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  gcashNumText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0284C7',
  },
  gcashNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  gcashAmountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  refSubmitSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  refInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#111827',
  },
  submitRefBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitRefBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  attachImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  attachImageBtnText: {
    color: '#0369A1',
    fontSize: 13,
    fontWeight: '700',
  },
  screenshotPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 8,
  },
  screenshotThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  removeImageBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  checkApprovalBtn: {
    marginTop: 12,
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
    borderWidth: 1,
    borderRadius: 10,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkApprovalBtnText: {
    color: '#0369A1',
    fontSize: 13,
    fontWeight: '700',
  },
  pinInstructions: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 12,
  },
  pinInputWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  pinInput: {
    width: '100%',
    height: 52,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#059669',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
    color: '#111827',
  },
  activateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    height: 50,
    borderRadius: 12,
    elevation: 2,
  },
  activateBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  supportNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  supportText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
});
