import React, { useEffect, useRef, useCallback } from 'react';
import { View, Animated, StyleSheet, Text } from 'react-native';
import { arcaneColors, arcaneRadius } from '@/constants/theme';
import { useReduceMotion } from '@/contexts/ReduceMotionContext';
import { motionTiming, motionEasing } from '@/utils/motion';
import * as Haptics from 'expo-haptics';

type FeedbackType = 'success' | 'warning' | 'error';

interface StatusFeedbackProps {
  type: FeedbackType;
  visible: boolean;
  message?: string;
  onComplete?: () => void;
}

const FEEDBACK_CONFIG: Record<FeedbackType, { color: string; glow: string; sigil: string; haptic: Haptics.NotificationFeedbackType }> = {
  success: {
    color: arcaneColors.safe,
    glow: arcaneColors.safeMuted,
    sigil: '◈',
    haptic: Haptics.NotificationFeedbackType.Success,
  },
  warning: {
    color: arcaneColors.caution,
    glow: arcaneColors.cautionMuted,
    sigil: '◇',
    haptic: Haptics.NotificationFeedbackType.Warning,
  },
  error: {
    color: arcaneColors.danger,
    glow: arcaneColors.dangerMuted,
    sigil: '⬡',
    haptic: Haptics.NotificationFeedbackType.Error,
  },
};

export function StatusFeedback({ type, visible, message, onComplete }: StatusFeedbackProps) {
  const { reduceMotion } = useReduceMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const sigilScale = useRef(new Animated.Value(0.5)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      const dur = reduceMotion ? 0 : motionTiming.fast;
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: dur, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.8, duration: dur, useNativeDriver: true }),
      ]).start();
      return;
    }

    Haptics.notificationAsync(FEEDBACK_CONFIG[type].haptic);

    if (reduceMotion) {
      opacity.setValue(1);
      scale.setValue(1);
      sigilScale.setValue(1);
      glowOpacity.setValue(0.6);
      shakeX.setValue(0);
      const timer = setTimeout(() => onComplete?.(), 1800);
      return () => clearTimeout(timer);
    }

    const enterAnim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: motionTiming.fast,
        easing: motionEasing.easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: motionTiming.normal,
        easing: motionEasing.spring,
        useNativeDriver: true,
      }),
    ]);

    const sigilPulse = Animated.sequence([
      Animated.timing(sigilScale, {
        toValue: 1.3,
        duration: motionTiming.fast,
        easing: motionEasing.spring,
        useNativeDriver: true,
      }),
      Animated.timing(sigilScale, {
        toValue: 1,
        duration: motionTiming.normal,
        easing: motionEasing.easeOut,
        useNativeDriver: true,
      }),
    ]);

    const glowBurst = Animated.sequence([
      Animated.timing(glowOpacity, {
        toValue: 0.9,
        duration: motionTiming.micro,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 0.3,
        duration: motionTiming.slow,
        easing: motionEasing.easeOut,
        useNativeDriver: true,
      }),
    ]);

    const shakeAnim = type === 'warning' || type === 'error'
      ? Animated.sequence([
          Animated.timing(shakeX, { toValue: 6, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -5, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 4, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -3, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
        ])
      : Animated.timing(shakeX, { toValue: 0, duration: 0, useNativeDriver: true });

    Animated.parallel([enterAnim, sigilPulse, glowBurst, shakeAnim]).start();

    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: motionTiming.normal,
          easing: motionEasing.easeIn,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.9,
          duration: motionTiming.normal,
          useNativeDriver: true,
        }),
      ]).start(() => onComplete?.());
    }, 1800);

    return () => clearTimeout(exitTimer);
  }, [visible, type, reduceMotion, opacity, scale, sigilScale, glowOpacity, shakeX, onComplete]);

  const config = FEEDBACK_CONFIG[type];

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          transform: [{ scale }, { translateX: shakeX }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.glowBg,
          {
            backgroundColor: config.glow,
            opacity: glowOpacity,
          },
        ]}
      />
      <View style={[styles.content, { borderColor: config.color }]}>
        <Animated.Text
          style={[
            styles.sigil,
            {
              color: config.color,
              transform: [{ scale: sigilScale }],
            },
          ]}
        >
          {config.sigil}
        </Animated.Text>
        {message ? (
          <Text style={[styles.message, { color: config.color }]}>{message}</Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

interface SigilPulseProps {
  color?: string;
  size?: number;
  autoPlay?: boolean;
}

export function SigilPulse({ color = arcaneColors.safe, size = 40, autoPlay = true }: SigilPulseProps) {
  const { reduceMotion } = useReduceMotion();
  const ringScale = useRef(new Animated.Value(0.5)).current;
  const ringOpacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (!autoPlay || reduceMotion) {
      ringScale.setValue(1);
      ringOpacity.setValue(0.4);
      return;
    }

    const anim = Animated.loop(
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 1.8,
          duration: 1400,
          easing: motionEasing.easeOut,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 1400,
          easing: motionEasing.easeOut,
          useNativeDriver: true,
        }),
      ]),
    );

    anim.start();
    return () => anim.stop();
  }, [autoPlay, reduceMotion, ringScale, ringOpacity]);

  return (
    <View style={[styles.sigilPulseContainer, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.sigilRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          },
        ]}
      />
      <View
        style={[
          styles.sigilCore,
          {
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: (size * 0.4) / 2,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

export function useStatusAnimation() {
  const { reduceMotion } = useReduceMotion();
  const shakeValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;

  const triggerShake = useCallback(() => {
    if (reduceMotion) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Animated.sequence([
      Animated.timing(shakeValue, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: -5, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: 4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: -3, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeValue, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, shakeValue]);

  const triggerPulse = useCallback(() => {
    if (reduceMotion) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(pulseValue, {
        toValue: 0.96,
        duration: motionTiming.micro,
        easing: motionEasing.easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(pulseValue, {
        toValue: 1,
        duration: motionTiming.fast,
        easing: motionEasing.spring,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, pulseValue]);

  return { shakeValue, pulseValue, triggerShake, triggerPulse };
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  glowBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: arcaneRadius.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: arcaneRadius.lg,
    borderWidth: 1,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  sigil: {
    fontSize: 22,
    fontWeight: '700' as const,
  },
  message: {
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  sigilPulseContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sigilRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  sigilCore: {
    opacity: 0.9,
  },
});
