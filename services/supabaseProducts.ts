import { supabase } from '@/lib/supabase';
import { Product } from '@/types';

export interface SupabaseProduct {
  id?: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  ingredients: string | null;
  allergens: string[] | null;
  allergens_text: string | null;
  traces: string[] | null;
  traces_text: string | null;
  categories: string | null;
  image_url: string | null;
  data_source: string;
  completeness_status: 'complete' | 'partial' | 'needs_review';
  scan_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseScanEvent {
  id?: string;
  user_id: string;
  profile_id: string;
  product_barcode: string | null;
  product_name: string | null;
  scan_type: 'barcode' | 'photo' | 'search' | 'manual';
  verdict: 'safe' | 'caution' | 'danger' | 'unknown';
  verdict_details: string | null;
  created_at?: string;
}

function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').trim();
}

function generateProductCode(product: Partial<Product>): string {
  if (product.code && product.code !== 'undefined' && product.code !== 'null') {
    return product.code;
  }
  const brand = normalizeForSearch(product.brands || '');
  const name = normalizeForSearch(product.product_name || 'unknown');
  return `manual_${brand}_${name}_${Date.now()}`.replace(/\s+/g, '_').substring(0, 100);
}

export async function upsertProduct(product: Product): Promise<{ success: boolean; error?: string }> {
  try {
    const barcode = product.code && /^\d{8,14}$/.test(product.code) ? product.code : null;
    const name = product.product_name || 'Unknown Product';
    const brand = product.brands || null;

    console.log('[SupabaseProducts] Upserting product:', { barcode, name, brand, source: product.source });

    if (barcode) {
      const { data: existing } = await supabase
        .from('products')
        .select('id, scan_count, ingredients_text, allergens_tags')
        .eq('code', barcode)
        .maybeSingle();

      if (existing) {
        const updates: Record<string, any> = {
          last_fetched_at: new Date().toISOString(),
          scan_count: (existing.scan_count || 0) + 1,
        };

        if (product.product_name && product.product_name !== 'Unknown Product') {
          updates.product_name = product.product_name;
        }
        if (product.brands) updates.brands = product.brands;
        if (product.ingredients_text && (!existing.ingredients_text || product.ingredients_text.length > (existing.ingredients_text?.length || 0))) {
          updates.ingredients_text = product.ingredients_text;
        }
        if (product.allergens) updates.allergens = product.allergens;
        if (product.allergens_tags && product.allergens_tags.length > 0) {
          updates.allergens_tags = product.allergens_tags;
        }
        if (product.traces_tags && product.traces_tags.length > 0) {
          updates.traces_tags = product.traces_tags;
        }
        if (product.image_url) updates.image_url = product.image_url;
        if (product.image_front_url) updates.image_front_url = product.image_front_url;
        if (product.categories) updates.categories = product.categories;

        const { error } = await supabase
          .from('products')
          .update(updates)
          .eq('id', existing.id);

        if (error) {
          console.error('[SupabaseProducts] Update error:', error.message);
          return { success: false, error: error.message };
        }

        console.log('[SupabaseProducts] Updated existing product, scan_count:', updates.scan_count);
        return { success: true };
      }
    }

    const code = barcode || generateProductCode(product);

    const { error } = await supabase
      .from('products')
      .upsert({
        code,
        product_name: name,
        brands: brand,
        ingredients_text: product.ingredients_text || null,
        allergens: product.allergens || null,
        allergens_tags: product.allergens_tags || [],
        traces: product.traces || null,
        traces_tags: product.traces_tags || [],
        categories: product.categories || null,
        categories_tags: product.categories_tags || [],
        image_url: product.image_url || null,
        image_front_url: product.image_front_url || null,
        source: product.source || 'manual_entry',
        scan_count: 1,
        cached_at: new Date().toISOString(),
        last_fetched_at: new Date().toISOString(),
      }, { onConflict: 'code' });

    if (error) {
      console.error('[SupabaseProducts] Insert error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('[SupabaseProducts] Inserted new product:', code);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SupabaseProducts] upsertProduct exception:', msg);
    return { success: false, error: msg };
  }
}

export async function recordScanEvent(event: SupabaseScanEvent): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[SupabaseProducts] Recording scan event:', {
      user: event.user_id?.substring(0, 8),
      type: event.scan_type,
      product: event.product_name?.substring(0, 30),
    });

    const { error } = await supabase
      .from('scan_history')
      .insert({
        user_id: event.user_id,
        profile_id: event.profile_id,
        product_code: event.product_barcode || `manual_${Date.now()}`,
        product_name: event.product_name || 'Unknown Product',
        verdict: event.verdict,
        scanned_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[SupabaseProducts] recordScanEvent error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('[SupabaseProducts] Scan event recorded successfully');
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SupabaseProducts] recordScanEvent exception:', msg);
    return { success: false, error: msg };
  }
}

