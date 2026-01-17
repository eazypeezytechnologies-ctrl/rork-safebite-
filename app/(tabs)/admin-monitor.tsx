import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  Smartphone,
  XCircle,
  AlertCircle,
  Zap,
  Users,
  TrendingUp,
  Shield,
  ScanLine,
  Heart,
  ShoppingCart,
  Database,
  Wifi,
  WifiOff,
  Eye,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useUser } from '@/contexts/UserContext';
import { useProfiles } from '@/contexts/ProfileContext';
import { getScanHistory, ScanHistoryItem } from '@/storage/scanHistory';
import { getFavorites } from '@/storage/favorites';
import { getShoppingList } from '@/storage/shoppingList';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ErrorLog {
  id: string;
  userId?: string;
  userEmail?: string;
  type: 'error' | 'warning' | 'timeout' | 'crash' | 'info';
  message: string;
  screen?: string;
  timestamp: Date;
  platform: 'ios' | 'android' | 'web';
  resolved: boolean;
}

interface UserActivity {
  userId: string;
  userEmail: string;
  type: string;
  metadata?: Record<string, any>;
  timestamp: string;
  platform: string;
}

interface LiveUser {
  id: string;
  email: string;
  isOnline: boolean;
  lastSeen: string;
  platform?: string;
  currentScreen?: string;
}

interface ActivityMetric {
  label: string;
  value: number;
  change: number;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
}

interface SystemMetric {
  label: string;
  value: string | number;
  status: 'healthy' | 'warning' | 'critical';
  icon: React.ComponentType<{ size: number; color: string }>;
}

