import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { arcaneColors } from '@/constants/theme';

interface ArcaneDividerProps {
  style?: ViewStyle;
  label?: string;
  variant?: 'default' | 'accent' | 'gold';
  testID?: string;
}

const VARIANT_COLORS = {
  default: arcaneColors.borderRune,
  accent: arcaneColors.borderAccent,
  gold: arcaneColors.borderGold,
} as const;

const RUNE_CHARS = ['᛫', '᛬', '᛫'];

export const ArcaneDivider = React.memo(function ArcaneDivider({
  style,
  label,
  variant = 'default',
  testID,
}: ArcaneDividerProps) {
  const color = VARIANT_COLORS[variant];

  return (
    <View testID={testID} style={[styles.container, style]}>
      <View style={[styles.line, { backgroundColor: color }]} />
      <View style={styles.runeGroup}>
        {label ? (
          <Text style={[styles.label, { color: arcaneColors.textMuted }]}>{label}</Text>
        ) : (
          RUNE_CHARS.map((char, i) => (
            <Text
              key={i}
              style={[
                styles.rune,
                { color, opacity: i === 1 ? 0.9 : 0.5 },
              ]}
            >
              {char}
            </Text>
          ))
        )}
      </View>
      <View style={[styles.line, { backgroundColor: color }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 4,
  },
  line: {
    flex: 1,
    height: 1,
  },
  runeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 3,
  },
  rune: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