export async function searchProducts(
  query: string,
  userId?: string,
  limit: number = 20
): Promise<Product[]> {
  const normalizedQuery = query.toLowerCase().trim();
  const allProducts: Product[] = [];
  const seenCodes = new Set<string>();

  console.log('[SupabaseProducts] Searching for:', normalizedQuery, 'userId:', userId?.substring(0, 8));

  try {
    if (userId) {
      const { data: scanHistory, error: scanError } = await supabase
        .from('scan_history')
        .select('product_code, product_name')
        .eq('user_id', userId)
        .ilike('product_name', `%${normalizedQuery}%`)
        .order('scanned_at', { ascending: false })
        .limit(10);

      if (!scanError && scanHistory) {
        console.log('[SupabaseProducts] Found', scanHistory.length, 'in user scan history');
        for (const scan of scanHistory) {
          if (scan.product_code && !seenCodes.has(scan.product_code)) {
            seenCodes.add(scan.product_code);

            const { data: productData } = await supabase
              .from('products')
              .select('*')
              .eq('code', scan.product_code)
              .maybeSingle();

            if (productData) {
              allProducts.push(mapSupabaseToProduct(productData));
            } else {
              allProducts.push({
                code: scan.product_code,
                product_name: scan.product_name || 'Unknown Product',
                source: 'openfoodfacts' as const,
              });
            }
          }
        }
      }
    }

    const { data: cachedProducts, error: cacheError } = await supabase
      .from('products')
      .select('*')
      .or(`product_name.ilike.%${normalizedQuery}%,brands.ilike.%${normalizedQuery}%`)
      .order('scan_count', { ascending: false })
      .limit(limit);

    if (!cacheError && cachedProducts) {
      console.log('[SupabaseProducts] Found', cachedProducts.length, 'in products table');
      for (const p of cachedProducts) {
        if (p.code && !seenCodes.has(p.code)) {
          seenCodes.add(p.code);
          allProducts.push(mapSupabaseToProduct(p));
        }
      }
    }
  } catch (err) {
    console.error('[SupabaseProducts] searchProducts error:', err);
  }

  console.log('[SupabaseProducts] Total results:', allProducts.length);
  return allProducts;
}

export async function getScanHistory(
  userId: string,
  profileId?: string,
  limit: number = 50
): Promise<{
  id: string;
  product_code: string;
  product_name: string;
  verdict: string;
  scanned_at: string;
  profile_id: string;
}[]> {
  try {
    let query = supabase
      .from('scan_history')
      .select('*')
      .eq('user_id', userId)
      .order('scanned_at', { ascending: false })
      .limit(limit);

    if (profileId) {
      query = query.eq('profile_id', profileId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[SupabaseProducts] getScanHistory error:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[SupabaseProducts] getScanHistory exception:', err);
    return [];
  }
}

export async function clearUserScanHistory(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('scan_history')
      .delete()
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function removeOneScanHistory(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('scan_history')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: msg };
  }
}

export async function getAdminStats(): Promise<{
  totalUsers: number;
  adminUsers: number;
  regularUsers: number;
  totalProfiles: number;
  totalScans: number;
  totalFavorites: number;
  totalProducts: number;
}> {
  try {
    const [usersRes, profilesRes, scansRes, favsRes, productsRes] = await Promise.all([
      supabase.from('users').select('id, is_admin'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('scan_history').select('id', { count: 'exact', head: true }),
      supabase.from('favorites').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
    ]);

    const users = usersRes.data || [];
    const adminCount = users.filter((u: any) => u.is_admin).length;

    return {
      totalUsers: users.length,
      adminUsers: adminCount,
      regularUsers: users.length - adminCount,
      totalProfiles: profilesRes.count || 0,
      totalScans: scansRes.count || 0,
      totalFavorites: favsRes.count || 0,
      totalProducts: productsRes.count || 0,
    };
  } catch (err) {
    console.error('[SupabaseProducts] getAdminStats error:', err);
    return {
      totalUsers: 0,
      adminUsers: 0,
      regularUsers: 0,
      totalProfiles: 0,
      totalScans: 0,
      totalFavorites: 0,
      totalProducts: 0,
    };
  }
}

export async function getRecentScansForAdmin(limit: number = 20): Promise<{
  id: string;
  user_id: string;
  product_code: string;
  product_name: string;
  verdict: string;
  scanned_at: string;
}[]> {
  try {
    const { data, error } = await supabase
      .from('scan_history')
      .select('*')
      .order('scanned_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[SupabaseProducts] getRecentScansForAdmin error:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[SupabaseProducts] getRecentScansForAdmin exception:', err);
    return [];
  }
}

function mapSupabaseToProduct(data: any): Product {
  return {
    code: data.code || '',
    product_name: data.product_name || undefined,
    brands: data.brands || undefined,
    image_url: data.image_url || undefined,
    image_front_url: data.image_front_url || undefined,
    ingredients_text: data.ingredients_text || undefined,
    allergens: data.allergens || undefined,
    allergens_tags: data.allergens_tags || [],
    traces: data.traces || undefined,
    traces_tags: data.traces_tags || [],
    categories: data.categories || undefined,
    categories_tags: data.categories_tags || [],
    source: (data.source || 'openfoodfacts') as Product['source'],
  };
}

export async function getProductByCode(code: string): Promise<Product | null> {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('code', code)
      .maybeSingle();

    if (error || !data) return null;
    return mapSupabaseToProduct(data);
  } catch {
    return null;
  }
}
