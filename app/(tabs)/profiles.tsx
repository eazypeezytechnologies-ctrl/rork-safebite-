import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, RefreshControl } from 'react-native';
import React from 'react';
import { useRouter } from 'expo-router';
import { Plus, User, AlertCircle, Trash2, Edit, LogOut, Shield, Users, Send, UserPlus, AlertTriangle } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { useUser } from '@/contexts/UserContext';
import { getRelationshipLabel, getRelationshipIcon } from '@/constants/profileColors';
import { BUILD_ID } from '@/constants/appVersion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { shareAppInvite } from '@/utils/invites';

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
              router.replace('/welcome');
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
            colors={['#0891B2']}
            tintColor="#0891B2"
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
                      {profile.allergens.length} allergen{profile.allergens.length !== 1 ? 's' : ''}
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
                    <Edit size={20} color="#0891B2" />
                    <Text style={styles.actionButtonText}>Edit</Text>
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

        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Settings</Text>
          
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
          
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={handleSignOut}
          >
            <LogOut size={20} color="#6B7280" />
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
    backgroundColor: '#F9FAFB',
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
    color: '#111827',
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
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
    backgroundColor: '#0891B2',
    borderRadius: 12,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileCardActive: {
    borderColor: '#0891B2',
    backgroundColor: '#F0FDFA',
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
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start' as const,
  },
  sensitivityBadgeText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600' as const,
  },
  activeBadge: {
    backgroundColor: '#0891B2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
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
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0891B2',
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
    backgroundColor: '#FEE2E2',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#DC2626',
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
    backgroundColor: '#DBEAFE',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#0891B2',
  },
  familyButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0891B2',
  },
  settingsSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  settingsSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 16,
  },
  userInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
  },
  adminButtonText: {
    color: '#0891B2',
  },
  disclaimer: {
    marginTop: 24,
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 18,
  },
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
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
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  familyInviteCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
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
    color: '#9CA3AF',
    textAlign: 'center' as const,
    marginTop: 8,
    marginBottom: 24,
  },
});
