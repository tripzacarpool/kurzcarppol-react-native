import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface VerificationBadgeProps {
  verificationBatch?: string;
  driverVerified?: boolean;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export default function VerificationBadge({
  verificationBatch,
  driverVerified = false,
  size = 'medium',
  showLabel = true,
}: VerificationBadgeProps) {
  if (!driverVerified || !verificationBatch) {
    return null;
  }

  const iconSize = size === 'small' ? 14 : size === 'medium' ? 16 : 20;
  const fontSize = size === 'small' ? 10 : size === 'medium' ? 11 : 13;
  const padding = size === 'small' ? 4 : size === 'medium' ? 6 : 8;

  return (
    <View style={[styles.container, { padding }]}>
      <ShieldCheck 
        size={iconSize} 
        color={Colors.dark.gold} 
        fill={Colors.dark.gold}
      />
      {showLabel && (
        <Text style={[styles.badgeText, { fontSize }]}>
          {verificationBatch}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  badgeText: {
    color: Colors.dark.gold,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
