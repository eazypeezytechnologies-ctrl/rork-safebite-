import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { AlertTriangle, RefreshCw, X } from 'lucide-react-native';

interface LimitedModeBannerProps {
  visible: boolean;
  message?: string | null;
  onRetry: () => void;
  onDismiss: () => void;
}

export function LimitedModeBanner({ visible, message, onRetry, onDismiss }: LimitedModeBannerProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      testID="limited-mode-banner"
    >
      <View style={styles.inner}>
        <View style={styles.iconContainer}>
          <AlertTriangle size={18} color="#92400E" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Limited Mode</Text>
          <Text style={styles.message} numberOfLines={2}>
            {message || 'Family features temporarily unavailable. Try again later.'}
          </Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={onRetry}
            testID="limited-mode-retry"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <RefreshCw size={14} color="#92400E" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={onDismiss}
            testID="limited-mode-dismiss"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X size={14} color="#92400E" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 4,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#92400E',
    marginBottom: 1,
  },
  message: {
    fontSize: 12,
    color: '#A16207',
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  retryButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
