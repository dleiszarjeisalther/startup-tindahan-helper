// src/presentation/components/ReceiptPrinterModal.tsx
import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  EscPosReceiptFormatter,
  ReceiptData,
  PaperWidth,
} from '../../domain/services/EscPosReceiptFormatter';
import {
  bluetoothThermalPrinterService,
  PrinterDevice,
} from '../../infrastructure/services/BluetoothThermalPrinterService';

interface ReceiptPrinterModalProps {
  visible: boolean;
  receiptData: ReceiptData | null;
  onClose: () => void;
}

export function ReceiptPrinterModal({
  visible,
  receiptData,
  onClose,
}: ReceiptPrinterModalProps) {
  const [paperWidth, setPaperWidth] = useState<PaperWidth>(58);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const previewText = useMemo(() => {
    if (!receiptData) return '';
    return EscPosReceiptFormatter.formatPlainTextReceipt(receiptData, paperWidth);
  }, [receiptData, paperWidth]);

  const handleScanDevices = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setIsScanning(true);
    setStatusMessage('Scanning for Bluetooth printers...');
    try {
      const found = await bluetoothThermalPrinterService.scanForPrinters();
      setDevices(found);
      setStatusMessage(
        found.length > 0
          ? `Found ${found.length} printer(s)`
          : 'No Bluetooth printer paired. Please pair in Android Bluetooth settings.'
      );
    } catch {
      setStatusMessage('Bluetooth scan failed.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnectDevice = async (device: PrinterDevice) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setStatusMessage(`Connecting to ${device.name}...`);
    const ok = await bluetoothThermalPrinterService.connect(device);
    if (ok) {
      setStatusMessage(`Connected to ${device.name}!`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      setStatusMessage(`Failed to connect to ${device.name}.`);
    }
  };

  const handlePrintEscPos = async () => {
    if (!receiptData) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setIsPrinting(true);
    setStatusMessage('Sending ESC/POS print job...');
    try {
      const commands = EscPosReceiptFormatter.formatReceipt(receiptData, paperWidth);
      const result = await bluetoothThermalPrinterService.printReceipt(commands);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setStatusMessage('Receipt printed successfully!');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setStatusMessage(result.message || 'Printing failed. You can share slip instead.');
      }
    } catch {
      setStatusMessage('Print command error.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleShareText = async () => {
    if (!receiptData) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await bluetoothThermalPrinterService.shareReceiptAsText(
      previewText,
      `Receipt-${receiptData.receiptNumber}.txt`
    );
  };

  if (!receiptData) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Thermal Receipt Slip</Text>
              <Text style={styles.subtitle}>
                ESC/POS Bluetooth & Digital Share
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Width Selector */}
          <View style={styles.widthSelector}>
            <TouchableOpacity
              style={[styles.widthBtn, paperWidth === 58 && styles.widthBtnActive]}
              onPress={() => setPaperWidth(58)}
            >
              <Text style={[styles.widthBtnText, paperWidth === 58 && styles.widthBtnTextActive]}>
                58mm (32 Col)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.widthBtn, paperWidth === 80 && styles.widthBtnActive]}
              onPress={() => setPaperWidth(80)}
            >
              <Text style={[styles.widthBtnText, paperWidth === 80 && styles.widthBtnTextActive]}>
                80mm (48 Col)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Status Message */}
          {statusMessage && (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          )}

          {/* Receipt Monospace Preview */}
          <View style={styles.previewContainer}>
            <ScrollView
              style={styles.previewScroll}
              showsVerticalScrollIndicator
              contentContainerStyle={styles.previewContent}
            >
              <Text style={styles.previewText}>{previewText}</Text>
            </ScrollView>
          </View>

          {/* Bluetooth Device List (if scanned) */}
          {devices.length > 0 && (
            <View style={styles.deviceListBox}>
              <Text style={styles.deviceListHeader}>Available Bluetooth Printers:</Text>
              {devices.map((dev) => (
                <TouchableOpacity
                  key={dev.id}
                  style={styles.deviceRow}
                  onPress={() => handleConnectDevice(dev)}
                >
                  <Text style={styles.deviceName}>🖨️ {dev.name}</Text>
                  <Text style={styles.deviceMac}>{dev.macAddress || dev.id}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.printBtn]}
              onPress={handlePrintEscPos}
              disabled={isPrinting}
            >
              {isPrinting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.printBtnText}>🖨️ Print Slip</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.shareBtn]}
              onPress={handleShareText}
            >
              <Text style={styles.shareBtnText}>📲 Share Text</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.scanBtn}
            onPress={handleScanDevices}
            disabled={isScanning}
          >
            {isScanning ? (
              <ActivityIndicator color="#475569" size="small" />
            ) : (
              <Text style={styles.scanBtnText}>🔍 Find Bluetooth Printer</Text>
            )}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
  },
  closeBtnText: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '700',
  },
  widthSelector: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  widthBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  widthBtnActive: {
    backgroundColor: '#0F172A',
  },
  widthBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  widthBtnTextActive: {
    color: '#FFFFFF',
  },
  statusBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusText: {
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
  },
  previewContainer: {
    height: 240,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 14,
  },
  previewScroll: {
    flex: 1,
  },
  previewContent: {
    padding: 12,
  },
  previewText: {
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 15,
    color: '#1E293B',
  },
  deviceListBox: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  deviceListHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1D4ED8',
    marginBottom: 6,
  },
  deviceRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  deviceName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E3A8A',
  },
  deviceMac: {
    fontSize: 10,
    color: '#6B7280',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  printBtn: {
    backgroundColor: '#0F172A',
  },
  printBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  shareBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  shareBtnText: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '600',
  },
  scanBtn: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBtnText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
});
