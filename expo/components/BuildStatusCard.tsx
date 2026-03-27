import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CheckCircle, AlertCircle, Server, Key, Shield, RotateCcw } from 'lucide-react-native';
import { BUILD_ID, APP_VERSION } from '@/constants/appVersion';
import { arcaneColors, arcaneRadius } from '@/constants/theme';
import { RuneCard } from '@/components/RuneCard';
import { SigilBadge } from '@/components/SigilBadge';
import { ArcaneDivider } from '@/components/ArcaneDivider';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase';
import { runSimpleConnectionCheck } from '@/utils/supabaseHealth';

interface BuildStatusCardProps {
  showDetailedChecks?: boolean;
  variant?: 'default' | 'accent';
  testID?: string;
}

interface CoreCheckState {
  anonKeyLoaded: boolean;
  authReachable: boolean | null;
  sessionRestoreComplete: boolean;
  checking: boolean;
}

export const BuildStatusCard = React.memo(function BuildStatusCard({
  showDetailedChecks = false,
  variant = 'default',
  testID,
}: BuildStatusCardProps) {
  const [coreChecks, setCoreChecks] = useState<CoreCheckState>({
    anonKeyLoaded: !!getSupabaseAnonKey(),
    authReachable: null,
    sessionRestoreComplete: false,
    checking: false,
  });

  const rawHost = getSupabaseUrl()?.replace(/https?:\/\//, '') ?? null;
  const maskedHost = rawHost
    ? rawHost.length > 12
      ? rawHost.substring(0, 6) + '······' + rawHost.substring(rawHost.length - 6)
      : rawHost.substring(0, 6) + '···'
    : null;

  const runCoreChecks = useCallback(async () => {
    setCoreChecks(prev => ({ ...prev, checking: true, authReachable: null }));
    console.log('[BuildStatusCard] Running core checks...');

    try {
      const result = await runSimpleConnectionCheck();
      setCoreChecks({
        anonKeyLoaded: !!getSupabaseAnonKey(),
        authReachable: result.ok,
        sessionRestoreComplete: true,
        checking: false,
      });
      console.log('[BuildStatusCard] Core checks complete:', result.ok ? 'PASS' : 'FAIL');
    } catch (err) {
      console.error('[BuildStatusCard] Core check error:', err);
      setCoreChecks(prev => ({
        ...prev,
        authReachable: false,
        sessionRestoreComplete: true,
        checking: false,
      }));
    }
  }, []);

  const allPassed = coreChecks.anonKeyLoaded && coreChecks.authReachable === true;
  const hasRun = coreChecks.authReachable !== null;

  return (
    <RuneCard variant={variant} testID={testID} style={styles.card}>
      <Text style={styles.title}>BUILD STATUS</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Version</Text>
        <Text style={styles.value}>v{APP_VERSION}</Text>
      </View>

      <ArcaneDivider variant="accent" style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.label}>Build</Text>
        <Text style={styles.value} numberOfLines={1}>{BUILD_ID}</Text>
      </View>

      <ArcaneDivider variant="accent" style={styles.divider} />

      <View style={styles.row}>
        <Text style={styles.label}>Host</Text>
        <Text style={styles.value} numberOfLines={1}>{maskedHost ?? 'Not configured'}</Text>
      </View>

      {showDetailedChecks && (
        <>
          <ArcaneDivider variant="accent" style={styles.divider} />

          <Text style={styles.checksTitle}>Core Checks</Text>

          <View style={styles.checkRow}>
            {coreChecks.anonKeyLoaded ? (
              <CheckCircle size={14} color={arcaneColors.safe} />
            ) : (
              <AlertCircle size={14} color={arcaneColors.danger} />
            )}
            <Text style={styles.checkLabel}>Anon key loaded</Text>
            <SigilBadge
              label={coreChecks.anonKeyLoaded ? 'Yes' : 'Missing'}
              status={coreChecks.anonKeyLoaded ? 'safe' : 'danger'}
              size="sm"
            />
          </View>

          <View style={styles.checkRow}>
            {coreChecks.checking ? (
              <ActivityIndicator size="small" color={arcaneColors.primary} />
            ) : coreChecks.authReachable === true ? (
              <CheckCircle size={14} color={arcaneColors.safe} />
            ) : coreChecks.authReachable === false ? (
              <AlertCircle size={14} color={arcaneColors.danger} />
            ) : (
              <Server size={14} color={arcaneColors.textMuted} />
            )}
            <Text style={styles.checkLabel}>/auth/v1/health reachable</Text>
            {coreChecks.authReachable !== null ? (
              <SigilBadge
                label={coreChecks.authReachable ? 'OK' : 'Fail'}
                status={coreChecks.authReachable ? 'safe' : 'danger'}
                size="sm"
              />
            ) : !coreChecks.checking ? (
              <Text style={styles.notTested}>—</Text>
            ) : null}
          </View>

          <View style={styles.checkRow}>
            {coreChecks.sessionRestoreComplete ? (
              <CheckCircle size={14} color={arcaneColors.safe} />
            ) : (
              <Key size={14} color={arcaneColors.textMuted} />
            )}
            <Text style={styles.checkLabel}>Session restore attempt</Text>
            <SigilBadge
              label={coreChecks.sessionRestoreComplete ? 'Done' : 'Pending'}
              status={coreChecks.sessionRestoreComplete ? 'safe' : 'neutral'}
              size="sm"
            />
          </View>

          {hasRun && (
            <View style={styles.overallRow}>
              <Shield size={16} color={allPassed ? arcaneColors.safe : arcaneColors.caution} />
              <Text style={[styles.overallText, { color: allPassed ? arcaneColors.safe : arcaneColors.caution }]}>
                {allPassed ? 'Build Operational' : 'Issues Detected'}
              </Text>
            </View>
          )}

          {hasRun && !allPassed && (
            <Text style={styles.continueHint}>
              You can still continue — some features may be limited.
            </Text>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={runCoreChecks}
              disabled={coreChecks.checking}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <RotateCcw size={13} color={coreChecks.checking ? arcaneColors.textMuted : arcaneColors.accent} />
              <Text style={[styles.actionText, coreChecks.checking && { color: arcaneColors.textMuted }]}>
                {coreChecks.checking ? 'Checking...' : hasRun ? 'Re-check' : 'Run Checks'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </RuneCard>
  );
});

const styles = StyleSheet.create({
  card: {
    marginBottom: 0,
  },
  title: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: arcaneColors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: arcaneColors.textSecondary,
  },
  value: {
    fontSize: 12,
    color: arcaneColors.textMuted,
    flex: 1,
    textAlign: 'right' as const,
    marginLeft: 12,
  },
  divider: {
    marginVertical: 8,
  },
  checksTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: arcaneColors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginTop: 4,
    marginBottom: 8,
  },
  checkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 4,
  },
  checkLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: arcaneColors.textSecondary,
    flex: 1,
  },
  notTested: {
    fontSize: 12,
    color: arcaneColors.textMuted,
  },
  overallRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(5, 150, 105, 0.06)',
    borderRadius: arcaneRadius.sm,
  },
  overallText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  continueHint: {
    fontSize: 11,
    color: arcaneColors.textMuted,
    textAlign: 'center' as const,
    marginTop: 6,
    lineHeight: 16,
  },
  actionRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionText: {
    fontSize: 12,
    color: arcaneColors.accent,
    fontWeight: '600' as const,
  },
});
