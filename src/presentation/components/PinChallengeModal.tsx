// src/presentation/components/PinChallengeModal.tsx
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTindahanStore } from '../hooks/useTindahanStore';

interface PinChallengeModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PinChallengeModal({
  visible,
  title = 'Owner Master PIN Required',
  subtitle = 'Enter 4-digit PIN to authenticate sensitive store action',
  onSuccess,
  onCancel,
}: PinChallengeModalProps) {
  const { verifyOwnerMasterPin } = useTindahanStore();
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(0);
  const [prevVisible, setPrevVisible] = useState(visible);

  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setPin('');
      setErrorMessage(null);
    }
  }

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
      // Automatically verify when 4 digits are entered
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
      onSuccess();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setPin('');
      if (outcome.lockoutStatus.isLocked) {
        setLockoutRemainingSec(outcome.lockoutStatus.remainingSeconds);
        setErrorMessage(
          `Security Lockout: Too many failed attempts. Wait ${outcome.lockoutStatus.remainingSeconds}s.`
        );
      } else {
        setErrorMessage(
          `Incorrect PIN. ${outcome.remainingAttempts} attempt(s) remaining.`
        );
      }
    }
  };

  const isLocked = lockoutRemainingSec > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

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
              {isLocked ? `Locked for ${lockoutRemainingSec}s` : 'Tap keypad to enter PIN'}
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
                        <Text style={styles.actionKeyText}>Cancel</Text>
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
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
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  dotLocked: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  hintText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 16,
    height: 20,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    height: 32,
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
    height: 54,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
});
