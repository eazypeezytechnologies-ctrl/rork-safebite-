import React, { useRef, useEffect } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { arcaneColors, arcaneRadius } from '@/constants/theme';
import { useReduceMotion } from '@/contexts/ReduceMotionContext';

type BadgeStatus = 'safe' | 'caution' | 'danger' | 'neutral' | 'legendary';

interface SigilBadgeProps {
  label: string;
  status?: BadgeStatus;
  size?: 'sm' | 'md';
  testID?: string;
}

const STATUS_MAP = {
  safe: {
    bg: arcaneColors.safeMuted,
    text: arcaneColors.safe,
    border: 'rgba(5, 150, 105, 0.25)',
    sigil: '◈',
  },
  caution: {
    bg: arcaneColors.cautionMuted,
    text: arcaneColors.caution,
    border: 'rgba(217, 119, 6, 0.25)',
    sigil: '◇',
  },
  danger: {
    bg: arcaneColors.dangerMuted,
    text: arcaneColors.danger,
    border: 'rgba(220, 38, 38, 0.25)',
    sigil: '⬡',
  },
  neutral: {
    bg: arcaneColors.primaryMuted,
    text: arcaneColors.primary,
    border: arcaneColors.borderRune,
    sigil: '◎',
  },
  legendary: {
    bg: arcaneColors.goldMuted,
    text: arcaneColors.goldDark,
    border: arcaneColors.borderGold,
    sigil: '✦',
  },
} as const;

export const SigilBadge = React.memo(function SigilBadge({
  label,
  status = 'neutral',
  size = 'md',
  testID,
}: SigilBadgeProps) {
  const { reduceMotion } = useReduceMotion();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const s = STATUS_MAP[status];
  const isSm = size === 'sm';

  useEffect(() => {
    if (reduceMotion || status === 'neutral') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, status, pulseAnim]);

  return (
    <Animated.View
      testID={testID}
      style={[
        styles.badge,
        {
          backgroundColor: s.bg,
          borderColor: s.border,
          transform: [{ scale: pulseAnim }],
          paddingHorizontal: isSm ? 8 : 12,
          paddingVertical: isSm ? 3 : 5,
        },
      ]}
    >
      <Text
        style={[
          styles.sigil,
          { color: s.text, fontSize: isSm ? 8 : 10 },
        ]}
      >
        {s.sigil}
      </Text>
      <Text
        style={[
          styles.label,
          {
            color: s.text,
            fontSize: isSm ? 11 : 13,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: arcaneRadius.pill,
    borderWidth: 1,
    gap: 4,
  },
  sigil: {
    fontWeight: '700' as const,
  },
  label: {
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
});
