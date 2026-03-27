import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, Href } from 'expo-router';
import { Users, Check, X, AlertCircle, Clock } from 'lucide-react-native';
import { useUser } from '@/contexts/UserContext';
import { redeemFamilyInvite, declineSecureInvite } from '@/utils/secureInvites';
import * as Haptics from 'expo-haptics';

export default function AcceptInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { currentUser } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<'idle' | 'success' | 'declined' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleAccept = async () => {
    if (!token || !currentUser?.id) {
      Alert.alert('Error', 'You must be signed in to accept an invitation.');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await redeemFamilyInvite(token, currentUser.id);

      if (response.success) {
        if (Platform.OS !== 'web') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        setResult('success');
      } else {
        setErrorMessage(response.error || 'Failed to accept invitation');
        setResult('error');
      }
    } catch (err) {
      console.error('[AcceptInvite] Error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
      setResult('error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!token || !currentUser?.id) return;

    Alert.alert(
      'Decline Invitation',
      'Are you sure you want to decline this family group invitation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const response = await declineSecureInvite(token, currentUser.id);
              if (response.success) {
                if (Platform.OS !== 'web') {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                setResult('declined');
              } else {
                setErrorMessage(response.error || 'Failed to decline invitation');
                setResult('error');
              }
            } catch (err) {
              console.error('[AcceptInvite] Decline error:', err);
              setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred');
              setResult('error');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  if (!token) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Invalid Invite' }} />
        <View style={styles.centerContent}>
          <AlertCircle size={64} color="#DC2626" />
          <Text style={styles.errorTitle}>Invalid Invitation</Text>
          <Text style={styles.errorText}>
            This invitation link is missing or malformed. Please ask the person who invited you to send a new link.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)/(scan)' as Href)}
          >
            <Text style={styles.primaryButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Sign In Required' }} />
        <View style={styles.centerContent}>
          <Users size={64} color="#0891B2" />
          <Text style={styles.title}>Family Invitation</Text>
          <Text style={styles.subtitle}>
            You need to sign in or create an account to accept this family group invitation.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/welcome' as Href)}
          >
            <Text style={styles.primaryButtonText}>Sign In / Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (result === 'success') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Invitation Accepted' }} />
        <View style={styles.centerContent}>
          <View style={styles.successIcon}>
            <Check size={48} color="#FFFFFF" />
          </View>
          <Text style={styles.successTitle}>Welcome to the Family!</Text>
          <Text style={styles.successText}>
            You have successfully joined the family group. You can now share allergen profiles and scan products together.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)/(scan)' as Href)}
          >
            <Text style={styles.primaryButtonText}>Go to Home</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace('/family-management' as Href)}
          >
            <Text style={styles.secondaryButtonText}>View Family Groups</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (result === 'declined') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Invitation Declined' }} />
        <View style={styles.centerContent}>
          <X size={64} color="#6B7280" />
          <Text style={styles.title}>Invitation Declined</Text>
          <Text style={styles.subtitle}>
            You have declined this family group invitation. The invite link is no longer valid.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)/(scan)' as Href)}
          >
            <Text style={styles.primaryButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (result === 'error') {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Invitation Error' }} />
        <View style={styles.centerContent}>
          <AlertCircle size={64} color="#DC2626" />
          <Text style={styles.errorTitle}>Could Not Process Invite</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setResult('idle');
              setErrorMessage('');
            }}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace('/(tabs)/(scan)' as Href)}
          >
            <Text style={styles.secondaryButtonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Family Invitation' }} />
      <View style={styles.centerContent}>
        <View style={styles.inviteIconWrap}>
          <Users size={48} color="#0891B2" />
        </View>
        <Text style={styles.title}>Family Group Invitation</Text>
        <Text style={styles.subtitle}>
          You have been invited to join a family group on SafeBite. Family members can share allergen profiles and scan products together.
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Clock size={16} color="#6B7280" />
            <Text style={styles.infoText}>Invites expire after 72 hours</Text>
          </View>
          <View style={styles.infoRow}>
            <Users size={16} color="#6B7280" />
            <Text style={styles.infoText}>Maximum 6 members per family group</Text>
          </View>
        </View>

        <View style={styles.signedInAs}>
          <Text style={styles.signedInLabel}>Accepting as:</Text>
          <Text style={styles.signedInEmail}>{currentUser.email}</Text>
        </View>

        {isProcessing ? (
          <View style={styles.processingWrap}>
            <ActivityIndicator size="large" color="#0891B2" />
            <Text style={styles.processingText}>Processing invitation...</Text>
          </View>
        ) : (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <Check size={22} color="#FFFFFF" />
              <Text style={styles.acceptButtonText}>Accept Invitation</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDecline}
              activeOpacity={0.8}
            >
              <X size={22} color="#DC2626" />
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  inviteIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center' as const,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    maxWidth: 340,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  signedInAs: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#99F6E4',
    marginBottom: 28,
  },
  signedInLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  signedInEmail: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#0D9488',
  },
  actionButtons: {
    width: '100%',
    maxWidth: 340,
    gap: 12,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0891B2',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  acceptButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  declineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  processingWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  processingText: {
    fontSize: 15,
    color: '#6B7280',
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center' as const,
    marginBottom: 12,
  },
  successText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#DC2626',
    textAlign: 'center' as const,
    marginTop: 16,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: '#0891B2',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#374151',
  },
});
