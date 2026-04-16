import { supabase } from '@/lib/supabase';
import {
  SupportIssue,
  IssueNote,
  ErrorLog,
  AdminDashboardStats,
  IssueStatus,
  IssueSeverity,
  IssueType,
} from '@/types/adminSupport';

export async function fetchDashboardStats(): Promise<AdminDashboardStats> {
  const defaults: AdminDashboardStats = {
    open_issues: 0,
    critical_issues: 0,
    scan_failures_today: 0,
    product_lookup_failures: 0,
    profile_save_failures: 0,
    unresolved_reports: 0,
  };

  try {
    const [openRes, criticalRes, todayScansRes, todayProductRes, todayProfileRes, unresolvedRes] = await Promise.allSettled([
      supabase.from('support_issues').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
      supabase.from('support_issues').select('id', { count: 'exact', head: true }).eq('severity', 'critical').neq('status', 'resolved'),
      supabase.from('support_issues').select('id', { count: 'exact', head: true }).eq('issue_type', 'scan_failed').gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase.from('support_issues').select('id', { count: 'exact', head: true }).in('issue_type', ['product_not_found', 'missing_ingredient_data']).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase.from('support_issues').select('id', { count: 'exact', head: true }).eq('issue_type', 'profile_not_saving').gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      supabase.from('support_issues').select('id', { count: 'exact', head: true }).neq('status', 'resolved'),
    ]);

    const getCount = (r: PromiseSettledResult<any>): number => {
      if (r.status === 'fulfilled' && r.value?.count != null) return r.value.count;
      return 0;
    };

    defaults.open_issues = getCount(openRes);
    defaults.critical_issues = getCount(criticalRes);
    defaults.scan_failures_today = getCount(todayScansRes);
    defaults.product_lookup_failures = getCount(todayProductRes);
    defaults.profile_save_failures = getCount(todayProfileRes);
    defaults.unresolved_reports = getCount(unresolvedRes);
  } catch (err) {
    console.warn('[AdminSupport] Dashboard stats error:', err);
  }

  return defaults;
}

export async function fetchIssues(filters?: {
  status?: IssueStatus;
  severity?: IssueSeverity;
  issue_type?: IssueType;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ issues: SupportIssue[]; total: number }> {
  try {
    let query = supabase.from('support_issues').select('*', { count: 'exact' });

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.severity) query = query.eq('severity', filters.severity);
    if (filters?.issue_type) query = query.eq('issue_type', filters.issue_type);
    if (filters?.search) {
      query = query.or(`description.ilike.%${filters.search}%,product_name.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%,user_email.ilike.%${filters.search}%`);
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) query = query.limit(filters.limit);
    if (filters?.offset) query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[AdminSupport] Fetch issues error:', error);
      return { issues: [], total: 0 };
    }

    return { issues: (data || []) as SupportIssue[], total: count || 0 };
  } catch (err) {
    console.error('[AdminSupport] Fetch issues exception:', err);
    return { issues: [], total: 0 };
  }
}

export async function fetchIssueById(id: string): Promise<SupportIssue | null> {
  try {
    const { data, error } = await supabase
      .from('support_issues')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('[AdminSupport] Fetch issue error:', error);
      return null;
    }

    return data as SupportIssue;
  } catch (err) {
    console.error('[AdminSupport] Fetch issue exception:', err);
    return null;
  }
}

