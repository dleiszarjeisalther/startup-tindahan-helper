// src/presentation/components/ExpiryDatePickerModal.tsx — Single Date Calendar Picker for Product Expiry
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export interface ExpiryDatePickerModalProps {
  visible: boolean;
  currentDate?: string; // ISO 'YYYY-MM-DD'
  onSelect: (dateStr: string) => void;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

const isSameDay = (d1: Date, d2: Date): boolean => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

const formatDateToISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const ExpiryDatePickerModal: React.FC<ExpiryDatePickerModalProps> = ({
  visible,
  currentDate,
  onSelect,
  onClose,
  title = 'Petsa ng Expiry ng Paninda',
  subtitle = 'Pumili ng buwan, taon, at araw sa kalendaryo para sa expiry alert',
}) => {
  const initialDate = useMemo(() => {
    if (currentDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDate)) {
      const parts = currentDate.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const today = new Date();
    // Default forward by 6 months for typical sari-sari store shelf-life
    return new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());
  }, [currentDate]);

  const [calendarMonth, setCalendarMonth] = useState<Date>(initialDate);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (currentDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDate)) {
      const parts = currentDate.split('-').map(Number);
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return null;
  });

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4];
  }, []);

  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (visible) {
      if (currentDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDate)) {
        const parts = currentDate.split('-').map(Number);
        const parsed = new Date(parts[0], parts[1] - 1, parts[2]);
        setSelectedDate(parsed);
        setCalendarMonth(parsed);
      } else {
        const today = new Date();
        const futureDefault = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate());
        setSelectedDate(null);
        setCalendarMonth(futureDefault);
      }
    }
  }

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: ({
      type: 'empty' | 'day';
      dayNum?: number;
      date: Date;
      key: string;
    })[] = [];

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        type: 'empty',
        date: new Date(year, month, 0),
        key: `empty-${i}`,
      });
    }

    for (let d = 1; d <= totalDays; d++) {
      days.push({
        type: 'day',
        dayNum: d,
        date: new Date(year, month, d),
        key: `day-${year}-${month}-${d}`,
      });
    }

    return days;
  }, [calendarMonth]);

  const handlePrevMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleDaySelect = (date: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedDate(date);
  };

  const handleApply = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (selectedDate) {
      onSelect(formatDateToISO(selectedDate));
    }
    onClose();
  };

  const handleClear = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedDate(null);
    onSelect('');
    onClose();
  };

  const monthsList = [
    { m: 0, label: 'Ene' },
    { m: 1, label: 'Peb' },
    { m: 2, label: 'Mar' },
    { m: 3, label: 'Abr' },
    { m: 4, label: 'May' },
    { m: 5, label: 'Hun' },
    { m: 6, label: 'Hul' },
    { m: 7, label: 'Ago' },
    { m: 8, label: 'Set' },
    { m: 9, label: 'Okt' },
    { m: 10, label: 'Nob' },
    { m: 11, label: 'Dis' },
  ];

  useEffect(() => {
    if (!visible) return;
    const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => backSub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay} pointerEvents="auto">
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalContainer}>
          <View style={styles.modalDragHandle} />

          {/* Modal Header */}
          <View style={styles.modalHeaderRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.modalTitle}>{title}</Text>
              <Text style={styles.modalSubtitle}>{subtitle}</Text>
            </View>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Isara ang kalendaryo"
            >
              <Ionicons name="close" size={20} color="#4B5563" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Active Selection Display Banner */}
            <View style={styles.activeSelectionCard}>
              <View style={styles.activeSelectionIconWrap}>
                <Ionicons name="calendar-outline" size={18} color="#0D7A52" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activeSelectionLabel}>Napiling Petsa ng Expiry:</Text>
                <Text style={styles.activeSelectionValue}>
                  {selectedDate
                    ? selectedDate.toLocaleDateString('tl-PH', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Wala pang napili (Opsyonal)'}
                </Text>
              </View>
            </View>

            {/* Calendar Controls */}
            <View style={styles.calendarContainer}>
              {/* Year Selector Chips */}
              <View style={{ marginBottom: 10 }}>
                <Text style={styles.sectionHeaderTitle}>TAON</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {availableYears.map((yr) => {
                    const isSelectedYear = calendarMonth.getFullYear() === yr;
                    return (
                      <Pressable
                        key={yr}
                        style={[
                          styles.yearChip,
                          isSelectedYear && styles.yearChipActive,
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setCalendarMonth(new Date(yr, calendarMonth.getMonth(), 1));
                        }}
                      >
                        <Text
                          style={[
                            styles.yearChipText,
                            isSelectedYear && styles.yearChipTextActive,
                          ]}
                        >
                          {yr}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Month Selector Chips */}
              <View style={{ marginBottom: 12 }}>
                <Text style={styles.sectionHeaderTitle}>BUWAN</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingBottom: 2 }}
                >
                  {monthsList.map((item) => {
                    const isSelectedMonth = calendarMonth.getMonth() === item.m;
                    return (
                      <Pressable
                        key={item.m}
                        style={[
                          styles.monthChip,
                          isSelectedMonth && styles.monthChipActive,
                        ]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setCalendarMonth(new Date(calendarMonth.getFullYear(), item.m, 1));
                        }}
                      >
                        <Text
                          style={[
                            styles.monthChipText,
                            isSelectedMonth && styles.monthChipTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Month Navigation Title */}
              <View style={styles.calendarNavRow}>
                <Pressable
                  style={styles.calendarNavBtn}
                  onPress={handlePrevMonth}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-back" size={18} color="#1F2937" />
                </Pressable>
                <Text style={styles.calendarMonthTitle}>
                  {calendarMonth.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
                <Pressable
                  style={styles.calendarNavBtn}
                  onPress={handleNextMonth}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-forward" size={18} color="#1F2937" />
                </Pressable>
              </View>

              {/* Day of Week Headers */}
              <View style={styles.calendarWeekRow}>
                {['Li', 'Lu', 'Ma', 'Mi', 'Hu', 'Bi', 'Sa'].map((d, dIdx) => (
                  <Text key={dIdx} style={styles.calendarWeekHeader}>
                    {d}
                  </Text>
                ))}
              </View>

              {/* 7-Column Day Matrix */}
              <View style={styles.calendarGrid}>
                {calendarDays.map((item) => {
                  if (item.type === 'empty') {
                    return <View key={item.key} style={styles.calendarDayCell} />;
                  }

                  const isSelected = selectedDate && isSameDay(item.date, selectedDate);
                  const isToday = isSameDay(item.date, new Date());

                  return (
                    <Pressable
                      key={item.key}
                      style={[
                        styles.calendarDayCell,
                        isSelected ? styles.calendarDaySelected : null,
                      ]}
                      onPress={() => handleDaySelect(item.date)}
                    >
                      <View
                        style={[
                          styles.calendarDayCircle,
                          isSelected ? styles.calendarDayCircleSelected : null,
                          isToday && !isSelected ? styles.calendarDayCircleToday : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            isSelected ? styles.calendarDayTextSelected : null,
                            isToday && !isSelected ? styles.calendarDayTextToday : null,
                          ]}
                        >
                          {item.dayNum}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Action Buttons Row */}
            <View style={styles.actionRow}>
              <Pressable style={styles.resetBtn} onPress={handleClear}>
                <Ionicons
                  name="refresh-outline"
                  size={16}
                  color="#4B5563"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.resetBtnText}>Tanggalin</Text>
              </Pressable>

              <Pressable style={styles.applyBtn} onPress={handleApply}>
                <Ionicons
                  name="checkmark-sharp"
                  size={16}
                  color="#FFFFFF"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.applyBtnText}>
                  {selectedDate ? 'I-apply ang Petsa' : 'Isara'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
    zIndex: 99999,
    elevation: 99,
  },
  modalBackdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '88%',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  modalDragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 12,
  },
  activeSelectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
  },
  activeSelectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeSelectionLabel: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '600',
  },
  activeSelectionValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#047857',
    marginTop: 1,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  yearChip: {
    minWidth: 70,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  yearChipActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  yearChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  yearChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  monthChip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  monthChipActive: {
    backgroundColor: '#0D7A52',
    borderColor: '#0D7A52',
  },
  monthChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  monthChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  calendarNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  calendarNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  calendarMonthTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
  },
  calendarWeekHeader: {
    width: 36,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayCell: {
    width: `${100 / 7}%`,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDaySelected: {
    backgroundColor: 'transparent',
  },
  calendarDayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayCircleSelected: {
    backgroundColor: '#0D7A52',
  },
  calendarDayCircleToday: {
    borderWidth: 1.5,
    borderColor: '#0D7A52',
  },
  calendarDayText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calendarDayTextToday: {
    color: '#0D7A52',
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  resetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4B5563',
  },
  applyBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0D7A52',
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
