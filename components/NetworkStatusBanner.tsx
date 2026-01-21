import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { Wifi, WifiOff, Clock, RefreshCw, X, AlertTriangle } from 'lucide-react-native';
import { requestThrottler } from '@/utils/requestThrottler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NetworkState = 'online' | 'offline' | 'throttled' | 'retrying' | 'slow';

interface NetworkStatusBannerProps {
  connectionStatus?: 'connecting' | 'connected' | 'slow' | 'error' | 'idle';
  onRetry?: () => void;
}

export function NetworkStatusBanner({ connectionStatus, onRetry }: NetworkStatusBannerProps) {
  const insets = useSafeAreaInsets();
  const [networkState, setNetworkState] = useState<NetworkState>('online');
  const [retrySeconds, setRetrySeconds] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-120));
  const [dismissed, setDismissed] = useState(false);

  const showBanner = useCallback(() => {
    setIsVisible(true);
    setDismissed(false);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  }, [slideAnim]);

  const hideBanner = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
    });
  }, [slideAnim]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    hideBanner();
  }, [hideBanner]);

  const handleRetry = useCallback(() => {
    console.log('[NetworkStatusBanner] Retry requested');
    requestThrottler.resetThrottle();
    setNetworkState('retrying');
    onRetry?.();
    
    setTimeout(() => {
      if (networkState === 'retrying') {
        setNetworkState('online');
        hideBanner();
      }
    }, 2000);
  }, [networkState, onRetry, hideBanner]);

  useEffect(() => {
    const checkStatus = () => {
      const isThrottled = requestThrottler.isThrottled();
      const seconds = requestThrottler.getRetryAfterSeconds();

      if (isThrottled && seconds > 0) {
        setNetworkState('throttled');
        setRetrySeconds(seconds);
        if (!dismissed) showBanner();
      } else if (connectionStatus === 'slow') {
        setNetworkState('slow');
        if (!dismissed) showBanner();
      } else if (connectionStatus === 'error') {
        setNetworkState('offline');
        if (!dismissed) showBanner();
      } else if (connectionStatus === 'connecting') {
        setNetworkState('retrying');
        if (!dismissed) showBanner();
      } else {
        if (isVisible && networkState !== 'retrying') {
          hideBanner();
        }
        setNetworkState('online');
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, [connectionStatus, dismissed, isVisible, networkState, showBanner, hideBanner]);

  if (!isVisible) return null;

  const getStatusConfig = () => {
    switch (networkState) {
      case 'offline':
        return {
          icon: <WifiOff size={20} color="#FFFFFF" />,
          bgColor: '#DC2626',
          title: 'Connection Lost',
          subtitle: 'Check your internet connection',
          showRetry: true,
        };
      case 'throttled':
        return {
          icon: <Clock size={20} color="#FFFFFF" />,
          bgColor: '#F59E0B',
          title: 'Too Many Requests',
          subtitle: `Retrying in ${retrySeconds}s...`,
          showRetry: true,
        };
      case 'retrying':
        return {
          icon: <RefreshCw size={20} color="#FFFFFF" />,
          bgColor: '#3B82F6',
          title: 'Reconnecting...',
          subtitle: 'Please wait',
          showRetry: false,
        };
      case 'slow':
        return {
          icon: <AlertTriangle size={20} color="#FFFFFF" />,
          bgColor: '#F97316',
          title: 'Slow Connection',
          subtitle: 'Requests may take longer',
          showRetry: true,
        };
      default:
        return {
          icon: <Wifi size={20} color="#FFFFFF" />,
          bgColor: '#10B981',
          title: 'Connected',
          subtitle: '',
          showRetry: false,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.bgColor,
          transform: [{ translateY: slideAnim }],
          paddingTop: insets.top + 8,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>{config.icon}</View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>{config.title}</Text>
          {config.subtitle ? (
            <Text style={styles.subtitle}>{config.subtitle}</Text>
          ) : null}
        </View>
        {config.showRetry && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            activeOpacity={0.7}
          >
            <RefreshCw size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          activeOpacity={0.7}
        >
          <X size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
      {networkState === 'throttled' && (
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(0, Math.min(100, (retrySeconds / 60) * 100))}%` },
            ]}
          />
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  retryButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  dismissButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
});

export default NetworkStatusBanner;
