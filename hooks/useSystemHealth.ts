import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface HealthRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'pass' | 'warn' | 'fail';
  environment: string;
  trigger_type: 'scheduled' | 'manual' | 'webhook';
  triggered_by: string | null;
  summary_text: string | null;
  created_at: string;
}

export interface HealthCheck {
  id: string;
  run_id: string;
  check_name: string;
  check_category: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  duration_ms: number | null;
  details: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
}

export interface SystemAction {
  id: string;
  run_id: string;
  action_name: string;
  action_type: 'remediation' | 'cleanup' | 'notification';
  status: 'pending' | 'success' | 'failed';
  target_entity: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface SystemAlert {
  id: string;
  run_id: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  details: Record<string, unknown>;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export interface ErrorEvent {
  id: string;
  user_id: string | null;
  source: 'client' | 'server';
  severity: string;
  error_type: string | null;
  message: string;
  stack_hash: string | null;
  component: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export function useSystemHealth() {
  const queryClient = useQueryClient();

  const runsQuery = useQuery({
    queryKey: ['system-health-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_health_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as HealthRun[];
    },
    staleTime: 30000,
  });

  const latestRunQuery = useQuery({
    queryKey: ['system-health-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_health_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as HealthRun | null;
    },
    staleTime: 30000,
  });

  const alertsQuery = useQuery({
    queryKey: ['system-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_alerts')
        .select('*')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as SystemAlert[];
    },
    staleTime: 30000,
  });

  const getRunDetails = useCallback(async (runId: string) => {
    const [checksResult, actionsResult] = await Promise.all([
      supabase
        .from('system_health_checks')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: true }),
      supabase
        .from('system_actions')
        .select('*')
        .eq('run_id', runId)
        .order('created_at', { ascending: true }),
    ]);

    return {
      checks: (checksResult.data || []) as HealthCheck[],
      actions: (actionsResult.data || []) as SystemAction[],
    };
  }, []);

  const triggerScanMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const { data, error } = await supabase
        .from('system_health_runs')
        .insert({
          status: 'running',
          trigger_type: 'manual',
          triggered_by: userId,
          environment: __DEV__ ? 'development' : 'production',
        })
        .select()
        .single();

      if (error) throw error;

      // Simulate running checks (in production, this would call the Edge Function)
      const runId = data.id;
      const checks = await runHealthChecks(runId);

      // Calculate overall status
      const failCount = checks.filter(c => c.status === 'fail').length;
      const warnCount = checks.filter(c => c.status === 'warn').length;
      const status = failCount > 0 ? 'fail' : warnCount > 0 ? 'warn' : 'pass';

      // Update run
      await supabase
        .from('system_health_runs')
        .update({
          finished_at: new Date().toISOString(),
          status,
          summary_text: `${checks.length} checks: ${checks.filter(c => c.status === 'pass').length} passed, ${warnCount} warnings, ${failCount} failures`,
        })
        .eq('id', runId);

      return { runId, status, checks };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-health-runs'] });
      queryClient.invalidateQueries({ queryKey: ['system-health-latest'] });
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] });
    },
  });

  const acknowledgeAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const { error } = await supabase
        .from('system_alerts')
        .update({
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: userId,
        })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] });
    },
  });

  const resolveAlert = useMutation({
    mutationFn: async ({ alertId, notes }: { alertId: string; notes?: string }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;

      const { error } = await supabase
        .from('system_alerts')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
          resolution_notes: notes,
        })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-alerts'] });
    },
  });

  return {
    runs: runsQuery.data || [],
    latestRun: latestRunQuery.data,
    alerts: alertsQuery.data || [],
    isLoading: runsQuery.isLoading || alertsQuery.isLoading,
    isRunning: triggerScanMutation.isPending,
    error: runsQuery.error || alertsQuery.error,
    getRunDetails,
    triggerScan: triggerScanMutation.mutate,
    acknowledgeAlert: acknowledgeAlert.mutate,
    resolveAlert: resolveAlert.mutate,
    refetch: () => {
      runsQuery.refetch();
      alertsQuery.refetch();
      latestRunQuery.refetch();
    },
  };
}

