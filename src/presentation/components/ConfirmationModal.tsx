import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export type ConfirmationType =
  | 'restock'
  | 'unpack'
  | 'home_use'
  | 'damaged'
  | 'delete'
  | 'danger'
  | 'warning'
  | 'info'
  | 'success';

export interface ConfirmationModalDetail {
  label: string;
  value: string;
  highlight?: boolean;
}

export interface ReasonSelectorConfig {
  options: string[];
  placeholder?: string;
  defaultReason?: string;
  label?: string;
}

export interface ConfirmationModalProps {
  visible: boolean;
  type?: ConfirmationType;
  title: string;
  message: string;
  itemName?: string;
  details?: ConfirmationModalDetail[];
  confirmText?: string;
  cancelText?: string | null;
  isLoading?: boolean;
  onConfirm: (reason?: string) => void | Promise<void>;
  onCancel: () => void;
  reasonSelector?: ReasonSelectorConfig;
}

interface TypeTheme {
  primary: string;
  primaryLight: string;
  icon: keyof typeof Ionicons.glyphMap;
  badgeLabel?: string;
}

const THEMES: Record<ConfirmationType, TypeTheme> = {
  restock: {
    primary: '#0D7A52',
    primaryLight: '#ECFDF5',
    icon: 'cube-outline',
    badgeLabel: 'RESTOCK',
  },
  unpack: {
    primary: '#2563EB',
    primaryLight: '#EFF6FF',
    icon: 'git-branch-outline',
    badgeLabel: 'UNPACK TINGI',
  },
  home_use: {
    primary: '#D97706',
    primaryLight: '#FFFBEB',
    icon: 'home-outline',
    badgeLabel: 'GAMIT SA BAHAY',
  },
  damaged: {
    primary: '#DC2626',
    primaryLight: '#FEF2F2',
    icon: 'alert-circle-outline',
    badgeLabel: 'SIRA / EXPIRED',
  },
  delete: {
    primary: '#DC2626',
    primaryLight: '#FEF2F2',
    icon: 'trash-outline',
    badgeLabel: 'BURAHIN',
  },
  danger: {
    primary: '#DC2626',
    primaryLight: '#FEF2F2',
    icon: 'alert-circle-outline',
    badgeLabel: 'BABALA',
  },
  warning: {
    primary: '#D97706',
    primaryLight: '#FFFBEB',
    icon: 'warning-outline',
    badgeLabel: 'PAALALA',
  },
  info: {
    primary: '#0284C7',
    primaryLight: '#F0F9FF',
    icon: 'information-circle-outline',
    badgeLabel: 'IMPORMASYON',
  },
  success: {
    primary: '#0D7A52',
    primaryLight: '#ECFDF5',
    icon: 'checkmark-circle-outline',
    badgeLabel: 'TAGUMPAY',
  },
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  type = 'info',
  title,
  message,
  itemName,
  details,
  confirmText = 'Kumpirmahin',
  cancelText = 'Kanselahin',
  isLoading = false,
  onConfirm,
  onCancel,
  reasonSelector,
}) => {
  const theme = THEMES[type] || THEMES.info;
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReasonText, setCustomReasonText] = useState<string>('');

  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (visible && reasonSelector) {
      setSelectedReason(reasonSelector.defaultReason || reasonSelector.options[0] || '');
      setCustomReasonText('');
    }
  }

  const handleConfirm = () => {
    if (isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    let finalReason: string | undefined = undefined;
    if (reasonSelector) {
      const trimmed = customReasonText.trim();
      finalReason = trimmed
        ? (selectedReason ? `${selectedReason} - ${trimmed}` : trimmed)
        : (selectedReason || 'Manual Adjustment');
    }
    void onConfirm(finalReason);
  };

  const handleCancel = () => {
    if (isLoading) return;
    Haptics.selectionAsync().catch(() => {});
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Top Icon Badge */}
          <View style={[styles.iconWrapper, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name={theme.icon} size={30} color={theme.primary} />
          </View>

          {/* Badge Tag */}
          {theme.badgeLabel ? (
            <View style={[styles.badgeTag, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.badgeText, { color: theme.primary }]}>
                {theme.badgeLabel}
              </Text>
            </View>
          ) : null}

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Optional Item Name Display */}
          {itemName ? (
            <View style={styles.itemBox}>
              <Ionicons name="pricetag-outline" size={15} color="#64748B" style={styles.itemIcon} />
              <Text style={styles.itemName} numberOfLines={2}>
                {itemName}
              </Text>
            </View>
          ) : null}

          {/* Message Body */}
          <Text style={styles.message}>{message}</Text>

          {/* Structured Details (e.g. Stock Before -> Stock After) */}
          {details && details.length > 0 ? (
            <View style={styles.detailsContainer}>
              {details.map((detail, index) => (
                <View
                  key={index}
                  style={[
                    styles.detailRow,
                    index > 0 && styles.detailRowBorder,
                  ]}
                >
                  <Text style={styles.detailLabel}>{detail.label}</Text>
                  <Text
                    style={[
                      styles.detailValue,
                      detail.highlight && { color: theme.primary, fontWeight: '800' },
                    ]}
                  >
                    {detail.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Optional Reason Selector with Fast Chips & Custom Note */}
          {reasonSelector && reasonSelector.options.length > 0 ? (
            <View style={styles.reasonSection}>
              <Text style={styles.reasonSectionLabel}>
                {reasonSelector.label || 'Dahilan ng Pag-update (Reason):'}
              </Text>
              <View style={styles.reasonChipsWrap}>
                {reasonSelector.options.map((option) => {
                  const isSelected = selectedReason === option;
                  return (
                    <Pressable
                      key={option}
                      style={[
                        styles.reasonChip,
                        isSelected && {
                          backgroundColor: theme.primaryLight,
                          borderColor: theme.primary,
                        },
                      ]}
                      onPress={() => {
                        setSelectedReason(option);
                        Haptics.selectionAsync().catch(() => {});
                      }}
                    >
                      <Text
                        style={[
                          styles.reasonChipText,
                          isSelected && { color: theme.primary, fontWeight: '700' },
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={styles.reasonInput}
                placeholder={reasonSelector.placeholder || 'Karagdagang detalye / note (opsyonal)...'}
                placeholderTextColor="#94A3B8"
                value={customReasonText}
                onChangeText={setCustomReasonText}
                maxLength={80}
              />
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            {cancelText !== null ? (
              <Pressable
                style={({ pressed }) => [
                  styles.cancelBtn,
                  pressed && styles.cancelBtnPressed,
                  isLoading && styles.btnDisabled,
                ]}
                onPress={handleCancel}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel={cancelText}
              >
                <Text style={styles.cancelBtnText}>{cancelText}</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: theme.primary },
                pressed && styles.confirmBtnPressed,
                cancelText === null && styles.confirmBtnFull,
                isLoading && styles.btnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={isLoading}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmBtnText}>{confirmText}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
      default: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
      },
    }),
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  itemBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
    marginBottom: 12,
  },
  itemIcon: {
    marginRight: 6,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  message: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
  },
  detailsContainer: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  detailLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnPressed: {
    backgroundColor: '#E2E8F0',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtn: {
    flex: 1.2,
    minHeight: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  confirmBtnFull: {
    flex: 1,
  },
  confirmBtnPressed: {
    opacity: 0.88,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  reasonSection: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reasonSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  reasonChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  reasonChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  reasonChipText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  reasonInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
});