export default function AdminMonitorScreen() {
  const insets = useSafeAreaInsets();
  const { users, currentUser, connectionStatus, refreshUsers, getRecentActivities } = useUser();
  const { profiles } = useProfiles();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [activityMetrics, setActivityMetrics] = useState<ActivityMetric[]>([]);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [storageKeys, setStorageKeys] = useState(0);
  const [liveUsers, setLiveUsers] = useState<LiveUser[]>([]);
  const [recentActivities, setRecentActivities] = useState<UserActivity[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadMonitorData = useCallback(async () => {
    try {
      const [scanHistory, favorites, shoppingList, allKeys, activities] = await Promise.all([
        getScanHistory(),
        getFavorites(),
        getShoppingList(),
        AsyncStorage.getAllKeys(),
        getRecentActivities(),
      ]);

      setStorageKeys(allKeys.length);
      setRecentScans(scanHistory.slice(0, 5));
      setRecentActivities(activities.slice(0, 10));
      
      // Fetch real users from Supabase
      try {
        await refreshUsers();
        
        // Map users to live status (simulate online status based on recent activity)
        const now = new Date();
        const liveUsersList: LiveUser[] = users.map(u => {
          const userActivities = activities.filter((a: UserActivity) => a.userId === u.id);
          const lastActivity = userActivities[0];
          const lastSeenDate = lastActivity ? new Date(lastActivity.timestamp) : new Date(u.createdAt);
          const minutesAgo = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
          
          return {
            id: u.id,
            email: u.email,
            isOnline: minutesAgo < 5, // Consider online if active in last 5 minutes
            lastSeen: lastSeenDate.toISOString(),
            platform: lastActivity?.platform,
            currentScreen: lastActivity?.metadata?.screen,
          };
        });
        setLiveUsers(liveUsersList);
      } catch (err) {
        console.log('[AdminMonitor] Error fetching users:', err);
      }

      const todayScans = scanHistory.filter(s => {
        const scanDate = new Date(s.scannedAt);
        const today = new Date();
        return scanDate.toDateString() === today.toDateString();
      }).length;

      

      setActivityMetrics([
        {
          label: 'Total Scans',
          value: scanHistory.length,
          change: todayScans,
          icon: ScanLine,
          color: '#3B82F6',
        },
        {
          label: 'Favorites',
          value: favorites.length,
          change: 0,
          icon: Heart,
          color: '#EF4444',
        },
        {
          label: 'Shopping Items',
          value: shoppingList.length,
          change: shoppingList.filter(s => !s.checked).length,
          icon: ShoppingCart,
          color: '#10B981',
        },
        {
          label: 'Profiles',
          value: profiles.length,
          change: 0,
          icon: Users,
          color: '#7C3AED',
        },
      ]);

      const logs: ErrorLog[] = [];
      
      if (connectionStatus === 'error' || connectionStatus === 'slow') {
        logs.push({
          id: 'conn-' + Date.now(),
          type: connectionStatus === 'error' ? 'error' : 'warning',
          message: connectionStatus === 'error' 
            ? 'Connection error detected' 
            : 'Slow connection detected',
          timestamp: new Date(),
          platform: Platform.OS as 'ios' | 'android' | 'web',
          resolved: false,
        });
      }

      if (scanHistory.length > 0) {
        const lastScan = scanHistory[0];
        logs.push({
          id: 'scan-' + lastScan.id,
          userEmail: currentUser?.email,
          type: 'info',
          message: `Product scanned: ${lastScan.product?.product_name || 'Unknown'}`,
          screen: 'Scan',
          timestamp: new Date(lastScan.scannedAt),
          platform: Platform.OS as 'ios' | 'android' | 'web',
          resolved: true,
        });
      }

      if (profiles.length === 0) {
        logs.push({
          id: 'no-profiles',
          type: 'warning',
          message: 'No allergy profiles created yet',
          screen: 'Profiles',
          timestamp: new Date(),
          platform: Platform.OS as 'ios' | 'android' | 'web',
          resolved: false,
        });
      }

      setErrorLogs(logs);
    } catch (error) {
      console.error('Error loading monitor data:', error);
    }
  }, [connectionStatus, currentUser?.email, profiles.length, getRecentActivities, refreshUsers, users]);

  useEffect(() => {
    loadMonitorData();
    
    // Auto-refresh every 30 seconds if enabled
    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadMonitorData();
        setLastUpdated(new Date());
      }, 30000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loadMonitorData, autoRefresh]);

  const unresolvedErrors = errorLogs.filter(e => !e.resolved && e.type !== 'info');

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    
    if (unresolvedErrors.length > 0) {
      pulse.start();
    }
    
    return () => pulse.stop();
  }, [unresolvedErrors.length, pulseAnim]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    await loadMonitorData();
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [loadMonitorData]);

  const resolveError = useCallback((errorId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setErrorLogs(prev => 
      prev.map(e => e.id === errorId ? { ...e, resolved: true } : e)
    );
  }, []);

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getErrorTypeColor = (type: ErrorLog['type']) => {
    switch (type) {
      case 'crash': return '#DC2626';
      case 'error': return '#F97316';
      case 'timeout': return '#FBBF24';
      case 'warning': return '#A78BFA';
      case 'info': return '#3B82F6';
      default: return '#9CA3AF';
    }
  };

  const getErrorTypeIcon = (type: ErrorLog['type']) => {
    switch (type) {
      case 'crash': return XCircle;
      case 'error': return AlertCircle;
      case 'timeout': return Clock;
      case 'warning': return AlertTriangle;
      case 'info': return CheckCircle;
      default: return AlertCircle;
    }
  };

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#10B981';
      case 'connecting': return '#FBBF24';
      case 'slow': return '#F97316';
      case 'error': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'slow': return 'Slow Connection';
      case 'error': return 'Connection Error';
      default: return 'Idle';
    }
  };

  const systemMetrics: SystemMetric[] = [
    {
      label: 'API Status',
      value: connectionStatus === 'error' ? 'Error' : 'Online',
      status: connectionStatus === 'error' ? 'critical' : connectionStatus === 'slow' ? 'warning' : 'healthy',
      icon: Zap,
    },
    {
      label: 'Users',
      value: users.length,
      status: 'healthy',
      icon: Users,
    },
    {
      label: 'Storage',
      value: `${storageKeys} keys`,
      status: storageKeys > 50 ? 'warning' : 'healthy',
      icon: Database,
    },
    {
      label: 'Platform',
      value: Platform.OS,
      status: 'healthy',
      icon: Smartphone,
    },
  ];

  const getStatusColor = (status: SystemMetric['status']) => {
    switch (status) {
      case 'healthy': return '#10B981';
      case 'warning': return '#FBBF24';
      case 'critical': return '#EF4444';
      default: return '#9CA3AF';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerTitleRow}>
            <Activity size={28} color="#7C3AED" />
            <Text style={styles.headerTitle}>Live Monitor</Text>
            {unresolvedErrors.length > 0 && (
              <Animated.View 
                style={[
                  styles.alertBadge,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                <Text style={styles.alertBadgeText}>{unresolvedErrors.length}</Text>
              </Animated.View>
            )}
          </View>
          <Text style={styles.headerSubtitle}>
            Last updated: {getTimeAgo(lastUpdated)}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <RefreshCw size={20} color="#7C3AED" />
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
        <View style={styles.connectionBanner}>
          <View style={[styles.connectionDot, { backgroundColor: getConnectionStatusColor() }]} />
          <Text style={styles.connectionText}>{getConnectionStatusText()}</Text>
          {currentUser && (
            <Text style={styles.connectionUser}>{currentUser.email}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Health</Text>
          <View style={styles.metricsGrid}>
            {systemMetrics.map((metric, index) => {
              const IconComponent = metric.icon;
              return (
                <View key={index} style={styles.metricCard}>
                  <View style={styles.metricHeader}>
                    <IconComponent size={18} color={getStatusColor(metric.status)} />
                    <View 
                      style={[
                        styles.statusDot, 
                        { backgroundColor: getStatusColor(metric.status) }
                      ]} 
                    />
                  </View>
                  <Text style={styles.metricValue}>{metric.value}</Text>
                  <Text style={styles.metricLabel}>{metric.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity Metrics</Text>
          <View style={styles.activityGrid}>
            {activityMetrics.map((metric, index) => {
              const IconComponent = metric.icon;
              return (
                <View key={index} style={styles.activityCard}>
                  <View style={[styles.activityIcon, { backgroundColor: `${metric.color}20` }]}>
                    <IconComponent size={20} color={metric.color} />
                  </View>
                  <Text style={styles.activityValue}>{metric.value}</Text>
                  <Text style={styles.activityLabel}>{metric.label}</Text>
                  {metric.change > 0 && (
                    <View style={styles.activityChange}>
                      <TrendingUp size={12} color="#10B981" />
                      <Text style={styles.activityChangeText}>+{metric.change} today</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Users</Text>
            <TouchableOpacity 
              style={[styles.autoRefreshBtn, autoRefresh && styles.autoRefreshBtnActive]}
              onPress={() => setAutoRefresh(!autoRefresh)}
            >
              <Eye size={14} color={autoRefresh ? '#10B981' : '#6B7280'} />
              <Text style={[styles.autoRefreshText, autoRefresh && styles.autoRefreshTextActive]}>
                {autoRefresh ? 'AUTO' : 'MANUAL'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {liveUsers.length === 0 ? (
            <View style={styles.emptyCard}>
              <Users size={32} color="#6B7280" />
              <Text style={styles.emptyText}>No users found</Text>
              <Text style={styles.emptySubtext}>Users will appear when they register</Text>
            </View>
          ) : (
            <View style={styles.usersList}>
              {liveUsers.map((user, index) => (
                <View key={index} style={styles.userCard}>
                  <View style={styles.userInfo}>
                    <View style={styles.userHeader}>
                      {user.isOnline ? (
                        <Wifi size={14} color="#10B981" />
                      ) : (
                        <WifiOff size={14} color="#6B7280" />
                      )}
                      <Text style={[styles.userStatus, user.isOnline && styles.userStatusOnline]}>
                        {user.isOnline ? 'Online' : 'Offline'}
                      </Text>
                    </View>
                    <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                    <Text style={styles.userMeta}>
                      {user.platform ? `${user.platform} • ` : ''}
                      Last seen: {getTimeAgo(new Date(user.lastSeen))}
                    </Text>
                  </View>
                  <View style={[
                    styles.onlineDot,
                    { backgroundColor: user.isOnline ? '#10B981' : '#6B7280' }
                  ]} />
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
          
          {recentActivities.length === 0 ? (
            <View style={styles.emptyCard}>
              <Activity size={32} color="#6B7280" />
              <Text style={styles.emptyText}>No recent activity</Text>
              <Text style={styles.emptySubtext}>User activity will appear here</Text>
            </View>
          ) : (
            <View style={styles.activityList}>
              {recentActivities.map((activity, index) => (
                <View key={index} style={styles.activityListCard}>
                  <View style={styles.activityIconContainer}>
                    {activity.type === 'product_scan' ? (
                      <ScanLine size={16} color="#3B82F6" />
                    ) : activity.type === 'login' ? (
                      <Users size={16} color="#10B981" />
                    ) : (
                      <Activity size={16} color="#7C3AED" />
                    )}
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityType}>
                      {activity.type === 'product_scan' ? 'Product Scanned' : 
                       activity.type === 'login' ? 'User Login' : 
                       activity.type.replace('_', ' ')}
                    </Text>
                    <Text style={styles.activityUser} numberOfLines={1}>
                      {activity.userEmail}
                    </Text>
                    {activity.metadata?.productName && (
                      <Text style={styles.activityDetail} numberOfLines={1}>
                        {activity.metadata.productName}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.activityTime}>
                    {getTimeAgo(new Date(activity.timestamp))}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Scans</Text>
          </View>
          
          {recentScans.length === 0 ? (
            <View style={styles.emptyCard}>
              <ScanLine size={32} color="#6B7280" />
              <Text style={styles.emptyText}>No recent scans</Text>
            </View>
          ) : (
            <View style={styles.scansList}>
              {recentScans.map((scan, index) => (
                <View key={index} style={styles.scanCard}>
                  <View style={styles.scanInfo}>
                    <Text style={styles.scanName} numberOfLines={1}>
                      {scan.product?.product_name || 'Unknown Product'}
                    </Text>
                    <Text style={styles.scanMeta}>
                      {scan.profileName} • {getTimeAgo(new Date(scan.scannedAt))}
                    </Text>
                  </View>
                  <View style={[
                    styles.scanBadge,
                    { backgroundColor: scan.verdict?.level === 'safe' ? '#10B98120' : '#EF444420' }
                  ]}>
                    {scan.verdict?.level === 'safe' ? (
                      <CheckCircle size={16} color="#10B981" />
                    ) : (
                      <AlertTriangle size={16} color="#EF4444" />
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>System Logs</Text>
            <Text style={styles.sectionCount}>
              {unresolvedErrors.length} unresolved
            </Text>
          </View>

          {errorLogs.length === 0 ? (
            <View style={styles.emptyCard}>
              <CheckCircle size={48} color="#10B981" />
              <Text style={styles.emptyText}>No issues detected</Text>
              <Text style={styles.emptySubtext}>All systems running smoothly</Text>
            </View>
          ) : (
            <View style={styles.errorList}>
              {errorLogs.map((error) => {
                const ErrorIcon = getErrorTypeIcon(error.type);
                const typeColor = getErrorTypeColor(error.type);
                
                return (
                  <View 
                    key={error.id} 
                    style={[
                      styles.errorCard,
                      error.resolved && styles.errorCardResolved
                    ]}
                  >
                    <View style={styles.errorHeader}>
                      <View style={[styles.errorType, { backgroundColor: `${typeColor}20` }]}>
                        <ErrorIcon size={14} color={typeColor} />
                        <Text style={[styles.errorTypeText, { color: typeColor }]}>
                          {error.type.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.errorTime}>{getTimeAgo(error.timestamp)}</Text>
                    </View>
                    
                    <Text style={[
                      styles.errorMessage,
                      error.resolved && styles.errorMessageResolved
                    ]}>
                      {error.message}
                    </Text>
                    
                    <View style={styles.errorMeta}>
                      {error.userEmail && (
                        <Text style={styles.errorMetaText}>
                          User: {error.userEmail}
                        </Text>
                      )}
                      {error.screen && (
                        <Text style={styles.errorMetaText}>
                          Screen: {error.screen}
                        </Text>
                      )}
                    </View>

                    {!error.resolved && error.type !== 'info' && (
                      <TouchableOpacity 
                        style={styles.resolveButton}
                        onPress={() => resolveError(error.id)}
                      >
                        <CheckCircle size={16} color="#10B981" />
                        <Text style={styles.resolveButtonText}>Mark Resolved</Text>
                      </TouchableOpacity>
                    )}
                    
                    {error.resolved && (
                      <View style={styles.resolvedBadge}>
                        <CheckCircle size={14} color="#6B7280" />
                        <Text style={styles.resolvedText}>Resolved</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          <View style={styles.quickStatsRow}>
            <View style={[styles.quickStat, { backgroundColor: '#7C3AED15' }]}>
              <Shield size={20} color="#7C3AED" />
              <Text style={styles.quickStatValue}>{users.length}</Text>
              <Text style={styles.quickStatLabel}>Total Users</Text>
            </View>
            <View style={[styles.quickStat, { backgroundColor: unresolvedErrors.length > 0 ? '#EF444415' : '#10B98115' }]}>
              {unresolvedErrors.length > 0 ? (
                <AlertTriangle size={20} color="#EF4444" />
              ) : (
                <CheckCircle size={20} color="#10B981" />
              )}
              <Text style={[styles.quickStatValue, { color: unresolvedErrors.length > 0 ? '#EF4444' : '#10B981' }]}>
                {unresolvedErrors.length}
              </Text>
              <Text style={styles.quickStatLabel}>Active Issues</Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1F2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  alertBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  alertBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    gap: 10,
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connectionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  connectionUser: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 'auto',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  sectionCount: {
    fontSize: 12,
    color: '#F97316',
    fontWeight: '600' as const,
    marginBottom: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B98120',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#10B981',
    letterSpacing: 1,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: 75,
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  activityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  activityCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#1F2937',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  activityValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  activityLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  activityChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  activityChangeText: {
    fontSize: 11,
    color: '#10B981',
  },
  scansList: {
    gap: 8,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  scanInfo: {
    flex: 1,
    marginRight: 12,
  },
  scanName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  scanMeta: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  scanBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickStat: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  quickStatValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  usersList: {
    gap: 8,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
  },
  userStatusOnline: {
    color: '#10B981',
  },
  userEmail: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  userMeta: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activityList: {
    gap: 8,
  },
  activityListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  activityIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityType: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  activityUser: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  activityDetail: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  activityTime: {
    fontSize: 11,
    color: '#6B7280',
  },
  autoRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  autoRefreshBtnActive: {
    backgroundColor: '#10B98120',
  },
  autoRefreshText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  autoRefreshTextActive: {
    color: '#10B981',
  },
  emptyCard: {
    backgroundColor: '#1F2937',
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#9CA3AF',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
  },
  errorList: {
    gap: 12,
  },
  errorCard: {
    backgroundColor: '#1F2937',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  errorCardResolved: {
    opacity: 0.6,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  errorType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  errorTypeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  errorTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  errorMessage: {
    fontSize: 14,
    color: '#E5E7EB',
    lineHeight: 20,
    marginBottom: 10,
  },
  errorMessageResolved: {
    textDecorationLine: 'line-through',
    color: '#6B7280',
  },
  errorMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  errorMetaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  resolveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B98120',
    paddingVertical: 10,
    borderRadius: 8,
  },
  resolveButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  resolvedText: {
    fontSize: 12,
    color: '#6B7280',
  },
});
