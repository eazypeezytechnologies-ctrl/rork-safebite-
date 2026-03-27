import { Animated, Easing } from 'react-native';

export const motionTiming = {
  micro: 120,
  fast: 200,
  normal: 300,
  slow: 400,
  fadeOnly: 150,
} as const;

export const motionEasing = {
  easeOut: Easing.out(Easing.cubic),
  easeIn: Easing.in(Easing.cubic),
  easeInOut: Easing.inOut(Easing.cubic),
  spring: Easing.bezier(0.175, 0.885, 0.32, 1.275),
  decelerate: Easing.out(Easing.poly(4)),
} as const;

export function createFadeIn(
  value: Animated.Value,
  reduceMotion: boolean,
  duration = motionTiming.normal,
) {
  return Animated.timing(value, {
    toValue: 1,
    duration: reduceMotion ? motionTiming.fadeOnly : duration,
    easing: motionEasing.easeOut,
    useNativeDriver: true,
  });
}

export function createFadeOut(
  value: Animated.Value,
  reduceMotion: boolean,
  duration = motionTiming.fast,
) {
  return Animated.timing(value, {
    toValue: 0,
    duration: reduceMotion ? motionTiming.fadeOnly : duration,
    easing: motionEasing.easeIn,
    useNativeDriver: true,
  });
}

export function createSlideUp(
  value: Animated.Value,
  reduceMotion: boolean,
  distance = 10,
  duration = motionTiming.normal,
) {
  if (reduceMotion) {
    value.setValue(0);
    return Animated.timing(value, {
      toValue: 0,
      duration: 0,
      useNativeDriver: true,
    });
  }
  value.setValue(distance);
  return Animated.timing(value, {
    toValue: 0,
    duration,
    easing: motionEasing.decelerate,
    useNativeDriver: true,
  });
}

export function createPulse(
  value: Animated.Value,
  reduceMotion: boolean,
) {
  if (reduceMotion) {
    value.setValue(1);
    return Animated.timing(value, { toValue: 1, duration: 0, useNativeDriver: true });
  }
  return Animated.sequence([
    Animated.timing(value, {
      toValue: 0.97,
      duration: motionTiming.micro,
      easing: motionEasing.easeOut,
      useNativeDriver: true,
    }),
    Animated.timing(value, {
      toValue: 1,
      duration: motionTiming.fast,
      easing: motionEasing.spring,
      useNativeDriver: true,
    }),
  ]);
}

export function createShake(
  value: Animated.Value,
  reduceMotion: boolean,
) {
  if (reduceMotion) {
    return Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true });
  }
  return Animated.sequence([
    Animated.timing(value, { toValue: 6, duration: 50, useNativeDriver: true }),
    Animated.timing(value, { toValue: -5, duration: 50, useNativeDriver: true }),
    Animated.timing(value, { toValue: 4, duration: 50, useNativeDriver: true }),
    Animated.timing(value, { toValue: -3, duration: 50, useNativeDriver: true }),
    Animated.timing(value, { toValue: 0, duration: 50, useNativeDriver: true }),
  ]);
}

export function createModalScale(
  value: Animated.Value,
  reduceMotion: boolean,
  direction: 'in' | 'out' = 'in',
) {
  if (reduceMotion) {
    value.setValue(direction === 'in' ? 1 : 0.98);
    return Animated.timing(value, {
      toValue: direction === 'in' ? 1 : 0.98,
      duration: 0,
      useNativeDriver: true,
    });
  }
  return Animated.timing(value, {
    toValue: direction === 'in' ? 1 : 0.98,
    duration: motionTiming.normal,
    easing: motionEasing.spring,
    useNativeDriver: true,
  });
}

export function createLoop(
  animation: Animated.CompositeAnimation,
  reduceMotion: boolean,
) {
  if (reduceMotion) {
    return { start: () => {}, stop: () => {}, reset: () => {} } as Animated.CompositeAnimation;
  }
  return Animated.loop(animation);
}

export function createSpinLoop(
  value: Animated.Value,
  reduceMotion: boolean,
  duration = 3000,
) {
  if (reduceMotion) {
    return { start: () => {}, stop: () => {}, reset: () => {} } as Animated.CompositeAnimation;
  }
  return Animated.loop(
    Animated.timing(value, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }),
  );
}

export function createGlowPulse(
  value: Animated.Value,
  reduceMotion: boolean,
  duration = 1800,
) {
  if (reduceMotion) {
    value.setValue(0.4);
    return { start: () => {}, stop: () => {}, reset: () => {} } as Animated.CompositeAnimation;
  }
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: 0.8,
        duration: duration / 2,
        easing: motionEasing.easeInOut,
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 0.3,
        duration: duration / 2,
        easing: motionEasing.easeInOut,
        useNativeDriver: true,
      }),
    ]),
  );
}
