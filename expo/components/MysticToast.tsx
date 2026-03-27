import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { arcaneRadius, arcaneShadows } from '@/constants/theme';
import { useReduceMotion } from '@/contexts/ReduceMotionContext';
import createContextHook from '@nkzw/create-context-hook';

type ToastType = 'safe' | 'caution' | 'danger' | 'info';

interface ToastData {
  id: number;
  message: string;
  type: ToastType;
}

const TOAST_CONFIG = {
  safe: {
    bg: '#059669',
    sigil: '◈',
  },
  caution: {
    bg: '#D97706',
    sigil: '◇',
  },
  danger: {
    bg: '#DC2626',
    sigil: '⬡',
  },
  info: {
    bg: '#0B6E7A',
    sigil: '◎',
  },
} as const;

let toastId = 0;

export const [MysticToastProvider, useMysticToast] = createContextHook(() => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
});

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  const { reduceMotion } = useReduceMotion();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = TOAST_CONFIG[toast.type];

  useEffect(() => {
    const dur = reduceMotion ? 0 : 280;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: dur,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: dur,
        useNativeDriver: true,
      }),
    ]).start();

    const dismissTimer = setTimeout(() => {
      const outDur = reduceMotion ? 0 : 220;
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -80,
          duration: outDur,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: outDur,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss());
    }, 2500);

    return () => clearTimeout(dismissTimer);
  }, [reduceMotion, translateY, opacity, onDismiss]);

  return (
    <Animated.View
      style={[
        styles.toast,
        arcaneShadows.elevated,
        {
          backgroundColor: config.bg,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Text style={styles.toastSigil}>{config.sigil}</Text>
      <Text style={styles.toastMessage} numberOfLines={2}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}

export function MysticToastRenderer() {
  const { toasts, dismissToast } = useMysticToast();

  if (toasts.length === 0) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={() => dismissToast(toast.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 60,
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: arcaneRadius.lg,
    marginBottom: 8,
    maxWidth: 400,
    width: '100%',
    gap: 10,
  },
  toastSigil: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  toastMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
