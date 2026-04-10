import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[SupabaseService] CRITICAL: Missing Supabase configuration. Backend services will not function.');
  console.warn('[SupabaseService] Please set SUPABASE_URL and SUPABASE_SERVICE_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY) environment variables.');
}

export const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

export const isBackendConfigured = () => !!(supabaseUrl && supabaseServiceKey);

export interface SupabaseProfile {
  id: string;
  user_id: string;
  name: string;
  relationship?: string;
  date_of_birth?: string;
  allergens: string[];
  custom_keywords: string[];
  has_anaphylaxis: boolean;
  emergency_contacts: {
    name: string;
    phone: string;
    relationship: string;
  }[];
  medications: string[];
  avatar_color?: string;
  created_at: string;
  updated_at: string;
  synced_at: string;
}

export interface DetectedAllergen {
  allergen: string;
  matched: string;
  confidence: number;
  category: string;
  source: 'ingredients' | 'allergens_field' | 'traces';
}

export interface SupabaseProduct {
  code: string;
  product_name?: string;
  brands?: string;
  image_url?: string;
  image_front_url?: string;
  ingredients_text?: string;
  ingredients_raw?: string;
  ingredients_tokens?: string[];
  allergens?: string;
  allergens_tags?: string[];
  traces?: string;
  traces_tags?: string[];
  categories?: string;
  categories_tags?: string[];
  detected_allergens?: DetectedAllergen[];
  source: string;
  source_url?: string;
  confidence?: number;
  cached_at: string;
  last_fetched_at: string;
  normalized_at?: string;
  expires_at?: string;
  scan_count: number;
}

export interface SupabaseScanHistory {
  id: string;
  user_id: string;
  profile_id: string;
  product_code: string;
  product_name?: string;
  verdict: 'safe' | 'caution' | 'danger';
  scanned_at: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  synced_at: string;
}

/**
 * Product fetch log entry for analytics.
 * 
 * Cache flag semantics:
 * - from_cache: true = returned cached product, NO external API call made
 * - cache_hit: true = DB row existed at time of lookup (regardless of freshness)
 * - cache_expired: true = DB row existed but TTL was expired (triggered external fetch)
 * 
 * Example scenarios:
 * 1. Fresh cache hit: from_cache=true, cache_hit=true, cache_expired=false
 * 2. Expired cache, external fetch succeeded: from_cache=false, cache_hit=true, cache_expired=true
 * 3. Expired cache, external fetch failed, returned stale: from_cache=true, cache_hit=true, cache_expired=true
 * 4. No cache, external fetch: from_cache=false, cache_hit=false, cache_expired=false
 * 5. Not found anywhere: from_cache=false, cache_hit=false, cache_expired=false
 */
export interface ProductFetchLog {
  barcode: string;
  source: string;
  success: boolean;
  latency_ms: number;
  error_message?: string;
  http_status?: number;
  /** True if we returned cached data without making an external API call */
  from_cache: boolean;
  /** True if a DB row existed at time of lookup */
  cache_hit?: boolean;
  /** True if DB row existed but was past its TTL expiration */
  cache_expired?: boolean;
  confidence?: number;
}

export class SupabaseService {
  private static checkClient(): void {
    if (!supabaseAdmin) {
      throw new Error('Supabase is not configured. Please set environment variables.');
    }
  }

  static async getProfiles(userId: string): Promise<SupabaseProfile[]> {
    this.checkClient();
    const { data, error } = await supabaseAdmin!
      .from('profiles')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('[SupabaseService] Error fetching profiles:', error);
      throw error;
    }

