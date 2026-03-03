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
    cornerAccent: arcaneColors.primaryLight,
  },
  accent: {
    border: arcaneColors.borderAccent,
    strip: arcaneColors.accent,
    glow: arcaneColors.accentMuted,
    cornerAccent: arcaneColors.accentLight,
  },
  gold: {
    border: arcaneColors.borderGold,
    strip: arcaneColors.gold,
    glow: arcaneColors.goldMuted,
    cornerAccent: arcaneColors.goldDark,
  },
  danger: {
    border: 'rgba(220, 38, 38, 0.20)',
    strip: arcaneColors.danger,
    glow: arcaneColors.dangerMuted,
    cornerAccent: arcaneColors.dangerLight,
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
          toValue: 0.85,
          duration: 2400,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.35,
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

        <View style={[styles.runeCornerTL, { borderColor: v.cornerAccent }]}>
          <View style={[styles.cornerDot, styles.cornerDotTL, { backgroundColor: v.cornerAccent }]} />
        </View>
        <View style={[styles.runeCornerTR, { borderColor: v.cornerAccent }]}>
          <View style={[styles.cornerDot, styles.cornerDotTR, { backgroundColor: v.cornerAccent }]} />
        </View>
        <View style={[styles.runeCornerBL, { borderColor: v.cornerAccent }]}>
          <View style={[styles.cornerDot, styles.cornerDotBL, { backgroundColor: v.cornerAccent }]} />
        </View>
        <View style={[styles.runeCornerBR, { borderColor: v.cornerAccent }]}>
          <View style={[styles.cornerDot, styles.cornerDotBR, { backgroundColor: v.cornerAccent }]} />
        </View>

        <View style={styles.content}>{children}</View>
      </Animated.View>
    </View>
  );
});

const CORNER_SIZE = 18;
const CORNER_DOT = 3;

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
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderTopLeftRadius: arcaneRadius.lg,
    opacity: 0.5,
  },
  runeCornerTR: {
    position: 'absolute',
    top: 3,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderRightWidth: 2,
    borderTopWidth: 2,
    borderTopRightRadius: arcaneRadius.lg,
    opacity: 0.5,
  },
  runeCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderBottomLeftRadius: arcaneRadius.lg,
    opacity: 0.5,
  },
  runeCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderBottomRightRadius: arcaneRadius.lg,
    opacity: 0.5,
  },
  cornerDot: {
    position: 'absolute',
    width: CORNER_DOT,
    height: CORNER_DOT,
    borderRadius: CORNER_DOT / 2,
    opacity: 0.7,
  },
  cornerDotTL: {
    top: 2,
    left: 2,
  },
  cornerDotTR: {
    top: 2,
    right: 2,
  },
  cornerDotBL: {
    bottom: 2,
    left: 2,
  },
  cornerDotBR: {
    bottom: 2,
    right: 2,
  },
});
