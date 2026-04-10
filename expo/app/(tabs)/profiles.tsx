import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, RefreshControl } from 'react-native';
import React from 'react';
import { useRouter, Href } from 'expo-router';
import { Plus, User, AlertCircle, Trash2, Edit, LogOut, Shield, Users, Send, UserPlus, AlertTriangle, Sparkles, FileText, Leaf } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { useUser } from '@/contexts/UserContext';
import { getHealthItemSummary } from '@/utils/profileHealthItems';
import { getRelationshipLabel, getRelationshipIcon } from '@/constants/profileColors';
import { BUILD_ID } from '@/constants/appVersion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { shareAppInvite } from '@/utils/invites';
import { arcaneColors, arcaneShadows, arcaneRadius } from '@/constants/theme';
import { ArcaneDivider } from '@/components/ArcaneDivider';
import { useReduceMotion } from '@/contexts/ReduceMotionContext';

function SkeletonProfileCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonContent}>
        <View style={styles.skeletonIcon} />
        <View style={styles.skeletonInfo}>
          <View style={styles.skeletonName} />
          <View style={styles.skeletonAllergens} />
        </View>
      </View>
    </View>
  );
}

function ReduceMotionToggle() {
  const { reduceMotion, toggleReduceMotion } = useReduceMotion();
  return (
    <TouchableOpacity
      style={styles.settingsButton}
      onPress={toggleReduceMotion}
    >
      <Sparkles size={20} color={arcaneColors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={styles.settingsButtonText}>Reduce Motion</Text>
        <Text style={{ fontSize: 12, color: arcaneColors.textMuted, marginTop: 2 }}>
          {reduceMotion ? 'Animations minimized' : 'Animations enabled'}
        </Text>
      </View>
      <View style={[
        styles.togglePill,
        reduceMotion && styles.togglePillActive,
      ]}>
        <View style={[
          styles.toggleKnob,
          reduceMotion && styles.toggleKnobActive,
        ]} />
      </View>
    </TouchableOpacity>
  );
}

export default function ProfilesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profiles, activeProfile, setActiveProfile, deleteProfile, refreshProfiles, isLoading } = useProfiles();
  const [refreshing, setRefreshing] = React.useState(false);
  const { currentUser, signOut } = useUser();

  const handleDeleteProfile = (profileId: string, profileName: string) => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    
    Alert.alert(
      'Delete Profile',
      `Are you sure you want to delete ${profileName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProfile(profileId);
              
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch {
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
              Alert.alert('Error', 'Failed to delete profile');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/welcome' as Href);
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleAppInvite = async () => {
    try {
      const userName = currentUser?.email?.split('@')[0] || 'A friend';
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      await shareAppInvite(userName);
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error('Error sharing app invite:', error);
        Alert.alert('Error', 'Failed to share invitation');
      }
    }
  };

  const handleFamilyInviteNav = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    router.push('/family-management' as any);
  };



  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              await refreshProfiles();
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              setRefreshing(false);
            }}
            colors={[arcaneColors.primary]}
            tintColor={arcaneColors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Profiles</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              router.push('/wizard' as any);
            }}
          >
            <Plus size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.profilesList}>
            <SkeletonProfileCard />
            <SkeletonProfileCard />
          </View>
        ) : profiles.length === 0 ? (
          <View style={styles.emptyState}>
            <User size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>No profiles yet</Text>
            <Text style={styles.emptySubtext}>Create a profile to start scanning products</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/wizard' as any)}
            >
              <Text style={styles.primaryButtonText}>Create Profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.profilesList}>
            {profiles.map((profile) => (
              <TouchableOpacity
                key={profile.id}
                style={[
                  styles.profileCard,
                  activeProfile?.id === profile.id && styles.profileCardActive,
                ]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                  setActiveProfile(profile.id);
                }}
              >
                <View style={styles.profileContent}>
                  <View style={[
                    styles.profileIcon,
                    { backgroundColor: profile.avatarColor || '#0891B2' }
                  ]}>
                    <Text style={styles.profileEmoji}>{getRelationshipIcon(profile.relationship)}</Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <View style={styles.profileNameRow}>
                      <Text style={styles.profileName}>{profile.name}</Text>
                      {profile.relationship && (
                        <Text style={styles.profileRelationship}>
                          {getRelationshipLabel(profile.relationship)}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.profileAllergens}>
                      {(() => {
                        const summary = getHealthItemSummary(profile);
                        const parts: string[] = [];
                        if (summary.activeAllergens > 0) parts.push(`${summary.activeAllergens} active allergen${summary.activeAllergens !== 1 ? 's' : ''}`);
                        else parts.push(`${profile.allergens.length} allergen${profile.allergens.length !== 1 ? 's' : ''}`);
                        if (summary.resolvedAllergens > 0) parts.push(`${summary.resolvedAllergens} resolved`);
                        return parts.join(' · ');
                      })()}
                    </Text>
                    {profile.hasAnaphylaxis && (
                      <View style={styles.anaphylaxisBadge}>
                        <AlertCircle size={12} color="#DC2626" />
                        <Text style={styles.anaphylaxisText}>Anaphylaxis risk</Text>
                      </View>
                    )}
                    {profile.trackEczemaTriggers && (
                      <View style={styles.sensitivityBadge}>
                        <AlertTriangle size={12} color="#D97706" />
                        <Text style={styles.sensitivityBadgeText}>Skin Sensitivity: ON</Text>
                      </View>
                    )}
                    {(profile.dietaryRules?.length ?? 0) > 0 && (
                      <View style={styles.dietaryBadge}>
                        <Leaf size={12} color={arcaneColors.safe} />
                        <Text style={styles.dietaryBadgeText}>
                          {profile.dietaryRules?.join(', ')}
                        </Text>
                      </View>
                    )}
                  </View>
                  {activeProfile?.id === profile.id && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  )}
                </View>
                <View style={styles.profileActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push(`/edit-profile?id=${profile.id}` as any)}
                  >
                    <Edit size={20} color={arcaneColors.primary} />
                    <Text style={styles.actionButtonText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => router.push(`/profile-records?id=${profile.id}` as any)}
                  >
                    <FileText size={20} color={arcaneColors.accent} />
                    <Text style={[styles.actionButtonText, { color: arcaneColors.accent }]}>Records</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteProfile(profile.id, profile.name)}
                  >
                    <Trash2 size={20} color="#DC2626" />
                    <Text style={[styles.actionButtonText, styles.actionButtonTextDanger]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.quickActions}>
          {activeProfile && (
            <TouchableOpacity
              style={styles.emergencyButton}
              onPress={() => router.push('/emergency-card' as any)}
            >
              <AlertCircle size={24} color="#DC2626" />
              <Text style={styles.emergencyButtonText}>Emergency Card</Text>
            </TouchableOpacity>
          )}

          {profiles.length > 1 && (
            <TouchableOpacity
              style={styles.familyButton}
              onPress={() => router.push('/family-management' as any)}
            >
              <Users size={24} color="#0891B2" />
              <Text style={styles.familyButtonText}>Family Groups</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.inviteCardsRow}>
          <TouchableOpacity
            style={styles.appInviteCard}
            onPress={handleAppInvite}
            activeOpacity={0.8}
          >
            <Send size={22} color="#FFFFFF" />
            <Text style={styles.inviteCardTitle}>Invite to App</Text>
            <Text style={styles.inviteCardSubtitle}>Share download link</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.familyInviteCard}
            onPress={handleFamilyInviteNav}
            activeOpacity={0.8}
          >
            <UserPlus size={22} color="#FFFFFF" />
            <Text style={styles.inviteCardTitle}>Family Invite</Text>
            <Text style={styles.inviteCardSubtitle}>Add to family group</Text>
          </TouchableOpacity>
        </View>

        <ArcaneDivider label="Settings" variant="accent" />

        <View style={styles.settingsSection}>
          
          {currentUser && (
            <View style={styles.userInfo}>
              <Text style={styles.userInfoLabel}>Signed in as:</Text>
              <Text style={styles.userInfoEmail}>{currentUser.email}</Text>
              {currentUser.isAdmin && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
            </View>
          )
          }
          
          {currentUser?.isAdmin && (
            <TouchableOpacity
              style={[styles.settingsButton, styles.adminButton]}
              onPress={() => router.push('/admin-users' as any)}
            >
              <Shield size={20} color="#0891B2" />
              <Text style={[styles.settingsButtonText, styles.adminButtonText]}>Manage Users</Text>
            </TouchableOpacity>
          )}
          
          <ReduceMotionToggle />

          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleSignOut}
          >
            <LogOut size={20} color={arcaneColors.textSecondary} />
            <Text style={styles.settingsButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            This app is informational only. Always read labels and follow medical advice.
          </Text>
        </View>

        <Text style={styles.buildId}>Build: {BUILD_ID}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: arcaneColors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    letterSpacing: 0.5,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: arcaneColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...arcaneShadows.elevated,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: arcaneColors.primary,
    borderRadius: arcaneRadius.lg,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  profilesList: {
    gap: 16,
  },
  profileCard: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: arcaneColors.borderRune,
    ...arcaneShadows.card,
  },
  profileCardActive: {
    borderColor: arcaneColors.primary,
    backgroundColor: arcaneColors.primaryMuted,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileEmoji: {
    fontSize: 28,
  },
  profileInfo: {
    flex: 1,
  },
  profileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
  },
  profileRelationship: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  profileAllergens: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  anaphylaxisBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  anaphylaxisText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600' as const,
  },
  sensitivityBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 4,
    backgroundColor: arcaneColors.cautionMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: arcaneRadius.sm,
    alignSelf: 'flex-start' as const,
  },
  sensitivityBadgeText: {
    fontSize: 11,
    color: arcaneColors.caution,
    fontWeight: '600' as const,
  },
  activeBadge: {
    backgroundColor: arcaneColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: arcaneRadius.pill,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  profileActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: arcaneRadius.md,
    backgroundColor: arcaneColors.bgMist,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: arcaneColors.primary,
  },
  actionButtonTextDanger: {
    color: '#DC2626',
  },
  quickActions: {
    gap: 12,
    marginTop: 24,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: arcaneColors.dangerMuted,
    borderRadius: arcaneRadius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: arcaneColors.danger,
  },
  emergencyButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#DC2626',
  },
  familyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: arcaneColors.primaryMuted,
    borderRadius: arcaneRadius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: arcaneColors.primary,
  },
  familyButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: arcaneColors.primary,
  },
  settingsSection: {
    marginTop: 0,
  },
  userInfo: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: arcaneColors.border,
  },
  userInfoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  userInfoEmail: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 8,
  },
  adminBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1E40AF',
  },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: arcaneColors.border,
  },
  settingsButtonDanger: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  settingsButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  settingsButtonTextDanger: {
    color: '#DC2626',
  },
  adminButton: {
    borderColor: arcaneColors.borderRune,
    backgroundColor: arcaneColors.primaryMuted,
  },
  adminButtonText: {
    color: arcaneColors.primary,
  },
  disclaimer: {
    marginTop: 24,
    marginBottom: 32,
    padding: 16,
    backgroundColor: arcaneColors.goldMuted,
    borderRadius: arcaneRadius.lg,
    borderWidth: 1,
    borderColor: arcaneColors.borderGold,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 18,
  },
  skeletonCard: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: arcaneColors.border,
  },
  skeletonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
    marginRight: 16,
  },
  skeletonInfo: {
    flex: 1,
  },
  skeletonName: {
    width: 120,
    height: 20,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 8,
  },
  skeletonAllergens: {
    width: 80,
    height: 14,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
  },
  inviteCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  appInviteCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: arcaneColors.safe,
    borderRadius: arcaneRadius.xl,
    padding: 18,
    ...arcaneShadows.elevated,
  },
  familyInviteCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: arcaneColors.accent,
    borderRadius: arcaneRadius.xl,
    padding: 18,
    ...arcaneShadows.glow,
  },
  inviteCardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 4,
  },
  inviteCardSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  buildId: {
    fontSize: 11,
    color: arcaneColors.textMuted,
    textAlign: 'center' as const,
    marginTop: 8,
    marginBottom: 24,
  },
  togglePill: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: arcaneColors.border,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  togglePillActive: {
    backgroundColor: arcaneColors.accent,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end' as const,
  },
  dietaryBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 4,
    backgroundColor: arcaneColors.safeMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: arcaneRadius.sm,
    alignSelf: 'flex-start' as const,
  },
  dietaryBadgeText: {
    fontSize: 11,
    color: arcaneColors.safe,
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
});
