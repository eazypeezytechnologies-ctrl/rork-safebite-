import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '@/contexts/UserContext';
import { UserSubscription, SubscriptionPlan } from '@/types';

const SUBSCRIPTION_STORAGE_KEY = '@safebite_subscription';
const ADMIN_SETTINGS_KEY = '@safebite_admin_settings';

interface AdminSettings {
  subscriptionsEnabled: boolean;
  testingMode: boolean;
}

interface SubscriptionPlanDetails {
  id: SubscriptionPlan;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  maxProfiles: number;
  familySharing: boolean;
  trialDays: number;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlanDetails[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      'Up to 2 allergy profiles',
      'Basic barcode scanning',
      'Search products',
      'View scan history (last 10)',
    ],
    maxProfiles: 2,
    familySharing: false,
    trialDays: 0,
  },
  {
    id: 'individual',
    name: 'Individual',
    monthlyPrice: 9.99,
    yearlyPrice: 79.99,
    features: [
      'Unlimited allergy profiles',
      'Advanced barcode scanning',
      'AI photo recognition',
      'Unlimited scan history',
      'Emergency cards',
      'Eczema trigger tracking',
      'Priority support',
    ],
    maxProfiles: 10,
    familySharing: false,
    trialDays: 14,
  },
  {
    id: 'family',
    name: 'Family',
    monthlyPrice: 29.99,
    yearlyPrice: 299.99,
    features: [
      'Everything in Individual',
      'Family sharing (up to 6 members)',
      'Shared family profiles',
      'Family scan history',
      'Family emergency cards',
      'Admin controls',
      'Priority family support',
    ],
    maxProfiles: 50,
    familySharing: true,
    trialDays: 14,
  },
];

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  subscriptionsEnabled: false,
  testingMode: true,
};

export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const { currentUser } = useUser();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [storedSubscription, storedAdminSettings] = await Promise.all([
        AsyncStorage.getItem(SUBSCRIPTION_STORAGE_KEY),
        AsyncStorage.getItem(ADMIN_SETTINGS_KEY),
      ]);

      if (storedSubscription) {
        const parsed = JSON.parse(storedSubscription);
        if (parsed.userId === currentUser?.id) {
          setSubscription(parsed);
        }
      }

      if (storedAdminSettings) {
        setAdminSettings(JSON.parse(storedAdminSettings));
      }
    } catch (error) {
      console.error('[SubscriptionContext] Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadData();
  }, [currentUser?.id, loadData]);

  const updateAdminSettings = useCallback(async (updates: Partial<AdminSettings>) => {
    try {
      const newSettings = { ...adminSettings, ...updates };
      setAdminSettings(newSettings);
      await AsyncStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(newSettings));
      console.log('[SubscriptionContext] Admin settings updated:', newSettings);
    } catch (error) {
      console.error('[SubscriptionContext] Error updating admin settings:', error);
    }
  }, [adminSettings]);

  const startTrial = useCallback(async (plan: SubscriptionPlan) => {
    if (!currentUser?.id) return;
    
    const planDetails = SUBSCRIPTION_PLANS.find(p => p.id === plan);
    if (!planDetails || planDetails.trialDays === 0) return;

    const now = new Date();
    const trialEnd = new Date(now.getTime() + planDetails.trialDays * 24 * 60 * 60 * 1000);
    
    const newSubscription: UserSubscription = {
      id: `sub_${Date.now()}`,
      userId: currentUser.id,
      plan,
      status: 'trialing',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: trialEnd.toISOString(),
      cancelAtPeriodEnd: false,
      trialEnd: trialEnd.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    setSubscription(newSubscription);
    await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(newSubscription));
    console.log('[SubscriptionContext] Trial started:', plan);
  }, [currentUser?.id]);

  const grantExtraTrialDays = useCallback(async (days: number) => {
    if (!subscription) return;
    
    const currentEnd = new Date(subscription.currentPeriodEnd);
    const newEnd = new Date(currentEnd.getTime() + days * 24 * 60 * 60 * 1000);
    
    const updatedSubscription: UserSubscription = {
      ...subscription,
      currentPeriodEnd: newEnd.toISOString(),
      trialEnd: subscription.status === 'trialing' ? newEnd.toISOString() : subscription.trialEnd,
      updatedAt: new Date().toISOString(),
    };

    setSubscription(updatedSubscription);
    await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(updatedSubscription));
    console.log('[SubscriptionContext] Extra days granted:', days);
  }, [subscription]);

  const cancelSubscription = useCallback(async () => {
    if (!subscription) return;
    
    const updatedSubscription: UserSubscription = {
      ...subscription,
      cancelAtPeriodEnd: true,
      updatedAt: new Date().toISOString(),
    };

    setSubscription(updatedSubscription);
    await AsyncStorage.setItem(SUBSCRIPTION_STORAGE_KEY, JSON.stringify(updatedSubscription));
    console.log('[SubscriptionContext] Subscription cancelled');
  }, [subscription]);

  const currentPlan = useMemo(() => {
    if (!subscription || subscription.status === 'expired' || subscription.status === 'canceled') {
      return SUBSCRIPTION_PLANS.find(p => p.id === 'free')!;
    }
    return SUBSCRIPTION_PLANS.find(p => p.id === subscription.plan) || SUBSCRIPTION_PLANS[0];
  }, [subscription]);

  const isPremium = useMemo(() => {
    if (!adminSettings.subscriptionsEnabled) return true;
    if (!subscription) return false;
    return subscription.status === 'active' || subscription.status === 'trialing';
  }, [subscription, adminSettings.subscriptionsEnabled]);

  const canAccessFeature = useCallback((feature: 'familySharing' | 'unlimitedProfiles' | 'aiRecognition' | 'eczemaTriggers') => {
    if (!adminSettings.subscriptionsEnabled) return true;
    
    switch (feature) {
      case 'familySharing':
        return currentPlan.familySharing;
      case 'unlimitedProfiles':
        return currentPlan.maxProfiles > 2;
      case 'aiRecognition':
      case 'eczemaTriggers':
        return currentPlan.id !== 'free';
      default:
        return true;
    }
  }, [currentPlan, adminSettings.subscriptionsEnabled]);

  const daysRemaining = useMemo(() => {
    if (!subscription) return 0;
    const end = new Date(subscription.currentPeriodEnd);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [subscription]);

  return useMemo(() => ({
    subscription,
    adminSettings,
    isLoading,
    currentPlan,
    isPremium,
    daysRemaining,
    plans: SUBSCRIPTION_PLANS,
    startTrial,
    grantExtraTrialDays,
    cancelSubscription,
    updateAdminSettings,
    canAccessFeature,
  }), [
    subscription,
    adminSettings,
    isLoading,
    currentPlan,
    isPremium,
    daysRemaining,
    startTrial,
    grantExtraTrialDays,
    cancelSubscription,
    updateAdminSettings,
    canAccessFeature,
  ]);
});
