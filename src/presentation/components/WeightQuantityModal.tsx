// src/presentation/components/WeightQuantityModal.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Money } from '@/domain/value-objects/Money';
import {
  ConfirmationModal,
  ConfirmationType,
} from '@/presentation/components/ConfirmationModal';

export interface WeightQuantityProduct {
  id: string;
  name: string;
  defaultPricePhp: number;
  stockCount: number;
  formattedPrice: string;
  unitOfMeasure?: 'pc' | 'kg';
}

interface WeightQuantityModalProps {
  visible: boolean;
  onClose: () => void;
  product: WeightQuantityProduct | null;
  currentQuantity: number;
  onConfirm: (productId: string, quantity: number) => void;
}

const PRESET_WEIGHTS = [
  { label: '¼ kg (0.25)', weight: 0.25 },
  { label: '½ kg (0.50)', weight: 0.5 },
  { label: '¾ kg (0.75)', weight: 0.75 },
  { label: '1 kg', weight: 1.0 },
  { label: '1.5 kg', weight: 1.5 },
  { label: '2 kg', weight: 2.0 },
  { label: '3 kg', weight: 3.0 },
  { label: '5 kg', weight: 5.0 },
  { label: '10 kg', weight: 10.0 },
  { label: '25 kg (1 Sako)', weight: 25.0 },
];

const PRESET_PESO_AMOUNTS = [10, 20, 30, 50, 100, 150, 200, 500];

interface WeightQuantitySheetProps {
  onClose: () => void;
  product: WeightQuantityProduct;
  initialQuantity: number;
  onConfirm: (productId: string, quantity: number) => void;
}

