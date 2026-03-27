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
  const corePulse = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (reduceMotion) {
      glowPulse.setValue(0.5);
      corePulse.setValue(0.85);
      return;
    }

    const outerAnim = Animated.loop(
      Animated.timing(outerSpin, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const innerAnim = Animated.loop(
      Animated.timing(innerSpin, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.7,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.2,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    const coreAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(corePulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(corePulse, {
          toValue: 0.6,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    outerAnim.start();
    innerAnim.start();
    pulseAnim.start();
    coreAnim.start();

    return () => {
      outerAnim.stop();
      innerAnim.stop();
      pulseAnim.stop();
      coreAnim.stop();
    };
  }, [reduceMotion, outerSpin, innerSpin, glowPulse, corePulse]);

  const outerRotate = outerSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const innerRotate = innerSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg'],
  });

  const runeSize = size * 0.12;
  const innerSize = size * 0.6;
  const coreSize = size * 0.2;
  const crossLen = size * 0.22;
  const crossThick = 1.2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.glowRing,
          {
            opacity: glowPulse,
            width: size + 6,
            height: size + 6,
            borderRadius: (size + 6) / 2,
            borderColor: glowColor,
          },
        ]}
      />

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
        {[0, 1, 2, 3].map((i) => {
          const angle = i * 90;
          const rad = (angle * Math.PI) / 180;
          const r = size / 2;
          const cx = r + Math.cos(rad) * r - runeSize / 2;
          const cy = r + Math.sin(rad) * r - runeSize / 2;
          return (
            <View
              key={`rune-${i}`}
              style={[
                styles.runeNode,
                {
                  width: runeSize,
                  height: runeSize,
                  borderRadius: runeSize / 2,
                  backgroundColor: i % 2 === 0 ? color : glowColor,
                  left: cx,
                  top: cy,
                },
              ]}
            />
          );
        })}

        {[45, 135, 225, 315].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const r = size / 2;
          const dotSize = runeSize * 0.5;
          const cx = r + Math.cos(rad) * (r * 0.92) - dotSize / 2;
          const cy = r + Math.sin(rad) * (r * 0.92) - dotSize / 2;
          return (
            <View
              key={`dot-${angle}`}
              style={[
                styles.runeNode,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: color,
                  opacity: 0.45,
                  left: cx,
                  top: cy,
                },
              ]}
            />
          );
        })}
      </Animated.View>

      <View style={styles.crossContainer}>
        <View
          style={[
            styles.crossLine,
            {
              width: crossLen,
              height: crossThick,
              backgroundColor: color,
              opacity: 0.18,
            },
          ]}
        />
        <View
          style={[
            styles.crossLine,
            {
              width: crossThick,
              height: crossLen,
              backgroundColor: color,
              opacity: 0.18,
            },
          ]}
        />
        <View
          style={[
            styles.crossLine,
            {
              width: crossLen * 0.7,
              height: crossThick,
              backgroundColor: glowColor,
              opacity: 0.12,
              transform: [{ rotate: '45deg' }],
            },
          ]}
        />
        <View
          style={[
            styles.crossLine,
            {
              width: crossLen * 0.7,
              height: crossThick,
              backgroundColor: glowColor,
              opacity: 0.12,
              transform: [{ rotate: '-45deg' }],
            },
          ]}
        />
      </View>

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
        {[0, 120, 240].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const r = innerSize / 2;
          const dotSize = runeSize * 0.6;
          const cx = r + Math.cos(rad) * r - dotSize / 2;
          const cy = r + Math.sin(rad) * r - dotSize / 2;
          return (
            <View
              key={`inner-${angle}`}
              style={[
                styles.runeNode,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: glowColor,
                  left: cx,
                  top: cy,
                },
              ]}
            />
          );
        })}
      </Animated.View>

      <Animated.View
        style={[
          styles.core,
          {
            width: coreSize,
            height: coreSize,
            borderRadius: coreSize / 2,
            backgroundColor: color,
            opacity: corePulse,
          },
        ]}
      />
      <View
        style={[
          styles.coreInner,
          {
            width: coreSize * 0.5,
            height: coreSize * 0.5,
            borderRadius: coreSize * 0.25,
            backgroundColor: glowColor,
            opacity: 0.6,
          },
        ]}
      />
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
    borderWidth: 1.5,
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  innerRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  runeNode: {
    position: 'absolute',
  },
  crossContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossLine: {
    position: 'absolute',
  },
  core: {
    position: 'absolute',
  },
  coreInner: {
    position: 'absolute',
  },
});
