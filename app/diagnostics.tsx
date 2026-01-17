import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Trash2,
  Clock,
} from 'lucide-react-native';
import {
  getErrorStats,
  resetCircuitBreaker,
  globalErrorCounter,
} from '@/utils/safeFetch';
import { globalErrorHandler } from '@/utils/globalErrorHandler';
import type { ErrorRecord } from '@/utils/safeFetch';
import type { GlobalError } from '@/utils/globalErrorHandler';

export default function DiagnosticsScreen() {
  const insets = useSafeAreaInsets();
  const [networkErrors, setNetworkErrors] = useState<ErrorRecord[]>([]);
  const [globalErrors, setGlobalErrors] = useState<GlobalError[]>([]);
  const [circuitState, setCircuitState] = useState<string>('CLOSED');
  const [totalErrors, setTotalErrors] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = () => {
    const stats = getErrorStats();
    setNetworkErrors(stats.recentErrors);
    setCircuitState(stats.circuitBreakerState);
    setTotalErrors(stats.totalErrors);
    setGlobalErrors(globalErrorHandler.getRecentErrors(10));
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    loadStats();
    setRefreshing(false);
  };

  const handleResetCircuit = () => {
    resetCircuitBreaker();
    loadStats();
  };

  const handleClearErrors = () => {
    globalErrorCounter.clearErrors();
    globalErrorHandler.clearErrors();
    loadStats();
  };

  const getCircuitColor = () => {
    switch (circuitState) {
      case 'CLOSED':
        return '#10B981';
      case 'HALF_OPEN':
        return '#F59E0B';
      case 'OPEN':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getCircuitIcon = () => {
    switch (circuitState) {
      case 'CLOSED':
        return <CheckCircle size={24} color="#10B981" />;
      case 'HALF_OPEN':
        return <AlertTriangle size={24} color="#F59E0B" />;
      case 'OPEN':
        return <XCircle size={24} color="#EF4444" />;
      default:
        return <Activity size={24} color="#6B7280" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <Stack.Screen options={{ title: 'Diagnostics' }} />
      
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Health</Text>
          
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              {getCircuitIcon()}
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Circuit Breaker</Text>
                <Text style={[styles.circuitState, { color: getCircuitColor() }]}>
                  {circuitState}
                </Text>
              </View>
            </View>
            <Text style={styles.cardDescription}>
              {circuitState === 'CLOSED' && 'All systems operational'}
              {circuitState === 'HALF_OPEN' && 'Testing connection recovery'}
              {circuitState === 'OPEN' && 'Circuit open - requests blocked'}
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <AlertTriangle size={24} color={totalErrors > 0 ? '#EF4444' : '#6B7280'} />
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Error Count (10min)</Text>
                <Text
                  style={[
                    styles.errorCount,
                    { color: totalErrors > 0 ? '#EF4444' : '#10B981' },
                  ]}
                >
                  {totalErrors}
                </Text>
              </View>
            </View>
            <Text style={styles.cardDescription}>
              {totalErrors === 0
                ? 'No errors in the last 10 minutes'
                : `${totalErrors} error${totalErrors > 1 ? 's' : ''} recorded`}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleResetCircuit}
          >
            <RefreshCw size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Reset Circuit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleClearErrors}
          >
            <Trash2 size={18} color="#EF4444" />
            <Text style={[styles.buttonText, { color: '#EF4444' }]}>Clear Errors</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Network Errors</Text>
          {networkErrors.length === 0 ? (
            <View style={styles.emptyState}>
              <CheckCircle size={48} color="#10B981" />
              <Text style={styles.emptyStateText}>No network errors</Text>
            </View>
          ) : (
            networkErrors.map((error, index) => (
              <View key={index} style={styles.errorCard}>
                <View style={styles.errorHeader}>
                  <Text style={styles.errorStatus}>
                    {error.statusCode || 'Network Error'}
                  </Text>
                  <View style={styles.errorTime}>
                    <Clock size={12} color="#6B7280" />
                    <Text style={styles.errorTimeText}>
                      {formatTimestamp(error.timestamp)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.errorUrl} numberOfLines={1}>
                  {error.url}
                </Text>
                <Text style={styles.errorMessage} numberOfLines={2}>
                  {error.error}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Global Errors</Text>
          {globalErrors.length === 0 ? (
            <View style={styles.emptyState}>
              <CheckCircle size={48} color="#10B981" />
              <Text style={styles.emptyStateText}>No global errors</Text>
            </View>
          ) : (
            globalErrors.map((error, index) => (
              <View key={index} style={styles.errorCard}>
                <View style={styles.errorHeader}>
                  <Text style={styles.errorType}>{error.type}</Text>
                  <View style={styles.errorTime}>
                    <Clock size={12} color="#6B7280" />
                    <Text style={styles.errorTimeText}>
                      {formatTimestamp(error.timestamp)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.errorMessage} numberOfLines={3}>
                  {error.message}
                </Text>
                {error.stack && (
                  <Text style={styles.errorStack} numberOfLines={3}>
                    {error.stack}
                  </Text>
                )}
                <Text style={styles.errorPlatform}>{error.platform}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.bottomSpacing} />
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
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardHeaderText: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  circuitState: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  errorCount: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  buttonPrimary: {
    backgroundColor: '#0891B2',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorStatus: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#EF4444',
  },
  errorType: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#EF4444',
    textTransform: 'uppercase',
  },
  errorTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  errorTimeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  errorUrl: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace' as const,
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: '#111827',
    marginBottom: 4,
  },
  errorStack: {
    fontSize: 11,
    color: '#6B7280',
    fontFamily: 'monospace' as const,
    marginTop: 4,
  },
  errorPlatform: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  bottomSpacing: {
    height: 32,
  },
});
