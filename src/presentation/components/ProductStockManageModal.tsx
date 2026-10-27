import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ProductDTO } from '../../domain/entities/Product';
import { ProductThumbnail } from './ProductThumbnail';
import {
  ConfirmationModal,
  ConfirmationModalDetail,
  ConfirmationType,
} from './ConfirmationModal';

export interface ProductStockManageModalProps {
  visible: boolean;
  product: ProductDTO | null;
  onClose: () => void;
  onAdjustStock: (params: {
    productId: string;
    mode: 'RESTOCK' | 'HOME_USE' | 'DAMAGED_EXPIRED' | 'UNPACK_TINGI';
    quantity: number;
    reason?: string;
  }) => Promise<void>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onEditProduct: (product: ProductDTO) => void;
  onChangePhoto: (productId: string) => void;
  showToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
  operatingMode?: 'OWNER' | 'CASHIER';
  isStoreSecurityEnabled?: boolean;
  isStoreLocked?: boolean;
  onRequirePinChallenge?: (action: () => void) => void;
}

export const ProductStockManageModal: React.FC<ProductStockManageModalProps> = ({
  visible,
  product,
  onClose,
  onAdjustStock,
  onDeleteProduct,
  onEditProduct,
  onChangePhoto,
  showToast,
  operatingMode = 'OWNER',
  isStoreSecurityEnabled = false,
  isStoreLocked = false,
  onRequirePinChallenge,
}) => {
  const [inputQtyStr, setInputQtyStr] = useState<string>('10');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Confirmation dialog state
  const [confirmState, setConfirmState] = useState<{
    visible: boolean;
    type: ConfirmationType;
    title: string;
    message: string;
    itemName: string;
    details: ConfirmationModalDetail[];
    confirmText: string;
    reasonSelector?: {
      label: string;
      options: string[];
      defaultReason: string;
      placeholder?: string;
    };
    action: (reason?: string) => Promise<void>;
  } | null>(null);

  if (!product) return null;

  const inputQty = Math.max(1, parseInt(inputQtyStr || '1', 10) || 1);
  const currentStock = product.stockCount;
  const unitCost = product.unitCostPhp || 0;
  const price = product.defaultPricePhp;
  const tuboPerPiece = Math.max(0, price - unitCost);
  const isCashierRestricted = operatingMode === 'CASHIER' || (isStoreSecurityEnabled && isStoreLocked);

  const guardWithPin = (action: () => void) => {
    if (isCashierRestricted && onRequirePinChallenge) {
      onRequirePinChallenge(action);
    } else {
      action();
    }
  };

  const handleStepQty = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = Math.max(1, inputQty + delta);
    setInputQtyStr(next.toString());
  };

  const handleSetPresetQty = (val: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInputQtyStr(val.toString());
  };

  // 1. Restock Action
  const triggerRestock = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setConfirmState({
      visible: true,
      type: 'restock',
      title: 'Kumpirmahin ang Restock',
      itemName: product.name,
      message: 'Sigurado ka bang nais mong magdagdag ng stock sa panindang ito?',
      details: [
        { label: 'Kasalukuyang Stock', value: `${currentStock} pcs` },
        { label: 'Dami ng Idaragdag', value: `+${inputQty} pcs` },
        { label: 'Magiging Kabuuan', value: `${currentStock + inputQty} pcs`, highlight: true },
      ],
      reasonSelector: {
        label: 'Dahilan ng Restock:',
        options: ['Bagong Delivery', 'Replenishment', 'Return to Shelf', 'Physical Count Correction'],
        defaultReason: 'Bagong Delivery',
        placeholder: 'Hal. galing sa supplier / delivery...',
      },
      confirmText: 'Itala ang Stock',
      action: async (reason) => {
        setIsSubmitting(true);
        try {
          await onAdjustStock({
            productId: product.id,
            mode: 'RESTOCK',
            quantity: inputQty,
            reason,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          showToast(`✓ Naidagdag +${inputQty} ${product.name} sa stock`, 'success');
          onClose();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Hindi maitala ang stock.';
          showToast(msg, 'error');
        } finally {
          setIsSubmitting(false);
          setConfirmState(null);
        }
      },
    });
  };

  // 2. Unpack Tingi Action
  const triggerUnpackTingi = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setConfirmState({
      visible: true,
      type: 'unpack',
      title: 'Kumpirmahin ang Pag-unpack',
      itemName: product.name,
      message: `Nais mo bang buksan ang ${inputQty} bulk pack para maging +${inputQty * 10} tingi piraso?`,
      details: [
        { label: 'Kasalukuyang Stock', value: `${currentStock} pcs` },
        { label: 'Mababawas na Pack', value: `-${inputQty} pack` },
        { label: 'Dagdag sa Tingi', value: `+${inputQty * 10} piraso`, highlight: true },
      ],
      reasonSelector: {
        label: 'Dahilan ng Pag-unpack:',
        options: ['Binuksang Pack para sa Tingi', 'Replenish Tingi Shelf', 'Pabor sa Suki'],
        defaultReason: 'Binuksang Pack para sa Tingi',
      },
      confirmText: 'I-unpack ang Tingi',
      action: async (reason) => {
        setIsSubmitting(true);
        try {
          await onAdjustStock({
            productId: product.id,
            mode: 'UNPACK_TINGI',
            quantity: inputQty,
            reason,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          showToast(`✓ Na-unpack ang ${inputQty} bulk pack sa tingi piraso`, 'success');
          onClose();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Hindi ma-unpack ang paninda.';
          showToast(msg, 'error');
        } finally {
          setIsSubmitting(false);
          setConfirmState(null);
        }
      },
    });
  };

  // 3. Gamit sa Bahay (Home Use)
  const triggerHomeUse = () => {
    guardWithPin(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const remaining = Math.max(0, currentStock - inputQty);
      setConfirmState({
        visible: true,
        type: 'home_use',
        title: 'Gamit sa Bahay (Home Use)',
        itemName: product.name,
        message: `Ibabawas ba ang ${inputQty} pc ng paninda para sa pansariling gamit sa bahay?`,
        details: [
          { label: 'Kasalukuyang Stock', value: `${currentStock} pcs` },
          { label: 'Ibabawas', value: `-${inputQty} pc` },
          { label: 'Matitirang Stock', value: `${remaining} pcs`, highlight: true },
        ],
        reasonSelector: {
          label: 'Dahilan ng Bawas (Home Use):',
          options: ['Pansariling Gamit', 'Kusina / Pananghalian', 'Pamilya / Meryenda', 'Suki Sample'],
          defaultReason: 'Pansariling Gamit',
          placeholder: 'Hal. ulam ng pamilya, meryenda...',
        },
        confirmText: 'I-bawas sa Stock',
        action: async (reason) => {
          setIsSubmitting(true);
          try {
            await onAdjustStock({
              productId: product.id,
              mode: 'HOME_USE',
              quantity: inputQty,
              reason,
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            showToast(`✓ Naitala ang -${inputQty} ${product.name} bilang Gamit sa Bahay`, 'warning');
            onClose();
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Hindi maitala ang bawas.';
            showToast(msg, 'error');
          } finally {
            setIsSubmitting(false);
            setConfirmState(null);
          }
        },
      });
    });
  };

  // 4. Sira / Expired Action
  const triggerDamaged = () => {
    guardWithPin(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const remaining = Math.max(0, currentStock - inputQty);
      setConfirmState({
        visible: true,
        type: 'damaged',
        title: 'Sira o Expired na Paninda',
        itemName: product.name,
        message: `Sigurado ka bang sira o expired ang ${inputQty} pc? Ibabawas ito sa mabebentang stock.`,
        details: [
          { label: 'Kasalukuyang Stock', value: `${currentStock} pcs` },
          { label: 'Ibabawas', value: `-${inputQty} pc` },
          { label: 'Matitirang Stock', value: `${remaining} pcs`, highlight: true },
        ],
        reasonSelector: {
          label: 'Dahilan ng Pagkasira / Expiry:',
          options: ['Basag / Depektibo', 'Lampas na sa Expiry', 'Daga / Insekto / Nabasa'],
          defaultReason: 'Lampas na sa Expiry',
          placeholder: 'Hal. may tagas ang supot, expired...',
        },
        confirmText: 'Itala bilang Sira',
        action: async (reason) => {
          setIsSubmitting(true);
          try {
            await onAdjustStock({
              productId: product.id,
              mode: 'DAMAGED_EXPIRED',
              quantity: inputQty,
              reason,
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            showToast(`✓ Inilipat ang ${inputQty} ${product.name} sa Talaan ng Sira`, 'warning');
            onClose();
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Hindi maitala ang sira.';
            showToast(msg, 'error');
          } finally {
            setIsSubmitting(false);
            setConfirmState(null);
          }
        },
      });
    });
  };

  // 5. Delete Product Action
  const triggerDelete = () => {
    guardWithPin(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setConfirmState({
        visible: true,
        type: 'delete',
        title: 'Alisin ang Paninda?',
        itemName: product.name,
        message: `Sigurado ka bang nais mong tanggalin ang "${product.name}" sa iyong paninda? Hindi na ito maibabalik.`,
        details: [
          { label: 'Kasalukuyang Stock', value: `${currentStock} pcs` },
          { label: 'Barcode', value: product.barcode || 'Wala' },
        ],
        confirmText: 'Oo, Alisin ang Paninda',
        action: async () => {
          setIsSubmitting(true);
          try {
            await onDeleteProduct(product.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            showToast(`🗑️ Naalis ang "${product.name}" sa imbentaryo`, 'warning');
            onClose();
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Hindi maalis ang paninda.';
            showToast(msg, 'error');
          } finally {
            setIsSubmitting(false);
            setConfirmState(null);
          }
        },
      });
    });
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.backdropDismiss} onPress={onClose} />
          <View style={styles.modalSheet}>
            <View style={styles.handleBar} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.thumbBox}>
                  <ProductThumbnail visual={product.visual} imageUri={product.imageUri} size="md" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.productSub} numberOfLines={1}>
                    Barcode: {product.barcode || 'Wala'} • {product.category || 'Paninda'}
                  </Text>
                </View>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Quick Actions Bar (Edit & Photo) */}
              <View style={styles.topActionBar}>
                <Text style={styles.manageTag}>Pamamahala ng Paninda</Text>
                <View style={styles.topBtnGroup}>
                  <Pressable
                    style={styles.btnEditPill}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      guardWithPin(() => {
                        onClose();
                        onEditProduct(product);
                      });
                    }}
                  >
                    <Ionicons name="pencil" size={13} color="#0D7A52" />
                    <Text style={styles.btnEditPillText}>Baguhin (Edit)</Text>
                  </Pressable>

                  <Pressable
                    style={styles.btnPhotoPill}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      onClose();
                      onChangePhoto(product.id);
                    }}
                  >
                    <Ionicons name="camera-outline" size={13} color="#334155" />
                    <Text style={styles.btnPhotoPillText}>Litrato</Text>
                  </Pressable>
                </View>
              </View>

              {/* Status Overview Card */}
              <View style={styles.overviewCard}>
                <View style={styles.ovCol}>
                  <Text style={styles.ovLabel}>Kasalukuyang Stock</Text>
                  <Text style={[styles.ovVal, currentStock <= 3 && styles.ovValLow]}>
                    {product.formattedStock}
                  </Text>
                </View>
                <View style={styles.ovCol}>
                  <Text style={styles.ovLabel}>Presyo ng Benta</Text>
                  <Text style={styles.ovVal}>{product.formattedPrice}</Text>
                </View>
                <View style={styles.ovCol}>
                  <Text style={styles.ovLabel}>Tubo bawat Piraso</Text>
                  <Text style={[styles.ovVal, styles.ovValGreen]}>
                    ₱{tuboPerPiece.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Multi-Unit Selling Tiers Summary */}
              {product.sellingTiers && product.sellingTiers.length > 1 ? (
                <View style={styles.tiersBox}>
                  <View style={styles.tiersHeader}>
                    <Text style={styles.tiersTitle}>Multi-unit Selling Tiers:</Text>
                    <Text style={styles.tiersActiveBadge}>Aktibo</Text>
                  </View>
                  {product.sellingTiers.map((tier) => (
                    <Text key={tier.unitName} style={styles.tierLine}>
                      • {tier.unitName.toUpperCase()}: ₱{tier.unitPricePhp.toFixed(2)} ({tier.baseUnitMultiplier} pcs)
                    </Text>
                  ))}
                </View>
              ) : null}

              {/* Interactive Quantity Stepper Box */}
              <View style={styles.stepperCard}>
                <View style={styles.stepperTop}>
                  <Text style={styles.stepperTitle}>Dami ng I-aadjust (Qty):</Text>
                  <View style={styles.qtyChips}>
                    {[1, 5, 10, 24].map((p) => {
                      const isActive = inputQty === p;
                      return (
                        <Pressable
                          key={p}
                          style={[styles.qtyChip, isActive && styles.qtyChipActive]}
                          onPress={() => handleSetPresetQty(p)}
                        >
                          <Text style={[styles.qtyChipText, isActive && styles.qtyChipTextActive]}>
                            +{p}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.stepperControls}>
                  <Pressable
                    style={[styles.btnStep, inputQty <= 1 && styles.btnStepDisabled]}
                    onPress={() => handleStepQty(-1)}
                    disabled={inputQty <= 1}
                  >
                    <Text style={styles.btnStepText}>−</Text>
                  </Pressable>

                  <TextInput
                    style={styles.inputQty}
                    value={inputQtyStr}
                    onChangeText={(val) => setInputQtyStr(val.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={4}
                  />

                  <Pressable style={styles.btnStep} onPress={() => handleStepQty(1)}>
                    <Text style={styles.btnStepText}>+</Text>
                  </Pressable>

                  <Text style={styles.stepUnitText}>
                    {product.unitOfMeasure === 'kg' ? 'kilo (kg)' : 'piraso (pcs)'}
                  </Text>
                </View>
              </View>

              {/* Section Header */}
              <Text style={styles.actionSectionTitle}>Mga Aksyon sa Stock:</Text>

              {/* Row 1: Green Restock + Blue Tingi */}
              <View style={styles.btnRow}>
                <Pressable
                  style={[styles.btnAction, styles.btnRestock]}
                  onPress={triggerRestock}
                  disabled={isSubmitting}
                >
                  <Ionicons name="add-circle-outline" size={16} color="#166534" />
                  <Text style={styles.btnRestockText}>+{inputQty} Restock</Text>
                </Pressable>

                <Pressable
                  style={[styles.btnAction, styles.btnTingi]}
                  onPress={triggerUnpackTingi}
                  disabled={isSubmitting}
                >
                  <Ionicons name="cube-outline" size={16} color="#1E40AF" />
                  <Text style={styles.btnTingiText}>📦 +{inputQty * 10} Tingi</Text>
                </Pressable>
              </View>

              {/* Row 2: Amber Gamit sa Bahay + Red Sira/Expired */}
              <View style={styles.btnRow}>
                <Pressable
                  style={[styles.btnAction, styles.btnHomeUse]}
                  onPress={triggerHomeUse}
                  disabled={isSubmitting}
                >
                  <Ionicons name="home-outline" size={16} color="#92400E" />
                  <Text style={styles.btnHomeUseText}>−{inputQty} Gamit sa Bahay</Text>
                </Pressable>

                <Pressable
                  style={[styles.btnAction, styles.btnDamaged]}
                  onPress={triggerDamaged}
                  disabled={isSubmitting}
                >
                  <Ionicons name="warning-outline" size={16} color="#991B1B" />
                  <Text style={styles.btnDamagedText}>⚠ −{inputQty} Sira/Expired</Text>
                </Pressable>
              </View>

              {/* Row 3: Delete Product */}
              <Pressable
                style={[styles.btnDelete, isSubmitting && styles.btnDisabled]}
                onPress={triggerDelete}
                disabled={isSubmitting}
              >
                <Ionicons name="trash-outline" size={15} color="#FFFFFF" />
                <Text style={styles.btnDeleteText}>Alisin ang Paninda</Text>
              </Pressable>

              {/* Microcopy Security Note */}
              <View style={styles.securityFooter}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#0D7A52" />
                <Text style={styles.securityFooterText}>
                  Ligtas at Sigurado: Bawat galaw ng paninda ay may dahilan at agad na naisasalba sa iyong tindahan nang walang kalituhan.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirmation Dialog Component */}
      {confirmState && (
        <ConfirmationModal
          visible={confirmState.visible}
          type={confirmState.type}
          title={confirmState.title}
          message={confirmState.message}
          itemName={confirmState.itemName}
          details={confirmState.details}
          reasonSelector={confirmState.reasonSelector}
          confirmText={confirmState.confirmText}
          cancelText="Kanselahin"
          isLoading={isSubmitting}
          onConfirm={confirmState.action}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  backdropDismiss: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  productSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    maxHeight: 520,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  topActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  manageTag: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  topBtnGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  btnEditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  btnEditPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0D7A52',
  },
  btnPhotoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  btnPhotoPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#334155',
  },
  overviewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ovCol: {
    alignItems: 'center',
  },
  ovLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
  },
  ovVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  ovValGreen: {
    color: '#0D7A52',
  },
  ovValLow: {
    color: '#D97706',
  },
  tiersBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 10,
    padding: 10,
    gap: 3,
  },
  tiersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  tiersTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D7A52',
  },
  tiersActiveBadge: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#15803D',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierLine: {
    fontSize: 10.5,
    color: '#166534',
    fontWeight: '600',
  },
  stepperCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  stepperTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1E293B',
    textTransform: 'uppercase',
  },
  qtyChips: {
    flexDirection: 'row',
    gap: 6,
  },
  qtyChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  qtyChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  qtyChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  qtyChipTextActive: {
    color: '#15803D',
    fontWeight: '800',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnStep: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnStepDisabled: {
    opacity: 0.4,
  },
  btnStepText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputQty: {
    width: 64,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#0D7A52',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    color: '#0D7A52',
    paddingHorizontal: 4,
  },
  stepUnitText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginLeft: 4,
  },
  actionSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  btnRestock: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
  },
  btnRestockText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#166534',
  },
  btnTingi: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
  },
  btnTingiText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1E40AF',
  },
  btnHomeUse: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
  },
  btnHomeUseText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  btnDamaged: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  btnDamagedText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
  },
  btnDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1F2937',
    borderRadius: 10,
    paddingVertical: 11,
    marginTop: 2,
  },
  btnDeleteText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F9FAFB',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  securityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    marginTop: 4,
  },
  securityFooterText: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 14,
    flex: 1,
  },
});
