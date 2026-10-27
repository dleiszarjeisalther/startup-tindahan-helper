import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { useTutorial, ElementLayout } from '@/presentation/providers/TutorialContext';
import { MickeyGlovePointer } from './MickeyGlovePointer';
import { TutorialTooltipCard } from './TutorialTooltipCard';
import { SukliSimulationSheet } from './SukliSimulationSheet';

/**
 * SpotlightOverlay:
 * 4-Slice Scrim Panels around the target layout to provide spotlight focus and background dimming.
 * The central spotlight rectangle is an open hole so native touches pass through 100% cleanly.
 * Features an emerald breathing highlight ring (#10B981) and animated Mickey Glove pointer.
 * Outside touches on the 4 scrim slices trigger gentle wiggle feedback.
 */
export function SpotlightOverlay() {
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

  if (!isActive) return null;

  // Step 4 is the interactive in-place POS simulation sheet
  if (currentStep === 4) {
    return (
      <SukliSimulationSheet
        onBack={previousStep}
        onComplete={nextStep}
        onSkip={skipTutorial}
      />
    );
  }

  const rawLayout = targets[currentStep];
  const pad = 6;

  const fallbackLayouts: Record<number, ElementLayout> = {
    1: {
      x: Math.max(16, (screenW - 270) / 2),
      y: 75,
      width: Math.min(screenW - 32, 270),
      height: 130,
      borderRadius: 16,
    },
    2: {
      x: 16,
      y: 310,
      width: Math.max(120, (screenW - 48) / 2),
      height: 140,
      borderRadius: 16,
    },
    3: {
      x: Math.max(16, (screenW - 56) / 2),
      y: Math.max(100, screenH - 115),
      width: 56,
      height: 56,
      borderRadius: 28,
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
        onNext={nextStep}
        onBack={previousStep}
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
