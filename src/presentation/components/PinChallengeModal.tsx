// src/presentation/components/PinChallengeModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTindahanStore } from '../hooks/useTindahanStore';
import { BiometricAuthService } from '@/infrastructure/services/BiometricAuthService';

interface PinChallengeModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PinChallengeModal({
  visible,
  title = 'Proteksyon ng Tindahan',
  subtitle = 'I-scan ang Fingerprint/Face ID o i-enter ang 4-digit PIN',
  onSuccess,
  onCancel,
}: PinChallengeModalProps) {
  const { verifyOwnerMasterPin, unlockStore } = useTindahanStore();
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(0);
  const [hasBiometrics, setHasBiometrics] = useState<boolean>(false);

  const triggerBiometrics = useCallback(async () => {
    try {
      const auth = await BiometricAuthService.authenticate(
        'I-scan ang fingerprint o Face ID upang magpatuloy'
      );
      if (auth.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        unlockStore();
        onSuccess();
      }
    } catch {
      // User can still fallback to PIN
    }
  }, [unlockStore, onSuccess]);

  const handleModalShow = useCallback(() => {
    setPin('');
    setErrorMessage(null);
    setLockoutRemainingSec(0);
    BiometricAuthService.checkCapabilities().then((cap) => {
      const canBio = cap.hasHardware && cap.isEnrolled;
      setHasBiometrics(canBio);
      if (canBio) {
        triggerBiometrics();
      }
    });
  }, [triggerBiometrics]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemainingSec <= 0) return;
    const interval = setInterval(() => {
      setLockoutRemainingSec((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setErrorMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemainingSec]);

  const handleDigitPress = (digit: string) => {
    if (lockoutRemainingSec > 0) return;
    if (pin.length >= 4) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const nextPin = pin + digit;
    setPin(nextPin);
    setErrorMessage(null);

    if (nextPin.length === 4) {
      submitPin(nextPin);
    }
  };

  const handleDelete = () => {
    if (lockoutRemainingSec > 0 || pin.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const submitPin = (pinToVerify: string) => {
    const outcome = verifyOwnerMasterPin(pinToVerify);
    if (outcome.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPin('');
      unlockStore();
      onSuccess();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPin('');
      if (outcome.lockoutStatus.isLocked) {
        setLockoutRemainingSec(outcome.lockoutStatus.remainingSeconds);
        setErrorMessage(
          `Security Lockout: Masyadong maraming mali. Maghintay ng ${outcome.lockoutStatus.remainingSeconds}s.`
        );
      } else {
        setErrorMessage(
          `Maling PIN. May ${outcome.remainingAttempts} pagsubok na natitira.`
        );
      }
    }
  };

  const isLocked = lockoutRemainingSec > 0;

  return (
    <Modal
      visible={visible}
      onShow={handleModalShow}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Ionicons name="shield-checkmark" size={36} color="#0D7A52" style={styles.headerIcon} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* Biometrics Quick Action Button */}
          {hasBiometrics ? (
            <Pressable
              style={styles.biometricBtn}
              onPress={triggerBiometrics}
              hitSlop={6}
            >
              <Ionicons name="finger-print" size={20} color="#0D7A52" />
              <Text style={styles.biometricBtnText}>I-scan ang Fingerprint / Face ID</Text>
            </Pressable>
          ) : null}

          {/* 4-Dot PIN Indicator */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((index) => {
              const isFilled = pin.length > index;
              return (
                <View
                  key={index}
                  style={[styles.dot, isFilled && styles.dotFilled, isLocked && styles.dotLocked]}
                />
              );
            })}
          </View>

          {/* Status / Error Message */}
          {errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : (
            <Text style={styles.hintText}>
              {isLocked ? `Naka-lock ng ${lockoutRemainingSec}s` : 'I-type ang 4-digit PIN sa ibaba'}
            </Text>
          )}

          {/* Keypad */}
          <View style={styles.keypad}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['C', '0', '⌫'],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((item) => {
                  if (item === 'C') {
                    return (
                      <TouchableOpacity
                        key={item}
                        style={[styles.keyBtn, styles.actionKeyBtn]}
                        onPress={() => {
                          setPin('');
                          onCancel();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.actionKeyText}>Kansela</Text>
                      </TouchableOpacity>
                    );
                  }
                  if (item === '⌫') {
                    return (
                      <TouchableOpacity
                        key={item}
                        style={[styles.keyBtn, styles.actionKeyBtn]}
                        onPress={handleDelete}
                        disabled={isLocked || pin.length === 0}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.actionKeyText}>⌫</Text>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.keyBtn, isLocked && styles.keyBtnDisabled]}
                      onPress={() => handleDigitPress(item)}
                      disabled={isLocked}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.keyText, isLocked && styles.keyTextDisabled]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  headerIcon: {
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    width: '100%',
  },
  biometricBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D7A52',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#94A3B8',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  dotLocked: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  hintText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 14,
    height: 20,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 14,
    textAlign: 'center',
    height: 28,
  },
  keypad: {
    width: '100%',
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  keyBtn: {
    flex: 1,
    height: 52,
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyBtnDisabled: {
    backgroundColor: '#F8FAFC',
    opacity: 0.5,
  },
  keyText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#0F172A',
  },
  keyTextDisabled: {
    color: '#CBD5E1',
  },
  actionKeyBtn: {
    backgroundColor: '#E2E8F0',
  },
  actionKeyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
});
