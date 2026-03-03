import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { arcaneColors, arcaneRadius } from '@/constants/theme';
import { ArcaneSpinner } from '@/components/ArcaneSpinner';
import { useReduceMotion } from '@/contexts/ReduceMotionContext';
import { motionTiming, motionEasing } from '@/utils/motion';

interface ArcaneLoadingStateProps {
  message?: string;
  hint?: string;
  showRetry?: boolean;
  onRetry?: () => void;
}

export function ArcaneLoadingState({
  message = 'Calling the Archive…',
  hint,
  showRetry = false,
  onRetry,
}: ArcaneLoadingStateProps) {
  const { reduceMotion } = useReduceMotion();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    const dur = reduceMotion ? motionTiming.fadeOnly : motionTiming.normal;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: dur,
        easing: motionEasing.easeOut,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: reduceMotion ? 0 : motionTiming.slow,
        easing: motionEasing.decelerate,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reduceMotion, fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.runeAccent} />
        <View style={styles.spinnerWrap}>
          <ArcaneSpinner size={48} />
        </View>
        <Text style={styles.message}>{message}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
        {showRetry && onRetry ? (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.7}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  card: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.xl,
    borderWidth: 1,
    borderColor: arcaneColors.borderRune,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
  },
  runeAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: arcaneColors.primary,
    opacity: 0.6,
  },
  spinnerWrap: {
    marginBottom: 16,
  },
  message: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: arcaneColors.text,
    letterSpacing: 0.3,
    textAlign: 'center' as const,
  },
  hint: {
    fontSize: 13,
    color: arcaneColors.textMuted,
    marginTop: 6,
    textAlign: 'center' as const,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: arcaneColors.primaryMuted,
    borderRadius: arcaneRadius.md,
    borderWidth: 1,
    borderColor: arcaneColors.borderRune,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: arcaneColors.primary,
    letterSpacing: 0.2,
  },
});
