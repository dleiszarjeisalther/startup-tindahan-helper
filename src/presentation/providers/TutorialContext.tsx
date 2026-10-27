import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { appKeyValueStorage } from '@/infrastructure/storage/KeyValueStorage';
import { useLicensing } from '@/presentation/hooks/useLicensing';

export interface ElementLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius?: number;
}

export interface TutorialContextValue {
  isActive: boolean;
  currentStep: number;
  targets: Record<number, ElementLayout>;
  registerTarget: (step: number, layout: ElementLayout) => void;
  unregisterTarget: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  startTutorial: (force?: boolean) => void;
  triggerWiggle: () => void;
  wiggleAnim: Animated.Value;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [targets, setTargets] = useState<Record<number, ElementLayout>>({});

  // React 19 & Expo SDK 58 Safe Render Rule: initialize Animated.Value in useState
  const wiggleAnim = useState(() => new Animated.Value(0))[0];
  const isWigglingRef = useRef(false);

  const registerTarget = useCallback((step: number, layout: ElementLayout) => {
    setTargets((prev) => {
      const existing = prev[step];
      if (
        existing &&
        Math.round(existing.x) === Math.round(layout.x) &&
        Math.round(existing.y) === Math.round(layout.y) &&
        Math.round(existing.width) === Math.round(layout.width) &&
        Math.round(existing.height) === Math.round(layout.height)
      ) {
        return prev;
      }
      return {
        ...prev,
        [step]: layout,
      };
    });
  }, []);

  const unregisterTarget = useCallback((step: number) => {
    setTargets((prev) => {
      if (!prev[step]) return prev;
      const copy = { ...prev };
      delete copy[step];
      return copy;
    });
  }, []);

  const startTutorial = useCallback((force = false) => {
    if (force || !appKeyValueStorage.hasSeenInteractiveTutorial()) {
      setCurrentStep(1);
      setIsActive(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }, []);

  const nextStep = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCurrentStep((prev) => {
      if (prev < 6) {
        return prev + 1;
      }
      // Completed last step (Step 6): Persist completion
      appKeyValueStorage.setInteractiveTutorialCompleted(true);
      setIsActive(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return 1;
    });
  }, []);

  const previousStep = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCurrentStep((prev) => Math.max(1, prev - 1));
  }, []);

  const skipTutorial = useCallback(() => {
    appKeyValueStorage.setInteractiveTutorialCompleted(true);
    setIsActive(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const triggerWiggle = useCallback(() => {
    if (isWigglingRef.current) return;
    isWigglingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    wiggleAnim.setValue(0);
    Animated.sequence([
      Animated.timing(wiggleAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(wiggleAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(wiggleAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(wiggleAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(wiggleAnim, { toValue: -3, duration: 40, useNativeDriver: true }),
      Animated.timing(wiggleAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start(() => {
      isWigglingRef.current = false;
    });
  }, [wiggleAnim]);

  const { isRegistered } = useLicensing();
  const bootTimeRef = useRef<number | null>(null);

  // Auto-start on fresh boot once splash screen settles (~2800ms) and onboarding is completed
  useEffect(() => {
    if (bootTimeRef.current === null) {
      bootTimeRef.current = Date.now();
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const hasSeen = appKeyValueStorage.hasSeenInteractiveTutorial();
    if (!hasSeen && isRegistered) {
      const elapsed = Date.now() - bootTimeRef.current;
      const delay = Math.max(600, 2800 - elapsed);
      timer = setTimeout(() => {
        setIsActive(true);
        setCurrentStep(1);
      }, delay);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isRegistered]);

  const value = useMemo<TutorialContextValue>(
    () => ({
      isActive,
      currentStep,
      targets,
      registerTarget,
      unregisterTarget,
      nextStep,
      previousStep,
      skipTutorial,
      startTutorial,
      triggerWiggle,
      wiggleAnim,
    }),
    [
      isActive,
      currentStep,
      targets,
      registerTarget,
      unregisterTarget,
      nextStep,
      previousStep,
      skipTutorial,
      startTutorial,
      triggerWiggle,
      wiggleAnim,
    ]
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial(): TutorialContextValue {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
