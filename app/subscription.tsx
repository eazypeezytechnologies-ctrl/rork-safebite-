import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Crown, Users, Sparkles, ChevronLeft, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSubscription, SUBSCRIPTION_PLANS } from '@/contexts/SubscriptionContext';
import { useUser } from '@/contexts/UserContext';
import { BUILD_ID } from '@/constants/appVersion';

export default function SubscriptionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();
  const {
    subscription,
    adminSettings,
    currentPlan,
    daysRemaining,
    startTrial,
    cancelSubscription,
    updateAdminSettings,
  } = useSubscription();
  
  const [selectedPlan, setSelectedPlan] = useState<'individual' | 'family'>('individual');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

  const handleStartTrial = async () => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    if (!adminSettings.subscriptionsEnabled) {
      Alert.alert(
        'Testing Mode',
        'Subscriptions are currently disabled for testing. All premium features are available.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    await startTrial(selectedPlan);
    Alert.alert(
      'Trial Started!',
      `Your 14-day free trial of ${selectedPlan === 'family' ? 'Family' : 'Individual'} plan has started.`,
      [{ text: 'Great!' }]
    );
  };

  const handleCancelSubscription = () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel? You will lose access to premium features at the end of your billing period.',
      [
        { text: 'Keep Subscription', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: async () => {
            await cancelSubscription();
            Alert.alert('Subscription Cancelled', 'Your subscription will end at the end of the current period.');
          },
        },
      ]
    );
  };

  const selectedPlanDetails = SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)!;
  const yearlyDiscount = Math.round((1 - selectedPlanDetails.yearlyPrice / (selectedPlanDetails.monthlyPrice * 12)) * 100);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Subscription',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
      >
        {!adminSettings.subscriptionsEnabled && (
          <View style={styles.testingBanner}>
            <AlertTriangle size={20} color="#92400E" />
            <View style={styles.testingBannerContent}>
              <Text style={styles.testingBannerTitle}>Testing Mode Active</Text>
              <Text style={styles.testingBannerText}>
                Billing is disabled. All premium features are available for testing.
              </Text>
            </View>
          </View>
        )}

        {subscription && (subscription.status === 'active' || subscription.status === 'trialing') && (
          <View style={styles.currentPlanCard}>
            <View style={styles.currentPlanHeader}>
              <Crown size={24} color="#F59E0B" />
              <Text style={styles.currentPlanTitle}>Current Plan</Text>
            </View>
            <Text style={styles.currentPlanName}>{currentPlan.name}</Text>
            <Text style={styles.currentPlanStatus}>
              {subscription.status === 'trialing' 
                ? `Trial ends in ${daysRemaining} days` 
                : subscription.cancelAtPeriodEnd 
                  ? `Expires in ${daysRemaining} days`
                  : 'Active'}
            </Text>
            {!subscription.cancelAtPeriodEnd && (
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCancelSubscription}
              >
                <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.header}>
          <Sparkles size={32} color="#8B5CF6" />
          <Text style={styles.title}>Unlock Premium</Text>
          <Text style={styles.subtitle}>
            Get unlimited access to all features for you and your family
          </Text>
        </View>

        <View style={styles.billingToggle}>
          <TouchableOpacity
            style={[styles.billingOption, billingCycle === 'monthly' && styles.billingOptionActive]}
            onPress={() => setBillingCycle('monthly')}
          >
            <Text style={[styles.billingOptionText, billingCycle === 'monthly' && styles.billingOptionTextActive]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.billingOption, billingCycle === 'yearly' && styles.billingOptionActive]}
            onPress={() => setBillingCycle('yearly')}
          >
            <Text style={[styles.billingOptionText, billingCycle === 'yearly' && styles.billingOptionTextActive]}>
              Yearly
            </Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>Save {yearlyDiscount}%</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.planCards}>
          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'individual' && styles.planCardSelected]}
            onPress={() => setSelectedPlan('individual')}
          >
            <View style={styles.planCardHeader}>
              <View style={styles.planIconContainer}>
                <Crown size={24} color={selectedPlan === 'individual' ? '#8B5CF6' : '#6B7280'} />
              </View>
              <Text style={styles.planCardName}>Individual</Text>
            </View>
            <Text style={styles.planCardPrice}>
              ${billingCycle === 'yearly' ? '79.99' : '9.99'}
              <Text style={styles.planCardPeriod}>/{billingCycle === 'yearly' ? 'year' : 'month'}</Text>
            </Text>
            <View style={styles.planCardFeatures}>
              {SUBSCRIPTION_PLANS[1].features.slice(0, 4).map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Check size={16} color="#10B981" />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.planCard, selectedPlan === 'family' && styles.planCardSelected, styles.familyPlanCard]}
            onPress={() => setSelectedPlan('family')}
          >
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>Most Popular</Text>
            </View>
            <View style={styles.planCardHeader}>
              <View style={[styles.planIconContainer, styles.familyPlanIcon]}>
                <Users size={24} color={selectedPlan === 'family' ? '#8B5CF6' : '#6B7280'} />
              </View>
              <Text style={styles.planCardName}>Family</Text>
            </View>
            <Text style={styles.planCardPrice}>
              ${billingCycle === 'yearly' ? '299.99' : '29.99'}
              <Text style={styles.planCardPeriod}>/{billingCycle === 'yearly' ? 'year' : 'month'}</Text>
            </Text>
            <View style={styles.planCardFeatures}>
              {SUBSCRIPTION_PLANS[2].features.slice(0, 4).map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Check size={16} color="#10B981" />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.startTrialButton}
          onPress={handleStartTrial}
        >
          <Text style={styles.startTrialButtonText}>
            Start 14-Day Free Trial
          </Text>
        </TouchableOpacity>

        <Text style={styles.trialNote}>
          No charge until trial ends. Cancel anytime.
        </Text>

        {currentUser?.isAdmin && (
          <View style={styles.adminSection}>
            <Text style={styles.adminSectionTitle}>Admin Controls</Text>
            <TouchableOpacity
              style={styles.adminToggle}
              onPress={() => updateAdminSettings({ subscriptionsEnabled: !adminSettings.subscriptionsEnabled })}
            >
              <Text style={styles.adminToggleLabel}>Enable Subscriptions</Text>
              <View style={[
                styles.adminToggleSwitch,
                adminSettings.subscriptionsEnabled && styles.adminToggleSwitchActive
              ]}>
                <View style={[
                  styles.adminToggleKnob,
                  adminSettings.subscriptionsEnabled && styles.adminToggleKnobActive
                ]} />
              </View>
            </TouchableOpacity>
            <Text style={styles.adminNote}>
              When disabled, all users have access to all premium features (testing mode).
            </Text>
          </View>
        )}

        <Text style={styles.buildId}>Build: {BUILD_ID}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  testingBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  testingBannerContent: {
    flex: 1,
  },
  testingBannerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#92400E',
    marginBottom: 4,
  },
  testingBannerText: {
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  currentPlanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  currentPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  currentPlanTitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600' as const,
  },
  currentPlanName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 4,
  },
  currentPlanStatus: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600' as const,
    marginBottom: 16,
  },
  cancelButton: {
    paddingVertical: 10,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600' as const,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  billingOption: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  billingOptionActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  billingOptionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  billingOptionTextActive: {
    color: '#111827',
  },
  saveBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  saveBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  planCards: {
    gap: 16,
    marginBottom: 24,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  planCardSelected: {
    borderColor: '#8B5CF6',
    backgroundColor: '#FAF5FF',
  },
  familyPlanCard: {
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -12,
    right: 16,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  planIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  familyPlanIcon: {
    backgroundColor: '#EDE9FE',
  },
  planCardName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
  },
  planCardPrice: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 16,
  },
  planCardPeriod: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  planCardFeatures: {
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  startTrialButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startTrialButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  trialNote: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
  adminSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  adminSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 16,
  },
  adminToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  adminToggleLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  adminToggleSwitch: {
    width: 52,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    padding: 2,
  },
  adminToggleSwitchActive: {
    backgroundColor: '#8B5CF6',
  },
  adminToggleKnob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  adminToggleKnobActive: {
    transform: [{ translateX: 20 }],
  },
  adminNote: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
  },
  buildId: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    marginTop: 24,
  },
});
