import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter, Href } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import {
  Search,
  User,
  Shield,
  ChevronRight,
  X,
  Mail,
  Calendar,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { lookupUser, fetchIssuesByUser } from '@/services/adminSupportService';
import {
  SupportIssue,
  ISSUE_TYPE_LABELS,
  SEVERITY_COLORS,
  STATUS_COLORS,
  ISSUE_STATUS_LABELS,
} from '@/types/adminSupport';

interface UserResult {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export default function UserLookupScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [userIssues, setUserIssues] = useState<SupportIssue[]>([]);

  const searchMutation = useMutation({
    mutationFn: (q: string) => lookupUser(q),
  });

  const issuesMutation = useMutation({
    mutationFn: (userId: string) => fetchIssuesByUser(userId),
    onSuccess: (data) => setUserIssues(data),
  });

  const handleSearch = useCallback(() => {
    if (query.trim().length < 2) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedUser(null);
    setUserIssues([]);
    searchMutation.mutate(query.trim());
  }, [query, searchMutation]);

  const handleSelectUser = useCallback((user: UserResult) => {
    setSelectedUser(user);
    issuesMutation.mutate(user.id);
  }, [issuesMutation]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'User Lookup', headerStyle: { backgroundColor: '#1E293B' }, headerTintColor: '#F1F5F9', headerTitleStyle: { color: '#F1F5F9' } }} />

      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Search size={16} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by email or user ID..."
              placeholderTextColor="#64748B"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(''); setSelectedUser(null); setUserIssues([]); }}>
                <X size={16} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={query.trim().length < 2}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {searchMutation.isPending && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#10B981" />
        </View>
      )}

      {!selectedUser && searchMutation.data && searchMutation.data.length > 0 && (
        <FlatList
          data={searchMutation.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <Text style={styles.resultHeader}>{searchMutation.data.length} user(s) found</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userCard} onPress={() => handleSelectUser(item)} activeOpacity={0.7}>
              <View style={[styles.userAvatar, item.is_admin && styles.userAvatarAdmin]}>
                {item.is_admin ? <Shield size={18} color="#8B5CF6" /> : <User size={18} color="#3B82F6" />}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userEmail}>{item.email}</Text>
                <Text style={styles.userId}>{item.id.substring(0, 8)}...</Text>
              </View>
              {item.is_admin && (
                <View style={styles.adminBadge}>
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
              <ChevronRight size={14} color="#64748B" />
            </TouchableOpacity>
          )}
        />
      )}

      {!selectedUser && searchMutation.data && searchMutation.data.length === 0 && (
        <View style={styles.emptyWrap}>
          <AlertCircle size={32} color="#64748B" />
          <Text style={styles.emptyText}>No users found</Text>
        </View>
      )}

      {selectedUser && (
        <FlatList
          data={userIssues}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <View style={styles.selectedUserCard}>
                <View style={[styles.userAvatar, selectedUser.is_admin && styles.userAvatarAdmin]}>
                  {selectedUser.is_admin ? <Shield size={20} color="#8B5CF6" /> : <User size={20} color="#3B82F6" />}
                </View>
                <View style={styles.selectedUserInfo}>
                  <Text style={styles.selectedUserEmail}>{selectedUser.email}</Text>
                  <View style={styles.selectedUserMeta}>
                    <Mail size={12} color="#64748B" />
                    <Text style={styles.selectedUserMetaText}>{selectedUser.id.substring(0, 16)}...</Text>
                  </View>
                  <View style={styles.selectedUserMeta}>
                    <Calendar size={12} color="#64748B" />
                    <Text style={styles.selectedUserMetaText}>Joined {new Date(selectedUser.created_at).toLocaleDateString()}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => { setSelectedUser(null); setUserIssues([]); }}>
                  <X size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>
                Issues ({userIssues.length})
              </Text>

              {issuesMutation.isPending && (
                <ActivityIndicator size="small" color="#10B981" style={{ marginVertical: 20 }} />
              )}
            </View>
          }
          renderItem={({ item }) => {
            const sevColor = SEVERITY_COLORS[item.severity];
            const statusColor = STATUS_COLORS[item.status];
            return (
              <TouchableOpacity
                style={styles.issueCard}
                onPress={() => router.push(`/issue-detail?id=${item.id}` as Href)}
                activeOpacity={0.7}
              >
                <View style={styles.issueTop}>
                  <View style={[styles.sevDot, { backgroundColor: sevColor }]} />
                  <Text style={styles.issueType}>{ISSUE_TYPE_LABELS[item.issue_type]}</Text>
                  <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusPillText, { color: statusColor }]}>{ISSUE_STATUS_LABELS[item.status]}</Text>
                  </View>
                </View>
                <Text style={styles.issueDesc} numberOfLines={2}>{item.description || 'No description'}</Text>
                <Text style={styles.issueTime}>{new Date(item.created_at).toLocaleDateString()}</Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            !issuesMutation.isPending ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No issues for this user</Text>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  searchSection: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F1F5F9',
    fontSize: 15,
    paddingVertical: 10,
  },
  searchBtn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 18,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  resultHeader: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3B82F620',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarAdmin: {
    backgroundColor: '#8B5CF620',
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#F1F5F9',
  },
  userId: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  adminBadge: {
    backgroundColor: '#8B5CF620',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  adminBadgeText: {
    fontSize: 11,
    color: '#8B5CF6',
    fontWeight: '600' as const,
  },
  selectedUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 14,
  },
  selectedUserInfo: {
    flex: 1,
    gap: 4,
  },
  selectedUserEmail: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#F1F5F9',
  },
  selectedUserMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedUserMetaText: {
    fontSize: 12,
    color: '#64748B',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#E2E8F0',
    marginBottom: 10,
  },
  issueCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  issueTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sevDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  issueType: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#F1F5F9',
    flex: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  issueDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 6,
  },
  issueTime: {
    fontSize: 11,
    color: '#64748B',
  },
  emptyWrap: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
});
