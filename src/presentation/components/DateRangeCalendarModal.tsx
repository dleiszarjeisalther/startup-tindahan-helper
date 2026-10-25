// src/presentation/components/DateRangeCalendarModal.tsx — Reusable Interactive Date Range Calendar Modal
import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DateRangeFilter } from '@/application/TindahanStoreService';

export interface DateRangeCalendarModalProps {
  visible: boolean;
  currentRange: DateRangeFilter | null;
  onApply: (range: DateRangeFilter | null) => void;
  onClose: () => void;
  availableYears?: number[];
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

export const DateRangeCalendarModal: React.FC<DateRangeCalendarModalProps> = ({
  visible,
  currentRange,
  onApply,
  onClose,
  availableYears: propYears,
  title = 'Salain ayon sa Petsa',
  subtitle = 'Pumili ng preset o sariling sakop ng petsa sa kalendaryo',
}) => {
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [tempStartDate, setTempStartDate] = useState<Date | null>(null);
  const [tempEndDate, setTempEndDate] = useState<Date | null>(null);
  const [activeDateField, setActiveDateField] = useState<'START' | 'END'>('START');
  const [selectedPreset, setSelectedPreset] = useState<
    'TODAY' | 'YESTERDAY' | 'LAST_7' | 'THIS_MONTH' | 'LAST_MONTH' | 'YTD' | 'CUSTOM'
  >('CUSTOM');

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    if (propYears && propYears.length > 0) {
      const set = new Set([...propYears, currentYear]);
      return Array.from(set).sort((a, b) => b - a);
    }
    return [currentYear];
  }, [propYears]);

  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (visible) {
      if (currentRange) {
        setTempStartDate(new Date(currentRange.startMs));
        setTempEndDate(new Date(currentRange.endMs));
        setCalendarMonth(new Date(currentRange.endMs));
        setSelectedPreset('CUSTOM');
      } else {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        setTempStartDate(todayStart);
        setTempEndDate(todayEnd);
        setCalendarMonth(now);
        setSelectedPreset('TODAY');
      }
      setActiveDateField('START');
    }
  }

  const diffDays = useMemo(() => {
    if (!tempStartDate || !tempEndDate) return 1;
    const diffMs = tempEndDate.getTime() - tempStartDate.getTime();
    return Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)) + 1);
  }, [tempStartDate, tempEndDate]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const list: ({ type: 'empty'; key: string } | { type: 'day'; date: Date; dayNum: number; key: string })[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      list.push({ type: 'empty', key: `empty-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({
        type: 'day',
        date: new Date(year, month, d),
        dayNum: d,
        key: `day-${year}-${month}-${d}`,
      });
    }
    return list;
  }, [calendarMonth]);

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleNextMonth = () => {
    const now = new Date();
    const next = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    if (
      next.getFullYear() > now.getFullYear() ||
      (next.getFullYear() === now.getFullYear() && next.getMonth() > now.getMonth())
    ) {
      return;
    }
    setCalendarMonth(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const getPresetRange = (preset: 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'THIS_MONTH' | 'LAST_MONTH' | 'YTD') => {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    switch (preset) {
      case 'TODAY':
        return {
          startMs: startOfDay(now).getTime(),
          endMs: endOfDay(now).getTime(),
          label: `Ngayon (${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
        };
      case 'YESTERDAY': {
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        return {
          startMs: startOfDay(y).getTime(),
          endMs: endOfDay(y).getTime(),
          label: `Kahapon (${y.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
        };
      }
      case 'LAST_7': {
        const d7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
        return {
          startMs: startOfDay(d7).getTime(),
          endMs: endOfDay(now).getTime(),
          label: `Huling 7 Araw (${d7.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
        };
      }
      case 'THIS_MONTH': {
        const mStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return {
          startMs: mStart.getTime(),
          endMs: endOfDay(now).getTime(),
          label: `Buwang Ito (${now.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`,
        };
      }
      case 'LAST_MONTH': {
        const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        return {
          startMs: lmStart.getTime(),
          endMs: lmEnd.getTime(),
          label: `Nakaraang Buwan (${lmStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })})`,
        };
      }
      case 'YTD': {
        const ytdStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        return {
          startMs: ytdStart.getTime(),
          endMs: endOfDay(now).getTime(),
          label: `Taong Ito (${now.getFullYear()})`,
        };
      }
    }
  };

  const handlePresetSelect = (
    preset: 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'THIS_MONTH' | 'LAST_MONTH' | 'YTD'
  ) => {
    setSelectedPreset(preset);
    const range = getPresetRange(preset);
    setTempStartDate(new Date(range.startMs));
    setTempEndDate(new Date(range.endMs));
    setCalendarMonth(new Date(range.endMs));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const handleDaySelect = (dayDate: Date) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedPreset('CUSTOM');

    if (activeDateField === 'START') {
      const newStart = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 0, 0, 0, 0);
      setTempStartDate(newStart);
      if (tempEndDate && dayDate.getTime() > tempEndDate.getTime()) {
        const adjustedEnd = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 23, 59, 59, 999);
        setTempEndDate(adjustedEnd);
      }
      setActiveDateField('END');
    } else {
      const selectedEnd = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 23, 59, 59, 999);
      if (tempStartDate && dayDate.getTime() < tempStartDate.getTime()) {
        setTempStartDate(new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 0, 0, 0, 0));
        setTempEndDate(tempStartDate);
      } else {
        setTempEndDate(selectedEnd);
      }
    }
  };

  const handleApply = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!tempStartDate) {
      onApply(null);
      onClose();
      return;
    }
    const end = tempEndDate ?? tempStartDate;
    const startMs = new Date(
      tempStartDate.getFullYear(),
      tempStartDate.getMonth(),
      tempStartDate.getDate(),
      0,
      0,
      0,
      0
    ).getTime();
    const endMs = new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate(),
      23,
      59,
      59,
      999
    ).getTime();

    const startLabel = tempStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const label = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;

    onApply({
      startMs,
      endMs,
      label,
    });
    onClose();
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onApply(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{title}</Text>
              <Text style={styles.modalSubtitle}>{subtitle}</Text>
            </View>
            <Pressable style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>
            {/* Presets Horizontal Chips */}
            <Text style={styles.filterSectionHeader}>MGA PRESET SHORTCUTS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.datePresetsScroll}
            >
              {[
                { key: 'TODAY', label: 'Ngayon' },
                { key: 'YESTERDAY', label: 'Kahapon' },
                { key: 'LAST_7', label: '7 Araw' },
                { key: 'THIS_MONTH', label: 'Buwang Ito' },
                { key: 'LAST_MONTH', label: 'Nakaraang Buwan' },
                { key: 'YTD', label: 'Taong Ito (YTD)' },
              ].map((item) => {
                const isSelected = selectedPreset === item.key;
                return (
                  <Pressable
                    key={item.key}
                    style={[
                      styles.datePresetChip,
                      isSelected ? styles.datePresetChipActive : null,
                    ]}
                    onPress={() => {
                      handlePresetSelect(item.key as any);
                      setActiveDateField('START');
                    }}
                  >
                    {isSelected ? (
                      <Ionicons name="checkmark-circle" size={13} color="#0D7A52" style={{ marginRight: 4 }} />
                    ) : null}
                    <Text
                      style={[
                        styles.datePresetChipText,
                        isSelected ? styles.datePresetChipTextActive : null,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Step Guidance Banner */}
            <View
              style={{
                backgroundColor:
                  tempStartDate && tempEndDate
                    ? '#ECFDF5'
                    : activeDateField === 'START'
                    ? '#EFF6FF'
                    : '#FFFBEB',
                borderWidth: 1.5,
                borderColor:
                  tempStartDate && tempEndDate
                    ? '#A7F3D0'
                    : activeDateField === 'START'
                    ? '#BFDBFE'
                    : '#FDE68A',
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons
                  name={
                    tempStartDate && tempEndDate
                      ? 'checkmark-circle'
                      : activeDateField === 'START'
                      ? 'calendar-outline'
                      : 'arrow-forward-circle-outline'
                  }
                  size={16}
                  color={
                    tempStartDate && tempEndDate
                      ? '#059669'
                      : activeDateField === 'START'
                      ? '#2563EB'
                      : '#D97706'
                  }
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '800',
                    letterSpacing: 0.5,
                    color:
                      tempStartDate && tempEndDate
                        ? '#065F46'
                        : activeDateField === 'START'
                        ? '#1E40AF'
                        : '#92400E',
                  }}
                >
                  {tempStartDate && tempEndDate
                    ? '✓ KUMPIRMADO: SAKOP NA PETSA'
                    : activeDateField === 'START'
                    ? 'HAKBANG 1: PILIIN ANG SIMULANG PETSA (CHOOSE START DATE)'
                    : 'HAKBANG 2: PILIIN ANG HULING PETSA (CHOOSE END DATE)'}
                </Text>
              </View>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color:
                    tempStartDate && tempEndDate
                      ? '#047857'
                      : activeDateField === 'START'
                      ? '#1D4ED8'
                      : '#B45309',
                  lineHeight: 16,
                }}
              >
                {tempStartDate && tempEndDate
                  ? `${tempStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} hanggang ${tempEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} (${diffDays} araw). I-tap ang I-apply sa ibaba.`
                  : activeDateField === 'START'
                  ? 'I-tap ang araw sa kalendaryo kung kailan magsisimula ang sakop.'
                  : `Naitakda na ang simula (${tempStartDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}). Piliin naman ang huling araw.`}
              </Text>
            </View>

            {/* Start & End Date Selector Cards */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#F9FAFB',
                borderRadius: 12,
                padding: 10,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                marginBottom: 10,
                gap: 8,
              }}
            >
              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: activeDateField === 'START' ? '#ECFDF5' : '#FFFFFF',
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 9,
                  borderWidth: 2,
                  borderColor: activeDateField === 'START' ? '#0D7A52' : '#E5E7EB',
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setActiveDateField('START');
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#4B5563', letterSpacing: 0.5 }}>
                    SIMULANG PETSA
                  </Text>
                  {activeDateField === 'START' ? (
                    <View style={{ backgroundColor: '#0D7A52', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>PUMIPILI</Text>
                    </View>
                  ) : tempStartDate ? (
                    <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                      <Text style={{ fontSize: 8, fontWeight: '800', color: '#0D7A52' }}>✓ SET</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: tempStartDate ? '#111827' : '#9CA3AF' }}>
                  {tempStartDate
                    ? tempStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Pumili sa ibaba...'}
                </Text>
                <Text style={{ fontSize: 9, color: activeDateField === 'START' ? '#0D7A52' : '#6B7280', marginTop: 2, fontWeight: '600' }}>
                  {activeDateField === 'START' ? '👉 Piliin sa kalendaryo' : 'I-tap para baguhin'}
                </Text>
              </Pressable>

              <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />

              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: activeDateField === 'END' ? '#ECFDF5' : '#FFFFFF',
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 9,
                  borderWidth: 2,
                  borderColor: activeDateField === 'END' ? '#0D7A52' : '#E5E7EB',
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setActiveDateField('END');
                  setCalendarMonth(new Date());
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#4B5563', letterSpacing: 0.5 }}>
                    HULING PETSA
                  </Text>
                  {activeDateField === 'END' ? (
                    <View style={{ backgroundColor: '#0D7A52', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF' }}>PUMIPILI</Text>
                    </View>
                  ) : tempEndDate ? (
                    <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                      <Text style={{ fontSize: 8, fontWeight: '800', color: '#0D7A52' }}>✓ SET</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: tempEndDate ? '#111827' : '#9CA3AF' }}>
                  {tempEndDate
                    ? tempEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : tempStartDate
                    ? tempStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '---'}
                </Text>
                <Text style={{ fontSize: 9, color: activeDateField === 'END' ? '#0D7A52' : '#6B7280', marginTop: 2, fontWeight: '600' }}>
                  {activeDateField === 'END' ? '👉 Piliin sa kalendaryo' : 'I-tap para baguhin'}
                </Text>
              </Pressable>
            </View>

            {/* Single Day Shortcut */}
            {tempStartDate ? (
              <Pressable
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#F3F4F6',
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  marginBottom: 12,
                  alignSelf: 'center',
                  gap: 6,
                }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setTempEndDate(tempStartDate);
                  setActiveDateField('START');
                }}
              >
                <Ionicons name="calendar-sharp" size={13} color="#4B5563" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#374151' }}>
                  Isang araw lamang ang sakop (Pareho ang Simula at Huli)
                </Text>
              </Pressable>
            ) : null}

            {/* Interactive Calendar */}
            <View style={styles.calendarContainer}>
              {/* Year Selector */}
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 0.5 }}>
                    TAON ({availableYears.length})
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {availableYears.map((yr) => {
                    const isSelectedYear = calendarMonth.getFullYear() === yr;
                    return (
                      <Pressable
                        key={yr}
                        style={{
                          flex: availableYears.length <= 3 ? 1 : undefined,
                          minWidth: 80,
                          paddingVertical: 7,
                          alignItems: 'center',
                          borderRadius: 8,
                          backgroundColor: isSelectedYear ? '#0D7A52' : '#F3F4F6',
                          borderWidth: 1.5,
                          borderColor: isSelectedYear ? '#0D7A52' : '#E5E7EB',
                        }}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          const now = new Date();
                          let targetMonth = calendarMonth.getMonth();
                          if (yr === now.getFullYear() && targetMonth > now.getMonth()) {
                            targetMonth = now.getMonth();
                          }
                          setCalendarMonth(new Date(yr, targetMonth, 1));
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: isSelectedYear ? '800' : '600',
                            color: isSelectedYear ? '#FFFFFF' : '#374151',
                          }}
                        >
                          {yr}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Month Selector */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#6B7280', marginBottom: 6, letterSpacing: 0.5 }}>
                  BUWAN (MONTH)
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingBottom: 2 }}
                >
                  {[
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
                  ].map((item) => {
                    const isSelectedMonth = calendarMonth.getMonth() === item.m;
                    const now = new Date();
                    const isFutureMonth =
                      calendarMonth.getFullYear() === now.getFullYear() && item.m > now.getMonth();

                    return (
                      <Pressable
                        key={item.m}
                        disabled={isFutureMonth}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 16,
                          backgroundColor: isSelectedMonth
                            ? '#0D7A52'
                            : isFutureMonth
                            ? '#F9FAFB'
                            : '#F3F4F6',
                          borderWidth: 1,
                          borderColor: isSelectedMonth
                            ? '#0D7A52'
                            : isFutureMonth
                            ? '#F3F4F6'
                            : '#E5E7EB',
                          opacity: isFutureMonth ? 0.35 : 1,
                        }}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                          setCalendarMonth(new Date(calendarMonth.getFullYear(), item.m, 1));
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: isSelectedMonth ? '800' : '600',
                            color: isSelectedMonth
                              ? '#FFFFFF'
                              : isFutureMonth
                              ? '#9CA3AF'
                              : '#374151',
                          }}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Month Title & Chevron Navigation */}
              <View style={styles.calendarNavRow}>
                <Pressable style={styles.calendarNavBtn} onPress={handlePrevMonth} hitSlop={8}>
                  <Ionicons name="chevron-back" size={18} color="#1F2937" />
                </Pressable>
                <Text style={styles.calendarMonthTitle}>
                  {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <Pressable
                  style={[
                    styles.calendarNavBtn,
                    calendarMonth.getFullYear() === new Date().getFullYear() &&
                    calendarMonth.getMonth() === new Date().getMonth()
                      ? { opacity: 0.3 }
                      : null,
                  ]}
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

              {/* Day Cells Grid */}
              <View style={styles.calendarGrid}>
                {calendarDays.map((item) => {
                  if (item.type === 'empty') {
                    return <View key={item.key} style={styles.calendarDayCell} />;
                  }

                  const isStart = tempStartDate && isSameDay(item.date, tempStartDate);
                  const isEnd = tempEndDate && isSameDay(item.date, tempEndDate);
                  const isInRange =
                    tempStartDate &&
                    tempEndDate &&
                    item.date.getTime() > tempStartDate.getTime() &&
                    item.date.getTime() < tempEndDate.getTime();
                  const isToday = isSameDay(item.date, new Date());
                  const isFuture = item.date.getTime() > new Date().setHours(23, 59, 59, 999);

                  return (
                    <Pressable
                      key={item.key}
                      disabled={isFuture}
                      style={[
                        styles.calendarDayCell,
                        isInRange ? styles.calendarDayInRange : null,
                        isStart || isEnd ? styles.calendarDaySelected : null,
                        isStart && tempEndDate ? styles.calendarDayStartWithEnd : null,
                        isEnd ? styles.calendarDayEnd : null,
                      ]}
                      onPress={() => handleDaySelect(item.date)}
                    >
                      <View
                        style={[
                          styles.calendarDayCircle,
                          isStart || isEnd ? styles.calendarDayCircleSelected : null,
                          isToday && !isStart && !isEnd ? styles.calendarDayCircleToday : null,
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            isFuture ? styles.calendarDayTextFuture : null,
                            isStart || isEnd ? styles.calendarDayTextSelected : null,
                            isToday && !isStart && !isEnd ? styles.calendarDayTextToday : null,
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

            {/* Action Buttons */}
            <View style={styles.dateFilterActionRow}>
              <Pressable style={styles.dateFilterResetBtn} onPress={handleReset}>
                <Ionicons name="refresh-outline" size={16} color="#4B5563" style={{ marginRight: 4 }} />
                <Text style={styles.dateFilterResetText}>I-reset (Ngayon)</Text>
              </Pressable>

              <Pressable style={styles.dateFilterApplyBtn} onPress={handleApply}>
                <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.dateFilterApplyText}>
                  {tempStartDate && tempEndDate
                    ? `✓ I-apply ang Sakop (${diffDays} araw)`
                    : tempStartDate
                    ? '✓ I-apply ang Petsa (1 araw)'
                    : 'I-apply ang Petsa'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  datePresetsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  datePresetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  datePresetChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#0D7A52',
  },
  datePresetChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  datePresetChipTextActive: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  calendarContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  calendarNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  calendarNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  calendarMonthTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
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
    justifyContent: 'space-around',
  },
  calendarDayCell: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  calendarDayInRange: {
    backgroundColor: '#DCFCE7',
    borderRadius: 0,
  },
  calendarDaySelected: {
    backgroundColor: '#0D7A52',
    borderRadius: 20,
  },
  calendarDayStartWithEnd: {
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  calendarDayEnd: {
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  calendarDayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '600',
    color: '#1F2937',
  },
  calendarDayTextFuture: {
    color: '#D1D5DB',
  },
  calendarDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  calendarDayTextToday: {
    color: '#0D7A52',
    fontWeight: '800',
  },
  dateFilterActionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 4,
  },
  dateFilterResetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateFilterResetText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  dateFilterApplyBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#0D7A52',
  },
  dateFilterApplyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
