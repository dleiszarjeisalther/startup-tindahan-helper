// src/presentation/components/UnitSelectionModal.tsx
import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ProductDTO, SellingUnitTier } from '@/domain/entities/Product';
import { ProductThumbnail } from '@/presentation/components/ProductThumbnail';

export interface UnitSelectionModalProps {
  visible: boolean;
  product: ProductDTO | null;
  currentUnit?: 'piece' | 'bundle' | 'pack' | 'box' | 'case';
  onClose: () => void;
  onSelectUnit: (
    unit: 'piece' | 'pack' | 'box',
    multiplier: number,
    price: number,
    fellBackToPiece?: boolean
  ) => void;
  onSaveTierConfig?: (tiers: SellingUnitTier[]) => void | Promise<void>;
}

export function UnitSelectionModal({
  visible,
  product,
  currentUnit = 'piece',
  onClose,
  onSelectUnit,
  onSaveTierConfig,
}: UnitSelectionModalProps) {
  if (!product) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <UnitSelectionDialogContent
        key={product.id}
        product={product}
        currentUnit={currentUnit}
        onClose={onClose}
        onSelectUnit={onSelectUnit}
        onSaveTierConfig={onSaveTierConfig}
      />
    </Modal>
  );
}

interface UnitSelectionDialogContentProps {
  product: ProductDTO;
  currentUnit: 'piece' | 'bundle' | 'pack' | 'box' | 'case';
  onClose: () => void;
  onSelectUnit: (
    unit: 'piece' | 'pack' | 'box',
    multiplier: number,
    price: number,
    fellBackToPiece?: boolean
  ) => void;
  onSaveTierConfig?: (tiers: SellingUnitTier[]) => void | Promise<void>;
}

