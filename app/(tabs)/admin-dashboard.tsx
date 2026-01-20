import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
} from 'react-native';
import { Stack, useRouter, Href } from 'expo-router';
import { useUser } from '@/contexts/UserContext';
import { useProfiles } from '@/contexts/ProfileContext';
import {
  Shield,
  Users,
  UserCheck,
  Database,
  Activity,
  LogOut,
  ScanLine,
  Heart,
  ShoppingCart,
  Clock,
  CheckCircle,
  Stethoscope,
  ChevronRight,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getScanHistory, ScanHistoryItem } from '@/storage/scanHistory';
import { getFavorites, FavoriteItem } from '@/storage/favorites';
import { getShoppingList, ShoppingListItem } from '@/storage/shoppingList';

interface ActivityItem {
  id: string;
  type: 'scan' | 'favorite' | 'shopping' | 'user' | 'profile';
  title: string;
  subtitle: string;
  timestamp: Date;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
}

export default function AdminDashboardScreen() {
  const { currentUser, users, signOut, refreshUsers } = useUser();
  const { profiles } = useProfiles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [storageStats, setStorageStats] = useState({
    scans: 0,
    favorites: 0,
    shoppingItems: 0,
  });

  const loadActivityData = useCallback(async () => {
    try {
      const [scanHistory, favorites, shoppingList] = await Promise.all([
        getScanHistory(),
        getFavorites(),
        getShoppingList(),
      ]);

      setStorageStats({
        scans: scanHistory.length,
        favorites: favorites.length,
        shoppingItems: shoppingList.length,
      });

      const activities: ActivityItem[] = [];

      scanHistory.slice(0, 5).forEach((item: ScanHistoryItem) => {
        activities.push({
          id: `scan-${item.id}`,
          type: 'scan',
          title: item.product?.product_name || 'Product Scanned',
          subtitle: `Scanned by ${item.profileName}`,
          timestamp: new Date(item.scannedAt),
          icon: ScanLine,
          color: '#3B82F6',
        });
      });

      favorites.slice(0, 3).forEach((item: FavoriteItem) => {
        activities.push({
          id: `fav-${item.id}`,
          type: 'favorite',
          title: item.product?.product_name || 'Product Favorited',
          subtitle: 'Added to favorites',
          timestamp: new Date(item.addedAt),
          icon: Heart,
          color: '#EF4444',
        });
      });

      shoppingList.slice(0, 3).forEach((item: ShoppingListItem) => {
        activities.push({
          id: `shop-${item.id}`,
          type: 'shopping',
          title: item.name,
          subtitle: item.checked ? 'Completed' : 'Pending',
          timestamp: new Date(item.addedAt),
          icon: ShoppingCart,
          color: '#10B981',
        });
      });

      activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      setRecentActivity(activities.slice(0, 8));
    } catch (error) {
      console.error('Error loading activity data:', error);
    }
  }, []);

  useEffect(() => {
    loadActivityData();
    refreshUsers();
  }, [loadActivityData, refreshUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([loadActivityData(), refreshUsers()]);
    setRefreshing(false);
  }, [loadActivityData, refreshUsers]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/welcome' as Href);
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const stats = [
    {
      label: 'Total Users',
      value: users.length,
      icon: Users,
      color: '#7C3AED',
      bgColor: '#EDE9FE',
    },
    {
      label: 'Admin Users',
      value: users.filter((u) => u.isAdmin).length,
      icon: Shield,
      color: '#DC2626',
      bgColor: '#FEE2E2',
    },
    {
      label: 'Regular Users',
      value: users.filter((u) => !u.isAdmin).length,
      icon: UserCheck,
      color: '#059669',
      bgColor: '#D1FAE5',
    },
    {
      label: 'Total Profiles',
      value: profiles.length,
      icon: Database,
      color: '#2563EB',
      bgColor: '#DBEAFE',
    },
  ];

  const quickActions = [
    {
      label: 'Manage Users',
      description: 'Edit accounts & permissions',
      icon: Users,
      color: '#7C3AED',
      route: 'admin-users-tab',
    },
    {
      label: 'Data Management',
      description: 'Export & import data',
      icon: Database,
      color: '#2563EB',
      route: 'admin-data',
    },
    {
      label: 'Live Monitor',
      description: 'Track errors & sessions',
      icon: Activity,
      color: '#10B981',
      route: 'admin-monitor',
    },
    {
      label: 'System Health',
      description: 'API & service status',
      icon: Stethoscope,
      color: '#F59E0B',
      route: 'admin-system-health',
    },
  ];

  const dataInsights = [
    {
      label: 'Total Scans',
      value: storageStats.scans,
      icon: ScanLine,
      color: '#3B82F6',
    },
    {
      label: 'Favorites',
      value: storageStats.favorites,
      icon: Heart,
      color: '#EF4444',
    },
    {
      label: 'Shopping Items',
      value: storageStats.shoppingItems,
      icon: ShoppingCart,
      color: '#10B981',
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <View>
          <View style={styles.headerTitleRow}>
            <Shield size={32} color="#7C3AED" />
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
          </View>
          <Text style={styles.headerSubtitle}>Welcome back, Administrator</Text>
          <Text style={styles.headerEmail}>{currentUser?.email}</Text>
        </View>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7C3AED"
          />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Overview</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <View style={[styles.statIconContainer, { backgroundColor: stat.bgColor }]}>
                  <stat.icon size={24} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Insights</Text>
          <View style={styles.insightsRow}>
            {dataInsights.map((insight, index) => (
              <View key={index} style={styles.insightCard}>
                <View style={[styles.insightIcon, { backgroundColor: `${insight.color}20` }]}>
                  <insight.icon size={20} color={insight.color} />
                </View>
                <Text style={styles.insightValue}>{insight.value}</Text>
                <Text style={styles.insightLabel}>{insight.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={styles.actionCard}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (action.route.startsWith('/')) {
                    router.push(action.route as Href);
                  } else {
                    router.push(`/(tabs)/${action.route}` as Href);
                  }
                }}
              >
                <View style={[styles.actionIcon, { backgroundColor: `${action.color}15` }]}>
                  <action.icon size={24} color={action.color} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <Text style={styles.actionDescription}>{action.description}</Text>
                <ChevronRight size={16} color="#6B7280" style={styles.actionChevron} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentActivity.length > 0 && (
              <View style={styles.activityBadge}>
                <Text style={styles.activityBadgeText}>{recentActivity.length}</Text>
              </View>
            )}
          </View>
          
          {recentActivity.length === 0 ? (
            <View style={styles.activityCard}>
              <Clock size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No recent activity</Text>
              <Text style={styles.emptySubtext}>
                Activity logs will appear here as users interact with the app
              </Text>
            </View>
          ) : (
            <View style={styles.activityList}>
              {recentActivity.map((activity) => {
                const IconComponent = activity.icon;
                return (
                  <View key={activity.id} style={styles.activityItem}>
                    <View style={[styles.activityIcon, { backgroundColor: `${activity.color}20` }]}>
                      <IconComponent size={18} color={activity.color} />
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityTitle} numberOfLines={1}>
                        {activity.title}
                      </Text>
                      <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
                    </View>
                    <Text style={styles.activityTime}>{getTimeAgo(activity.timestamp)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Status</Text>
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <CheckCircle size={20} color="#10B981" />
                <Text style={styles.statusLabel}>API</Text>
                <Text style={styles.statusValue}>Online</Text>
              </View>
              <View style={styles.statusDivider} />
              <View style={styles.statusItem}>
                <CheckCircle size={20} color="#10B981" />
                <Text style={styles.statusLabel}>Database</Text>
                <Text style={styles.statusValue}>Connected</Text>
              </View>
              <View style={styles.statusDivider} />
              <View style={styles.statusItem}>
                <CheckCircle size={20} color="#10B981" />
                <Text style={styles.statusLabel}>Storage</Text>
                <Text style={styles.statusValue}>OK</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>{Platform.OS}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Environment</Text>
              <Text style={styles.infoValue}>{__DEV__ ? 'Development' : 'Production'}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    backgroundColor: '#1F2937',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  headerEmail: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  signOutButton: {
    padding: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  activityBadge: {
    backgroundColor: '#7C3AED',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 16,
  },
  activityBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  insightsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  insightCard: {
    flex: 1,
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  insightValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  insightLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  actionDescription: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },
  actionChevron: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  activityCard: {
    backgroundColor: '#1F2937',
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    gap: 12,
  },
  activityList: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    overflow: 'hidden',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  activityTime: {
    fontSize: 11,
    color: '#6B7280',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#9CA3AF',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  statusDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#374151',
  },
  infoCard: {
    backgroundColor: '#1F2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#374151',
  },
});
