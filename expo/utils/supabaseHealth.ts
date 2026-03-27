import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase';

interface CheckResult {
  ok: boolean;
  status?: number;
  ms?: number;
  message: string;
}

interface OperationalCheckResult {
  ok: boolean;
  checks: {
    authHealth: CheckResult;
    restHealth: CheckResult;
    keyValid: CheckResult;
  };
  summary: string;
  timestamp: string;
  buildInfo: {
    url: string | null;
    keyPresent: boolean;
  };
}

const TIMEOUT_MS = 12000;

async function timedFetch(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; ms: number; body: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    const ms = Date.now() - start;
    const body = await res.text().catch(() => '');
    clearTimeout(timeoutId);
    return { status: res.status, ms, body: body.substring(0, 200) };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const msg = err?.message || String(err);

    if (err?.name === 'AbortError' || msg.includes('aborted')) {
      throw new Error(`Request timed out after ${TIMEOUT_MS}ms`);
    }
    if (
      msg.includes('Load failed') ||
      msg.includes('Failed to fetch') ||
      msg.includes('fetch failed') ||
      msg.includes('Network request failed')
    ) {
      throw new Error('Network unreachable — check Wi-Fi/cellular');
    }
    throw new Error(msg);
  }
}

export async function runSupabaseOperationalCheck(): Promise<OperationalCheckResult> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  const baseResult: OperationalCheckResult = {
    ok: false,
    checks: {
      authHealth: { ok: false, message: 'Not checked' },
      restHealth: { ok: false, message: 'Not checked' },
      keyValid: { ok: false, message: 'Not checked' },
    },
    summary: '',
    timestamp: new Date().toISOString(),
    buildInfo: {
      url: supabaseUrl ? supabaseUrl.replace(/https?:\/\//, '').substring(0, 24) + '...' : null,
      keyPresent: !!supabaseAnonKey,
    },
  };

  if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
    baseResult.summary = 'SUPABASE_URL is missing or does not start with https://';
    baseResult.checks.authHealth.message = 'Skipped — invalid URL';
    baseResult.checks.restHealth.message = 'Skipped — invalid URL';
    baseResult.checks.keyValid.message = 'Cannot validate without valid URL';
    console.log('[HealthCheck] Failed config validation:', baseResult.summary);
    return baseResult;
  }

  if (!supabaseAnonKey || supabaseAnonKey.length < 10) {
    baseResult.summary = 'SUPABASE_ANON_KEY is missing or too short';
    baseResult.checks.authHealth.message = 'Skipped — no anon key';
    baseResult.checks.restHealth.message = 'Skipped — no anon key';
    baseResult.checks.keyValid.message = 'Anon key is missing or invalid';
    console.log('[HealthCheck] Failed config validation:', baseResult.summary);
    return baseResult;
  }

  const headers = {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };

  console.log('[HealthCheck] Starting operational check...');

  let authResult: CheckResult = { ok: false, message: 'Not checked' };
  try {
    const res = await timedFetch(`${supabaseUrl}/auth/v1/health`, headers);
    authResult = {
      ok: res.status === 200,
      status: res.status,
      ms: res.ms,
      message: res.status === 200
        ? `Healthy (${res.ms}ms)`
        : `HTTP ${res.status} (${res.ms}ms)${res.body ? ' — ' + res.body.substring(0, 80) : ''}`,
    };
    console.log('[HealthCheck] Auth health:', authResult.message);
  } catch (err: any) {
    authResult = {
      ok: false,
      message: err.message || 'Unknown error',
    };
    console.log('[HealthCheck] Auth health error:', authResult.message);
  }

  let restResult: CheckResult = { ok: false, message: 'Not checked' };
  try {
    const res = await timedFetch(`${supabaseUrl}/rest/v1/`, headers);
    const isReachable = res.status === 200 || res.status === 204;
    restResult = {
      ok: isReachable,
      status: res.status,
      ms: res.ms,
      message: isReachable
        ? `Reachable (${res.ms}ms)`
        : `HTTP ${res.status} (${res.ms}ms)${res.body ? ' — ' + res.body.substring(0, 80) : ''}`,
    };
    console.log('[HealthCheck] REST health:', restResult.message);
  } catch (err: any) {
    restResult = {
      ok: false,
      message: err.message || 'Unknown error',
    };
    console.log('[HealthCheck] REST health error:', restResult.message);
  }

  const bothUnauthorized =
    authResult.status === 401 && restResult.status === 401;
  const keyValid: CheckResult = bothUnauthorized
    ? {
        ok: false,
        message:
          'Both endpoints returned 401 — likely missing apikey header or invalid anon key',
      }
    : authResult.ok
      ? { ok: true, message: 'Key accepted by Auth endpoint' }
      : {
          ok: false,
          message: `Auth returned ${authResult.status ?? 'error'} — key may be invalid`,
        };

  console.log('[HealthCheck] Key validation:', keyValid.message);

  const allOk = authResult.ok && restResult.ok && keyValid.ok;
  const partialOk = authResult.ok || restResult.ok;

  let summary: string;
  if (allOk) {
    summary = 'All systems operational';
  } else if (partialOk) {
    const failing: string[] = [];
    if (!authResult.ok) failing.push('Auth');
    if (!restResult.ok) failing.push('REST');
    if (!keyValid.ok) failing.push('Key');
    summary = `Partial: ${failing.join(', ')} check(s) failed`;
  } else if (bothUnauthorized) {
    summary =
      'Supabase is reachable but requests are unauthorized. Confirm anon key matches this project.';
  } else {
    summary = 'All checks failed — verify URL, anon key, and network connectivity';
  }

  return {
    ok: allOk,
    checks: {
      authHealth: authResult,
      restHealth: restResult,
      keyValid,
    },
    summary,
    timestamp: baseResult.timestamp,
    buildInfo: baseResult.buildInfo,
  };
}

function redactUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.length <= 12) return url.substring(0, 4) + '······';
  return url.substring(0, 6) + '······' + url.substring(url.length - 6);
}

function redactMessage(msg: string): string {
  return msg.replace(/eyJ[A-Za-z0-9_-]{10,}/g, '[REDACTED_TOKEN]');
}

export interface SimpleConnectionResult {
  ok: boolean;
  message: string;
}

export async function runSimpleConnectionCheck(): Promise<SimpleConnectionResult> {
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
    console.log('[SimpleCheck] No valid URL configured');
    return { ok: false, message: 'App not configured' };
  }
  if (!supabaseAnonKey || supabaseAnonKey.length < 10) {
    console.log('[SimpleCheck] No valid anon key');
    return { ok: false, message: 'App not configured' };
  }

  try {
    const headers = {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Accept': 'application/json',
    };
    const res = await timedFetch(`${supabaseUrl}/auth/v1/health`, headers);
    if (res.status === 200) {
      console.log('[SimpleCheck] Connection OK');
      return { ok: true, message: 'Connected' };
    }
    console.log('[SimpleCheck] Unexpected status:', res.status);
    return { ok: false, message: 'Connection issue' };
  } catch (err: any) {
    console.log('[SimpleCheck] Error:', err?.message);
    return { ok: false, message: 'Connection issue' };
  }
}

export interface OperationalSelfTestResult {
  buildOperational: boolean;
  configValid: boolean;
  healthOk: boolean;
  sessionOk: boolean;
  summary: string;
  details: {
    configCheck: string;
    healthCheck: string;
    sessionCheck: string;
  };
  timestamp: string;
}

export async function runOperationalSelfTest(
  getSessionFn?: () => Promise<{ data: { session: any }; error: any }>,
): Promise<OperationalSelfTestResult> {
  const timestamp = new Date().toISOString();
  const supabaseUrl = getSupabaseUrl();
  const supabaseAnonKey = getSupabaseAnonKey();

  const result: OperationalSelfTestResult = {
    buildOperational: false,
    configValid: false,
    healthOk: false,
    sessionOk: false,
    summary: '',
    details: {
      configCheck: 'Not checked',
      healthCheck: 'Not checked',
      sessionCheck: 'Not checked',
    },
    timestamp,
  };

  if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
    result.details.configCheck = 'SUPABASE_URL missing or invalid';
    result.summary = 'Config invalid — URL missing or does not start with https://';
    console.log('[SelfTest] Config invalid:', result.details.configCheck);
    return result;
  }
  if (!supabaseAnonKey || supabaseAnonKey.length < 10) {
    result.details.configCheck = 'SUPABASE_ANON_KEY missing or too short';
    result.summary = 'Config invalid — anon key missing';
    console.log('[SelfTest] Config invalid:', result.details.configCheck);
    return result;
  }

  result.configValid = true;
  result.details.configCheck = 'Valid';
  console.log('[SelfTest] Config valid');

  try {
    const headers = {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    const res = await timedFetch(`${supabaseUrl}/auth/v1/health`, headers);
    if (res.status === 200) {
      result.healthOk = true;
      result.details.healthCheck = `Healthy (${res.ms}ms)`;
    } else {
      result.details.healthCheck = `HTTP ${res.status} (${res.ms}ms)`;
    }
    console.log('[SelfTest] Health check:', result.details.healthCheck);
  } catch (err: any) {
    result.details.healthCheck = err?.message || 'Failed';
    console.log('[SelfTest] Health check error:', result.details.healthCheck);
  }

  if (getSessionFn) {
    try {
      const { data, error } = await getSessionFn();
      if (error) {
        result.details.sessionCheck = `Error: ${error.message}`;
      } else if (data?.session) {
        result.sessionOk = true;
        result.details.sessionCheck = 'Active session found';
      } else {
        result.details.sessionCheck = 'No active session';
      }
      console.log('[SelfTest] Session check:', result.details.sessionCheck);
    } catch (err: any) {
      result.details.sessionCheck = err?.message || 'Failed';
      console.log('[SelfTest] Session check error:', result.details.sessionCheck);
    }
  } else {
    result.details.sessionCheck = 'Skipped (not logged in)';
  }

  result.buildOperational = result.configValid && result.healthOk;
  if (result.buildOperational) {
    result.summary = 'Build Operational — all checks passed';
  } else {
    const failing: string[] = [];
    if (!result.configValid) failing.push('Config');
    if (!result.healthOk) failing.push('Health');
    if (getSessionFn && !result.sessionOk) failing.push('Session');
    result.summary = `Build Not Operational — ${failing.join(', ')} check(s) failed`;
  }

  console.log('[SelfTest] Result:', result.summary);
  return result;
}

export function formatDiagnosticsForCopy(result: OperationalCheckResult): string {
  return JSON.stringify(
    {
      ok: result.ok,
      summary: redactMessage(result.summary),
      timestamp: result.timestamp,
      buildInfo: {
        url: redactUrl(result.buildInfo.url),
        keyPresent: result.buildInfo.keyPresent,
      },
      checks: {
        authHealth: {
          ok: result.checks.authHealth.ok,
          status: result.checks.authHealth.status,
          ms: result.checks.authHealth.ms,
          message: redactMessage(result.checks.authHealth.message),
        },
        restHealth: {
          ok: result.checks.restHealth.ok,
          status: result.checks.restHealth.status,
          ms: result.checks.restHealth.ms,
          message: redactMessage(result.checks.restHealth.message),
        },
        keyValid: {
          ok: result.checks.keyValid.ok,
          message: redactMessage(result.checks.keyValid.message),
        },
      },
    },
    null,
    2,
  );
}
