// src/presentation/components/BarcodeScannerViewfinder.tsx
// OOP Encapsulated Barcode Scanner Viewfinder with Animated Sweeping Laser
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { soundFeedbackService } from '@/infrastructure/services/SoundFeedbackService';

export interface BarcodeScannerViewfinderProps {
  /** Callback when a valid barcode string is detected */
  onBarcodeScanned: (barcode: string) => void;
  /** Whether the camera feed is actively streaming */
  isActive?: boolean;
  /** Callback when camera active state changes */
  onToggleActive?: (active: boolean) => void;
  /** Whether to show the flashlight/torch toggle button (default: true) */
  showTorchButton?: boolean;
  /** Optional custom action on the top-left */
  topLeftAction?: React.ReactNode;
  /** Optional custom action in the top-center */
  topCenterAction?: React.ReactNode;
  /** Optional custom action in the top-right */
  topRightAction?: React.ReactNode;
  /** Informational text hint below the reticle */
  hintText?: string;
  /** Toast or notification text shown inside the viewfinder */
  toastMessage?: string | null;
  /** Banner node shown at bottom of scanner (e.g. unknown barcode banner) */
  bottomBanner?: React.ReactNode;
  /** Viewfinder reticle width (default: 270) */
  reticleWidth?: number;
  /** Viewfinder reticle height (default: 130) */
  reticleHeight?: number;
  /** Overall scanner container height (default: 230) */
  containerHeight?: number;
  /** Safe-area offset for controls over a full-bleed camera (default: 0) */
  topControlInset?: number;
  /** Custom container style */
  style?: StyleProp<ViewStyle>;
}

/**
 * Reusable OOP Barcode Scanner Viewfinder Component.
 * Encapsulates CameraView, permission handling, flashlight controls,
 * debounce locking, and animated glowing red sweeping laser reticle.
 * Shared across Home POS and Inventory screens.
 */