    return data || [];
  }

  static async createProfile(profile: Omit<SupabaseProfile, 'id' | 'created_at' | 'updated_at' | 'synced_at'>): Promise<SupabaseProfile> {
    this.checkClient();
    const { data, error } = await supabaseAdmin!
      .from('profiles')
      .insert({
        ...profile,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[SupabaseService] Error creating profile:', error);
      throw error;
    }

    return data;
  }

  static async updateProfile(id: string, updates: Partial<SupabaseProfile>): Promise<SupabaseProfile> {
    this.checkClient();
    const { data, error } = await supabaseAdmin!
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[SupabaseService] Error updating profile:', error);
      throw error;
    }

    return data;
  }

  static async deleteProfile(id: string): Promise<void> {
    this.checkClient();
    const { error } = await supabaseAdmin!
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[SupabaseService] Error deleting profile:', error);
      throw error;
    }
  }

  static async getProduct(code: string): Promise<SupabaseProduct | null> {
    this.checkClient();
    const { data, error } = await supabaseAdmin!
      .from('products')
      .select('*')
      .eq('code', code)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[SupabaseService] Error fetching product:', error);
      throw error;
    }

    return data;
  }

  static async upsertProduct(product: SupabaseProduct): Promise<SupabaseProduct> {
    this.checkClient();
    const { data, error } = await supabaseAdmin!
      .from('products')
      .upsert({
        ...product,
        last_fetched_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[SupabaseService] Error upserting product:', error);
      throw error;
    }

    return data;
  }

  static async incrementScanCount(code: string): Promise<void> {
    this.checkClient();
    const { error } = await supabaseAdmin!.rpc('increment_scan_count', { product_code: code });

    if (error) {
      console.error('[SupabaseService] Error incrementing scan count:', error);
    }
  }

  static async addScanHistory(scan: Omit<SupabaseScanHistory, 'id' | 'scanned_at' | 'synced_at'>): Promise<SupabaseScanHistory> {
    this.checkClient();
    const { data, error } = await supabaseAdmin!
      .from('scan_history')
      .insert({
        ...scan,
        scanned_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[SupabaseService] Error adding scan history:', error);
      throw error;
    }

    return data;
  }

  static async getScanHistory(userId: string, limit = 50): Promise<SupabaseScanHistory[]> {
    this.checkClient();
    const { data, error } = await supabaseAdmin!
      .from('scan_history')
      .select('*')
      .eq('user_id', userId)
      .order('scanned_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[SupabaseService] Error fetching scan history:', error);
      throw error;
    }

    return data || [];
  }

  static async trackAnalytics(userId: string, eventType: string, eventData?: Record<string, any>): Promise<void> {
    this.checkClient();
    const { error } = await supabaseAdmin!
      .from('analytics')
      .insert({
        user_id: userId,
        event_type: eventType,
        event_data: eventData,
        timestamp: new Date().toISOString(),
        synced_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[SupabaseService] Error tracking analytics:', error);
    }
  }

  static async acquireFetchLock(barcode: string, lockId?: string, ttlSeconds: number = 30): Promise<boolean> {
    this.checkClient();
    try {
      const { data, error } = await supabaseAdmin!.rpc('acquire_product_fetch_lock', {
        p_barcode: barcode,
        p_locked_by: lockId || null,
        p_ttl_seconds: ttlSeconds,
      });

      if (error) {
        console.error('[SupabaseService] Error acquiring fetch lock:', error);
        return false;
      }

      console.log(`[SupabaseService] Lock ${data ? 'acquired' : 'not acquired'} for barcode: ${barcode}`);
      return data === true;
    } catch (error) {
      console.error('[SupabaseService] Exception acquiring fetch lock:', error);
      return false;
    }
  }

  static async releaseFetchLock(barcode: string): Promise<void> {
    this.checkClient();
    try {
      const { error } = await supabaseAdmin!.rpc('release_product_fetch_lock', {
        p_barcode: barcode,
      });

      if (error) {
        console.error('[SupabaseService] Error releasing fetch lock:', error);
      } else {
        console.log(`[SupabaseService] Lock released for barcode: ${barcode}`);
      }
    } catch (error) {
      console.error('[SupabaseService] Exception releasing fetch lock:', error);
    }
  }

  static async isFetchLocked(barcode: string): Promise<boolean> {
    this.checkClient();
    try {
      const { data, error } = await supabaseAdmin!.rpc('is_product_fetch_locked', {
        p_barcode: barcode,
      });

      if (error) {
        console.error('[SupabaseService] Error checking fetch lock:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('[SupabaseService] Exception checking fetch lock:', error);
      return false;
    }
  }

  static async logProductFetch(log: ProductFetchLog): Promise<void> {
    if (!supabaseAdmin) {
      console.log('[SupabaseService] Skipping fetch log - Supabase not configured');
      return;
    }
    try {
      const { error } = await supabaseAdmin
        .from('product_fetch_logs')
        .insert({
          barcode: log.barcode,
          source: log.source,
          success: log.success,
          latency_ms: log.latency_ms,
          error_message: log.error_message,
          http_status: log.http_status,
          from_cache: log.from_cache,
          cache_hit: log.cache_hit,
          cache_expired: log.cache_expired,
          confidence: log.confidence,
          created_at: new Date().toISOString(),
        });

      if (error) {
        console.error('[SupabaseService] Error logging product fetch:', error);
      }
    } catch (error) {
      console.error('[SupabaseService] Exception logging product fetch:', error);
    }
  }

  static async getFetchStats(): Promise<{
    bySource: { source: string; total: number; success_rate: number; avg_latency: number }[];
    last24h: { total: number; successes: number; failures: number };
  }> {
    if (!supabaseAdmin) {
      return { bySource: [], last24h: { total: 0, successes: 0, failures: 0 } };
    }
    try {
      const { data, error } = await supabaseAdmin
        .from('product_fetch_stats')
        .select('*');

      if (error) {
        console.error('[SupabaseService] Error fetching stats:', error);
        return { bySource: [], last24h: { total: 0, successes: 0, failures: 0 } };
      }

      const bySource = (data || []).map((row: any) => ({
        source: row.source,
        total: row.total_requests,
        success_rate: row.success_rate,
        avg_latency: row.avg_latency_ms,
      }));

      const totals = bySource.reduce(
        (acc, s) => ({
          total: acc.total + s.total,
          successes: acc.successes + Math.round(s.total * s.success_rate / 100),
          failures: acc.failures + Math.round(s.total * (100 - s.success_rate) / 100),
        }),
        { total: 0, successes: 0, failures: 0 }
      );

      return { bySource, last24h: totals };
    } catch (error) {
      console.error('[SupabaseService] Exception fetching stats:', error);
      return { bySource: [], last24h: { total: 0, successes: 0, failures: 0 } };
    }
  }

  static async getAnalyticsStats(userId?: string): Promise<{
    totalScans: number;
    totalProfiles: number;
    recentActivity: { date: string; count: number }[];
  }> {
    try {
      this.checkClient();
      let scanQuery = supabaseAdmin!
        .from('scan_history')
        .select('*', { count: 'exact', head: true });

      let profileQuery = supabaseAdmin!
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (userId) {
        scanQuery = scanQuery.eq('user_id', userId);
        profileQuery = profileQuery.eq('user_id', userId);
      }

      const [scanResult, profileResult] = await Promise.all([
        scanQuery,
        profileQuery,
      ]);

      const recentScansQuery = userId
        ? supabaseAdmin!
            .from('scan_history')
            .select('scanned_at')
            .eq('user_id', userId)
            .gte('scanned_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        : supabaseAdmin!
            .from('scan_history')
            .select('scanned_at')
            .gte('scanned_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const { data: recentScans } = await recentScansQuery;

      const activityMap = new Map<string, number>();
      recentScans?.forEach((scan) => {
        const date = new Date(scan.scanned_at).toISOString().split('T')[0];
        activityMap.set(date, (activityMap.get(date) || 0) + 1);
      });

      const recentActivity = Array.from(activityMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        totalScans: scanResult.count || 0,
        totalProfiles: profileResult.count || 0,
        recentActivity,
      };
    } catch (error) {
      console.error('[SupabaseService] Error fetching analytics stats:', error);
      return {
        totalScans: 0,
        totalProfiles: 0,
        recentActivity: [],
      };
    }
  }
}
