import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter, Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  Filter,
  Search,
  ChevronRight,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { fetchIssues } from '@/services/adminSupportService';
import {
  SupportIssue,
  IssueStatus,
  IssueSeverity,
  IssueType,
  ISSUE_TYPE_LABELS,
  ISSUE_STATUS_LABELS,
  SEVERITY_LABELS,
  SEVERITY_COLORS,
  STATUS_COLORS,
} from '@/types/adminSupport';

const STATUS_OPTIONS: IssueStatus[] = ['new', 'investigating', 'waiting_on_user', 'resolved'];
const SEVERITY_OPTIONS: IssueSeverity[] = ['critical', 'high', 'medium', 'low'];

export default function IssuesQueueScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<IssueStatus | undefined>(undefined);
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const issuesQuery = useQuery({
    queryKey: ['admin-issues-queue', statusFilter, severityFilter, search],
    queryFn: () => fetchIssues({
      status: statusFilter,
      severity: severityFilter,
      search: search.length >= 2 ? search : undefined,
      limit: 50,
    }),
    staleTime: 30_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await issuesQuery.refetch();
    setRefreshing(false);
  }, [issuesQuery]);

  const clearFilters = useCallback(() => {
    setStatusFilter(undefined);
    setSeverityFilter(undefined);
    setSearch('');
  }, []);

  const hasFilters = !!statusFilter || !!severityFilter || search.length >= 2;

  const renderItem = useCallback(({ item }: { item: SupportIssue }) => {
    const sevColor = SEVERITY_COLORS[item.severity];
    const statusColor = STATUS_COLORS[item.status];
    const timeAgo = getTimeAgo(new Date(item.created_at));

    return (
      <TouchableOpacity
        style={styles.issueCard}
        onPress={() => router.push(`/issue-detail?id=${item.id}` as Href)}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={[styles.sevBadge, { backgroundColor: sevColor + '20' }]}>
            <View style={[styles.sevDot, { backgroundColor: sevColor }]} />
            <Text style={[styles.sevText, { color: sevColor }]}>{SEVERITY_LABELS[item.severity]}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{ISSUE_STATUS_LABELS[item.status]}</Text>
          </View>
        </View>

        <Text style={styles.issueType}>{ISSUE_TYPE_LABELS[item.issue_type]}</Text>
        <Text style={styles.issueDesc} numberOfLines={2}>{item.description || 'No description provided'}</Text>

        <View style={styles.cardBottom}>
          <Text style={styles.cardMeta}>{item.user_email || 'Unknown user'}</Text>
          <Text style={styles.cardTime}>{timeAgo}</Text>
        </View>

        {item.ai_summary ? (
          <View style={styles.aiRow}>
            <Text style={styles.aiLabel}>AI:</Text>
            <Text style={styles.aiText} numberOfLines={1}>{item.ai_summary}</Text>
          </View>
        ) : null}

        <ChevronRight size={14} color="#64748B" style={styles.chevron} />
      </TouchableOpacity>
    );
  }, [router]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Issues Queue', headerStyle: { backgroundColor: '#1E293B' }, headerTintColor: '#F1F5F9', headerTitleStyle: { color: '#F1F5F9' } }} />

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Search size={16} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search issues..."
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <X size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={18} color={showFilters ? '#FFFFFF' : '#94A3B8'} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterChips}>
              {STATUS_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, statusFilter === s && { backgroundColor: STATUS_COLORS[s] + '30' }]}
                  onPress={() => setStatusFilter(statusFilter === s ? undefined : s)}
                >
                  <Text style={[styles.chipText, statusFilter === s && { color: STATUS_COLORS[s] }]}>
                    {ISSUE_STATUS_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Severity</Text>
            <View style={styles.filterChips}>
              {SEVERITY_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, severityFilter === s && { backgroundColor: SEVERITY_COLORS[s] + '30' }]}
                  onPress={() => setSeverityFilter(severityFilter === s ? undefined : s)}
                >
                  <Text style={[styles.chipText, severityFilter === s && { color: SEVERITY_COLORS[s] }]}>
                    {SEVERITY_LABELS[s]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {hasFilters && (
            <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
              <Text style={styles.clearBtnText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.resultBar}>
        <Text style={styles.resultCount}>
          {issuesQuery.data?.total ?? 0} issue{(issuesQuery.data?.total ?? 0) !== 1 ? 's' : ''}
        </Text>
      </View>

      {issuesQuery.isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#10B981" />
        </View>
      ) : (
        <FlatList
          data={issuesQuery.data?.issues ?? []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No issues found</Text>
              <Text style={styles.emptySubtext}>
                {hasFilters ? 'Try adjusting your filters' : 'All clear!'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
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
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#3B82F6',
  },
  filtersPanel: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  filterSection: {
    marginBottom: 10,
  },
  filterLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600' as const,
    marginBottom: 6,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  chipText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500' as const,
  },
  clearBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  clearBtnText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '500' as const,
  },
  resultBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultCount: {
    fontSize: 13,
    color: '#64748B',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  issueCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative' as const,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  sevBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  sevDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sevText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  issueType: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#F1F5F9',
    marginBottom: 4,
  },
  issueDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 10,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  cardTime: {
    fontSize: 12,
    color: '#64748B',
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 6,
  },
  aiLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#8B5CF6',
  },
  aiText: {
    fontSize: 12,
    color: '#94A3B8',
    flex: 1,
  },
  chevron: {
    position: 'absolute' as const,
    top: 14,
    right: 14,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#94A3B8',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748B',
  },
});
