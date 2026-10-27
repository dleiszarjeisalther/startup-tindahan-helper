import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface CancelExchangeCreditModalProps {
  visible: boolean;
  creditPhp: number;
  sourceReceiptId?: string | null;
  onClose: () => void;
  onConvertToCashRefund: () => Promise<void> | void;
  onUndoReturn: () => Promise<void> | void;
}

export const CancelExchangeCreditModal: React.FC<CancelExchangeCreditModalProps> = ({
  visible,
  creditPhp,
  sourceReceiptId,
  onClose,
  onConvertToCashRefund,
  onUndoReturn,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCashRefund = async () => {
    try {
      setIsSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await onConvertToCashRefund();
      onClose();
    } catch {
      // Handled by caller toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndo = async () => {
    try {
      setIsSubmitting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await onUndoReturn();
      onClose();
    } catch {
      // Handled by caller toast
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.dialogCard}>
          {/* Top Handle / Badge */}
          <View style={styles.iconCircle}>
            <Ionicons name="swap-horizontal" size={24} color="#2563EB" />
          </View>

          <Text style={styles.dialogTitle}>Kanselahin ang Palit-Paninda</Text>
          <Text style={styles.dialogSubtitle}>
            May aktibong kredito na ₱{creditPhp.toFixed(2)}
            {sourceReceiptId ? ` mula sa Resibo #${sourceReceiptId}` : ''}.
          </Text>

          <Text style={styles.sectionQuestion}>
            Ano ang nais mong gawin sa isinauling paninda at kredito?
          </Text>

          {/* Action Option 1: Cash Refund */}
          <Pressable
            style={[styles.optionCard, styles.optionCardGreen]}
            onPress={handleCashRefund}
            disabled={isSubmitting}
          >
            <View style={[styles.optionIconBadge, styles.iconBadgeGreen]}>
              <Ionicons name="cash-outline" size={20} color="#16A34A" />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitleGreen}>
                Ibalik ang Pera (Cash Refund)
              </Text>
              <Text style={styles.optionSubtitle}>
                Walang napiling ipapalit ang suki; ibigay ang ₱{creditPhp.toFixed(2)} mula sa kaha.
              </Text>
            </View>
          </Pressable>

          {/* Action Option 2: Undo Return */}
          <Pressable
            style={[styles.optionCard, styles.optionCardBlue]}
            onPress={handleUndo}
            disabled={isSubmitting}
          >
            <View style={[styles.optionIconBadge, styles.iconBadgeBlue]}>
              <Ionicons name="arrow-undo-outline" size={20} color="#2563EB" />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitleBlue}>
                Ibalik ang Paninda sa Resibo (Undo)
              </Text>
              <Text style={styles.optionSubtitle}>
                Nagbago ang isip o nagkamali; ibabalik ang paninda sa suki at bawiin ang pagsauli.
              </Text>
            </View>
          </Pressable>

          {/* Dismiss Button */}
          <Pressable
            style={styles.btnDismiss}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onClose();
            }}
            disabled={isSubmitting}
          >
            <Text style={styles.btnDismissText}>Huwag Galawin (Bumalik)</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  dialogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 24,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  dialogSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
  sectionQuestion: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  optionCardGreen: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  optionCardBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  optionIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconBadgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  iconBadgeBlue: {
    backgroundColor: '#DBEAFE',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitleGreen: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  optionTitleBlue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  optionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 15,
  },
  btnDismiss: {
    marginTop: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    width: '100%',
    alignItems: 'center',
  },
  btnDismissText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
});