async function runHealthChecks(runId: string): Promise<HealthCheck[]> {
  const checks: Partial<HealthCheck>[] = [];

  // Auth check
  const authStart = Date.now();
  try {
    const { error } = await supabase.auth.getSession();
    checks.push({
      run_id: runId,
      check_name: 'Auth Configuration',
      check_category: 'auth',
      status: error ? 'warn' : 'pass',
      duration_ms: Date.now() - authStart,
      details: { sessionAccessible: !error },
    });
  } catch (e) {
    checks.push({
      run_id: runId,
      check_name: 'Auth Configuration',
      check_category: 'auth',
      status: 'fail',
      duration_ms: Date.now() - authStart,
      details: {},
      error_message: String(e),
    });
  }

  // Database check
  const dbStart = Date.now();
  try {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    checks.push({
      run_id: runId,
      check_name: 'Database Connectivity',
      check_category: 'database',
      status: error ? 'fail' : 'pass',
      duration_ms: Date.now() - dbStart,
      details: { userCount: count || 0 },
      error_message: error?.message,
    });
  } catch (e) {
    checks.push({
      run_id: runId,
      check_name: 'Database Connectivity',
      check_category: 'database',
      status: 'fail',
      duration_ms: Date.now() - dbStart,
      details: {},
      error_message: String(e),
    });
  }

  // API check - OpenFoodFacts
  const apiStart = Date.now();
  try {
    const response = await fetch('https://world.openfoodfacts.org/api/v2/product/737628064502.json', {
      method: 'GET',
      headers: { 'User-Agent': 'SafeBite-HealthCheck/1.0' },
    });
    
    checks.push({
      run_id: runId,
      check_name: 'External API (OpenFoodFacts)',
      check_category: 'external',
      status: response.ok || response.status === 404 ? 'pass' : 'warn',
      duration_ms: Date.now() - apiStart,
      details: { statusCode: response.status, latencyMs: Date.now() - apiStart },
    });
  } catch (e) {
    checks.push({
      run_id: runId,
      check_name: 'External API (OpenFoodFacts)',
      check_category: 'external',
      status: 'fail',
      duration_ms: Date.now() - apiStart,
      details: {},
      error_message: String(e),
    });
  }

  // Storage check
  const storageStart = Date.now();
  try {
    const { count: productCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    const { count: errorCount } = await supabase
      .from('app_error_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    checks.push({
      run_id: runId,
      check_name: 'Storage Health',
      check_category: 'storage',
      status: (productCount || 0) > 50000 ? 'warn' : 'pass',
      duration_ms: Date.now() - storageStart,
      details: { 
        cachedProducts: productCount || 0, 
        errorsLast24h: errorCount || 0 
      },
    });
  } catch (e) {
    checks.push({
      run_id: runId,
      check_name: 'Storage Health',
      check_category: 'storage',
      status: 'skip',
      duration_ms: Date.now() - storageStart,
      details: {},
      error_message: String(e),
    });
  }

  // Save all checks to database
  for (const check of checks) {
    await supabase.from('system_health_checks').insert(check);
  }

  return checks as HealthCheck[];
}

export function useErrorEvents() {
  const query = useQuery({
    queryKey: ['error-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_error_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as ErrorEvent[];
    },
    staleTime: 60000,
  });

  const errorStats = useQuery({
    queryKey: ['error-stats'],
    queryFn: async () => {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [last24h, last7d] = await Promise.all([
        supabase
          .from('app_error_events')
          .select('severity', { count: 'exact' })
          .gte('created_at', twentyFourHoursAgo),
        supabase
          .from('app_error_events')
          .select('severity', { count: 'exact' })
          .gte('created_at', sevenDaysAgo),
      ]);

      return {
        last24h: last24h.count || 0,
        last7d: last7d.count || 0,
      };
    },
    staleTime: 60000,
  });

  return {
    events: query.data || [],
    stats: errorStats.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export async function logClientError(
  message: string,
  options: {
    severity?: 'info' | 'warning' | 'error' | 'critical';
    component?: string;
    stackTrace?: string;
    metadata?: Record<string, unknown>;
  } = {}
) {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;

    await supabase.from('app_error_events').insert({
      user_id: userId || null,
      source: 'client',
      severity: options.severity || 'error',
      message,
      component: options.component,
      stack_hash: options.stackTrace ? hashString(options.stackTrace) : null,
      metadata: options.metadata || {},
      device_info: {
        platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.error('[SystemHealth] Failed to log error:', e);
  }
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}
