import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  BackHandler,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTutorial, ElementLayout } from '@/presentation/providers/TutorialContext';
import { MickeyGlovePointer } from './MickeyGlovePointer';
import { TutorialTooltipCard } from './TutorialTooltipCard';

/**
 * SpotlightOverlay:
 * 4-Slice Scrim Panels around the target layout to provide spotlight focus and background dimming.
 * The central spotlight rectangle is an open hole so native touches pass through 100% cleanly.
 * Features an emerald breathing highlight ring (#10B981) and animated Mickey Glove pointer.
 * Outside touches on the 4 scrim slices trigger gentle wiggle feedback.
 */
export function SpotlightOverlay() {
  const router = useRouter();
  const {
    isActive,
    currentStep,
    targets,
    nextStep,
    previousStep,
    skipTutorial,
    triggerWiggle,
    wiggleAnim,
  } = useTutorial();

  const { width: screenW, height: screenH } = useWindowDimensions();

  // React 19 safe render rule: initialize Animated.Value in useState
  const pulseAnim = useState(() => new Animated.Value(0.6))[0];

  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;
    if (isActive) {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();
    } else {
      pulseAnim.setValue(0.6);
    }

    return () => {
      if (animLoop) {
        animLoop.stop();
      }
      pulseAnim.setValue(0.6);
    };
  }, [isActive, pulseAnim]);

  const handleNext = useCallback(() => {
    Keyboard.dismiss();
    if (currentStep === 1) {
      nextStep();
      router.navigate('/inventory');
    } else if (currentStep >= 2 && currentStep <= 5) {
      nextStep();
    } else if (currentStep === 6) {
      nextStep();
      router.navigate('/');
    }
  }, [currentStep, nextStep, router]);

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    if (currentStep === 2) {
      previousStep();
      router.navigate('/');
    } else if (currentStep >= 3 && currentStep <= 5) {
      previousStep();
    } else if (currentStep === 6) {
      previousStep();
      router.navigate('/inventory');
    } else {
      previousStep();
    }
  }, [currentStep, previousStep, router]);

  // Intercept Android hardware back button so step index stays synchronized with route
  useEffect(() => {
    if (!isActive) return;

    const backAction = () => {
      if (currentStep > 1) {
        handleBack();
        return true;
      }
      return false;
    };

    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction
    );

    return () => backSubscription.remove();
  }, [isActive, currentStep, handleBack]);

  if (!isActive) return null;

  const rawLayout = targets[currentStep];
  const pad = 6;

  const fallbackLayouts: Record<number, ElementLayout> = {
    // Step 1: [+ Add Product] in POS screen
    1: {
      x: Math.max(16, (screenW - 240) / 2),
      y: Math.max(120, screenH * 0.52),
      width: Math.min(screenW - 32, 240),
      height: 48,
      borderRadius: 14,
    },
    // Step 2: [ 📷 Scan ] barcode button in Add Product form
    2: {
      x: screenW - 130,
      y: 180,
      width: 100,
      height: 44,
      borderRadius: 10,
    },
    // Step 3: Product Name * text input in Add Product form
    3: {
      x: 16,
      y: 250,
      width: screenW - 32,
      height: 48,
      borderRadius: 12,
    },
    // Step 4: Category * & Uri ng Paninda pills in Add Product form
    4: {
      x: 16,
      y: 330,
      width: screenW - 32,
      height: 110,
      borderRadius: 14,
    },
    // Step 5: Presyo & Puhunan fields in Add Product form
    5: {
      x: 16,
      y: 470,
      width: screenW - 32,
      height: 140,
      borderRadius: 16,
    },
    // Step 6: [ Scan ] Tab in Bottom Tab Bar
    6: {
      x: 16,
      y: Math.max(100, screenH - 74),
      width: 72,
      height: 48,
      borderRadius: 14,
    },
  };

  const activeLayout =
    rawLayout && rawLayout.width > 0 && rawLayout.height > 0
      ? rawLayout
      : fallbackLayouts[currentStep] || {
          x: (screenW - 200) / 2,
          y: (screenH - 100) / 2,
          width: 200,
          height: 100,
          borderRadius: 16,
        };

  const targetX = Math.max(0, activeLayout.x - pad);
  const targetY = Math.max(0, activeLayout.y - pad);
  const targetW = Math.min(screenW - targetX, activeLayout.width + pad * 2);
  const targetH = Math.min(screenH - targetY, activeLayout.height + pad * 2);
  const targetR = Math.max(12, (activeLayout.borderRadius ?? 16) + pad / 2);

  const targetCenterX = targetX + targetW / 2;
  const targetCenterY = targetY + targetH / 2;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 4-Slice Scrim Panels surrounding the target spotlight */}
      {/* 1. Top Panel */}
      <Pressable
        style={[
          styles.scrimSlice,
          {
            top: 0,
            left: 0,
            right: 0,
            height: targetY,
          },
        ]}
        onPress={triggerWiggle}
      />

      {/* 2. Bottom Panel */}
      <Pressable
        style={[
          styles.scrimSlice,
          {
            top: targetY + targetH,
            left: 0,
            right: 0,
            bottom: 0,
          },
        ]}
        onPress={triggerWiggle}
      />

      {/* 3. Left Panel */}
      <Pressable
        style={[
          styles.scrimSlice,
          {
            top: targetY,
            left: 0,
            width: targetX,
            height: targetH,
          },
        ]}
        onPress={triggerWiggle}
      />

      {/* 4. Right Panel */}
      <Pressable
        style={[
          styles.scrimSlice,
          {
            top: targetY,
            left: targetX + targetW,
            right: 0,
            height: targetH,
          },
        ]}
        onPress={triggerWiggle}
      />

      {/* Emerald Breathing Highlight Ring around target hole (Pass-through touches) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.breathingRing,
          {
            left: targetX,
            top: targetY,
            width: targetW,
            height: targetH,
            borderRadius: targetR,
            opacity: pulseAnim,
          },
        ]}
      />

      {/* Animated Mickey Mouse Cartoon Glove Pointer */}
      <MickeyGlovePointer
        targetX={targetCenterX}
        targetY={targetCenterY}
        visible={true}
      />

      {/* Dynamic Auto-Flipping Tooltip Speech Bubble */}
      <TutorialTooltipCard
        currentStep={currentStep}
        targetLayout={{
          x: targetX,
          y: targetY,
          width: targetW,
          height: targetH,
        }}
        onNext={handleNext}
        onBack={handleBack}
        onSkip={skipTutorial}
        wiggleAnim={wiggleAnim}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrimBackground: {
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
  },
  scrimSlice: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
  },
  breathingRing: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
