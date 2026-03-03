import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { arcaneColors, arcaneShadows, arcaneRadius } from '@/constants/theme';
import { useReduceMotion } from '@/contexts/ReduceMotionContext';

interface RuneCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  glowColor?: string;
  variant?: 'default' | 'accent' | 'gold' | 'danger';
  testID?: string;
}

const VARIANT_MAP = {
  default: {
    border: arcaneColors.borderRune,
    strip: arcaneColors.primary,
    glow: arcaneColors.primaryMuted,
  },
  accent: {
    border: arcaneColors.borderAccent,
    strip: arcaneColors.accent,
    glow: arcaneColors.accentMuted,
  },
  gold: {
    border: arcaneColors.borderGold,
    strip: arcaneColors.gold,
    glow: arcaneColors.goldMuted,
  },
  danger: {
    border: 'rgba(220, 38, 38, 0.20)',
    strip: arcaneColors.danger,
    glow: arcaneColors.dangerMuted,
  },
} as const;

export const RuneCard = React.memo(function RuneCard({
  children,
  style,
  variant = 'default',
  testID,
}: RuneCardProps) {
  const { reduceMotion } = useReduceMotion();
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const v = VARIANT_MAP[variant];

  useEffect(() => {
    if (reduceMotion) {
      glowAnim.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 0.8,
          duration: 2400,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 2400,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, glowAnim]);

  return (
    <View testID={testID} style={[styles.wrapper, style]}>
      <Animated.View
        style={[
          styles.card,
          {
            borderColor: v.border,
          },
          arcaneShadows.card,
        ]}
      >
        <Animated.View
          style={[
            styles.glowStrip,
            {
              backgroundColor: v.strip,
              opacity: glowAnim,
            },
          ]}
        />
        <View style={[styles.runeCornerTL, { borderColor: v.border }]} />
        <View style={[styles.runeCornerBR, { borderColor: v.border }]} />
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  glowStrip: {
    height: 3,
    width: '100%',
  },
  content: {
    padding: 16,
  },
  runeCornerTL: {
    position: 'absolute',
    top: 3,
    left: 0,
    width: 16,
    height: 16,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderTopLeftRadius: arcaneRadius.lg,
    opacity: 0.4,
  },
  runeCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderBottomRightRadius: arcaneRadius.lg,
    opacity: 0.4,
  },
});
