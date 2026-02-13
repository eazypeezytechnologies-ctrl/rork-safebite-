import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';

export type AuditEventType =
  | 'auth.sign_in'
  | 'auth.sign_out'
  | 'auth.sign_up'
  | 'auth.password_reset'
  | 'profile.create'
  | 'profile.update'
  | 'profile.delete'
  | 'scan.barcode'
  | 'scan.photo'
  | 'scan.save_product'
  | 'family.create'
  | 'family.join'
  | 'family.leave'
  | 'family.remove_member'
  | 'family.delete'
  | 'invite.create'
  | 'invite.redeem'
  | 'invite.revoke'
  | 'invite.decline'
  | 'invite.expire'
  | 'admin.view_as'
  | 'admin.override_verdict'
  | 'admin.grant_extension'
  | 'admin.toggle_subscription'
  | 'error.scan_failed'
  | 'error.save_failed'
  | 'error.invite_failed'
  | 'error.auth_failed';

interface AuditEventPayload {
  eventType: AuditEventType;
  userId?: string;
  familyId?: string;
  profileId?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

const EVENT_QUEUE: AuditEventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 5000;
const MAX_QUEUE_SIZE = 20;

async function flushQueue(): Promise<void> {
  if (EVENT_QUEUE.length === 0) return;

  const batch = EVENT_QUEUE.splice(0, MAX_QUEUE_SIZE);

  try {
    const rows = batch.map(evt => ({
      event_type: evt.eventType,
      user_id: evt.userId || null,
      family_id: evt.familyId || null,
      profile_id: evt.profileId || null,
      target_id: evt.targetId || null,
      metadata: {
        ...(evt.metadata || {}),
        platform: Platform.OS,
      },
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('audit_events').insert(rows);

    if (error) {
      console.warn('[AuditLog] Failed to flush batch:', error.message);
      if (error.code !== '42P01') {
        EVENT_QUEUE.unshift(...batch);
      }
    } else {
      console.log(`[AuditLog] Flushed ${rows.length} events`);
    }
  } catch (err) {
    console.warn('[AuditLog] Flush error (non-critical):', err instanceof Error ? err.message : 'unknown');
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushQueue();
  }, FLUSH_INTERVAL_MS);
}

export function logAuditEvent(payload: AuditEventPayload): void {
  EVENT_QUEUE.push(payload);

  if (EVENT_QUEUE.length >= MAX_QUEUE_SIZE) {
    flushQueue();
  } else {
    scheduleFlush();
  }
}

export async function logAuditEventImmediate(payload: AuditEventPayload): Promise<void> {
  try {
    const { error } = await supabase.from('audit_events').insert({
      event_type: payload.eventType,
      user_id: payload.userId || null,
      family_id: payload.familyId || null,
      profile_id: payload.profileId || null,
      target_id: payload.targetId || null,
      metadata: {
        ...(payload.metadata || {}),
        platform: Platform.OS,
      },
      created_at: new Date().toISOString(),
    });

    if (error && error.code !== '42P01') {
      console.warn('[AuditLog] Immediate log failed:', error.message);
    }
  } catch (err) {
    console.warn('[AuditLog] Immediate log error:', err instanceof Error ? err.message : 'unknown');
  }
}

export async function forceFlush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushQueue();
}

export async function getAuditEventsAggregated(
  timeRange: '24h' | '7d' | '30d' = '7d'
): Promise<{
  totalEvents: number;
  byType: Record<string, number>;
  errorRate: number;
  recentErrors: { event_type: string; created_at: string; metadata: Record<string, unknown> }[];
}> {
  try {
    const { data: events, error } = await supabase
      .from('audit_events')
      .select('event_type, created_at, metadata')
      .gte('created_at', new Date(Date.now() - (timeRange === '24h' ? 86400000 : timeRange === '7d' ? 604800000 : 2592000000)).toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.warn('[AuditLog] Aggregation query failed:', error.message);
      return { totalEvents: 0, byType: {}, errorRate: 0, recentErrors: [] };
    }

    const byType: Record<string, number> = {};
    let errorCount = 0;
    const recentErrors: { event_type: string; created_at: string; metadata: Record<string, unknown> }[] = [];

    for (const evt of events || []) {
      byType[evt.event_type] = (byType[evt.event_type] || 0) + 1;
      if (evt.event_type.startsWith('error.')) {
        errorCount++;
        if (recentErrors.length < 10) {
          recentErrors.push({
            event_type: evt.event_type,
            created_at: evt.created_at,
            metadata: evt.metadata || {},
          });
        }
      }
    }

    const totalEvents = events?.length || 0;
    const errorRate = totalEvents > 0 ? (errorCount / totalEvents) * 100 : 0;

    return { totalEvents, byType, errorRate, recentErrors };
  } catch (err) {
    console.warn('[AuditLog] Aggregation error:', err);
    return { totalEvents: 0, byType: {}, errorRate: 0, recentErrors: [] };
  }
}
