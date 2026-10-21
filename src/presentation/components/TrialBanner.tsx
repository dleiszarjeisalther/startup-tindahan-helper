// src/presentation/components/TrialBanner.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLicensing } from '../hooks/useLicensing';

interface TrialBannerProps {
  onPressUpgrade?: () => void;
}

export function TrialBanner({ onPressUpgrade }: TrialBannerProps) {
  const { isLicensed, isRegistered, isTrialExpired, isQuotaExceeded, daysRemaining, hoursRemaining } = useLicensing();

  // If user is already Pro licensed, keep header completely clean
  if (isLicensed || !isRegistered) {
    return null;
  }

  const isExpired = isTrialExpired;

  return (
    <TouchableOpacity
      style={[styles.bannerContainer, isExpired ? styles.bannerExpired : styles.bannerActive]}
      onPress={onPressUpgrade}
      activeOpacity={0.85}
    >
      <View style={styles.leftContent}>
        <Ionicons
          name={isExpired ? 'lock-closed' : 'time-outline'}
          size={16}
          color={isExpired ? '#DC2626' : '#D97706'}
        />
        <Text style={[styles.bannerText, isExpired ? styles.textExpired : styles.textActive]}>
          {isQuotaExceeded
            ? 'Naabot ang 200 Benta (Trial Limit)'
            : isExpired
            ? 'Tapos na ang Libreng Trial'
            : daysRemaining > 1
            ? `Libreng Trial: ${daysRemaining} araw natitira`
            : `Libreng Trial: ${hoursRemaining} oras natitira`}
        </Text>
      </View>
      <View style={[styles.badge, isExpired ? styles.badgeExpired : styles.badgeActive]}>
        <Text style={[styles.badgeText, isExpired ? styles.badgeTextExpired : styles.badgeTextActive]}>
          {isExpired ? 'I-unlock' : 'Mag-upgrade'}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={12}
          color={isExpired ? '#DC2626' : '#B45309'}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  bannerActive: {
    backgroundColor: '#FEF3C7',
    borderBottomColor: '#FDE68A',
  },
  bannerExpired: {
    backgroundColor: '#FEE2E2',
    borderBottomColor: '#FECACA',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
  },
  textActive: {
    color: '#92400E',
  },
  textExpired: {
    color: '#B91C1C',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 2,
  },
  badgeActive: {
    backgroundColor: '#FDE68A',
  },
  badgeExpired: {
    backgroundColor: '#FECACA',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextActive: {
    color: '#B45309',
  },
  badgeTextExpired: {
    color: '#DC2626',
  },
});
