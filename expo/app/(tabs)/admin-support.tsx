import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter, Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  Headphones,
  AlertTriangle,
  ScanLine,
  Search,
  Package,
  UserX,
  ChevronRight,
  Eye,
  Flame,
  Clock,
  Users,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  fetchDashboardStats,
  fetchImmediateAttentionIssues,
  fetchRecentIssues,
  fetchAIWatchlistIssues,
} from '@/services/adminSupportService';
import {
  SupportIssue,
  ISSUE_TYPE_LABELS,
  SEVERITY_COLORS,
  STATUS_COLORS,
  ISSUE_STATUS_LABELS,
} from '@/types/adminSupport';

function StatCard({ label, value, icon: Icon, color, bgColor }: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
  bgColor: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color, borderLeftWidth: 3 }]}>
      <View style={[styles.statIconWrap, { backgroundColor: bgColor }]}>
        <Icon size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function IssueRow({ issue, onPress }: { issue: SupportIssue; onPress: () => void }) {
  const sevColor = SEVERITY_COLORS[issue.severity];
  const statusColor = STATUS_COLORS[issue.status];
  const timeAgo = getTimeAgo(new Date(issue.created_at));

  return (
    <TouchableOpacity style={styles.issueRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.sevDot, { backgroundColor: sevColor }]} />
      <View style={styles.issueContent}>
        <Text style={styles.issueTitle} numberOfLines={1}>
          {ISSUE_TYPE_LABELS[issue.issue_type]}
        </Text>
        <Text style={styles.issueDesc} numberOfLines={1}>
          {issue.description || issue.user_email || 'No description'}
        </Text>
      </View>
      <View style={styles.issueRight}>
        <View style={[styles.statusPill, { backgroundColor: statusColor + '20' }]}>
          <Text style={[styles.statusPillText, { color: statusColor }]}>
            {ISSUE_STATUS_LABELS[issue.status]}
          </Text>
        </View>
        <Text style={styles.issueTime}>{timeAgo}</Text>
      </View>
      <ChevronRight size={14} color="#6B7280" />
    </TouchableOpacity>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function AdminSupportDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const statsQuery = useQuery({
    queryKey: ['admin-support-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 60_000,
  });

  const immediateQuery = useQuery({
    queryKey: ['admin-support-immediate'],
    queryFn: fetchImmediateAttentionIssues,
    staleTime: 60_000,
  });

  const recentQuery = useQuery({
    queryKey: ['admin-support-recent'],
    queryFn: () => fetchRecentIssues(5),
    staleTime: 60_000,
  });

  const watchlistQuery = useQuery({
    queryKey: ['admin-support-watchlist'],
    queryFn: fetchAIWatchlistIssues,
    staleTime: 60_000,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([
      statsQuery.refetch(),
      immediateQuery.refetch(),
      recentQuery.refetch(),
      watchlistQuery.refetch(),
    ]);
    setRefreshing(false);
  }, [statsQuery, immediateQuery, recentQuery, watchlistQuery]);

  const stats = statsQuery.data;
  const isLoading = statsQuery.isLoading;

  const navigateToIssue = useCallback((id: string) => {
    router.push(`/issue-detail?id=${id}` as Href);
  }, [router]);

  const navigateToQueue = useCallback(() => {
    router.push('/issues-queue' as Href);
  }, [router]);

  const navigateToUserLookup = useCallback(() => {
    router.push('/user-lookup' as Href);
  }, [router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Headphones size={26} color="#10B981" />
          <Text style={styles.headerTitle}>Support Console</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10B981" />
        }
      >
        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#10B981" />
            <Text style={styles.loadingText}>Loading dashboard...</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsGrid}>
              <StatCard label="Open Issues" value={stats?.open_issues ?? 0} icon={AlertTriangle} color="#F59E0B" bgColor="#FEF3C7" />
              <StatCard label="Critical" value={stats?.critical_issues ?? 0} icon={Flame} color="#EF4444" bgColor="#FEE2E2" />
              <StatCard label="Scan Fails" value={stats?.scan_failures_today ?? 0} icon={ScanLine} color="#3B82F6" bgColor="#DBEAFE" />
              <StatCard label="Lookup Fails" value={stats?.product_lookup_failures ?? 0} icon={Package} color="#8B5CF6" bgColor="#EDE9FE" />
              <StatCard label="Profile Saves" value={stats?.profile_save_failures ?? 0} icon={UserX} color="#F97316" bgColor="#FFF7ED" />
              <StatCard label="Unresolved" value={stats?.unresolved_reports ?? 0} icon={Clock} color="#6366F1" bgColor="#EEF2FF" />
            </View>

            <View style={styles.quickNav}>
              <TouchableOpacity style={styles.navButton} onPress={navigateToQueue} activeOpacity={0.7}>
                <Search size={18} color="#FFFFFF" />
                <Text style={styles.navButtonText}>Issues Queue</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navButton, styles.navButtonAlt]} onPress={navigateToUserLookup} activeOpacity={0.7}>
                <Users size={18} color="#FFFFFF" />
                <Text style={styles.navButtonText}>User Lookup</Text>
              </TouchableOpacity>
            </View>

            {(immediateQuery.data?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Flame size={16} color="#EF4444" />
                  <Text style={styles.sectionTitle}>Immediate Attention</Text>
                </View>
                <View style={styles.issueList}>
                  {immediateQuery.data?.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} onPress={() => navigateToIssue(issue.id)} />
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Clock size={16} color="#3B82F6" />
                <Text style={styles.sectionTitle}>Recent Issues</Text>
                <TouchableOpacity onPress={navigateToQueue}>
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              </View>
              {(recentQuery.data?.length ?? 0) === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No issues reported yet</Text>
                </View>
              ) : (
                <View style={styles.issueList}>
                  {recentQuery.data?.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} onPress={() => navigateToIssue(issue.id)} />
                  ))}
                </View>
              )}
            </View>

            {(watchlistQuery.data?.length ?? 0) > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Eye size={16} color="#8B5CF6" />
                  <Text style={styles.sectionTitle}>AI Watchlist</Text>
                </View>
                <View style={styles.issueList}>
                  {watchlistQuery.data?.map((issue) => (
                    <IssueRow key={issue.id} issue={issue} onPress={() => navigateToIssue(issue.id)} />
                  ))}
                </View>
              </View>
            )}

            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#F1F5F9',
    letterSpacing: 0.3,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    width: '48%' as any,
    flexGrow: 1,
    flexBasis: '45%' as any,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#F1F5F9',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  quickNav: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 10,
  },
  navButtonAlt: {
    backgroundColor: '#6366F1',
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600' as const,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#E2E8F0',
    flex: 1,
  },
  seeAll: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500' as const,
  },
  issueList: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    gap: 10,
  },
  sevDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  issueContent: {
    flex: 1,
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#F1F5F9',
  },
  issueDesc: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  issueRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600' as const,
  },
  issueTime: {
    fontSize: 10,
    color: '#64748B',
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
  },
});
