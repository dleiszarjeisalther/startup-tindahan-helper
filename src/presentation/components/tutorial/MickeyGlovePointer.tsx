import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Animated,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTutorial } from '@/presentation/providers/TutorialContext';

const GLOVE_ASSET = require('../../../../assets/images/mickey_glove_pointer.png');

interface MickeyGlovePointerProps {
  /** Target X coordinate where the index fingertip should touch */
  targetX: number;
  /** Target Y coordinate where the index fingertip should touch */
  targetY: number;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
}

const GLOVE_WIDTH = 64;
const GLOVE_HEIGHT = 80;
// Calibrated from high-resolution asset (684x854 with tip at 68, 12):
const FINGERTIP_OFFSET_X = Math.round(GLOVE_WIDTH * (68 / 684)); // ≈ 6
const FINGERTIP_OFFSET_Y = 2;
const RIPPLE_SIZE = 36;
const RIPPLE_RADIUS = RIPPLE_SIZE / 2;

/**
 * MickeyGlovePointer:
 * High-resolution iconic Mickey Mouse cartoon white glove (with 3 dorsal darts, puffed gauntlet cuff,
 * and angled pointing index finger) rendered with expo-image and vector fallback.
 * 
 * Features a 1.4s animated loop:
 *   1. Hover & Tilt (0-400ms)
 *   2. Click Down (400-650ms) + Light Haptics
 *   3. Expanding Ripple Wave (650-1100ms) centered precisely at fingertip
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
  const [imageError, setImageError] = useState(false);

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
        // 1. Hover & Tilt (0–400ms): Hand lifts 10px off surface, tilting slightly
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: -10,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(tiltAnim, {
            toValue: -6,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]),

        // 2. Click Down (400–650ms): Lands squarely at touch surface (floatAnim=0)
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(tiltAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.94,
            duration: 250,
            useNativeDriver: true,
          }),
        ]),

        // 3. Ripple Wave & 4. Spring Recoil (650–1400ms)
        Animated.parallel([
          // Ripple expands and fades from under the fingertip
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
          // Recoil spring: hand gently lifts to slight resting position
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
                toValue: -2,
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
          left: targetX,
          top: targetY,
          transform: [{ translateX: wiggleAnim }],
        },
        style,
      ]}
    >
      {/* Ripple ring centered precisely at the pointer fingertip (0, 0) */}
      <Animated.View
        style={[
          styles.rippleCircle,
          {
            left: -RIPPLE_RADIUS,
            top: -RIPPLE_RADIUS,
            transform: [{ scale: rippleScale }],
            opacity: rippleOpacity,
          },
        ]}
      />

      {/* Animated Mickey Mouse Glove Body with Fingertip Pivot Container */}
      <Animated.View
        style={[
          styles.handPivotWrapper,
          {
            transform: [
              { translateY: floatAnim },
              { rotate: tiltInterpolate },
              { scale: scaleAnim },
            ],
          },
        ]}
      >
        {!imageError ? (
          <Image
            source={GLOVE_ASSET}
            style={styles.gloveImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={100}
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.vectorFallbackWrapper}>
            <Ionicons name="hand-left" size={48} color="#FFFFFF" style={styles.vectorFallbackIcon} />
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'visible',
    zIndex: 99999,
  },
  rippleCircle: {
    position: 'absolute',
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    borderRadius: RIPPLE_RADIUS,
    borderWidth: 2.5,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.22)',
    zIndex: 1,
  },
  handPivotWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    overflow: 'visible',
    zIndex: 2,
  },
  gloveImage: {
    position: 'absolute',
    left: -FINGERTIP_OFFSET_X,
    top: -FINGERTIP_OFFSET_Y,
    width: GLOVE_WIDTH,
    height: GLOVE_HEIGHT,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  vectorFallbackWrapper: {
    position: 'absolute',
    left: -12,
    top: -6,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
  },
  vectorFallbackIcon: {
    transform: [{ rotate: '45deg' }],
  },
});
