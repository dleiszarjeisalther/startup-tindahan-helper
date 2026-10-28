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
import { useRouter } from 'expo-router';
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
  onChangePhoto: (productId: string, source?: 'CAMERA' | 'GALLERY') => void;
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
  const router = useRouter();
  const [inputQtyStr, setInputQtyStr] = useState<string>('10');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPhotoChoiceModal, setShowPhotoChoiceModal] = useState<boolean>(false);

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
      options: string[];
      defaultReason?: string;
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
  const marginPct = price > 0 ? Math.round((tuboPerPiece / price) * 100) : 0;
  const isLowStock =
    product.stockStatus === 'LOW_STOCK' ||
    currentStock <= (product.effectiveLowStockThreshold || 5);
  const isCashierRestricted = operatingMode === 'CASHIER' || (isStoreSecurityEnabled && isStoreLocked);

  // Multi-unit pack / tingi calculation
  const packTier = product.sellingTiers?.find(
    (u) => u.unitName !== 'piece' && u.baseUnitMultiplier > 1
  );
  const packMultiplier = packTier?.baseUnitMultiplier || 10;
  const packName = packTier?.unitName || 'pack';
  const tingiQty = inputQty * packMultiplier;

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
    setInputQtyStr(String(next));
  };

  const handleSelectQuickChip = (qty: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setInputQtyStr(String(qty));
  };

  const handleRestock = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setConfirmState({
      visible: true,
      type: 'restock',
      title: 'Itala ang Restock (+)',
      message: `Idaragdag ang ${inputQty} pcs sa stock ng ${product.name}.`,
      itemName: product.name,
      details: [
        { label: 'Dating Stock', value: `${currentStock} pcs` },
        { label: 'Idaragdag', value: `+${inputQty} pcs` },
        { label: 'Bagong Stock', value: `${currentStock + inputQty} pcs` },
      ],
      confirmText: 'Oo, Idagdag sa Stock',
      action: async () => {
        try {
          setIsSubmitting(true);
          await onAdjustStock({
            productId: product.id,
            mode: 'RESTOCK',
            quantity: inputQty,
            reason: 'Bagong bili / Restock mula sa supplier',
          });
          showToast(`+${inputQty} pcs naidagdag sa stock ng ${product.name}!`, 'success');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Hindi naisave ang stock.';
          showToast(msg, 'error');
        } finally {
          setIsSubmitting(false);
          setConfirmState(null);
        }
      },
    });
  };

  const handleUnpackTingi = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setConfirmState({
      visible: true,
      type: 'unpack',
      title: 'Buksan Bilang Tingi (📦)',
      message: `Bubuksan ang ${inputQty} ${packName} (${packMultiplier}x) upang maging +${tingiQty} retail tingi piraso.`,
      itemName: product.name,
      details: [
        { label: 'Bultong Bubuksan', value: `${inputQty} ${packName}` },
        { label: 'Idaragdag na Tingi', value: `+${tingiQty} pcs` },
        { label: 'Bagong Stock', value: `${currentStock + tingiQty} pcs` },
      ],
      confirmText: 'Oo, Gawing Tingi',
      action: async () => {
        try {
          setIsSubmitting(true);
          await onAdjustStock({
            productId: product.id,
            mode: 'UNPACK_TINGI',
            quantity: tingiQty,
            reason: `Bukas ng ${inputQty} ${packName} tingi`,
          });
          showToast(`+${tingiQty} pcs tingi naidagdag sa stock!`, 'success');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Hindi naisave ang tingi.';
          showToast(msg, 'error');
        } finally {
          setIsSubmitting(false);
          setConfirmState(null);
        }
      },
    });
  };

  const handleHomeUse = () => {
    guardWithPin(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setConfirmState({
        visible: true,
        type: 'home_use',
        title: 'Bawas: Gamit sa Bahay (🏠)',
        message: `Ibabawas ang ${inputQty} pcs para sa pansariling konsumo ng pamilya. Hindi ito mabibilang sa Benta at hindi mababawasan ang Pera sa Kaha.`,
        itemName: product.name,
        details: [
          { label: 'Dating Stock', value: `${currentStock} pcs` },
          { label: 'Ibabawas', value: `−${inputQty} pcs` },
          { label: 'Matitirang Stock', value: `${Math.max(0, currentStock - inputQty)} pcs` },
          { label: 'Dahilan', value: 'Konsumo ng pamilya sa bahay' },
        ],
        confirmText: 'Oo, Ibawas sa Stock',
        action: async () => {
          try {
            setIsSubmitting(true);
            await onAdjustStock({
              productId: product.id,
              mode: 'HOME_USE',
              quantity: inputQty,
              reason: 'Konsumo ng pamilya sa bahay',
            });
            showToast(`−${inputQty} pcs ibinawas para sa konsumo sa bahay.`, 'success');
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Hindi naisave ang bawas sa stock.';
            showToast(msg, 'error');
          } finally {
            setIsSubmitting(false);
            setConfirmState(null);
          }
        },
      });
    });
  };

  const handleDamagedExpired = () => {
    guardWithPin(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setConfirmState({
        visible: true,
        type: 'damaged',
        title: 'Bawas: Sira / Expired (⚠️)',
        message: `Ibabawas ang ${inputQty} pcs sa mabebentang stock at itatala sa listahan ng sira o expired na paninda (para sa B.O. / return sa supplier).`,
        itemName: product.name,
        details: [
          { label: 'Dating Stock', value: `${currentStock} pcs` },
          { label: 'Ibabawas', value: `−${inputQty} pcs` },
          { label: 'Matitirang Stock', value: `${Math.max(0, currentStock - inputQty)} pcs` },
        ],
        reasonSelector: {
          options: [
            'Sira / Basag na Packaging',
            'Expired / Lampas Petsa',
            'Inamag / Napanis',
            'May Butas / Kinain ng Daga/Insekto',
          ],
          defaultReason: 'Sira / Basag na Packaging',
          placeholder: 'Iba pang dahilan...',
        },
        confirmText: 'Oo, Itala Bilang Sira',
        action: async (selectedReason?: string) => {
          try {
            setIsSubmitting(true);
            await onAdjustStock({
              productId: product.id,
              mode: 'DAMAGED_EXPIRED',
              quantity: inputQty,
              reason: selectedReason || 'Sira / Expired na Paninda',
            });
            showToast(`−${inputQty} pcs inilipat sa talaan ng sira / expired.`, 'warning');
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Hindi naisave ang bawas sa stock.';
            showToast(msg, 'error');
          } finally {
            setIsSubmitting(false);
            setConfirmState(null);
          }
        },
      });
    });
  };

  const handleDelete = () => {
    guardWithPin(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setConfirmState({
        visible: true,
        type: 'delete',
        title: 'Alisin ang Paninda sa Tindahan',
        message: `Sigurado ka bang nais mong tanggalin ang "${product.name}" sa iyong imbentaryo? Hindi na ito lilitaw sa listahan o sa cashier scanner.`,
        itemName: product.name,
        details: [
          { label: 'Barcode', value: product.barcode },
          { label: 'Huling Stock', value: `${currentStock} pcs` },
        ],
        confirmText: 'Oo, Tanggalin ang Paninda',
        action: async () => {
          try {
            setIsSubmitting(true);
            await onDeleteProduct(product.id);
            showToast(`Naalis na ang "${product.name}" sa tindahan.`, 'warning');
            onClose();
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Hindi natanggal ang paninda.';
            showToast(msg, 'error');
          } finally {
            setIsSubmitting(false);
            setConfirmState(null);
          }
        },
      });
    });
  };

  const handleNavigateToHistory = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onClose();
    router.push('/history');
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdropPressable} onPress={onClose} />

          <View style={styles.modalSheet}>
            {/* Top Drag Handle */}
            <View style={styles.handleBar} />

            {/* Product Header Row */}
            <View style={styles.productHeaderRow}>
              <View style={styles.productHeaderLeft}>
                <ProductThumbnail
                  visual={product.visual}
                  imageUri={product.imageUri}
                  size="md"
                />

                <View style={styles.productHeaderInfo}>
                  <Text style={styles.productNameText} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.productBarcodeSubtext}>
                    {product.barcode} • {product.category || 'Pangkalahatan'}
                  </Text>

                  {/* Action Pills Row */}
                  <View style={styles.headerActionPillsRow}>
                    <Pressable
                      style={styles.pillEdit}
                      onPress={() => {
                        guardWithPin(() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          onClose();
                          onEditProduct(product);
                        });
                      }}
                    >
                      <Ionicons name="create-outline" size={13} color="#0D7A52" />
                      <Text style={styles.pillEditText}>Baguhin ang Detalye</Text>
                    </Pressable>

                    <Pressable
                      style={styles.pillPhoto}
                      onPress={() => {
                        guardWithPin(() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setShowPhotoChoiceModal(true);
                        });
                      }}
                    >
                      <Ionicons name="camera-outline" size={13} color="#334155" />
                      <Text style={styles.pillPhotoText}>Litrato</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  onClose();
                }}
                style={styles.closeCircleButton}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Status Overview (3-Column White Card) */}
              <View style={styles.statusOverviewCard}>
                {/* Column 1: Kasalukuyang Stock */}
                <View style={styles.statusCol}>
                  <Text style={styles.statusColLabel}>Kasalukuyang Stock</Text>
                  <View style={styles.statusStockValueRow}>
                    <View
                      style={[
                        styles.stockDot,
                        { backgroundColor: isLowStock ? '#DC2626' : '#16A34A' },
                      ]}
                    />
                    <Text style={styles.statusStockValueText}>{currentStock} pcs</Text>
                  </View>
                  <Text
                    style={[
                      styles.statusStockSubtext,
                      { color: isLowStock ? '#DC2626' : '#15803D' },
                    ]}
                  >
                    {isLowStock ? 'Kulang sa stock' : 'Sapat ang stock'}
                  </Text>
                </View>

                <View style={styles.statusDivider} />

                {/* Column 2: Presyo ng Benta */}
                <View style={styles.statusCol}>
                  <Text style={styles.statusColLabel}>Presyo ng Benta</Text>
                  <Text style={styles.statusPriceValueText}>₱{price.toFixed(2)}</Text>
                  <Text style={styles.statusCostSubtext}>
                    Puhunan: ₱{unitCost.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.statusDivider} />

                {/* Column 3: Tubo bawat Piraso */}
                <View style={styles.statusCol}>
                  <Text style={styles.statusColLabel}>Tubo bawat Piraso</Text>
                  <Text style={styles.statusTuboValueText}>
                    +₱{tuboPerPiece.toFixed(2)}
                  </Text>
                  <View style={styles.marginBadge}>
                    <Text style={styles.marginBadgeText}>{marginPct}% kita</Text>
                  </View>
                </View>
              </View>

              {/* Interactive Stepper Card */}
              <View style={styles.stepperCard}>
                <View style={styles.stepperHeaderRow}>
                  <Text style={styles.stepperHeaderTitle}>
                    DAMI NG I-AADJUST (QTY) :
                  </Text>
                  <Text style={styles.stepperHeaderSubtext}>Pumili o mag-type</Text>
                </View>

                {/* Stepper Controls Row */}
                <View style={styles.stepperControlsRow}>
                  <Pressable
                    style={styles.stepperSquareBtn}
                    onPress={() => handleStepQty(-1)}
                  >
                    <Ionicons name="remove" size={22} color="#334155" />
                  </Pressable>

                  <View style={styles.stepperCenterInputBox}>
                    <TextInput
                      style={styles.stepperTextInput}
                      value={inputQtyStr}
                      onChangeText={(val) => setInputQtyStr(val.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      selectTextOnFocus
                    />
                    <Text style={styles.stepperUnitLabel}>pcs</Text>
                  </View>

                  <Pressable
                    style={styles.stepperSquareBtn}
                    onPress={() => handleStepQty(1)}
                  >
                    <Ionicons name="add" size={22} color="#334155" />
                  </Pressable>
                </View>

                {/* Quick Chips Row */}
                <View style={styles.quickChipsRow}>
                  {[
                    { label: '1 pc', qty: 1 },
                    { label: '5 pcs', qty: 5 },
                    { label: '10 pcs', qty: 10 },
                    { label: '12 Dosena', qty: 12 },
                    { label: '24 Kahon', qty: 24 },
                  ].map((chip) => {
                    const isActive = inputQty === chip.qty;
                    return (
                      <Pressable
                        key={chip.label}
                        style={[
                          styles.quickChip,
                          isActive && styles.quickChipActive,
                        ]}
                        onPress={() => handleSelectQuickChip(chip.qty)}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            isActive && styles.quickChipTextActive,
                          ]}
                        >
                          {chip.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Stock Actions Header */}
              <View style={styles.actionsHeaderRow}>
                <Text style={styles.actionsHeaderTitle}>
                  MGA AKSYON SA STOCK (PUMILI NG DAHILAN) :
                </Text>
                <Text style={styles.actionsHeaderSubtext}>1-tap save</Text>
              </View>

              {/* Stock Actions (2x2 Color Grid) */}
              <View style={styles.actionGridContainer}>
                {/* Card 1: +Restock (Green) */}
                <Pressable
                  style={[styles.actionCard, styles.actionCardRestock]}
                  onPress={handleRestock}
                  disabled={isSubmitting}
                >
                  <View style={[styles.actionCardIconBadge, styles.iconBadgeGreen]}>
                    <Ionicons name="add" size={18} color="#16A34A" />
                  </View>
                  <Text style={[styles.actionCardTitle, styles.textGreenTitle]}>
                    +{inputQty} Restock
                  </Text>
                  <Text style={[styles.actionCardSubtitle, styles.textGreenSubtitle]}>
                    Bagong bili / dagdag
                  </Text>
                  <View style={[styles.stockPill, styles.stockPillGreen]}>
                    <Text style={[styles.stockPillText, styles.textGreenPill]}>
                      Magiging stock: {currentStock + inputQty} pcs
                    </Text>
                  </View>
                </Pressable>

                {/* Card 2: +Tingi (Blue) */}
                <Pressable
                  style={[styles.actionCard, styles.actionCardTingi]}
                  onPress={handleUnpackTingi}
                  disabled={isSubmitting}
                >
                  <View style={[styles.actionCardIconBadge, styles.iconBadgeBlue]}>
                    <Ionicons name="cube-outline" size={18} color="#2563EB" />
                  </View>
                  <Text style={[styles.actionCardTitle, styles.textBlueTitle]}>
                    +{tingiQty} Tingi
                  </Text>
                  <Text style={[styles.actionCardSubtitle, styles.textBlueSubtitle]}>
                    Bukas ng bulto/pack
                  </Text>
                  <View style={[styles.stockPill, styles.stockPillBlue]}>
                    <Text style={[styles.stockPillText, styles.textBluePill]}>
                      Magiging stock: {currentStock + tingiQty} pcs
                    </Text>
                  </View>
                </Pressable>

                {/* Card 3: −Bahay (Amber) */}
                <Pressable
                  style={[styles.actionCard, styles.actionCardHome]}
                  onPress={handleHomeUse}
                  disabled={isSubmitting}
                >
                  <View style={[styles.actionCardIconBadge, styles.iconBadgeAmber]}>
                    <Ionicons name="home-outline" size={18} color="#D97706" />
                  </View>
                  <Text style={[styles.actionCardTitle, styles.textAmberTitle]}>
                    −{inputQty} sa Bahay
                  </Text>
                  <Text style={[styles.actionCardSubtitle, styles.textAmberSubtitle]}>
                    Konsumo ng pamilya
                  </Text>
                  <View style={[styles.stockPill, styles.stockPillAmber]}>
                    <Text style={[styles.stockPillText, styles.textAmberPill]}>
                      Magiging stock: {Math.max(0, currentStock - inputQty)} pcs
                    </Text>
                  </View>
                </Pressable>

                {/* Card 4: −Sira/Expired (Red) */}
                <Pressable
                  style={[styles.actionCard, styles.actionCardDamaged]}
                  onPress={handleDamagedExpired}
                  disabled={isSubmitting}
                >
                  <View style={[styles.actionCardIconBadge, styles.iconBadgeRed]}>
                    <Ionicons name="warning-outline" size={18} color="#DC2626" />
                  </View>
                  <Text style={[styles.actionCardTitle, styles.textRedTitle]}>
                    −{inputQty} Sira/Expired
                  </Text>
                  <Text style={[styles.actionCardSubtitle, styles.textRedSubtitle]}>
                    Bawas / di mabenta
                  </Text>
                  <View style={[styles.stockPill, styles.stockPillRed]}>
                    <Text style={[styles.stockPillText, styles.textRedPill]}>
                      Magiging stock: {Math.max(0, currentStock - inputQty)} pcs
                    </Text>
                  </View>
                </Pressable>
              </View>

              {/* Security / Audit Callout Banner */}
              <View style={styles.safetyCalloutBanner}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
                <Text style={styles.safetyCalloutText}>
                  Ligtas at Sigurado: Bawat galaw ng paninda ay naka-rekord sa History at pwedeng i-undo agad.
                </Text>
              </View>

              {/* Bottom Action Links */}
              <View style={styles.bottomLinksRow}>
                <Pressable
                  style={styles.bottomLinkTouchable}
                  onPress={handleNavigateToHistory}
                >
                  <Ionicons name="time-outline" size={16} color="#475569" />
                  <Text style={styles.historyLinkText}>
                    Tingnan ang History ng Paninda
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.bottomLinkTouchable}
                  onPress={handleDelete}
                  disabled={isSubmitting}
                >
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Text style={styles.deleteLinkText}>Alisin ang Paninda</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Action Confirmation Modal */}
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
          cancelText="Huwag Ituloy"
          onConfirm={(reason) => confirmState.action(reason)}
          onCancel={() => setConfirmState(null)}
        />
      )}

      {/* Photo Source Choice Modal */}
      <Modal
        visible={showPhotoChoiceModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowPhotoChoiceModal(false)}
      >
        <View style={styles.choiceModalOverlay}>
          <Pressable
            style={styles.choiceModalBackdrop}
            onPress={() => setShowPhotoChoiceModal(false)}
          />
          <View style={styles.choiceModalCard}>
            <View style={styles.choiceModalHeader}>
              <View style={styles.choiceIconBadge}>
                <Ionicons name="camera" size={20} color="#0D7A52" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceModalTitle}>Palitan ang Litrato</Text>
                <Text style={styles.choiceModalSubtitle} numberOfLines={1}>
                  {product.name}
                </Text>
              </View>
              <Pressable
                onPress={() => setShowPhotoChoiceModal(false)}
                hitSlop={8}
                style={styles.choiceCloseBtn}
              >
                <Ionicons name="close" size={18} color="#64748B" />
              </Pressable>
            </View>

            <View style={styles.choiceOptionsList}>
              <Pressable
                style={styles.choiceOptionBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  setShowPhotoChoiceModal(false);
                  onChangePhoto(product.id, 'CAMERA');
                }}
              >
                <View style={[styles.choiceOptionIconCircle, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="camera" size={22} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceOptionTitle}>Kumuha ng Litrato gamit ang Camera</Text>
                  <Text style={styles.choiceOptionDesc}>Mag-snap ng bagong larawan gamit ang camera</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>

              <Pressable
                style={styles.choiceOptionBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  setShowPhotoChoiceModal(false);
                  onChangePhoto(product.id, 'GALLERY');
                }}
              >
                <View style={[styles.choiceOptionIconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="images" size={22} color="#2563EB" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceOptionTitle}>Pumili mula sa Gallery</Text>
                  <Text style={styles.choiceOptionDesc}>Pumili ng litrato mula sa albums ng telepono</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            <Pressable
              style={styles.choiceCancelBtn}
              onPress={() => setShowPhotoChoiceModal(false)}
            >
              <Text style={styles.choiceCancelText}>Kanselahin</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingTop: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  handleBar: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  productHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    marginRight: 8,
  },
  productHeaderInfo: {
    flex: 1,
    marginLeft: 10,
  },
  productNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  productBarcodeSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  headerActionPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  pillEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0D7A52',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D7A52',
  },
  pillPhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillPhotoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  closeCircleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 28,
  },
  statusOverviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statusCol: {
    flex: 1,
    alignItems: 'center',
  },
  statusColLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  statusStockValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  stockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusStockValueText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusStockSubtext: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statusDivider: {
    width: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  statusPriceValueText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  statusCostSubtext: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  statusTuboValueText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
  },
  marginBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
  },
  marginBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  stepperCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
  },
  stepperHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  stepperHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  stepperHeaderSubtext: {
    fontSize: 11,
    color: '#94A3B8',
  },
  stepperControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperSquareBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperCenterInputBox: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0D7A52',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  stepperTextInput: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    minWidth: 40,
    padding: 0,
  },
  stepperUnitLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 4,
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#0D7A52',
    borderWidth: 1.5,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  quickChipTextActive: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  actionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionsHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  actionsHeaderSubtext: {
    fontSize: 11,
    color: '#94A3B8',
  },
  actionGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  actionCard: {
    width: '48.5%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  actionCardRestock: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  actionCardTingi: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  actionCardHome: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  actionCardDamaged: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  actionCardIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadgeGreen: {
    backgroundColor: '#DCFCE7',
  },
  iconBadgeBlue: {
    backgroundColor: '#DBEAFE',
  },
  iconBadgeAmber: {
    backgroundColor: '#FEF3C7',
  },
  iconBadgeRed: {
    backgroundColor: '#FEE2E2',
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
  },
  textGreenTitle: {
    color: '#14532D',
  },
  textBlueTitle: {
    color: '#1E3A8A',
  },
  textAmberTitle: {
    color: '#78350F',
  },
  textRedTitle: {
    color: '#7F1D1D',
  },
  actionCardSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  textGreenSubtitle: {
    color: '#166534',
  },
  textBlueSubtitle: {
    color: '#1E40AF',
  },
  textAmberSubtitle: {
    color: '#92400E',
  },
  textRedSubtitle: {
    color: '#991B1B',
  },
  stockPill: {
    marginTop: 8,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
    alignSelf: 'flex-start',
  },
  stockPillGreen: {
    backgroundColor: '#DCFCE7',
  },
  stockPillBlue: {
    backgroundColor: '#DBEAFE',
  },
  stockPillAmber: {
    backgroundColor: '#FEF3C7',
  },
  stockPillRed: {
    backgroundColor: '#FEE2E2',
  },
  stockPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  textGreenPill: {
    color: '#14532D',
  },
  textBluePill: {
    color: '#1E3A8A',
  },
  textAmberPill: {
    color: '#78350F',
  },
  textRedPill: {
    color: '#7F1D1D',
  },
  safetyCalloutBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  safetyCalloutText: {
    fontSize: 11,
    color: '#166534',
    flex: 1,
    lineHeight: 16,
    fontWeight: '500',
  },
  bottomLinksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingBottom: 16,
  },
  bottomLinkTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  deleteLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  choiceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  choiceModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  choiceModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 24,
  },
  choiceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  choiceIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  choiceModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  choiceCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOptionsList: {
    gap: 12,
    marginBottom: 16,
  },
  choiceOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  choiceOptionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  choiceOptionDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  choiceCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  choiceCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
