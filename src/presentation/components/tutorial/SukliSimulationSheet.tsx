import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTutorial } from '@/presentation/providers/TutorialContext';
import { MickeyGlovePointer } from './MickeyGlovePointer';

interface SukliSimulationSheetProps {
  onBack: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

export function SukliSimulationSheet({
  onBack,
  onComplete,
  onSkip,
}: SukliSimulationSheetProps) {
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { triggerWiggle, wiggleAnim } = useTutorial();
  const [tenderedAmount, setTenderedAmount] = useState<number>(20);
  const [hasSelectedTender, setHasSelectedTender] = useState<boolean>(false);
  const [p20ButtonLayout, setP20ButtonLayout] = useState<{ x: number; y: number } | null>(null);
  const [completeBtnLayout, setCompleteBtnLayout] = useState<{ x: number; y: number } | null>(null);
  const p20BtnRef = useRef<any>(null);
  const completeBtnRef = useRef<any>(null);

  const itemTotal = 15;
  const changeDue = Math.max(0, tenderedAmount - itemTotal);

  const quickAmounts = [15, 20, 50, 100];

  const measureTargets = () => {
    p20BtnRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      if (w > 0 && h > 0) {
        setP20ButtonLayout({ x: x + w / 2, y: y + h / 2 });
      }
    });
    completeBtnRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      if (w > 0 && h > 0) {
        setCompleteBtnLayout({ x: x + w / 2, y: y + h / 2 });
      }
    });
  };

  useEffect(() => {
    const t1 = setTimeout(measureTargets, 120);
    const t2 = setTimeout(measureTargets, 350);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const handleSelectAmount = (amt: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTenderedAmount(amt);
    setHasSelectedTender(true);
  };

  return (
    <Pressable style={styles.overlayBackdrop} onPress={triggerWiggle}>
      <Animated.View
        style={[
          styles.sheetCard,
          {
            width: Math.min(screenW - 24, 380),
            paddingBottom: Math.max(20, insets.bottom + 12),
            transform: [{ translateX: wiggleAnim }],
          },
        ]}
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.badgePill}>
            <Text style={styles.badgeText}>Hakbang 6 ng 6</Text>
          </View>
          <Pressable
            onPress={onSkip}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Laktawan ang gabay"
          >
            <Text style={styles.skipText}>Laktawan</Text>
          </Pressable>
        </View>

        {/* Title & Microcopy */}
        <Text style={styles.mainTitle}>💰 Awtomatikong Kwenta ng Sukli</Text>
        <Text style={styles.mainSubtitle}>
          I-type o pindutin lamang ang inabot na pera ng mamimili para agad lumabas ang tamang panukli.
        </Text>

        {/* Sample Item Card */}
        <View style={styles.sampleCartCard}>
          <View style={styles.sampleItemRow}>
            <View style={styles.itemEmojiBox}>
              <Text style={{ fontSize: 22 }}>🍜</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>1x Pancit Canton (Chilimansi)</Text>
              <Text style={styles.itemSub}>Halimbawang Benta sa Tindahan</Text>
            </View>
            <Text style={styles.itemPrice}>₱15.00</Text>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Kabuuang Babayaran:</Text>
            <Text style={styles.totalAmount}>₱15.00</Text>
          </View>
        </View>

        {/* Cash Tendered Selector */}
        <View style={styles.tenderSection}>
          <Text style={styles.sectionLabel}>Piliin ang Inabot na Pera ng Suki:</Text>
          <View style={styles.quickAmountsRow}>
            {quickAmounts.map((amt) => {
              const isSelected = tenderedAmount === amt;
              return (
                <Pressable
                  key={amt}
                  ref={amt === 20 ? p20BtnRef : undefined}
                  onLayout={
                    amt === 20
                      ? () => {
                          p20BtnRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
                            if (w > 0 && h > 0) {
                              setP20ButtonLayout({ x: x + w / 2, y: y + h / 2 });
                            }
                          });
                        }
                      : undefined
                  }
                  style={[
                    styles.amountBtn,
                    isSelected && styles.amountBtnActive,
                  ]}
                  onPress={() => handleSelectAmount(amt)}
                >
                  <Text
                    style={[
                      styles.amountBtnText,
                      isSelected && styles.amountBtnTextActive,
                    ]}
                  >
                    {amt === 15 ? 'Eksakto ₱15' : `₱${amt}`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Live Sukli Result Box */}
        <View style={styles.resultBox}>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Inabot ng Suki:</Text>
            <Text style={styles.resultValue}>₱{tenderedAmount.toFixed(2)}</Text>
          </View>

          <View style={styles.resultRowHighlight}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle" size={22} color="#10B981" />
              <Text style={styles.sukliTitle}>Sukli ng Suki:</Text>
            </View>
            <Text style={styles.sukliAmount}>
              {changeDue === 0 ? 'Walang Sukli' : `₱${changeDue.toFixed(2)}`}
            </Text>
          </View>
        </View>

        {/* Zero Jargon Note */}
        <Text style={styles.friendlyNote}>
          ✨ Awtomatikong naitala at sigurado ang kwenta kahit walang internet!
        </Text>

        {/* Bottom Actions */}
        <View style={styles.bottomActionRow}>
          <Pressable
            style={styles.backButton}
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Bumalik sa nakaraang hakbang"
          >
            <Text style={styles.backButtonText}>‹ Bumalik</Text>
          </Pressable>

          <Pressable
            ref={completeBtnRef}
            style={styles.completeButton}
            onPress={onComplete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Naintindihan Ko! Simulan Magtinda"
          >
            <Text style={styles.completeButtonText}>
              Naintindihan Ko! Simulan Magtinda 🎉
            </Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Mickey Glove Pointer: pointing to ₱20 button initially, then completion button once tender amount is selected */}
      {!hasSelectedTender && p20ButtonLayout ? (
        <MickeyGlovePointer
          targetX={p20ButtonLayout.x}
          targetY={p20ButtonLayout.y}
          visible={true}
        />
      ) : completeBtnLayout ? (
        <MickeyGlovePointer
          targetX={completeBtnLayout.x}
          targetY={completeBtnLayout.y}
          visible={true}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlayBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
  },
  sheetCard: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 20,
    paddingTop: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 20,
  },
  topHeader: {
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
  badgeText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
  },
  skipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  mainTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  mainSubtitle: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  sampleCartCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    marginBottom: 14,
  },
  sampleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemEmojiBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  itemSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  itemPrice: {
    color: '#FBBF24',
    fontSize: 14,
    fontWeight: '800',
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: '#94A3B8',
    fontSize: 12.5,
    fontWeight: '600',
  },
  totalAmount: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  tenderSection: {
    marginBottom: 14,
  },
  sectionLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  amountBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountBtnActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#10B981',
  },
  amountBtnText: {
    color: '#CBD5E1',
    fontSize: 12.5,
    fontWeight: '700',
  },
  amountBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  resultBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#10B981',
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultLabel: {
    color: '#A7F3D0',
    fontSize: 12.5,
  },
  resultValue: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  resultRowHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
  },
  sukliTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  sukliAmount: {
    color: '#10B981',
    fontSize: 20,
    fontWeight: '900',
  },
  friendlyNote: {
    color: '#A7F3D0',
    fontSize: 11.5,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  bottomActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
  },
  backButtonText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
