import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { User } from '@/types';
import * as UserStorage from '@/storage/users';
import { Edit2, Trash2, Save, X, Shield, ShieldOff } from 'lucide-react-native';

export default function AdminUsersScreen() {
  const { currentUser, users, refreshUsers } = useUser();
  const router = useRouter();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    email: string;
    password: string;
    isAdmin: boolean;
  }>({ email: '', password: '', isAdmin: false });
  const [isLoading, setIsLoading] = useState(false);

  if (!currentUser?.isAdmin) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Admin Users' }} />
        <View style={styles.errorContainer}>
          <Shield size={48} color="#EF4444" />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>
            You need administrator privileges to access this page.
          </Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const startEditing = (user: User) => {
    setEditingUserId(user.id);
    setEditForm({
      email: user.email,
      password: user.password || '',
      isAdmin: user.isAdmin,
    });
  };

  const cancelEditing = () => {
    setEditingUserId(null);
    setEditForm({ email: '', password: '', isAdmin: false });
  };

  const saveUser = async (userId: string) => {
    try {
      setIsLoading(true);

      if (!editForm.email.trim()) {
        Alert.alert('Error', 'Email is required');
        return;
      }

      if (!editForm.email.includes('@')) {
        Alert.alert('Error', 'Please enter a valid email address');
        return;
      }

      const allUsers = await UserStorage.getAllUsers();
      const userIndex = allUsers.findIndex((u) => u.id === userId);

      if (userIndex === -1) {
        Alert.alert('Error', 'User not found');
        return;
      }

      const emailExists = allUsers.some(
        (u) => u.email === editForm.email && u.id !== userId
      );
      if (emailExists) {
        Alert.alert('Error', 'This email is already in use by another user');
        return;
      }

      allUsers[userIndex] = {
        ...allUsers[userIndex],
        email: editForm.email,
        password: editForm.password || allUsers[userIndex].password,
        isAdmin: editForm.isAdmin,
      };

      await UserStorage.saveUsers(allUsers);

      if (currentUser.id === userId) {
        await UserStorage.setCurrentUser(allUsers[userIndex]);
      }

      await refreshUsers();
      Alert.alert('Success', 'User updated successfully');
      cancelEditing();
    } catch (error) {
      console.error('Error saving user:', error);
      Alert.alert('Error', 'Failed to update user');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (userId === currentUser.id) {
      Alert.alert('Error', 'You cannot delete your own account');
      return;
    }

    const confirmDelete = () => {
      Alert.alert(
        'Confirm Delete',
        'Are you sure you want to delete this user? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                setIsLoading(true);
                const allUsers = await UserStorage.getAllUsers();
                const filteredUsers = allUsers.filter((u) => u.id !== userId);
                await UserStorage.saveUsers(filteredUsers);
                await refreshUsers();
                Alert.alert('Success', 'User deleted successfully');
              } catch (error) {
                console.error('Error deleting user:', error);
                Alert.alert('Error', 'Failed to delete user');
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    };

    confirmDelete();
  };

  const renderUserCard = (user: User) => {
    const isEditing = editingUserId === user.id;
    const isCurrentUser = user.id === currentUser.id;

    return (
      <View key={user.id} style={styles.userCard}>
        {isEditing ? (
          <View style={styles.editForm}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={editForm.email}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, email: text })
                }
                placeholder="user@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={editForm.password}
                onChangeText={(text) =>
                  setEditForm({ ...editForm, password: text })
                }
                placeholder="Enter new password"
                secureTextEntry
                editable={!isLoading}
              />
              <Text style={styles.hint}>Leave blank to keep current password</Text>
            </View>

            <TouchableOpacity
              style={styles.adminToggle}
              onPress={() =>
                setEditForm({ ...editForm, isAdmin: !editForm.isAdmin })
              }
              disabled={isLoading}
            >
              <View style={styles.adminToggleContent}>
                {editForm.isAdmin ? (
                  <Shield size={20} color="#0891B2" />
                ) : (
                  <ShieldOff size={20} color="#6B7280" />
                )}
                <Text
                  style={[
                    styles.adminToggleText,
                    editForm.isAdmin && styles.adminToggleTextActive,
                  ]}
                >
                  Administrator
                </Text>
              </View>
              <View
                style={[
                  styles.toggle,
                  editForm.isAdmin && styles.toggleActive,
                ]}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    editForm.isAdmin && styles.toggleThumbActive,
                  ]}
                />
              </View>
            </TouchableOpacity>

            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={cancelEditing}
                disabled={isLoading}
              >
                <X size={18} color="#6B7280" />
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={() => saveUser(user.id)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Save size={18} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.userInfo}>
            <View style={styles.userHeader}>
              <View style={styles.userDetails}>
                <View style={styles.emailRow}>
                  <Text style={styles.userEmail}>{user.email}</Text>
                  {isCurrentUser && (
                    <View style={styles.currentUserBadge}>
                      <Text style={styles.currentUserText}>You</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.userId}>ID: {user.id}</Text>
                <Text style={styles.userDate}>
                  Created: {new Date(user.createdAt).toLocaleDateString()}
                </Text>
              </View>
              {user.isAdmin && (
                <View style={styles.adminBadge}>
                  <Shield size={16} color="#0891B2" />
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
            </View>

            <View style={styles.userActions}>
              <TouchableOpacity
                style={[styles.iconButton, styles.editButton]}
                onPress={() => startEditing(user)}
                disabled={isLoading}
              >
                <Edit2 size={18} color="#0891B2" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              {!isCurrentUser && (
                <TouchableOpacity
                  style={[styles.iconButton, styles.deleteButton]}
                  onPress={() => deleteUser(user.id)}
                  disabled={isLoading}
                >
                  <Trash2 size={18} color="#EF4444" />
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Admin Users' }} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>User Management</Text>
          <Text style={styles.subtitle}>
            Manage user accounts and administrator privileges
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{users.length}</Text>
              <Text style={styles.statLabel}>Total Users</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {users.filter((u) => u.isAdmin).length}
              </Text>
              <Text style={styles.statLabel}>Admins</Text>
            </View>
          </View>
        </View>

        <View style={styles.usersList}>
          {users.map((user) => renderUserCard(user))}
        </View>

        {users.length === 0 && (
          <View style={styles.emptyState}>
            <Shield size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#0891B2',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  usersList: {
    gap: 12,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userInfo: {
    gap: 16,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userDetails: {
    flex: 1,
    gap: 4,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  userEmail: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
  },
  currentUserBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentUserText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#1E40AF',
  },
  userId: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  userDate: {
    fontSize: 14,
    color: '#6B7280',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#CFFAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  adminBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0891B2',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  editButton: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0891B2',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#EF4444',
  },
  editForm: {
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
  },
  hint: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic' as const,
  },
  adminToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  adminToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminToggleText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  adminToggleTextActive: {
    color: '#0891B2',
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#D1D5DB',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#0891B2',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButton: {
    backgroundColor: '#F9FAFB',
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  saveButton: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#0891B2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
