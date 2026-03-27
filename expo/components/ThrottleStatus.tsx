import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Clock, X, RefreshCw } from 'lucide-react-native';
import { requestThrottler } from '@/utils/requestThrottler';

interface ThrottleStatusProps {
  onDismiss?: () => void;
}

export function ThrottleStatus({ onDismiss }: ThrottleStatusProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [slideAnim] = useState(new Animated.Value(-100));

  const hideStatus = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      onDismiss?.();
    });
  }, [slideAnim, onDismiss]);

  const checkThrottle = useCallback(() => {
    const throttled = requestThrottler.isThrottled();
    const seconds = requestThrottler.getRetryAfterSeconds();
    
    if (throttled && seconds > 0) {
      setIsVisible(true);
      setRetrySeconds(seconds);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else if (isVisible && !throttled) {
      hideStatus();
    }
  }, [isVisible, slideAnim, hideStatus]);

  useEffect(() => {
    checkThrottle();
    const interval = setInterval(checkThrottle, 1000);
    return () => clearInterval(interval);
  }, [checkThrottle]);

  const handleReset = useCallback(() => {
    requestThrottler.resetThrottle();
    hideStatus();
  }, [hideStatus]);

  if (!isVisible) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <View style={styles.content}>
        <Clock size={18} color="#F59E0B" />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Too many requests</Text>
          <Text style={styles.subtitle}>
            Retrying in {retrySeconds}s...
          </Text>
        </View>
        <TouchableOpacity onPress={handleReset} style={styles.retryButton}>
          <RefreshCw size={16} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={hideStatus} style={styles.closeButton}>
          <X size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill,
            { width: `${Math.min(100, (retrySeconds / 30) * 100)}%` }
          ]} 
        />
      </View>
    </Animated.View>
  );
}

interface ConnectionStatusProps {
  status: 'connecting' | 'connected' | 'slow' | 'error' | 'idle';
  retryCount?: number;
}

export function ConnectionStatus({ status, retryCount = 0 }: ConnectionStatusProps) {
  const [slideAnim] = useState(new Animated.Value(-60));
  const isVisible = status === 'connecting' || status === 'slow' || status === 'error';

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isVisible ? 0 : -60,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, [isVisible, slideAnim]);

  if (status === 'idle' || status === 'connected') return null;

  const getStatusConfig = () => {
    switch (status) {
      case 'connecting':
        return {
          color: '#3B82F6',
          bgColor: '#EFF6FF',
          text: 'Connecting...',
        };
      case 'slow':
        return {
          color: '#F59E0B',
          bgColor: '#FFFBEB',
          text: retryCount > 0 ? `Slow connection (retry ${retryCount})...` : 'Slow connection...',
        };
      case 'error':
        return {
          color: '#EF4444',
          bgColor: '#FEF2F2',
          text: 'Connection failed',
        };
      default:
        return {
          color: '#6B7280',
          bgColor: '#F3F4F6',
          text: '',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Animated.View 
      style={[
        styles.statusContainer,
        { 
          backgroundColor: config.bgColor,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={[styles.statusDot, { backgroundColor: config.color }]} />
      <Text style={[styles.statusText, { color: config.color }]}>{config.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1F2937',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  retryButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#374151',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
});

export default ThrottleStatus;
