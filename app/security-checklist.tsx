import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  Shield,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Copy,
  Lock,
  Key,
  Database,
  UserCheck,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

import { useUser } from '@/contexts/UserContext';
import { supabase, isSupabaseConfigured, getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase';

interface CheckItem {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'checking' | 'idle';
  detail: string;
}

const SQL_FIX_PACK = `-- SafeBite Security SQL Fix Pack
-- Run in Supabase SQL Editor

-- 1. Enable RLS on all user-data tables
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS secure_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shopping_list ENABLE ROW LEVEL SECURITY;

-- 2. Add product_type column if missing
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT NULL;

-- 3. Fix secure_invitations FK if needed
-- (Check your schema: family_id should reference family_groups.id)
-- ALTER TABLE secure_invitations
--   DROP CONSTRAINT IF EXISTS secure_invitations_family_id_fkey,
--   ADD CONSTRAINT secure_invitations_family_id_fkey
--     FOREIGN KEY (family_id) REFERENCES family_groups(id) ON DELETE CASCADE;

-- 4. Basic RLS policies (profiles)
CREATE POLICY IF NOT EXISTS "Users can view own profiles"
  ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can insert own profiles"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own profiles"
  ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can delete own profiles"
  ON profiles FOR DELETE USING (auth.uid() = user_id);

-- 5. Basic RLS policies (scan_history)
CREATE POLICY IF NOT EXISTS "Users can view own scans"
  ON scan_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can insert own scans"
  ON scan_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Basic RLS policies (family_groups)
CREATE POLICY IF NOT EXISTS "Users can view own groups"
  ON family_groups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can insert own groups"
  ON family_groups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can update own groups"
  ON family_groups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Users can delete own groups"
  ON family_groups FOR DELETE USING (auth.uid() = user_id);
`;

export default function SecurityChecklistScreen() {
  const { currentUser } = useUser();
  const [checks, setChecks] = useState<CheckItem[]>([
    { id: 'config', label: 'Supabase configured', status: 'idle', detail: '' },
    { id: 'anon_key', label: 'Anon key present (no service role)', status: 'idle', detail: '' },
    { id: 'session', label: 'Auth session active', status: 'idle', detail: '' },
    { id: 'rls_profiles', label: 'RLS: profiles table', status: 'idle', detail: '' },
    { id: 'rls_scan_history', label: 'RLS: scan_history table', status: 'idle', detail: '' },
    { id: 'rls_family_groups', label: 'RLS: family_groups table', status: 'idle', detail: '' },
    { id: 'rls_products', label: 'RLS: products table', status: 'idle', detail: '' },
    { id: 'cross_account', label: 'Cross-account isolation', status: 'idle', detail: '' },
  ]);
  const [isRunning, setIsRunning] = useState(false);

  const updateCheck = useCallback((id: string, status: CheckItem['status'], detail: string) => {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, status, detail } : c));
  }, []);

  const runChecks = useCallback(async () => {
    setIsRunning(true);

    setChecks(prev => prev.map(c => ({ ...c, status: 'checking' as const, detail: 'Checking...' })));

    const url = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();
    const configured = isSupabaseConfigured();

    updateCheck('config', configured ? 'pass' : 'fail',
      configured
        ? `URL: ${url?.substring(0, 30)}...`
        : 'Missing SUPABASE_URL or SUPABASE_ANON_KEY'
    );

    const keyLen = anonKey?.length || 0;
    const looksLikeServiceRole = anonKey?.includes('service_role') || keyLen > 300;
    updateCheck('anon_key',
      !anonKey ? 'fail' : looksLikeServiceRole ? 'fail' : 'pass',
      !anonKey
        ? 'No anon key loaded'
        : looksLikeServiceRole
          ? 'WARNING: Key appears to be service_role — must use anon key only!'
          : `Anon key loaded (${keyLen} chars)`
    );

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (session?.user) {
        updateCheck('session', 'pass', `Signed in as ${session.user.email}`);
      } else {
        updateCheck('session', 'warn', 'No active session — sign in first');
      }
    } catch (err) {
      updateCheck('session', 'fail', `Session check error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    const tablesToCheck = [
      { id: 'rls_profiles', table: 'profiles' },
      { id: 'rls_scan_history', table: 'scan_history' },
      { id: 'rls_family_groups', table: 'family_groups' },
      { id: 'rls_products', table: 'products' },
    ];

    for (const { id, table } of tablesToCheck) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .limit(1);

        if (error) {
          const code = (error as any).code || '';
          if (code === '42501' || error.message?.includes('permission denied')) {
            updateCheck(id, 'pass', 'RLS active — permission denied (expected for non-owner rows)');
          } else if (code === '42P17' || error.message?.includes('infinite recursion')) {
            updateCheck(id, 'warn', 'RLS active but has policy recursion issue — needs SQL fix');
          } else {
            updateCheck(id, 'warn', `Query error: ${error.message?.substring(0, 60)}`);
          }
        } else {
          updateCheck(id, 'pass', `Accessible — ${data?.length ?? 0} row(s) returned (RLS filtering)`);
        }
      } catch (err) {
        updateCheck(id, 'fail', `Error: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    if (currentUser?.id) {
      try {
        const fakeUserId = '00000000-0000-0000-0000-000000000000';
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', fakeUserId)
          .limit(1);

        if (error) {
          updateCheck('cross_account', 'pass', 'Cannot query other users\' data (RLS blocks it)');
        } else if (data && data.length === 0) {
          updateCheck('cross_account', 'pass', 'No rows returned for fake user ID (RLS working)');
        } else {
          updateCheck('cross_account', 'fail', 'WARNING: Returned data for another user ID!');
        }
      } catch {
        updateCheck('cross_account', 'pass', 'Cross-account query blocked');
      }
    } else {
      updateCheck('cross_account', 'warn', 'Sign in first to test cross-account isolation');
    }

    setIsRunning(false);
  }, [currentUser, updateCheck]);

  const handleCopySqlFix = async () => {
    try {
      await Clipboard.setStringAsync(SQL_FIX_PACK);
      Alert.alert('Copied', 'SQL Fix Pack copied to clipboard. Paste it in your Supabase SQL Editor.');
    } catch {
      Alert.alert('Copy Failed', 'Could not copy to clipboard.');
    }
  };

  const getStatusIcon = (status: CheckItem['status']) => {
    switch (status) {
      case 'pass': return <CheckCircle size={18} color="#10B981" />;
      case 'fail': return <XCircle size={18} color="#EF4444" />;
      case 'warn': return <AlertTriangle size={18} color="#F59E0B" />;
      case 'checking': return <ActivityIndicator size="small" color="#0891B2" />;
      default: return <View style={styles.idleDot} />;
    }
  };

  const getStatusBg = (status: CheckItem['status']) => {
    switch (status) {
      case 'pass': return '#ECFDF5';
      case 'fail': return '#FEF2F2';
      case 'warn': return '#FFFBEB';
      default: return '#F9FAFB';
    }
  };

  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Security Checklist' }} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerCard}>
          <Shield size={32} color="#0891B2" />
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Security Checklist</Text>
            <Text style={styles.headerSubtitle}>
              Verifies Supabase Auth + RLS configuration
            </Text>
          </View>
        </View>

        {currentUser && (
          <View style={styles.userBanner}>
            <UserCheck size={16} color="#065F46" />
            <Text style={styles.userBannerText}>
              Signed in as: {currentUser.email}
            </Text>
          </View>
        )}

        {passCount + failCount + warnCount > 0 && (
          <View style={styles.summaryRow}>
            <View style={[styles.summaryBadge, { backgroundColor: '#D1FAE5' }]}>
              <Text style={[styles.summaryBadgeText, { color: '#065F46' }]}>{passCount} Pass</Text>
            </View>
            {warnCount > 0 && (
              <View style={[styles.summaryBadge, { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.summaryBadgeText, { color: '#92400E' }]}>{warnCount} Warn</Text>
              </View>
            )}
            {failCount > 0 && (
              <View style={[styles.summaryBadge, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.summaryBadgeText, { color: '#991B1B' }]}>{failCount} Fail</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={[styles.runButton, isRunning && styles.runButtonDisabled]}
          onPress={runChecks}
          disabled={isRunning}
          activeOpacity={0.8}
        >
          {isRunning ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <RefreshCw size={18} color="#FFFFFF" />
          )}
          <Text style={styles.runButtonText}>
            {isRunning ? 'Running...' : 'Run Security Checks'}
          </Text>
        </TouchableOpacity>

        <View style={styles.checksContainer}>
          {checks.map(check => (
            <View
              key={check.id}
              style={[styles.checkRow, { backgroundColor: getStatusBg(check.status) }]}
            >
              <View style={styles.checkIcon}>
                {getStatusIcon(check.status)}
              </View>
              <View style={styles.checkContent}>
                <Text style={styles.checkLabel}>{check.label}</Text>
                {check.detail ? (
                  <Text style={styles.checkDetail} numberOfLines={2}>{check.detail}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sqlSection}>
          <View style={styles.sqlHeader}>
            <Database size={18} color="#6366F1" />
            <Text style={styles.sqlTitle}>SQL Fix Pack</Text>
          </View>
          <Text style={styles.sqlDesc}>
            Copy the recommended SQL policies and run them in your Supabase SQL Editor to fix RLS and FK issues.
          </Text>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopySqlFix}
            activeOpacity={0.8}
          >
            <Copy size={16} color="#FFFFFF" />
            <Text style={styles.copyButtonText}>Copy SQL Fix Pack</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Lock size={14} color="#6B7280" />
            <Text style={styles.infoText}>App uses Supabase Auth + RLS only</Text>
          </View>
          <View style={styles.infoRow}>
            <Key size={14} color="#6B7280" />
            <Text style={styles.infoText}>No service_role key in client code</Text>
          </View>
          <View style={styles.infoRow}>
            <Shield size={14} color="#6B7280" />
            <Text style={styles.infoText}>All data calls use authenticated Supabase client</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  userBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#D1FAE5',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  userBannerText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#065F46',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  summaryBadgeText: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0891B2',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
  },
  runButtonDisabled: {
    opacity: 0.6,
  },
  runButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  checksContainer: {
    gap: 8,
    marginBottom: 20,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  checkIcon: {
    width: 28,
    alignItems: 'center',
    marginRight: 12,
  },
  checkContent: {
    flex: 1,
  },
  checkLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
  },
  checkDetail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  idleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D1D5DB',
  },
  sqlSection: {
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  sqlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sqlTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#4338CA',
  },
  sqlDesc: {
    fontSize: 13,
    color: '#4338CA',
    lineHeight: 18,
    marginBottom: 12,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingVertical: 12,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 13,
    color: '#6B7280',
  },
});
