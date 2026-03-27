import React, { useRef, useCallback } from 'react';
import {
  Animated,
  TouchableWithoutFeedback,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
  Text,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { arcaneColors, arcaneRadius } from '@/constants/theme';
import { useReduceMotion } from '@/contexts/ReduceMotionContext';
import { motionTiming, motionEasing } from '@/utils/motion';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'gold' | 'ghost';

interface AnimatedButtonProps {
  onPress: () => void;
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  haptic?: boolean;
  testID?: string;
}

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; text: string; glow: string }> = {
  primary: { bg: arcaneColors.primary, text: '#FFFFFF', glow: arcaneColors.primary },
  secondary: { bg: arcaneColors.accentMuted, text: arcaneColors.accent, glow: arcaneColors.accent },
  danger: { bg: arcaneColors.dangerMuted, text: arcaneColors.danger, glow: arcaneColors.danger },
  gold: { bg: arcaneColors.goldMuted, text: arcaneColors.goldDark, glow: arcaneColors.gold },
  ghost: { bg: 'transparent', text: arcaneColors.textSecondary, glow: arcaneColors.primary },
};

export function AnimatedButton({
  onPress,
  label,
  variant = 'primary',
  disabled = false,
  icon,
  style,
  textStyle,
  haptic = true,
  testID,
}: AnimatedButtonProps) {
  const { reduceMotion } = useReduceMotion();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = useCallback(() => {
    if (disabled) return;

    if (!reduceMotion) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0.97,
          duration: motionTiming.micro,
          easing: motionEasing.easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: motionTiming.micro,
          easing: motionEasing.easeOut,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [disabled, reduceMotion, scaleAnim, glowAnim]);

  const handlePressOut = useCallback(() => {
    if (!reduceMotion) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: motionTiming.normal,
          easing: motionEasing.spring,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: motionTiming.slow,
          easing: motionEasing.easeOut,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [reduceMotion, scaleAnim, glowAnim]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [disabled, haptic, onPress]);

  const vs = VARIANT_STYLES[variant];
  const isPrimary = variant === 'primary';

  const glowShadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isPrimary ? 0.15 : 0, isPrimary ? 0.4 : 0.2],
  });

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.button,
          {
            backgroundColor: vs.bg,
            transform: [{ scale: scaleAnim }],
            opacity: disabled ? 0.5 : 1,
          },
          isPrimary && styles.primaryButton,
          Platform.OS !== 'web' && {
            shadowColor: vs.glow,
            shadowOpacity: glowShadowOpacity as unknown as number,
            shadowOffset: { width: 0, height: 2 },
            shadowRadius: 12,
          },
          style,
        ]}
      >
        {icon && <View style={styles.iconWrap}>{icon}</View>}
        <Text
          style={[
            styles.label,
            { color: vs.text },
            isPrimary && styles.primaryLabel,
            textStyle,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: arcaneRadius.lg,
    gap: 8,
  },
  primaryButton: {
    elevation: 3,
  },
  iconWrap: {
    marginRight: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  primaryLabel: {
    fontWeight: '700' as const,
  },
});
