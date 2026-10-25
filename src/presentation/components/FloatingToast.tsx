import React, { useEffect, useState, useRef } from 'react';
import {
  Animated,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type ToastType = 'success' | 'warning' | 'info' | 'error';

export interface FloatingToastProps {
  message: string | null;
  type?: ToastType;
  durationMs?: number;
  onDismiss: () => void;
  topOffset?: number;
}

export const FloatingToast: React.FC<FloatingToastProps> = ({
  message,
  type = 'success',
  durationMs = 2800,
  onDismiss,
  topOffset = 10,
}) => {
  const [opacityAnim] = useState(() => new Animated.Value(0));
  const [translateYAnim] = useState(() => new Animated.Value(-16));
  const onDismissRef = useRef(onDismiss);
  const prevMessageRef = useRef<string | null>(null);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message) {
      prevMessageRef.current = null;
      opacityAnim.setValue(0);
      translateYAnim.setValue(-16);
      return;
    }

    const isNewMessage = prevMessageRef.current !== message;
    prevMessageRef.current = message;

    if (isNewMessage) {
      // Reset and animate in only when a new message appears
      opacityAnim.setValue(0);
      translateYAnim.setValue(-16);

      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: -12,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        prevMessageRef.current = null;
        onDismissRef.current();
      });
    }, durationMs);

    return () => clearTimeout(timer);
  }, [message, durationMs, opacityAnim, translateYAnim]);

  if (!message) return null;

  const getStyleForType = () => {
    switch (type) {
      case 'warning':
        return {
          bg: '#FFFBEB',
          border: '#FDE68A',
          textColor: '#92400E',
          icon: 'alert-circle' as const,
          iconColor: '#D97706',
        };
      case 'error':
        return {
          bg: '#FEF2F2',
          border: '#FECACA',
          textColor: '#991B1B',
          icon: 'close-circle' as const,
          iconColor: '#DC2626',
        };
      case 'info':
        return {
          bg: '#F0F9FF',
          border: '#BAE6FD',
          textColor: '#0369A1',
          icon: 'information-circle' as const,
          iconColor: '#0284C7',
        };
      case 'success':
      default:
        return {
          bg: '#ECFDF5',
          border: '#A7F3D0',
          textColor: '#065F46',
          icon: 'checkmark-circle' as const,
          iconColor: '#059669',
        };
    }
  };

  const currentTheme = getStyleForType();

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          top: topOffset,
          opacity: opacityAnim,
          transform: [{ translateY: translateYAnim }],
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        style={[
          styles.toastContainer,
          {
            backgroundColor: currentTheme.bg,
            borderColor: currentTheme.border,
          },
        ]}
        onPress={() => {
          Animated.parallel([
            Animated.timing(opacityAnim, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(translateYAnim, {
              toValue: -12,
              duration: 150,
              useNativeDriver: true,
            }),
          ]).start(() => {
            prevMessageRef.current = null;
            onDismissRef.current();
          });
        }}
      >
        <Ionicons
          name={currentTheme.icon}
          size={18}
          color={currentTheme.iconColor}
          style={styles.icon}
        />
        <Text style={[styles.toastText, { color: currentTheme.textColor }]}>
          {message}
        </Text>
        <Ionicons
          name="close"
          size={16}
          color={currentTheme.textColor}
          style={styles.closeIcon}
        />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    elevation: Platform.OS === 'android' ? 24 : 10,
    alignItems: 'center',
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    gap: 8,
  },
  icon: {
    flexShrink: 0,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  closeIcon: {
    marginLeft: 4,
    opacity: 0.6,
  },
});
