import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLiveProducts, useLiveAnalytics } from '@/hooks/useLiveData';
import { useUser } from '@/contexts/UserContext';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export const [LiveDataContext, useLiveData] = createContextHook(() => {
  const { currentUser } = useUser();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const isBackendEnabled = !!process.env.EXPO_PUBLIC_RORK_API_BASE_URL;

  const liveProducts = useLiveProducts();
  const liveAnalytics = useLiveAnalytics(currentUser?.id);

  const products = useMemo(() => 
    isBackendEnabled ? liveProducts : { popular: [], recent: [], isLoading: false, refetch: async () => {} },
    [isBackendEnabled, liveProducts]
  );

  const analytics = useMemo(() => 
    isBackendEnabled ? liveAnalytics : { stats: undefined, isLoading: false, track: async () => {}, refetch: async () => {} },
    [isBackendEnabled, liveAnalytics]
  );

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      setIsOnline(navigator.onLine);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } else {
      const unsubscribe = NetInfo.addEventListener((state: any) => {
        setIsOnline(state.isConnected ?? false);
      });

      return () => unsubscribe();
    }
  }, []);

  const syncData = useCallback(async () => {
    try {
      console.log('Syncing data...');
      await Promise.all([
        products.refetch(),
        analytics.refetch(),
      ]);
      setLastSyncTime(new Date());
      console.log('Data synced successfully');
    } catch (error) {
      console.error('Error syncing data:', error);
    }
  }, [products, analytics]);

  useEffect(() => {
    if (isOnline && autoSync) {
      syncData();
    }
  }, [isOnline, autoSync, syncData]);

  const trackEvent = useCallback(async (
    eventType: 'scan' | 'search' | 'recall_check' | 'profile_create' | 'profile_update' | 'login' | 'signup' | 'favorite_add' | 'favorite_remove' | 'shopping_list_add' | 'shopping_list_remove',
    eventData?: Record<string, any>
  ) => {
    if (!currentUser?.id) return;
    
    try {
      await analytics.track({
        userId: currentUser.id,
        eventType,
        eventData,
      });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  }, [currentUser?.id, analytics]);

  return useMemo(() => ({
    isOnline,
    lastSyncTime,
    autoSync,
    setAutoSync,
    syncData,
    products: {
      popular: products.popular,
      recent: products.recent,
      isLoading: products.isLoading,
    },
    analytics: {
      stats: analytics.stats,
      isLoading: analytics.isLoading,
      track: trackEvent,
    },
  }), [isOnline, lastSyncTime, autoSync, syncData, products, analytics, trackEvent]);
});
