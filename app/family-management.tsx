import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { Users, Plus, Trash2, Check, UserPlus, X } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { useFamily } from '@/contexts/FamilyContext';
import { FamilyGroup, Profile } from '@/types';
import * as Haptics from 'expo-haptics';

export default function FamilyManagementScreen() {
  const { profiles } = useProfiles();
  const {
    familyGroups,
    activeFamilyGroup,
    createFamilyGroup,
    updateFamilyGroup,
    deleteFamilyGroup,
    setActiveFamilyGroup,
    refreshFamilyGroups,
  } = useFamily();

  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshFamilyGroups();
    }, [refreshFamilyGroups])
  );

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('Missing Name', 'Please enter a family group name');
      return;
    }

    if (selectedMembers.length === 0) {
      Alert.alert('No Members', 'Please select at least one member');
      return;
    }

    try {
      const newGroup: FamilyGroup = {
        id: `family_${Date.now()}_${Math.random()}`,
        name: newGroupName.trim(),
        memberIds: selectedMembers,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await createFamilyGroup(newGroup);
      await setActiveFamilyGroup(newGroup.id);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setIsCreating(false);
      setNewGroupName('');
      setSelectedMembers([]);

      Alert.alert('Success', `Family group "${newGroup.name}" created!`);
    } catch (error) {
      console.error('Error creating family group:', error);
      Alert.alert('Error', 'Failed to create family group');
    }
  };

  const handleEditGroup = (group: FamilyGroup) => {
    setEditingGroupId(group.id);
    setNewGroupName(group.name);
    setSelectedMembers([...group.memberIds]);
    setIsCreating(true);
  };

  const handleUpdateGroup = async () => {
    if (!editingGroupId) return;

    if (!newGroupName.trim()) {
      Alert.alert('Missing Name', 'Please enter a family group name');
      return;
    }

    if (selectedMembers.length === 0) {
      Alert.alert('No Members', 'Please select at least one member');
      return;
    }

    try {
      const group = familyGroups.find(g => g.id === editingGroupId);
      if (!group) return;

      const updatedGroup: FamilyGroup = {
        ...group,
        name: newGroupName.trim(),
        memberIds: selectedMembers,
        updatedAt: new Date().toISOString(),
      };

      await updateFamilyGroup(updatedGroup);

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setIsCreating(false);
      setEditingGroupId(null);
      setNewGroupName('');
      setSelectedMembers([]);

      Alert.alert('Success', `Family group "${updatedGroup.name}" updated!`);
    } catch (error) {
      console.error('Error updating family group:', error);
      Alert.alert('Error', 'Failed to update family group');
    }
  };

  const handleDeleteGroup = (group: FamilyGroup) => {
    Alert.alert(
      'Delete Family Group',
      `Are you sure you want to delete "${group.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFamilyGroup(group.id);

              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }

              Alert.alert('Success', 'Family group deleted');
            } catch (error) {
              console.error('Error deleting family group:', error);
              Alert.alert('Error', 'Failed to delete family group');
            }
          },
        },
      ]
    );
  };

  const handleSelectGroup = async (groupId: string) => {
    try {
      const newGroupId = activeFamilyGroup?.id === groupId ? null : groupId;
      await setActiveFamilyGroup(newGroupId);

      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error selecting family group:', error);
      Alert.alert('Error', 'Failed to select family group');
    }
  };

  const toggleMember = (profileId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setSelectedMembers(prev =>
      prev.includes(profileId)
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setEditingGroupId(null);
    setNewGroupName('');
    setSelectedMembers([]);
  };

  const getProfileById = (id: string): Profile | undefined => {
    return profiles.find(p => p.id === id);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Family Groups',
          headerRight: () =>
            !isCreating ? (
              <TouchableOpacity onPress={() => setIsCreating(true)} style={styles.headerButton}>
                <Plus size={24} color="#0891B2" />
              </TouchableOpacity>
            ) : null,
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {isCreating ? (
          <View style={styles.createSection}>
            <View style={styles.createHeader}>
              <Text style={styles.createTitle}>
                {editingGroupId ? 'Edit Family Group' : 'Create Family Group'}
              </Text>
              <TouchableOpacity onPress={cancelCreating}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Family group name (e.g., 'Smith Family')"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />

            <Text style={styles.sectionTitle}>Select Members</Text>
            <View style={styles.membersList}>
              {profiles.length === 0 ? (
                <Text style={styles.emptyText}>No profiles available. Create profiles first.</Text>
              ) : (
                profiles.map(profile => (
                  <TouchableOpacity
                    key={profile.id}
                    style={[
                      styles.memberItem,
                      selectedMembers.includes(profile.id) && styles.memberItemSelected,
                    ]}
                    onPress={() => toggleMember(profile.id)}
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: profile.avatarColor || '#0891B2' },
                      ]}
                    >
                      <Text style={styles.avatarText}>
                        {profile.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{profile.name}</Text>
                      {profile.relationship && (
                        <Text style={styles.memberRelationship}>{profile.relationship}</Text>
                      )}
                      <Text style={styles.allergenCount}>
                        {profile.allergens.length} allergen{profile.allergens.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={styles.checkbox}>
                      {selectedMembers.includes(profile.id) && (
                        <Check size={18} color="#0891B2" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            <TouchableOpacity
              style={[styles.createButton, (!newGroupName || selectedMembers.length === 0) && styles.createButtonDisabled]}
              onPress={editingGroupId ? handleUpdateGroup : handleCreateGroup}
              disabled={!newGroupName || selectedMembers.length === 0}
            >
              <UserPlus size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>
                {editingGroupId ? 'Update Group' : 'Create Group'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {familyGroups.length === 0 ? (
              <View style={styles.emptyState}>
                <Users size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No Family Groups</Text>
                <Text style={styles.emptySubtext}>
                  Create a family group to manage allergens for multiple profiles at once
                </Text>
                <TouchableOpacity style={styles.emptyButton} onPress={() => setIsCreating(true)}>
                  <Plus size={20} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Create Family Group</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.groupsList}>
                {familyGroups.map(group => {
                  const isActive = activeFamilyGroup?.id === group.id;
                  const memberProfiles = group.memberIds
                    .map(id => getProfileById(id))
                    .filter(Boolean) as Profile[];

                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[styles.groupCard, isActive && styles.groupCardActive]}
                      onPress={() => handleSelectGroup(group.id)}
                    >
                      <View style={styles.groupHeader}>
                        <View style={styles.groupInfo}>
                          <Text style={styles.groupName}>{group.name}</Text>
                          <Text style={styles.memberCount}>
                            {memberProfiles.length} member{memberProfiles.length !== 1 ? 's' : ''}
                          </Text>
                        </View>
                        {isActive && (
                          <View style={styles.activeBadge}>
                            <Check size={16} color="#FFFFFF" />
                            <Text style={styles.activeBadgeText}>Active</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.membersPreview}>
                        {memberProfiles.slice(0, 3).map(profile => (
                          <View
                            key={profile.id}
                            style={[
                              styles.memberAvatar,
                              { backgroundColor: profile.avatarColor || '#0891B2' },
                            ]}
                          >
                            <Text style={styles.memberAvatarText}>
                              {profile.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        ))}
                        {memberProfiles.length > 3 && (
                          <View style={styles.moreCount}>
                            <Text style={styles.moreCountText}>+{memberProfiles.length - 3}</Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.groupActions}>
                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={() => handleEditGroup(group)}
                        >
                          <Text style={styles.editButtonText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleDeleteGroup(group)}
                        >
                          <Trash2 size={18} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  headerButton: {
    padding: 8,
    marginRight: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
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
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0891B2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  createSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  createHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  createTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 12,
  },
  membersList: {
    gap: 8,
    marginBottom: 20,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  memberItemSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#0891B2',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 2,
  },
  memberRelationship: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 2,
    textTransform: 'capitalize' as const,
  },
  allergenCount: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0891B2',
    padding: 14,
    borderRadius: 12,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  groupsList: {
    gap: 12,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  groupCardActive: {
    borderColor: '#0891B2',
    backgroundColor: '#F0F9FF',
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 4,
  },
  memberCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0891B2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  membersPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: -8,
    marginBottom: 12,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  moreCount: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  moreCountText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  groupActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