function WeightQuantitySheet({
  onClose,
  product,
  initialQuantity,
  onConfirm,
}: WeightQuantitySheetProps) {
  const defaultWeight = initialQuantity > 0 ? initialQuantity : 1.0;
  const [mode, setMode] = useState<'WEIGHT' | 'PESO'>('WEIGHT');
  const [weightInput, setWeightInput] = useState<string>(() =>
    Number(defaultWeight.toFixed(3)).toString()
  );
  const [pesoInput, setPesoInput] = useState<string>(() => {
    if (product.defaultPricePhp > 0) {
      const estPeso = Math.round(product.defaultPricePhp * defaultWeight);
      return estPeso > 0 ? estPeso.toString() : '';
    }
    return '';
  });

  const pricePerKg = product.defaultPricePhp;
  const stockCount = product.stockCount;

  // Active computed weight in kg (rounded to 3 decimal places / grams)
  const resolvedWeight = useMemo(() => {
    if (mode === 'WEIGHT') {
      const parsed = parseFloat(weightInput.replace(/[^0-9.]/g, '') || '0');
      return isNaN(parsed) || parsed < 0 ? 0 : Number(parsed.toFixed(3));
    } else {
      const parsedPeso = parseFloat(pesoInput.replace(/[^0-9.]/g, '') || '0');
      if (isNaN(parsedPeso) || parsedPeso <= 0 || pricePerKg <= 0) return 0;
      // Weight = Budget / PricePerKg
      const calculatedWeight = parsedPeso / pricePerKg;
      return Number(calculatedWeight.toFixed(3));
    }
  }, [mode, weightInput, pesoInput, pricePerKg]);

  // Total cost in Pesos (Zero-float invariant: integer centavos)
  const lineTotal = useMemo(() => {
    if (resolvedWeight <= 0 || pricePerKg <= 0) return Money.zero();
    const centavos = Math.round(pricePerKg * 100 * resolvedWeight);
    return Money.fromCentavos(centavos);
  }, [resolvedWeight, pricePerKg]);

  const isStockInsufficient = resolvedWeight > stockCount;

  const handleSelectPresetWeight = (wt: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setWeightInput(Number(wt.toFixed(3)).toString());
  };

  const handleSelectPresetPeso = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPesoInput(amount.toString());
  };

  const handleAdjustWeight = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const current = parseFloat(weightInput.replace(/[^0-9.]/g, '') || '0');
    const next = Math.max(0, current + delta);
    setWeightInput(Number(next.toFixed(3)).toString());
  };

  const [alertModal, setAlertModal] = useState<{
    type?: ConfirmationType;
    title: string;
    message: string;
  } | null>(null);

  const handleConfirm = () => {
    if (resolvedWeight <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setAlertModal({
        type: 'warning',
        title: 'Walang Halaga o Timbang',
        message: 'Mangyaring maglagay ng timbang o halaga ng bibilhin bago ilagay sa cart.',
      });
      return;
    }
    if (isStockInsufficient) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setAlertModal({
        type: 'warning',
        title: 'Kulang ang Stock',
        message: `Mayroon na lamang ${Number(stockCount.toFixed(3))} kg na stock sa imbentaryo para sa ${product.name}. Hindi maaaring magbenta ng higit sa kasalukuyang stock (${resolvedWeight} kg).`,
      });
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onConfirm(product.id, resolvedWeight);
    onClose();
  };

  return (
    <KeyboardAvoidingView
      style={styles.backdrop}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable style={styles.overlayPressable} onPress={onClose} />
      <View style={styles.sheetContainer}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.badgeRow}>
              <View style={styles.unitBadge}>
                <Ionicons name="scale-outline" size={14} color="#0D7A52" />
                <Text style={styles.unitBadgeText}>Tinitimbang (kg)</Text>
              </View>
              <Text style={styles.stockStatusText}>
                Stock: {Number(stockCount.toFixed(3))} kg
              </Text>
            </View>
            <Text style={styles.productTitle} numberOfLines={1}>
              {product.name}
            </Text>
            <Text style={styles.pricePerKgText}>
              {Money.fromPhp(pricePerKg).format()} bawat kilo
            </Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color="#4B5563" />
          </Pressable>
        </View>

        {/* Mode Switcher Tabs */}
        <View style={styles.tabBar}>
          <Pressable
            style={[styles.tabBtn, mode === 'WEIGHT' && styles.tabBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setMode('WEIGHT');
            }}
          >
            <Ionicons
              name="scale"
              size={16}
              color={mode === 'WEIGHT' ? '#0D7A52' : '#6B7280'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabText, mode === 'WEIGHT' && styles.tabTextActive]}>
              Ayon sa Timbang (kg)
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tabBtn, mode === 'PESO' && styles.tabBtnActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setMode('PESO');
            }}
          >
            <Ionicons
              name="cash-outline"
              size={16}
              color={mode === 'PESO' ? '#0D7A52' : '#6B7280'}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.tabText, mode === 'PESO' && styles.tabTextActive]}>
              Ayon sa Halaga (₱ Budget)
            </Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          {mode === 'WEIGHT' ? (
            <>
              {/* Weight Stepper & Direct Input */}
              <Text style={styles.sectionLabel}>Ipasok ang Timbang (kilo):</Text>
              <View style={styles.inputSteppingRow}>
                <Pressable
                  style={styles.stepBtn}
                  onPress={() => handleAdjustWeight(-0.25)}
                  hitSlop={6}
                >
                  <Text style={styles.stepBtnText}>-0.25</Text>
                </Pressable>
                <Pressable
                  style={styles.stepBtn}
                  onPress={() => handleAdjustWeight(-1.0)}
                  hitSlop={6}
                >
                  <Text style={styles.stepBtnText}>-1 kg</Text>
                </Pressable>
                <View style={styles.weightInputWrapper}>
                  <TextInput
                    style={styles.weightTextInput}
                    value={weightInput}
                    onChangeText={(val) => setWeightInput(val)}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    textAlign="center"
                    placeholder="0.000"
                  />
                  <Text style={styles.weightInputSuffix}>kg</Text>
                </View>
                <Pressable
                  style={styles.stepBtn}
                  onPress={() => handleAdjustWeight(0.25)}
                  hitSlop={6}
                >
                  <Text style={styles.stepBtnText}>+0.25</Text>
                </Pressable>
                <Pressable
                  style={styles.stepBtn}
                  onPress={() => handleAdjustWeight(1.0)}
                  hitSlop={6}
                >
                  <Text style={styles.stepBtnText}>+1 kg</Text>
                </Pressable>
              </View>

              {/* Quick Weight Chips */}
              <Text style={styles.sectionLabel}>Mabilisang Pagpili (Tingi & Kilo):</Text>
              <View style={styles.chipGrid}>
                {PRESET_WEIGHTS.map((item) => {
                  const isSelected = Math.abs(resolvedWeight - item.weight) < 0.001;
                  return (
                    <Pressable
                      key={item.label}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => handleSelectPresetWeight(item.weight)}
                    >
                      <Text
                        style={[styles.chipText, isSelected && styles.chipTextSelected]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              {/* Peso Budget Input ("Pabili ng ₱50...") */}
              <Text style={styles.sectionLabel}>
                Magkano ang bibilhin ng customer? (&quot;Pabili ng ₱...&quot;)
              </Text>
              <View style={styles.pesoInputWrapper}>
                <Text style={styles.pesoCurrencyPrefix}>₱</Text>
                <TextInput
                  style={styles.pesoTextInput}
                  value={pesoInput}
                  onChangeText={(val) => setPesoInput(val)}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  placeholder="Hal. 20, 50, 100"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              {/* Quick Peso Chips */}
              <Text style={styles.sectionLabel}>Mabilisang Halaga (₱):</Text>
              <View style={styles.chipGrid}>
                {PRESET_PESO_AMOUNTS.map((amt) => {
                  const isSelected = pesoInput === amt.toString();
                  return (
                    <Pressable
                      key={amt}
                      style={[styles.chip, isSelected && styles.chipSelected]}
                      onPress={() => handleSelectPresetPeso(amt)}
                    >
                      <Text
                        style={[styles.chipText, isSelected && styles.chipTextSelected]}
                      >
                        ₱{amt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Weight breakdown conversion result */}
              {resolvedWeight > 0 ? (
                <View style={styles.conversionBox}>
                  <Ionicons name="information-circle-outline" size={18} color="#0D7A52" />
                  <Text style={styles.conversionText}>
                    Katumbas na timbang:{' '}
                    <Text style={styles.conversionHighlight}>
                      {resolvedWeight} kg ({Math.round(resolvedWeight * 1000)} grams)
                    </Text>
                  </Text>
                </View>
              ) : null}
            </>
          )}

          {/* Warning if stock is insufficient */}
          {isStockInsufficient ? (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={18} color="#B91C1C" />
              <Text style={styles.warningText}>
                ⚠️ Kulang ang stock! ({Number(stockCount.toFixed(3))} kg lamang ang available sa imbentaryo)
              </Text>
            </View>
          ) : null}

          {/* Computation Summary Card */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Kabuuang Timbang:</Text>
              <Text style={styles.summaryValue}>
                {resolvedWeight > 0 ? `${resolvedWeight} kg` : '0 kg'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Presyo bawat Kilo:</Text>
              <Text style={styles.summaryValue}>
                {Money.fromPhp(pricePerKg).format()}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotalRow]}>
              <Text style={styles.summaryTotalLabel}>Kabuuang Bayarin:</Text>
              <Text style={styles.summaryTotalValue}>
                {lineTotal.format()}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Confirm Button */}
        <View style={styles.footerRow}>
          <Pressable
            style={[
              styles.confirmBtn,
              (resolvedWeight <= 0 || isStockInsufficient) && styles.confirmBtnDisabled,
            ]}
            onPress={handleConfirm}
          >
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.confirmBtnText}>
              {initialQuantity > 0 ? 'I-update sa Cart' : 'Ilagay sa Cart'} ({lineTotal.format()})
            </Text>
          </Pressable>
        </View>

        {alertModal ? (
          <ConfirmationModal
            visible={true}
            type={alertModal.type ?? 'warning'}
            title={alertModal.title}
            message={alertModal.message}
            itemName={product.name}
            confirmText="Naintindihan"
            cancelText={null}
            onConfirm={() => setAlertModal(null)}
            onCancel={() => setAlertModal(null)}
          />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

export function WeightQuantityModal({
  visible,
  onClose,
  product,
  currentQuantity,
  onConfirm,
}: WeightQuantityModalProps) {
  if (!visible || !product) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <WeightQuantitySheet
        key={`${product.id}-${currentQuantity}`}
        onClose={onClose}
        product={product}
        initialQuantity={currentQuantity}
        onConfirm={onConfirm}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  overlayPressable: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 20,
    maxHeight: '90%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  unitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  unitBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  stockStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  productTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  pricePerKgText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D7A52',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginTop: 14,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginTop: 10,
    marginBottom: 8,
  },
  inputSteppingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 12,
  },
  stepBtn: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
  },
  weightInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#0D7A52',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  weightTextInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    paddingVertical: 6,
  },
  weightInputSuffix: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7280',
    marginLeft: 4,
  },
  pesoInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#0D7A52',
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    marginBottom: 12,
  },
  pesoCurrencyPrefix: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0D7A52',
    marginRight: 6,
  },
  pesoTextInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    paddingVertical: 8,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  conversionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  conversionText: {
    fontSize: 13,
    color: '#1E40AF',
    fontWeight: '500',
    flex: 1,
  },
  conversionHighlight: {
    fontWeight: '800',
    color: '#1E3A8A',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  warningText: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '700',
    flex: 1,
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '700',
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D7A52',
  },
  footerRow: {
    marginTop: 10,
  },
  confirmBtn: {
    backgroundColor: '#0D7A52',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 52,
    shadowColor: '#0D7A52',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  confirmBtnDisabled: {
    backgroundColor: '#9CA3AF',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
