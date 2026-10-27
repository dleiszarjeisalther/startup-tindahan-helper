import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTutorial } from '@/presentation/providers/TutorialContext';

interface MickeyGlovePointerProps {
  /** Target X coordinate where the index fingertip should touch */
  targetX: number;
  /** Target Y coordinate where the index fingertip should touch */
  targetY: number;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * MickeyGlovePointer:
 * Pure React Native cartoon white hand glove (with 3 dorsal darts and gauntlet cuff) with pointer finger.
 * Features a 1.4s animated loop:
 *   1. Hover & Tilt (0-400ms)
 *   2. Click Down (400-650ms) + Light Haptics
 *   3. Expanding Ripple Wave (650-1100ms)
 *   4. Spring Recoil (1100-1400ms)
 * Complies with React 19 safe render rules: useState(() => new Animated.Value(...))[0]
 */
export function MickeyGlovePointer({
  targetX,
  targetY,
  visible = true,
  style,
}: MickeyGlovePointerProps) {
  const { wiggleAnim } = useTutorial();

  // React 19 & Expo SDK 58 Safe Render Rule: initialize Animated.Values via useState initializer
  const floatAnim = useState(() => new Animated.Value(0))[0];
  const tiltAnim = useState(() => new Animated.Value(0))[0];
  const scaleAnim = useState(() => new Animated.Value(1))[0];
  const rippleScale = useState(() => new Animated.Value(0.3))[0];
  const rippleOpacity = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    let isMounted = true;
    let hapticTimer: ReturnType<typeof setTimeout> | null = null;

    const runLoop = () => {
      if (!isMounted) return;

      rippleScale.setValue(0.3);
      rippleOpacity.setValue(0);

      // Trigger haptics exactly when the click lands (at ~620ms into loop)
      hapticTimer = setTimeout(() => {
        if (isMounted && visible) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      }, 620);

      Animated.sequence([
        // 1. Hover & Tilt (0–400ms)
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: -8,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(tiltAnim, {
            toValue: -8,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),

        // 2. Click Down (400–650ms)
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: 4,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(tiltAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.88,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),

        // 3. Ripple Wave & 4. Spring Recoil (650–1400ms)
        Animated.parallel([
          // Ripple expands and fades
          Animated.sequence([
            Animated.timing(rippleOpacity, {
              toValue: 0.85,
              duration: 60,
              useNativeDriver: true,
            }),
            Animated.parallel([
              Animated.timing(rippleScale, {
                toValue: 2.2,
                duration: 420,
                useNativeDriver: true,
              }),
              Animated.timing(rippleOpacity, {
                toValue: 0,
                duration: 420,
                useNativeDriver: true,
              }),
            ]),
          ]),
          // Recoil spring
          Animated.sequence([
            Animated.delay(120),
            Animated.parallel([
              Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 6,
                tension: 45,
                useNativeDriver: true,
              }),
              Animated.spring(floatAnim, {
                toValue: 0,
                friction: 6,
                tension: 45,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ]),
      ]).start(({ finished }) => {
        if (finished && isMounted) {
          runLoop();
        }
      });
    };

    if (visible) {
      runLoop();
    }

    return () => {
      isMounted = false;
      if (hapticTimer) clearTimeout(hapticTimer);
      floatAnim.stopAnimation();
      tiltAnim.stopAnimation();
      scaleAnim.stopAnimation();
      rippleScale.stopAnimation();
      rippleOpacity.stopAnimation();
    };
  }, [visible, floatAnim, tiltAnim, scaleAnim, rippleScale, rippleOpacity]);

  if (!visible) return null;

  const tiltInterpolate = tiltAnim.interpolate({
    inputRange: [-15, 0, 15],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.rootContainer,
        {
          left: targetX - 22,
          top: targetY - 10,
          transform: [{ translateX: wiggleAnim }],
        },
        style,
      ]}
    >
      {/* Ripple ring anchored at pointer fingertip */}
      <Animated.View
        style={[
          styles.rippleCircle,
          {
            transform: [{ scale: rippleScale }],
            opacity: rippleOpacity,
          },
        ]}
      />

      {/* Animated Glove Body */}
      <Animated.View
        style={[
          styles.gloveWrapper,
          {
            transform: [
              { translateY: floatAnim },
              { rotate: tiltInterpolate },
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        {/* Extended Pointer Index Finger */}
        <View style={styles.indexFinger}>
          <View style={styles.fingerJointDetail} />
        </View>

        {/* Hand Palm with Shadow */}
        <View style={styles.palmContainer}>
          {/* Curled thumb */}
          <View style={styles.thumbCurled} />

          {/* Palm Base */}
          <View style={styles.palmBase}>
            {/* 3 Iconic Black Dorsal Darts: \ | / */}
            <View style={styles.dorsalDartRow}>
              <View style={[styles.dorsalDart, styles.dartLeft]} />
              <View style={[styles.dorsalDart, styles.dartCenter]} />
              <View style={[styles.dorsalDart, styles.dartRight]} />
            </View>
          </View>

          {/* Curled remaining fingers (middle, ring, pinky) */}
          <View style={styles.curledFingersGroup}>
            <View style={[styles.curledFinger, styles.middleFinger]} />
            <View style={[styles.curledFinger, styles.ringFinger]} />
            <View style={[styles.curledFinger, styles.pinkyFinger]} />
          </View>
        </View>

        {/* Rounded Gauntlet Cuff at the wrist */}
        <View style={styles.wristCuff}>
          <View style={styles.cuffRibbing} />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    position: 'absolute',
    width: 68,
    height: 76,
    zIndex: 99999,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  rippleCircle: {
    position: 'absolute',
    top: 0,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    zIndex: 1,
  },
  gloveWrapper: {
    width: 58,
    height: 68,
    alignItems: 'center',
    zIndex: 2,
    shadowColor: '#000000',
    shadowOpacity: 0.38,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 12,
  },
  indexFinger: {
    position: 'absolute',
    top: 4,
    left: 17,
    width: 14,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.2,
    borderColor: '#1E293B',
    zIndex: 3,
  },
  fingerJointDetail: {
    position: 'absolute',
    top: 8,
    left: 2,
    right: 2,
    height: 1.5,
    backgroundColor: 'rgba(30, 41, 59, 0.25)',
    borderRadius: 1,
  },
  palmContainer: {
    position: 'absolute',
    top: 20,
    left: 6,
    width: 44,
    height: 34,
    zIndex: 4,
  },
  palmBase: {
    width: 38,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.2,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dorsalDartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 2,
  },
  dorsalDart: {
    width: 2.2,
    backgroundColor: '#1E293B',
    borderRadius: 1.2,
  },
  dartLeft: {
    height: 8,
    transform: [{ rotate: '-18deg' }],
  },
  dartCenter: {
    height: 10,
  },
  dartRight: {
    height: 8,
    transform: [{ rotate: '18deg' }],
  },
  thumbCurled: {
    position: 'absolute',
    top: 8,
    left: -5,
    width: 13,
    height: 14,
    borderRadius: 6.5,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    zIndex: 2,
  },
  curledFingersGroup: {
    position: 'absolute',
    right: 0,
    top: 1,
    gap: -3,
    zIndex: 5,
  },
  curledFinger: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  middleFinger: {
    width: 12,
    height: 11,
    borderRadius: 5.5,
  },
  ringFinger: {
    width: 11,
    height: 10,
    borderRadius: 5,
  },
  pinkyFinger: {
    width: 10,
    height: 9,
    borderRadius: 4.5,
  },
  wristCuff: {
    position: 'absolute',
    bottom: 2,
    width: 32,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.2,
    borderColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  cuffRibbing: {
    width: 18,
    height: 2,
    backgroundColor: 'rgba(30, 41, 59, 0.2)',
    borderRadius: 1,
  },
});
