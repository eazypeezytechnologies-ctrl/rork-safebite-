import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Play,
  ChevronDown,
  ChevronUp,
  Bell,
  Wrench,
  Shield,
  Database,
  Globe,
  Server,
  Zap,
  TrendingUp,
  AlertCircle,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSystemHealth, HealthCheck, SystemAction } from '@/hooks/useSystemHealth';

interface SystemHealthDashboardProps {
  compact?: boolean;
}

export default function SystemHealthDashboard({ compact = false }: SystemHealthDashboardProps) {
  const {
    runs,
    latestRun,
    alerts,
    isLoading,
    isRunning,
    triggerScan,
    acknowledgeAlert,
    resolveAlert,
    getRunDetails,
    refetch,
  } = useSystemHealth();

  const [refreshing, setRefreshing] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [runDetails, setRunDetails] = useState<{
    checks: HealthCheck[];
    actions: SystemAction[];
  } | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (alerts.length > 0) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [alerts.length, pulseAnim]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleTriggerScan = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    triggerScan();
  }, [triggerScan]);

  const handleExpandRun = useCallback(async (runId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      setRunDetails(null);
    } else {
      setExpandedRunId(runId);
      const details = await getRunDetails(runId);
      setRunDetails(details);
    }
  }, [expandedRunId, getRunDetails]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return '#10B981';
      case 'warn': return '#F59E0B';
      case 'fail': return '#EF4444';
      case 'running': return '#3B82F6';
      case 'skip': return '#6B7280';
      default: return '#9CA3AF';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return CheckCircle;
      case 'warn': return AlertTriangle;
      case 'fail': return XCircle;
      case 'running': return Activity;
      case 'skip': return Clock;
      default: return AlertCircle;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#DC2626';
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'auth': return Shield;
      case 'database': return Database;
      case 'external': return Globe;
      case 'api': return Server;
      case 'storage': return Database;
      case 'queue': return Zap;
      default: return Activity;
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const unresolvedAlerts = alerts.filter(a => !a.resolved_at);
  const criticalAlerts = unresolvedAlerts.filter(a => a.severity === 'critical' || a.severity === 'high');

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactHeader}>
          <View style={styles.compactTitleRow}>
            <Activity size={20} color="#7C3AED" />
            <Text style={styles.compactTitle}>System Health</Text>
          </View>
          {latestRun && (
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(latestRun.status)}20` }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(latestRun.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(latestRun.status) }]}>
                {latestRun.status.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.compactStats}>
          <View style={styles.compactStat}>
            <Text style={styles.compactStatValue}>{runs.length}</Text>
            <Text style={styles.compactStatLabel}>Runs</Text>
          </View>
          <View style={styles.compactDivider} />
          <View style={styles.compactStat}>
            <Text style={[styles.compactStatValue, unresolvedAlerts.length > 0 && { color: '#EF4444' }]}>
              {unresolvedAlerts.length}
            </Text>
            <Text style={styles.compactStatLabel}>Alerts</Text>
          </View>
          <View style={styles.compactDivider} />
          <View style={styles.compactStat}>
            <Text style={styles.compactStatValue}>
              {latestRun ? getTimeAgo(latestRun.started_at) : 'Never'}
            </Text>
            <Text style={styles.compactStatLabel}>Last Run</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.compactButton, isRunning && styles.compactButtonDisabled]}
          onPress={handleTriggerScan}
          disabled={isRunning}
        >
          {isRunning ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Play size={16} color="#FFFFFF" />
              <Text style={styles.compactButtonText}>Run Health Check</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />
      }
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Activity size={28} color="#7C3AED" />
          <View>
            <Text style={styles.headerTitle}>System Health</Text>
            <Text style={styles.headerSubtitle}>
              {latestRun ? `Last scan: ${getTimeAgo(latestRun.started_at)}` : 'No scans yet'}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity
          style={[styles.scanButton, isRunning && styles.scanButtonDisabled]}
          onPress={handleTriggerScan}
          disabled={isRunning}
        >
          {isRunning ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Play size={18} color="#FFFFFF" />
              <Text style={styles.scanButtonText}>Scan Now</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {criticalAlerts.length > 0 && (
        <Animated.View style={[styles.alertBanner, { transform: [{ scale: pulseAnim }] }]}>
          <Bell size={20} color="#FFFFFF" />
          <Text style={styles.alertBannerText}>
            {criticalAlerts.length} critical alert{criticalAlerts.length > 1 ? 's' : ''} require attention
          </Text>
        </Animated.View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <TrendingUp size={24} color="#10B981" />
            <Text style={styles.statValue}>
              {runs.filter(r => r.status === 'pass').length}
            </Text>
            <Text style={styles.statLabel}>Passed</Text>
          </View>
          <View style={styles.statCard}>
            <AlertTriangle size={24} color="#F59E0B" />
            <Text style={styles.statValue}>
              {runs.filter(r => r.status === 'warn').length}
            </Text>
            <Text style={styles.statLabel}>Warnings</Text>
          </View>
          <View style={styles.statCard}>
            <XCircle size={24} color="#EF4444" />
            <Text style={styles.statValue}>
              {runs.filter(r => r.status === 'fail').length}
            </Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>
          <View style={styles.statCard}>
            <Bell size={24} color="#7C3AED" />
            <Text style={styles.statValue}>{unresolvedAlerts.length}</Text>
            <Text style={styles.statLabel}>Alerts</Text>
          </View>
        </View>
      </View>

      {unresolvedAlerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Alerts</Text>
          {unresolvedAlerts.slice(0, 5).map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              <View style={styles.alertHeader}>
                <View style={[styles.severityBadge, { backgroundColor: `${getSeverityColor(alert.severity)}20` }]}>
                  <AlertTriangle size={14} color={getSeverityColor(alert.severity)} />
                  <Text style={[styles.severityText, { color: getSeverityColor(alert.severity) }]}>
                    {alert.severity.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.alertTime}>{getTimeAgo(alert.created_at)}</Text>
              </View>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertMessage}>{alert.message}</Text>
              <View style={styles.alertActions}>
                {!alert.acknowledged_at && (
                  <TouchableOpacity
                    style={styles.alertAction}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      acknowledgeAlert(alert.id);
                    }}
                  >
                    <CheckCircle size={14} color="#3B82F6" />
                    <Text style={styles.alertActionText}>Acknowledge</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.alertAction}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    resolveAlert({ alertId: alert.id });
                  }}
                >
                  <CheckCircle size={14} color="#10B981" />
                  <Text style={[styles.alertActionText, { color: '#10B981' }]}>Resolve</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Runs</Text>
        {isLoading ? (
          <ActivityIndicator size="large" color="#7C3AED" style={{ marginTop: 20 }} />
        ) : runs.length === 0 ? (
          <View style={styles.emptyState}>
            <Activity size={48} color="#6B7280" />
            <Text style={styles.emptyText}>No health runs yet</Text>
            <Text style={styles.emptySubtext}>Run a scan to see system health status</Text>
          </View>
        ) : (
          runs.slice(0, 10).map((run) => {
            const StatusIcon = getStatusIcon(run.status);
            const isExpanded = expandedRunId === run.id;

            return (
              <View key={run.id} style={styles.runCard}>
                <TouchableOpacity
                  style={styles.runHeader}
                  onPress={() => handleExpandRun(run.id)}
                >
                  <View style={styles.runHeaderLeft}>
                    <View style={[styles.runStatusIcon, { backgroundColor: `${getStatusColor(run.status)}20` }]}>
                      <StatusIcon size={18} color={getStatusColor(run.status)} />
                    </View>
                    <View>
                      <Text style={styles.runTitle}>
                        {run.trigger_type === 'scheduled' ? 'Scheduled Scan' : 'Manual Scan'}
                      </Text>
                      <Text style={styles.runTime}>{getTimeAgo(run.started_at)}</Text>
                    </View>
                  </View>
                  <View style={styles.runHeaderRight}>
                    <View style={[styles.envBadge, { backgroundColor: run.environment === 'production' ? '#EF444420' : '#3B82F620' }]}>
                      <Text style={[styles.envText, { color: run.environment === 'production' ? '#EF4444' : '#3B82F6' }]}>
                        {run.environment}
                      </Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={20} color="#6B7280" />
                    ) : (
                      <ChevronDown size={20} color="#6B7280" />
                    )}
                  </View>
                </TouchableOpacity>

                {run.summary_text && (
                  <Text style={styles.runSummary}>{run.summary_text}</Text>
                )}

                {isExpanded && runDetails && (
                  <View style={styles.runDetails}>
                    <Text style={styles.detailsTitle}>Health Checks</Text>
                    {runDetails.checks.map((check) => {
                      const CheckIcon = getStatusIcon(check.status);
                      const CategoryIcon = getCategoryIcon(check.check_category);
                      return (
                        <View key={check.id} style={styles.checkItem}>
                          <View style={styles.checkLeft}>
                            <CategoryIcon size={16} color="#6B7280" />
                            <Text style={styles.checkName}>{check.check_name}</Text>
                          </View>
                          <View style={styles.checkRight}>
                            {check.duration_ms && (
                              <Text style={styles.checkDuration}>{check.duration_ms}ms</Text>
                            )}
                            <CheckIcon size={16} color={getStatusColor(check.status)} />
                          </View>
                        </View>
                      );
                    })}

                    {runDetails.actions.length > 0 && (
                      <>
                        <Text style={[styles.detailsTitle, { marginTop: 16 }]}>Actions Taken</Text>
                        {runDetails.actions.map((action) => (
                          <View key={action.id} style={styles.actionItem}>
                            <Wrench size={16} color="#7C3AED" />
                            <View style={styles.actionInfo}>
                              <Text style={styles.actionName}>{action.action_name}</Text>
                              <Text style={styles.actionType}>{action.action_type}</Text>
                            </View>
                            <View style={[
                              styles.actionStatus,
                              { backgroundColor: action.status === 'success' ? '#10B98120' : '#EF444420' }
                            ]}>
                              <Text style={[
                                styles.actionStatusText,
                                { color: action.status === 'success' ? '#10B981' : '#EF4444' }
                              ]}>
                                {action.status}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111827' },
  content: { padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 22, fontWeight: '700' as const, color: '#FFF' },
  headerSubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  scanButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#7C3AED', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  scanButtonDisabled: { opacity: 0.6 },
  scanButtonText: { fontSize: 14, fontWeight: '600' as const, color: '#FFF' },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#DC2626', padding: 14, borderRadius: 12, marginBottom: 20 },
  alertBannerText: { fontSize: 14, fontWeight: '600' as const, color: '#FFF' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: '#FFF', marginBottom: 12 },
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: '#1F2937', padding: 14, borderRadius: 12, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#374151' },
  statValue: { fontSize: 24, fontWeight: '700' as const, color: '#FFF' },
  statLabel: { fontSize: 11, color: '#9CA3AF' },
  alertCard: { backgroundColor: '#1F2937', padding: 14, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#374151' },
  alertHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  severityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  severityText: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.5 },
  alertTime: { fontSize: 12, color: '#6B7280' },
  alertTitle: { fontSize: 15, fontWeight: '600' as const, color: '#FFF', marginBottom: 4 },
  alertMessage: { fontSize: 13, color: '#9CA3AF', lineHeight: 18, marginBottom: 12 },
  alertActions: { flexDirection: 'row', gap: 16 },
  alertAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertActionText: { fontSize: 13, fontWeight: '500' as const, color: '#3B82F6' },
  runCard: { backgroundColor: '#1F2937', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#374151', overflow: 'hidden' },
  runHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  runHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  runStatusIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  runTitle: { fontSize: 14, fontWeight: '600' as const, color: '#FFF' },
  runTime: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  runHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  envBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  envText: { fontSize: 10, fontWeight: '600' as const, textTransform: 'uppercase' as const },
  runSummary: { fontSize: 12, color: '#9CA3AF', paddingHorizontal: 14, paddingBottom: 12 },
  runDetails: { backgroundColor: '#111827', padding: 14, borderTopWidth: 1, borderTopColor: '#374151' },
  detailsTitle: { fontSize: 13, fontWeight: '600' as const, color: '#9CA3AF', marginBottom: 10 },
  checkItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  checkLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  checkName: { fontSize: 13, color: '#E5E7EB' },
  checkRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkDuration: { fontSize: 11, color: '#6B7280' },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  actionInfo: { flex: 1 },
  actionName: { fontSize: 13, color: '#E5E7EB' },
  actionType: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  actionStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  actionStatusText: { fontSize: 10, fontWeight: '600' as const, textTransform: 'uppercase' as const },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 16, fontWeight: '600' as const, color: '#9CA3AF' },
  emptySubtext: { fontSize: 13, color: '#6B7280' },
  compactContainer: { backgroundColor: '#1F2937', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#374151' },
  compactHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  compactTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactTitle: { fontSize: 16, fontWeight: '600' as const, color: '#FFF' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
  compactStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  compactStat: { flex: 1, alignItems: 'center' },
  compactStatValue: { fontSize: 18, fontWeight: '700' as const, color: '#FFF' },
  compactStatLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  compactDivider: { width: 1, height: 30, backgroundColor: '#374151' },
  compactButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', paddingVertical: 12, borderRadius: 10 },
  compactButtonDisabled: { opacity: 0.6 },
  compactButtonText: { fontSize: 14, fontWeight: '600' as const, color: '#FFF' },
});
