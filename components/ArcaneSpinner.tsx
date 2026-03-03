import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { arcaneColors } from '@/constants/theme';
import { useReduceMotion } from '@/contexts/ReduceMotionContext';

interface ArcaneSpinnerProps {
  size?: number;
  color?: string;
  glowColor?: string;
}

export function ArcaneSpinner({
  size = 56,
  color = arcaneColors.primary,
  glowColor = arcaneColors.accent,
}: ArcaneSpinnerProps) {
  const { reduceMotion } = useReduceMotion();
  const outerSpin = useRef(new Animated.Value(0)).current;
  const innerSpin = useRef(new Animated.Value(0)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (reduceMotion) {
      glowPulse.setValue(0.5);
      return;
    }

    const outerAnim = Animated.loop(
      Animated.timing(outerSpin, {
        toValue: 1,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const innerAnim = Animated.loop(
      Animated.timing(innerSpin, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.7,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.25,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    outerAnim.start();
    innerAnim.start();
    pulseAnim.start();

    return () => {
      outerAnim.stop();
      innerAnim.stop();
      pulseAnim.stop();
    };
  }, [reduceMotion, outerSpin, innerSpin, glowPulse]);

  const outerRotate = outerSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const innerRotate = innerSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const runeSize = size * 0.15;
  const innerSize = size * 0.62;
  const coreSize = size * 0.18;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View style={[styles.glowRing, { opacity: glowPulse, width: size, height: size, borderRadius: size / 2, borderColor: glowColor }]} />

      <Animated.View
        style={[
          styles.outerRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color,
            transform: [{ rotate: outerRotate }],
          },
        ]}
      >
        <View style={[styles.rune, styles.runeTop, { width: runeSize, height: runeSize, borderRadius: runeSize / 2, backgroundColor: color, top: -runeSize / 2 }]} />
        <View style={[styles.rune, styles.runeRight, { width: runeSize, height: runeSize, borderRadius: runeSize / 2, backgroundColor: glowColor, right: -runeSize / 2 }]} />
        <View style={[styles.rune, styles.runeBottom, { width: runeSize, height: runeSize, borderRadius: runeSize / 2, backgroundColor: color, bottom: -runeSize / 2 }]} />
        <View style={[styles.rune, styles.runeLeft, { width: runeSize, height: runeSize, borderRadius: runeSize / 2, backgroundColor: glowColor, left: -runeSize / 2 }]} />
      </Animated.View>

      <Animated.View
        style={[
          styles.innerRing,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            borderColor: glowColor,
            transform: [{ rotate: innerRotate }],
          },
        ]}
      >
        <View style={[styles.innerRune, { width: runeSize * 0.7, height: runeSize * 0.7, borderRadius: runeSize * 0.35, backgroundColor: glowColor, top: -(runeSize * 0.35) }]} />
        <View style={[styles.innerRuneBottom, { width: runeSize * 0.7, height: runeSize * 0.7, borderRadius: runeSize * 0.35, backgroundColor: color, bottom: -(runeSize * 0.35) }]} />
      </Animated.View>

      <View style={[styles.core, { width: coreSize, height: coreSize, borderRadius: coreSize / 2, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glowRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  innerRing: {
    position: 'absolute',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rune: {
    position: 'absolute',
  },
  runeTop: {
    alignSelf: 'center',
  },
  runeRight: {
    top: '50%',
    marginTop: -4,
  },
  runeBottom: {
    alignSelf: 'center',
  },
  runeLeft: {
    top: '50%',
    marginTop: -4,
  },
  innerRune: {
    position: 'absolute',
    alignSelf: 'center',
  },
  innerRuneBottom: {
    position: 'absolute',
    alignSelf: 'center',
  },
  core: {
    position: 'absolute',
    opacity: 0.9,
  },
});
