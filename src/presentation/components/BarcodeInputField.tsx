// src/presentation/components/BarcodeInputField.tsx
import React, { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import { BarcodeScannerViewfinder } from './BarcodeScannerViewfinder';

interface BarcodeInputFieldProps {
  value: string;
  onChangeBarcode: (code: string, mode: 'SCAN' | 'MANUAL' | 'GENERATE_TINGI') => void;
  onDuplicateCheck?: (code: string) => void;
  errorMessage?: string | null;
  label?: string;
  placeholder?: string;
  showTingiButton?: boolean;
  helperText?: string;
  scannerHintText?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export const BarcodeInputField: React.FC<BarcodeInputFieldProps> = ({
  value,
  onChangeBarcode,
  onDuplicateCheck,
  errorMessage,
  label = 'Product Barcode (Input Digits or Scan) *',
  placeholder = 'Type e.g. 6800056520709 or Scan',
  showTingiButton = true,
  helperText,
  scannerHintText = 'Align barcode inside animated laser reticle',
  containerStyle,
}) => {
  const [scannerOpen, setScannerOpen] = useState(false);
  const isFocused = useIsFocused();

  // Adjust state during render when focus changes (React 19 pattern)
  const [prevIsFocused, setPrevIsFocused] = useState(isFocused);
  if (prevIsFocused !== isFocused) {
    setPrevIsFocused(isFocused);
    if (!isFocused && scannerOpen) {
      setScannerOpen(false);
    }
  }

  const handleBarcodeScanned = (scannedCode: string) => {
    console.log(`[BarcodeInputField] Barcode scanned from camera viewfinder: "${scannedCode}"`);
    setScannerOpen(false);
    onChangeBarcode(scannedCode, 'SCAN');
    onDuplicateCheck?.(scannedCode);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, errorMessage ? styles.inputError : null]}
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="next"
          onChangeText={(text) => onChangeBarcode(text, 'MANUAL')}
          onBlur={() => value.trim() && onDuplicateCheck?.(value.trim())}
        />
        <Pressable
          style={[styles.scanButton, scannerOpen ? styles.scanButtonActive : null]}
          hitSlop={8}
          onPress={() => setScannerOpen((prev) => !prev)}
        >
          <Text style={styles.scanButtonText}>
            {scannerOpen ? '✕ Close' : '📷 Scan'}
          </Text>
        </Pressable>
        {showTingiButton ? (
          <Pressable
            style={styles.tingiButton}
            hitSlop={8}
            onPress={() => onChangeBarcode('', 'GENERATE_TINGI')}
          >
            <Text style={styles.tingiButtonText}>Tingi Code</Text>
          </Pressable>
        ) : null}
      </View>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {/* Shared OOP Barcode Scanner Viewfinder with Animated Sweeping Laser Line */}
      {scannerOpen && isFocused && (
        <View style={styles.cameraWrapper}>
          <BarcodeScannerViewfinder
            isActive={true}
            onToggleActive={(active) => setScannerOpen(active)}
            onBarcodeScanned={handleBarcodeScanned}
            reticleWidth={240}
            reticleHeight={120}
            containerHeight={210}
            hintText={scannerHintText}
            topRightAction={
              <Pressable
                style={styles.closeCamBtn}
                onPress={() => setScannerOpen(false)}
                hitSlop={8}
              >
                <Text style={styles.closeCamText}>✕ Close</Text>
              </Pressable>
            }
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 8 },
  label: { fontWeight: '700', fontSize: 14, marginBottom: 6, color: '#111827' },
  helperText: { fontSize: 12, color: '#4B5563', marginBottom: 6, lineHeight: 16 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FFFFFF',
    color: '#111827',
    fontVariant: ['tabular-nums'],
  },
  inputError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  scanButton: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#0F6E43',
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  scanButtonActive: {
    backgroundColor: '#B91C1C',
  },
  scanButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  tingiButton: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  tingiButtonText: { color: '#1F2937', fontWeight: '600', fontSize: 13 },
  errorText: { color: '#DC2626', fontSize: 13, marginTop: 4, fontWeight: '500' },
  cameraWrapper: {
    height: 210,
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  closeCamBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  closeCamText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