function UnitSelectionDialogContent({
  product,
  currentUnit,
  onClose,
  onSelectUnit,
}: UnitSelectionDialogContentProps) {
  // Extract or initialize tiers
  const pieceTier =
    product.sellingTiers.find((t) => t.unitName === 'piece') ?? {
      unitName: 'piece' as const,
      baseUnitMultiplier: 1,
      unitPricePhp: product.defaultPricePhp ?? 15,
    };

  const existingPackTier = product.sellingTiers.find(
    (t) => t.unitName === 'pack' || t.unitName === 'bundle'
  );

  const packMultiplier = existingPackTier?.baseUnitMultiplier ?? 10;
  const packPrice =
    existingPackTier?.unitPricePhp ??
    Math.round(pieceTier.unitPricePhp * packMultiplier * 100) / 100;

  const totalStock = product.stockCount ?? 0;
  const availablePacks = Math.floor(totalStock / packMultiplier);
  const isPackOutOfStock = availablePacks <= 0;
  const isPieceOutOfStock = totalStock <= 0;

  const handleSelect = (
    unit: 'piece' | 'pack' | 'box',
    mult: number,
    pr: number,
    fellBackToPiece?: boolean
  ) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onSelectUnit(unit, mult, pr, fellBackToPiece);
    onClose();
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ProductThumbnail visual={product.visual} imageUri={product.imageUri} size="md" />
            <View style={styles.headerTextCol}>
              <Text style={styles.productName} numberOfLines={1}>
                {product.name}
              </Text>
              <Text style={styles.stockSubtitle}>
                Kabuuang Stock: <Text style={styles.stockHighlight}>{product.formattedStock}</Text>
              </Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#6B7280" />
          </Pressable>
        </View>

        <Text style={styles.instructionText}>
          Piliin kung <Text style={styles.instructionBold}>Whole Pack</Text> ba o <Text style={styles.instructionBold}>Per Piece</Text>:
        </Text>

        <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
          {/* OPTION 1: PER PIECE (TINGI) */}
          <Pressable
            disabled={isPieceOutOfStock}
            style={[
              styles.optionCard,
              currentUnit === 'piece' ? styles.optionCardActive : null,
              isPieceOutOfStock ? styles.optionCardDisabled : null,
            ]}
            onPress={() => handleSelect('piece', 1, pieceTier.unitPricePhp)}
          >
            <View style={styles.optionLeft}>
              <View style={[styles.iconWrap, currentUnit === 'piece' ? styles.iconWrapActive : null]}>
                <Ionicons
                  name="pricetag-outline"
                  size={20}
                  color={currentUnit === 'piece' ? '#0D7A52' : '#4B5563'}
                />
              </View>
              <View>
                <View style={styles.titleBadgeRow}>
                  <Text style={styles.optionTitle}>Per Piece (Tingi)</Text>
                  {currentUnit === 'piece' ? (
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>✓ Kasalukuyan</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.optionDetail}>1 piraso lamang</Text>
                <Text style={styles.optionStock}>
                  {isPieceOutOfStock ? '⚠️ Walang stock' : `May ${totalStock} piraso magagamit`}
                </Text>
              </View>
            </View>

            <View style={styles.optionRight}>
              <Text style={styles.optionPrice}>₱{pieceTier.unitPricePhp.toFixed(2)}</Text>
              <View style={[styles.selectBtn, isPieceOutOfStock ? styles.selectBtnDisabled : null]}>
                <Text style={styles.selectBtnText}>{isPieceOutOfStock ? 'Ubos' : '+ Piliin'}</Text>
              </View>
            </View>
          </Pressable>

          {/* OPTION 2: WHOLE PACK (BUONG PACK) */}
          <Pressable
            disabled={isPieceOutOfStock}
            style={[
              styles.optionCard,
              currentUnit === 'pack' ? styles.optionCardActive : null,
              isPieceOutOfStock ? styles.optionCardDisabled : null,
              isPackOutOfStock && !isPieceOutOfStock ? styles.optionCardWarning : null,
            ]}
            onPress={() => {
              if (isPackOutOfStock) {
                // Auto-fallback to piece if insufficient for whole pack
                handleSelect('piece', 1, pieceTier.unitPricePhp, true);
              } else {
                handleSelect('pack', packMultiplier, packPrice, false);
              }
            }}
          >
            <View style={styles.optionLeft}>
              <View
                style={[
                  styles.iconWrap,
                  currentUnit === 'pack' ? styles.iconWrapActive : null,
                  isPackOutOfStock && !isPieceOutOfStock ? styles.iconWrapWarning : null,
                ]}
              >
                <Ionicons
                  name="layers-outline"
                  size={20}
                  color={
                    currentUnit === 'pack'
                      ? '#0D7A52'
                      : isPackOutOfStock && !isPieceOutOfStock
                      ? '#D97706'
                      : '#4B5563'
                  }
                />
              </View>
              <View>
                <View style={styles.titleBadgeRow}>
                  <Text style={styles.optionTitle}>Whole Pack (Buong Pack)</Text>
                  {isPackOutOfStock && !isPieceOutOfStock ? (
                    <View style={styles.warningPill}>
                      <Text style={styles.warningPillText}>Auto Per Piece</Text>
                    </View>
                  ) : currentUnit === 'pack' ? (
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>✓ Kasalukuyan</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.optionDetail}>
                  {packMultiplier} piraso bawat pack (₱{(packPrice / packMultiplier).toFixed(2)}/pc)
                </Text>
                <Text
                  style={[
                    styles.optionStock,
                    isPackOutOfStock && !isPieceOutOfStock ? styles.optionStockWarning : null,
                  ]}
                >
                  {isPieceOutOfStock
                    ? '⚠️ Walang stock'
                    : isPackOutOfStock
                    ? `⚠️ Kulang para sa 1 pack (${totalStock} pcs na lang) — auto per piece`
                    : `May ${availablePacks} pack magagamit`}
                </Text>
              </View>
            </View>

            <View style={styles.optionRight}>
              <Text style={styles.optionPrice}>₱{packPrice.toFixed(2)}</Text>
              <View
                style={[
                  styles.selectBtn,
                  isPieceOutOfStock
                    ? styles.selectBtnDisabled
                    : isPackOutOfStock
                    ? styles.selectBtnWarning
                    : null,
                ]}
              >
                <Text style={styles.selectBtnText}>
                  {isPieceOutOfStock
                    ? 'Ubos'
                    : isPackOutOfStock
                    ? 'Per Piece na lang'
                    : '+ Piliin'}
                </Text>
              </View>
            </View>
          </Pressable>
        </ScrollView>

        {/* Footer Dismiss */}
        <Pressable style={styles.dismissBtn} onPress={onClose}>
          <Text style={styles.dismissBtnText}>Isara</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTextCol: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  stockSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  stockHighlight: {
    color: '#0D7A52',
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  instructionText: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 12,
    marginBottom: 10,
  },
  instructionBold: {
    fontWeight: '700',
    color: '#0D7A52',
  },
  optionsScroll: {
    maxHeight: 380,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  optionCardActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  optionCardDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    opacity: 0.6,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#D1FAE5',
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  activePill: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  optionDetail: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  optionStock: {
    fontSize: 11,
    color: '#0D7A52',
    fontWeight: '600',
    marginTop: 2,
  },
  optionRight: {
    alignItems: 'flex-end',
    gap: 4,
    marginLeft: 8,
  },
  optionPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D7A52',
  },
  selectBtn: {
    backgroundColor: '#0D7A52',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  selectBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  optionCardWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  iconWrapWarning: {
    backgroundColor: '#FEF3C7',
  },
  warningPill: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  warningPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  optionStockWarning: {
    color: '#D97706',
    fontWeight: '700',
  },
  selectBtnWarning: {
    backgroundColor: '#D97706',
  },
  selectBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  dismissBtn: {
    marginTop: 14,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    alignItems: 'center',
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
});
