import { supabase } from '@/lib/supabase';
import { logAuditEventImmediate } from '@/utils/auditLog';

export interface AdminMetrics {
  totalUsers: number;
  adminUsers: number;
  regularUsers: number;
  totalProfiles: number;
  totalScans: number;
  totalFavorites: number;
  totalFamilies: number;
  totalFamilyMembers: number;
  pendingInvites: number;
  acceptedInvites: number;
  totalProducts: number;
  eventsLast24h: number;
  eventsLast7d: number;
}

export interface ScanDayStat {
  scanDate: string;
  scanCount: number;
  uniqueUsers: number;
}

export interface AdminViewSession {
  targetFamilyId: string;
  reason: string;
  durationMinutes?: number;
}

export async function fetchAdminMetrics(): Promise<AdminMetrics> {
  try {
    const { data, error } = await supabase
      .from('admin_metrics')
      .select('*')
      .single();

    if (error) {
      console.warn('[AdminMonitoring] Metrics view query failed, falling back to manual counts:', error.message);
      return await fetchAdminMetricsFallback();
    }

    return {
      totalUsers: data.total_users || 0,
      adminUsers: data.admin_users || 0,
      regularUsers: data.regular_users || 0,
      totalProfiles: data.total_profiles || 0,
      totalScans: data.total_scans || 0,
      totalFavorites: data.total_favorites || 0,
      totalFamilies: data.total_families || 0,
      totalFamilyMembers: data.total_family_members || 0,
      pendingInvites: data.pending_invites || 0,
      acceptedInvites: data.accepted_invites || 0,
      totalProducts: data.total_products || 0,
      eventsLast24h: data.events_last_24h || 0,
      eventsLast7d: data.events_last_7d || 0,
    };
  } catch (err) {
    console.warn('[AdminMonitoring] Metrics fetch error:', err);
    return await fetchAdminMetricsFallback();
  }
}

async function fetchAdminMetricsFallback(): Promise<AdminMetrics> {
  const defaults: AdminMetrics = {
    totalUsers: 0, adminUsers: 0, regularUsers: 0,
    totalProfiles: 0, totalScans: 0, totalFavorites: 0,
    totalFamilies: 0, totalFamilyMembers: 0,
    pendingInvites: 0, acceptedInvites: 0,
    totalProducts: 0, eventsLast24h: 0, eventsLast7d: 0,
  };

  try {
    const queries = await Promise.allSettled([
      supabase.from('users').select('id, is_admin', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('scan_history').select('id', { count: 'exact', head: true }),
      supabase.from('favorites').select('id', { count: 'exact', head: true }),
      supabase.from('families').select('id', { count: 'exact', head: true }),
      supabase.from('family_members').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
    ]);

    const getCount = (result: PromiseSettledResult<any>): number => {
      if (result.status === 'fulfilled' && result.value?.count != null) {
        return result.value.count;
      }
      return 0;
    };

    defaults.totalUsers = getCount(queries[0]);
    defaults.totalProfiles = getCount(queries[1]);
    defaults.totalScans = getCount(queries[2]);
    defaults.totalFavorites = getCount(queries[3]);
    defaults.totalFamilies = getCount(queries[4]);
    defaults.totalFamilyMembers = getCount(queries[5]);
    defaults.totalProducts = getCount(queries[6]);
  } catch (err) {
    console.warn('[AdminMonitoring] Fallback metrics error:', err);
  }

  return defaults;
}

export async function fetchScanStats(days: number = 30): Promise<ScanDayStat[]> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('admin_scan_stats')
      .select('*')
      .gte('scan_date', since.toISOString())
      .order('scan_date', { ascending: false });

    if (error) {
      console.warn('[AdminMonitoring] Scan stats view failed:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      scanDate: row.scan_date,
      scanCount: row.scan_count,
      uniqueUsers: row.unique_users,
    }));
  } catch (err) {
    console.warn('[AdminMonitoring] Scan stats error:', err);
    return [];
  }
}

export async function startAdminViewSession(
  adminUserId: string,
  session: AdminViewSession
): Promise<{ sessionId: string | null; error: string | null }> {
  try {
    const durationMinutes = session.durationMinutes || 15;
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + durationMinutes);

    const { data, error } = await supabase
      .from('admin_view_sessions')
      .insert({
        admin_user_id: adminUserId,
        target_family_id: session.targetFamilyId,
        reason: session.reason,
        expires_at: expiresAt.toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      return { sessionId: null, error: error.message };
    }

    await logAuditEventImmediate({
      eventType: 'admin.view_as',
      userId: adminUserId,
      familyId: session.targetFamilyId,
      targetId: data.id,
      metadata: {
        reason: session.reason,
        duration_minutes: durationMinutes,
        expires_at: expiresAt.toISOString(),
      },
    });

    console.log('[AdminMonitoring] View-as session started:', data.id);
    return { sessionId: data.id, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { sessionId: null, error: msg };
  }
}

export async function endAdminViewSession(sessionId: string): Promise<void> {
  try {
    await supabase
      .from('admin_view_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);
    console.log('[AdminMonitoring] View-as session ended:', sessionId);
  } catch (err) {
    console.warn('[AdminMonitoring] End session error:', err);
  }
}

export async function fetchActiveViewSessions(adminUserId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('admin_view_sessions')
      .select('*')
      .eq('admin_user_id', adminUserId)
      .is('ended_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('started_at', { ascending: false });

    if (error) {
      console.warn('[AdminMonitoring] Active sessions query failed:', error.message);
      return [];
    }

    return data || [];
  } catch {
    return [];
  }
}