export async function createIssue(issue: Omit<SupportIssue, 'id' | 'created_at' | 'updated_at' | 'resolved_at' | 'ai_summary' | 'ai_likely_cause' | 'ai_suggested_checks' | 'ai_suggested_reply'>): Promise<SupportIssue | null> {
  try {
    const { data, error } = await supabase
      .from('support_issues')
      .insert({
        ...issue,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[AdminSupport] Create issue error:', error);
      return null;
    }

    console.log('[AdminSupport] Issue created:', data?.id);
    return data as SupportIssue;
  } catch (err) {
    console.error('[AdminSupport] Create issue exception:', err);
    return null;
  }
}

export async function updateIssueStatus(id: string, status: IssueStatus): Promise<boolean> {
  try {
    const updates: Record<string, string> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === 'resolved') {
      updates.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('support_issues')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[AdminSupport] Update status error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[AdminSupport] Update status exception:', err);
    return false;
  }
}

export async function updateIssueFlags(id: string, flags: {
  is_repeated?: boolean;
  product_data_incomplete?: boolean;
  category_corrected?: boolean;
  severity?: IssueSeverity;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('support_issues')
      .update({ ...flags, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[AdminSupport] Update flags error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[AdminSupport] Update flags exception:', err);
    return false;
  }
}

export async function updateIssueAI(id: string, ai: {
  ai_summary?: string;
  ai_likely_cause?: string;
  ai_suggested_checks?: string;
  ai_suggested_reply?: string;
}): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('support_issues')
      .update({ ...ai, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[AdminSupport] Update AI error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[AdminSupport] Update AI exception:', err);
    return false;
  }
}

export async function fetchIssueNotes(issueId: string): Promise<IssueNote[]> {
  try {
    const { data, error } = await supabase
      .from('issue_notes')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[AdminSupport] Fetch notes error:', error);
      return [];
    }

    return (data || []) as IssueNote[];
  } catch (err) {
    console.error('[AdminSupport] Fetch notes exception:', err);
    return [];
  }
}

export async function addIssueNote(note: Omit<IssueNote, 'id' | 'created_at'>): Promise<IssueNote | null> {
  try {
    const { data, error } = await supabase
      .from('issue_notes')
      .insert({ ...note, created_at: new Date().toISOString() })
      .select()
      .single();

    if (error) {
      console.error('[AdminSupport] Add note error:', error);
      return null;
    }

    return data as IssueNote;
  } catch (err) {
    console.error('[AdminSupport] Add note exception:', err);
    return null;
  }
}

export async function fetchRecentErrors(limit: number = 20): Promise<ErrorLog[]> {
  try {
    const { data, error } = await supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AdminSupport] Fetch errors error:', error);
      return [];
    }

    return (data || []) as ErrorLog[];
  } catch (err) {
    console.error('[AdminSupport] Fetch errors exception:', err);
    return [];
  }
}

export async function logError(entry: Omit<ErrorLog, 'id' | 'created_at'>): Promise<void> {
  try {
    await supabase.from('error_logs').insert({
      ...entry,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[AdminSupport] Log error failed:', err);
  }
}

export async function fetchIssuesByUser(userId: string): Promise<SupportIssue[]> {
  try {
    const { data, error } = await supabase
      .from('support_issues')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[AdminSupport] Fetch user issues error:', error);
      return [];
    }

    return (data || []) as SupportIssue[];
  } catch (err) {
    console.error('[AdminSupport] Fetch user issues exception:', err);
    return [];
  }
}

export async function lookupUser(query: string): Promise<Array<{ id: string; email: string; is_admin: boolean; created_at: string }>> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, is_admin, created_at')
      .or(`email.ilike.%${query}%,id.eq.${query.length === 36 ? query : '00000000-0000-0000-0000-000000000000'}`)
      .limit(20);

    if (error) {
      console.error('[AdminSupport] User lookup error:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[AdminSupport] User lookup exception:', err);
    return [];
  }
}

export async function fetchImmediateAttentionIssues(): Promise<SupportIssue[]> {
  try {
    const { data, error } = await supabase
      .from('support_issues')
      .select('*')
      .in('severity', ['critical', 'high'])
      .neq('status', 'resolved')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[AdminSupport] Immediate attention error:', error);
      return [];
    }

    return (data || []) as SupportIssue[];
  } catch (err) {
    console.error('[AdminSupport] Immediate attention exception:', err);
    return [];
  }
}

export async function fetchRecentIssues(limit: number = 5): Promise<SupportIssue[]> {
  try {
    const { data, error } = await supabase
      .from('support_issues')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AdminSupport] Recent issues error:', error);
      return [];
    }

    return (data || []) as SupportIssue[];
  } catch (err) {
    console.error('[AdminSupport] Recent issues exception:', err);
    return [];
  }
}

export async function fetchAIWatchlistIssues(): Promise<SupportIssue[]> {
  try {
    const { data, error } = await supabase
      .from('support_issues')
      .select('*')
      .eq('is_repeated', true)
      .neq('status', 'resolved')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[AdminSupport] AI watchlist error:', error);
      return [];
    }

    return (data || []) as SupportIssue[];
  } catch (err) {
    console.error('[AdminSupport] AI watchlist exception:', err);
    return [];
  }
}