export const BarcodeScannerViewfinder: React.FC<BarcodeScannerViewfinderProps> = ({
  onBarcodeScanned,
  isActive = false,
  onToggleActive,
  showTorchButton = true,
  topLeftAction,
  topCenterAction,
  topRightAction,
  hintText,
  toastMessage,
  bottomBanner,
  reticleWidth = 270,
  reticleHeight = 130,
  containerHeight = 230,
  topControlInset = 0,
  style,
}) => {
  const [torchOn, setTorchOn] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);
  const lastScannedBarcodeRef = useRef<{ code: string; time: number } | null>(null);

  // Smooth continuous vertical scanning laser animation
  const [laserAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(laserAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(laserAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [laserAnim]);

  const maxTravel = Math.max(10, reticleHeight - 16);
  const translateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, maxTravel],
  });

  useEffect(() => {
    if (isActive) {
      scanLockRef.current = false;
      console.log('[BarcodeScannerViewfinder] Camera became active.');
    } else {
      console.log('[BarcodeScannerViewfinder] Camera deactivated / standby.');
    }
  }, [isActive]);

  const handleToggleCamera = async () => {
    if (!isActive) {
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) return;
      }
      scanLockRef.current = false;
      onToggleActive?.(true);
    } else {
      onToggleActive?.(false);
    }
  };

  const handleDetected = (rawCode: string) => {
    const clean = (rawCode || '').trim();
    if (!clean) {
      console.log('[BarcodeScannerViewfinder] Ignored empty barcode scan event.');
      return;
    }
    if (scanLockRef.current) {
      console.log(`[BarcodeScannerViewfinder] Barcode "${clean}" ignored due to active scanLock throttle (1400ms).`);
      return;
    }

    // Ignore continuous scanning of the exact same item held stationary in front of the lens
    if (
      lastScannedBarcodeRef.current &&
      lastScannedBarcodeRef.current.code === clean &&
      Date.now() - lastScannedBarcodeRef.current.time < 2200
    ) {
      return;
    }

    scanLockRef.current = true;
    lastScannedBarcodeRef.current = { code: clean, time: Date.now() };
    console.log(`[BarcodeScannerViewfinder] ✓ Barcode accepted: "${clean}". Triggering haptics and beep...`);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((err) => {
      console.log('[BarcodeScannerViewfinder] Haptics error:', err);
    });

    soundFeedbackService
      .playBarcodeBeep()
      .then(() => {
        console.log(`[BarcodeScannerViewfinder] ✓ playBarcodeBeep completed for "${clean}".`);
      })
      .catch((err) => {
        // Sound feedback is non-blocking; preserve the successful barcode scan.
        console.log(`[BarcodeScannerViewfinder] Barcode beep failed for "${clean}"; next scan will retry:`, err);
      });

    console.log(`[BarcodeScannerViewfinder] Dispatching onBarcodeScanned callback to parent for "${clean}"...`);
    onBarcodeScanned(clean);

    setTimeout(() => {
      scanLockRef.current = false;
      console.log('[BarcodeScannerViewfinder] Scan lock released after 1400ms debounce interval.');
    }, 1400);
  };

  return (
    <View
      style={[
        styles.container,
        { height: containerHeight, paddingTop: topControlInset },
        style,
      ]}
    >
      {/* Background Camera View or Standby Backdrop */}
      {isActive ? (
        <CameraView
          key="camera-view-live"
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torchOn}
          mute={true}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'],
          }}
          onBarcodeScanned={(res) => {
            console.log('[BarcodeScannerViewfinder] Raw scan event captured from CameraView:', {
              data: res.data,
              type: res.type,
              scanLocked: scanLockRef.current,
            });
            if (res.data) handleDetected(res.data);
          }}
        />
      ) : (
        <View style={styles.standbyBackdrop} />
      )}

      {/* Top Controls Row */}
      <View style={[styles.topBar, { top: 10 + topControlInset }]}>
        <View style={styles.topActionLeft}>
          {showTorchButton ? (
            <Pressable
              style={[styles.camIconBtn, torchOn ? styles.camIconBtnActive : null]}
              onPress={() => setTorchOn((prev) => !prev)}
              hitSlop={8}
            >
              <Text style={styles.camIconText}>⚡</Text>
            </Pressable>
          ) : (
            topLeftAction
          )}
        </View>

        <View style={styles.topActionCenter}>{topCenterAction}</View>

        <View style={styles.topActionRight}>
          {topRightAction ? (
            topRightAction
          ) : (
            <Pressable
              style={[styles.camIconBtn, isActive ? styles.camIconBtnActive : null]}
              onPress={handleToggleCamera}
              hitSlop={8}
            >
              <Text style={styles.camIconText}>{isActive ? '📷 Live' : '📷 Scan'}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Center Barcode Reticle with Smooth Animated Sweeping Laser Line */}
      <Pressable
        style={[styles.reticleWrapper, { width: reticleWidth, height: reticleHeight }]}
        onPress={handleToggleCamera}
        hitSlop={8}
      >
        {/* 4 Green Corner Brackets */}
        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />

        {/* Animated Sweeping Red Laser Beam */}
        <Animated.View
          style={[
            styles.laserBeamWrapper,
            { transform: [{ translateY }] },
          ]}
        >
          <View style={styles.laserCoreLine} />
          <View style={styles.laserGlowAura} />
        </Animated.View>

        {/* Center Target Indicator */}
        <View style={styles.reticleCenterGuide}>
          <Text style={styles.reticleCenterText}>[  +  ]</Text>
        </View>
      </Pressable>

      {/* Hint text below reticle */}
      <Text style={styles.hintText}>
        {hintText ??
          (isActive
            ? 'Align product barcode within frame to scan'
            : 'Point camera at barcode • Tap frame for Live Camera')}
      </Text>

      {/* Toast Pill */}
      {toastMessage ? (
        <View style={styles.toastPill}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* Optional bottom banner (e.g. unknown barcode banner) */}
      {bottomBanner}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  standbyBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
  },
  topBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  topActionLeft: {
    minWidth: 40,
    alignItems: 'flex-start',
  },
  topActionCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topActionRight: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
  camIconBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  camIconBtnActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#34D399',
  },
  camIconText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  reticleWrapper: {
    position: 'relative',
    marginTop: 8,
    overflow: 'hidden',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 28,
    height: 28,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#22C55E',
    borderTopLeftRadius: 10,
    zIndex: 5,
  },
  cornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#22C55E',
    borderTopRightRadius: 10,
    zIndex: 5,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 28,
    height: 28,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#22C55E',
    borderBottomLeftRadius: 10,
    zIndex: 5,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#22C55E',
    borderBottomRightRadius: 10,
    zIndex: 5,
  },
  laserBeamWrapper: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 6,
    zIndex: 4,
  },
  laserCoreLine: {
    height: 2.5,
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  laserGlowAura: {
    height: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.45)',
    borderRadius: 3,
    marginTop: -4,
    shadowColor: '#EF4444',
    shadowOpacity: 0.95,
    shadowRadius: 8,
    elevation: 6,
  },
  reticleCenterGuide: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    alignItems: 'center',
    opacity: 0.35,
  },
  reticleCenterText: {
    color: '#86EFAC',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 8,
  },
  hintText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  toastPill: {
    position: 'absolute',
    bottom: 8,
    backgroundColor: '#065F46',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#34D399',
    zIndex: 20,
  },
  toastText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
