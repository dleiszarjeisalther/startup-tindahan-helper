import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ElementLayout } from '@/presentation/providers/TutorialContext';

interface TutorialTooltipCardProps {
  currentStep: number;
  targetLayout?: ElementLayout;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  wiggleAnim: Animated.Value;
}

interface StepContent {
  title: string;
  body: string;
  nextButtonLabel: string;
}

const STEP_DATA: Record<number, StepContent> = {
  1: {
    title: '📸 Awtomatikong Barcode Scanner',
    body: 'Itapat lamang ang camera sa barcode ng paninda (delata, kape, noodles) para awtomatikong maitala sa benta nang hindi na kailangang mag-type.',
    nextButtonLabel: 'Susunod ›',
  },
  2: {
    title: '⚡ Isang Pindot, Dagdag sa Benta',
    body: 'Wala bang barcode? Pindutin lamang ang litrato o pangalan ng paninda para agad itong maidagdag sa listahan ng binibili.',
    nextButtonLabel: 'Susunod ›',
  },
  3: {
    title: '🛒 Berdeng Kariton ng Benta',
    body: 'Dito makikita kung ilang piraso na ang nakalista. Pindutin ang berdeng kariton kapag handa nang magbayad ang suki para makita ang kabuuang kwenta.',
    nextButtonLabel: 'Subukan ang Sukli ›',
  },
  4: {
    title: '💰 Awtomatikong Kwenta ng Sukli',
    body: 'I-type lamang ang inabot na pera ng mamimili para agad lumabas ang tamang panukli. Sigurado at ligtas ang talaan kahit walang internet!',
    nextButtonLabel: 'Naintindihan Ko! Simulan Magtinda 🎉',
  },
};

export function TutorialTooltipCard({
  currentStep,
  targetLayout,
  onNext,
  onBack,
  onSkip,
  wiggleAnim,
}: TutorialTooltipCardProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const content = STEP_DATA[currentStep] || STEP_DATA[1];
  const cardWidth = Math.min(screenW - 32, 340);
  const estimatedCardHeight = 180;

  let isAbove = false;
  let top = (screenH - estimatedCardHeight) / 2;
  let left = (screenW - cardWidth) / 2;
  let arrowLeft = cardWidth / 2 - 8;

  if (targetLayout && targetLayout.width > 0 && targetLayout.height > 0) {
    const targetCenterX = targetLayout.x + targetLayout.width / 2;
    left = Math.max(16, Math.min(screenW - cardWidth - 16, targetCenterX - cardWidth / 2));
    arrowLeft = Math.max(16, Math.min(cardWidth - 32, targetCenterX - left - 8));

    // Determine if tooltip should flip above or below
    const spaceBelow = screenH - insets.bottom - (targetLayout.y + targetLayout.height);
    const spaceAbove = targetLayout.y - insets.top;

    if (spaceBelow < estimatedCardHeight + 30 && spaceAbove > estimatedCardHeight) {
      isAbove = true;
      top = Math.max(insets.top + 10, targetLayout.y - estimatedCardHeight - 16);
    } else {
      isAbove = false;
      top = Math.min(
        screenH - insets.bottom - estimatedCardHeight - 10,
        targetLayout.y + targetLayout.height + 16
      );
    }
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: cardWidth,
          top,
          left,
          transform: [{ translateX: wiggleAnim }],
        },
      ]}
    >
      {/* Little speech bubble arrow */}
      {targetLayout ? (
        <View
          style={[
            styles.arrow,
            isAbove ? styles.arrowBottom : styles.arrowTop,
            { left: arrowLeft },
          ]}
        />
      ) : null}

      {/* Card Content */}
      <View style={styles.cardBody}>
        {/* Top Header Row: Step Badge + Laktawan (Skip) */}
        <View style={styles.headerRow}>
          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>Hakbang {currentStep} ng 4</Text>
          </View>

          <Pressable
            onPress={onSkip}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Laktawan ang gabay"
          >
            <Text style={styles.skipButtonText}>Laktawan</Text>
          </Pressable>
        </View>

        {/* Title */}
        <Text style={styles.titleText}>{content.title}</Text>

        {/* Description Microcopy */}
        <Text style={styles.bodyText}>{content.body}</Text>

        {/* Action Buttons Row */}
        <View style={styles.buttonRow}>
          {currentStep > 1 ? (
            <Pressable
              style={styles.backButton}
              onPress={onBack}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Bumalik sa nakaraang hakbang"
            >
              <Text style={styles.backButtonText}>‹ Bumalik</Text>
            </Pressable>
          ) : <View style={{ flex: 1 }} />}

          <Pressable
            style={styles.nextButton}
            onPress={onNext}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={content.nextButtonLabel}
          >
            <Text style={styles.nextButtonText}>{content.nextButtonLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 99998,
  },
  cardBody: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 16,
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 99999,
  },
  arrowTop: {
    top: -8,
    borderBottomWidth: 8,
    borderBottomColor: '#1E293B',
  },
  arrowBottom: {
    bottom: -8,
    borderTopWidth: 8,
    borderTopColor: '#1E293B',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgePill: {
    backgroundColor: 'rgba(16, 185, 129, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  badgePillText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  skipButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  bodyText: {
    color: '#CBD5E1',
    fontSize: 13.5,
    lineHeight: 19.5,
    fontWeight: '400',
    marginBottom: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  backButtonText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  nextButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
