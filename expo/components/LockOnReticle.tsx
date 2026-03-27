import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useReduceMotion } from '@/contexts/ReduceMotionContext';

interface LockOnReticleProps {
  size?: number;
  locked?: boolean;
  color?: string;
  lockedColor?: string;
}

export const LockOnReticle = React.memo(function LockOnReticle({
  size = 280,
  locked = false,
  color = 'rgba(11, 110, 122, 0.7)',
  lockedColor = '#10B981',
}: LockOnReticleProps) {
  const { reduceMotion } = useReduceMotion();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const cornerGlow = useRef(new Animated.Value(0.5)).current;
  const lockFlash = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      cornerGlow.setValue(0.7);
      return;
    }

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(cornerGlow, {
          toValue: 0.9,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(cornerGlow, {
          toValue: 0.4,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    glowLoop.start();

    const spinLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.start();

    return () => {
      glowLoop.stop();
      spinLoop.stop();
    };
  }, [reduceMotion, cornerGlow, rotateAnim]);

  useEffect(() => {
    if (locked) {
      Animated.sequence([
        Animated.timing(lockFlash, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(lockFlash, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [locked, lockFlash, pulseAnim]);

  const activeColor = locked ? lockedColor : color;
  const cornerSize = size * 0.22;
  const runeMarkSize = 6;

  const outerRotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const lockScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.flashOverlay,
          {
            width: size,
            height: size,
            borderRadius: 8,
            opacity: lockFlash,
            borderColor: lockedColor,
          },
        ]}
      />

      <Animated.View
        style={[
          styles.reticleFrame,
          {
            width: size,
            height: size,
            transform: [{ scale: lockScale }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.corner,
            styles.cornerTL,
            {
              width: cornerSize,
              height: cornerSize,
              borderColor: activeColor,
              opacity: cornerGlow,
            },
          ]}
        >
          <View style={[styles.runeMark, { backgroundColor: activeColor, top: -runeMarkSize / 2, left: cornerSize / 2 - runeMarkSize / 2 }]} />
          <View style={[styles.runeMark, { backgroundColor: activeColor, left: -runeMarkSize / 2, top: cornerSize / 2 - runeMarkSize / 2 }]} />
        </Animated.View>

        <Animated.View
          style={[
            styles.corner,
            styles.cornerTR,
            {
              width: cornerSize,
              height: cornerSize,
              borderColor: activeColor,
              opacity: cornerGlow,
            },
          ]}
        >
          <View style={[styles.runeMark, { backgroundColor: activeColor, top: -runeMarkSize / 2, right: cornerSize / 2 - runeMarkSize / 2 }]} />
          <View style={[styles.runeMark, { backgroundColor: activeColor, right: -runeMarkSize / 2, top: cornerSize / 2 - runeMarkSize / 2 }]} />
        </Animated.View>

        <Animated.View
          style={[
            styles.corner,
            styles.cornerBL,
            {
              width: cornerSize,
              height: cornerSize,
              borderColor: activeColor,
              opacity: cornerGlow,
            },
          ]}
        >
          <View style={[styles.runeMark, { backgroundColor: activeColor, bottom: -runeMarkSize / 2, left: cornerSize / 2 - runeMarkSize / 2 }]} />
          <View style={[styles.runeMark, { backgroundColor: activeColor, left: -runeMarkSize / 2, bottom: cornerSize / 2 - runeMarkSize / 2 }]} />
        </Animated.View>

        <Animated.View
          style={[
            styles.corner,
            styles.cornerBR,
            {
              width: cornerSize,
              height: cornerSize,
              borderColor: activeColor,
              opacity: cornerGlow,
            },
          ]}
        >
          <View style={[styles.runeMark, { backgroundColor: activeColor, bottom: -runeMarkSize / 2, right: cornerSize / 2 - runeMarkSize / 2 }]} />
          <View style={[styles.runeMark, { backgroundColor: activeColor, right: -runeMarkSize / 2, bottom: cornerSize / 2 - runeMarkSize / 2 }]} />
        </Animated.View>

        <View style={[styles.crosshairH, { backgroundColor: activeColor, width: size * 0.06, left: size / 2 - (size * 0.03), top: -1 }]} />
        <View style={[styles.crosshairH, { backgroundColor: activeColor, width: size * 0.06, left: size / 2 - (size * 0.03), bottom: -1 }]} />
        <View style={[styles.crosshairV, { backgroundColor: activeColor, height: size * 0.06, top: size / 2 - (size * 0.03), left: -1 }]} />
        <View style={[styles.crosshairV, { backgroundColor: activeColor, height: size * 0.06, top: size / 2 - (size * 0.03), right: -1 }]} />
      </Animated.View>

      {!reduceMotion && (
        <Animated.View
          style={[
            styles.runeRing,
            {
              width: size * 0.85,
              height: size * 0.85,
              borderRadius: size * 0.425,
              borderColor: activeColor,
              transform: [{ rotate: outerRotate }],
              opacity: cornerGlow,
            },
          ]}
        >
          {[0, 90, 180, 270].map((deg) => (
            <View
              key={deg}
              style={[
                styles.ringDot,
                {
                  backgroundColor: activeColor,
                  transform: [
                    { rotate: `${deg}deg` },
                    { translateY: -(size * 0.425) },
                  ],
                },
              ]}
            />
          ))}
        </Animated.View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashOverlay: {
    position: 'absolute',
    borderWidth: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  reticleFrame: {
    position: 'relative',
  },
  corner: {
    position: 'absolute',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  runeMark: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  crosshairH: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    opacity: 0.4,
  },
  crosshairV: {
    position: 'absolute',
    width: 2,
    borderRadius: 1,
    opacity: 0.4,
  },
  runeRing: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
  },
});
