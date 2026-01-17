import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';
import { SupabaseService } from '@/backend/services/supabaseService';
import { 
  normalizeProduct, 
  NormalizedProduct, 
  RawProductData,
  ProductSource,
  DetectedAllergen 
} from '@/utils/productNormalization';

const OFF_API = 'https://world.openfoodfacts.org/api/v2';
const OBF_API = 'https://world.openbeautyfacts.org/api/v2';
const OPF_API = 'https://world.openproductsfacts.org/api/v2';
const UPC_ITEM_DB_API = 'https://api.upcitemdb.com/prod/trial/lookup';
const DATAKICK_API = 'https://www.datakick.org/api/items';
const USDA_API = 'https://api.nal.usda.gov/fdc/v1';

// Dynamic TTL constants (in milliseconds)
const TTL_MIN_MS = 1 * 24 * 60 * 60 * 1000;      // 1 day minimum
const TTL_MAX_MS = 30 * 24 * 60 * 60 * 1000;     // 30 days maximum
const TTL_DEFAULT_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days default

// TTL thresholds
const HIGH_SCAN_THRESHOLD = 100;   // Products scanned 100+ times
const MED_SCAN_THRESHOLD = 20;     // Products scanned 20+ times
const LOW_CONFIDENCE_THRESHOLD = 0.7;
const VERY_LOW_CONFIDENCE_THRESHOLD = 0.5;

const LOCK_TTL_SECONDS = 30;
const LOCK_WAIT_MS = 500;
const MAX_LOCK_RETRIES = 10;

interface LookupProduct {
  code: string;
  product_name: string;
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
  source_url?: string;
  confidence?: number;
}

interface LookupResult {
  product: LookupProduct | null;
  fromCache: boolean;
  source: ProductSource | 'cache' | 'not_found';
  freshness: 'fresh' | 'stale' | 'expired' | 'new';
  expiresAt: string | null;
  confidence: number;
  detectedAllergens: DetectedAllergen[];
}

async function fetchFromOpenX(barcode: string, apiUrl: string): Promise<RawProductData | null> {
  try {
    const response = await fetch(`${apiUrl}/product/${barcode}.json`);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    return {
      code: p.code || barcode,
      product_name: p.product_name || '',
      brands: p.brands,
      image_url: p.image_url,
      image_front_url: p.image_front_url,
      ingredients_text: p.ingredients_text,
      allergens: p.allergens,
      allergens_tags: p.allergens_tags || [],
      traces: p.traces,
      traces_tags: p.traces_tags || [],
      categories: p.categories,
      categories_tags: p.categories_tags || [],
      _raw: p,
    };
  } catch (error) {
    console.log(`[ProductLookup] OpenX API error:`, error);
    return null;
  }
}

async function fetchFromUpcItemDb(barcode: string): Promise<RawProductData | null> {
  try {
    const response = await fetch(`${UPC_ITEM_DB_API}?upc=${barcode}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.items || data.items.length === 0) return null;

    const item = data.items[0];
    return {
      code: barcode,
      product_name: item.title || item.description || '',
      brands: item.brand,
      image_url: item.images?.[0],
      image_front_url: item.images?.[0],
      ingredients_text: '',
      allergens: '',
      allergens_tags: [],
      traces: '',
      traces_tags: [],
      categories: item.category,
      categories_tags: item.category ? [item.category] : [],
      _raw: item,
    };
  } catch (error) {
    console.log(`[ProductLookup] UPCItemDB error:`, error);
    return null;
  }
}

async function fetchFromDatakick(barcode: string): Promise<RawProductData | null> {
  try {
    const response = await fetch(`${DATAKICK_API}/${barcode}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.name) return null;

    return {
      code: barcode,
      product_name: data.name,
      brands: data.brand_name,
      image_url: data.images?.[0]?.url,
      image_front_url: data.images?.[0]?.url,
      ingredients_text: data.ingredients,
      allergens: data.allergens,
      allergens_tags: [],
      traces: '',
      traces_tags: [],
      categories: data.category,
      categories_tags: data.category ? [data.category] : [],
      _raw: data,
    };
  } catch (error) {
    console.log(`[ProductLookup] Datakick error:`, error);
    return null;
  }
}

async function fetchFromUsda(barcode: string): Promise<RawProductData | null> {
  try {
    const apiKey = process.env.USDA_API_KEY || 'DEMO_KEY';
    const response = await fetch(`${USDA_API}/foods/search?query=${barcode}&api_key=${apiKey}`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.foods || data.foods.length === 0) return null;

    const food = data.foods[0];
    return {
      code: barcode,
      product_name: food.description || '',
      brands: food.brandOwner,
      image_url: '',
      image_front_url: '',
      ingredients_text: food.ingredients,
      allergens: '',
      allergens_tags: [],
      traces: '',
      traces_tags: [],
      categories: food.foodCategory,
      categories_tags: food.foodCategory ? [food.foodCategory] : [],
      _raw: food,
    };
  } catch (error) {
    console.log(`[ProductLookup] USDA error:`, error);
    return null;
  }
}

async function fetchFromExternalApis(barcode: string): Promise<{ product: NormalizedProduct; source: ProductSource } | null> {
  console.log(`[ProductLookup] Fetching from external APIs for barcode: ${barcode}`);

  const sources: { fetch: () => Promise<RawProductData | null>; source: ProductSource }[] = [
    { fetch: () => fetchFromOpenX(barcode, OFF_API), source: 'openfoodfacts' },
    { fetch: () => fetchFromOpenX(barcode, OBF_API), source: 'openbeautyfacts' },
    { fetch: () => fetchFromOpenX(barcode, OPF_API), source: 'openproductsfacts' },
    { fetch: () => fetchFromUpcItemDb(barcode), source: 'upcitemdb' },
    { fetch: () => fetchFromDatakick(barcode), source: 'datakick' },
    { fetch: () => fetchFromUsda(barcode), source: 'usda' },
  ];

  for (const { fetch, source } of sources) {
    const startTime = Date.now();
    try {
      const rawProduct = await fetch();
      const latencyMs = Date.now() - startTime;
      
      if (rawProduct && rawProduct.product_name) {
        console.log(`[ProductLookup] Found product in ${source}: ${rawProduct.product_name} (${latencyMs}ms)`);
        const normalized = normalizeProduct(rawProduct, source);
        console.log(`[ProductLookup] Normalized product with ${normalized.detected_allergens.length} detected allergens`);
        
        SupabaseService.logProductFetch({
          barcode,
          source,
          success: true,
          latency_ms: latencyMs,
          from_cache: false,
          confidence: normalized.confidence,
        }).catch(() => {});
        
        return { product: normalized, source };
      }
      
      SupabaseService.logProductFetch({
        barcode,
        source,
        success: false,
        latency_ms: latencyMs,
        from_cache: false,
        error_message: 'Product not found or missing name',
      }).catch(() => {});
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      console.log(`[ProductLookup] Error fetching from ${source} (${latencyMs}ms):`, error);
      
      SupabaseService.logProductFetch({
        barcode,
        source,
        success: false,
        latency_ms: latencyMs,
        from_cache: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      }).catch(() => {});
    }
  }

  console.log(`[ProductLookup] Product not found in any external API`);
  return null;
}

async function getCachedProduct(barcode: string): Promise<{
  product: LookupProduct;
  source: ProductSource;
  cachedAt: string;
  expiresAt: string;
  isExpired: boolean;
  confidence: number;
  detectedAllergens: DetectedAllergen[];
} | null> {
  try {
    const cached = await SupabaseService.getProduct(barcode);
    if (!cached) return null;

    const cachedAt = cached.cached_at || cached.last_fetched_at || new Date().toISOString();
    
    // Use stored expires_at if available, otherwise calculate dynamically
    let expiresAt: string;
    if (cached.expires_at) {
      expiresAt = cached.expires_at;
    } else {
      // Fallback: calculate TTL for legacy cached products
      const ttlFactors: TTLFactors = {
        scanCount: cached.scan_count || 0,
        confidence: cached.confidence || 0.5,
        hasIngredients: !!(cached.ingredients_text && cached.ingredients_text.length > 10),
        hasAllergenInfo: (Array.isArray(cached.detected_allergens) && cached.detected_allergens.length > 0) ||
                         (Array.isArray(cached.allergens_tags) && cached.allergens_tags.length > 0),
        source: (cached.source as ProductSource) || 'openfoodfacts',
      };
      const ttlMs = calculateDynamicTTL(ttlFactors);
      expiresAt = new Date(new Date(cachedAt).getTime() + ttlMs).toISOString();
    }
    
    const isExpired = new Date() > new Date(expiresAt);

    const detectedAllergens: DetectedAllergen[] = Array.isArray(cached.detected_allergens) 
      ? cached.detected_allergens 
      : [];

    return {
      product: {
        code: cached.code,
        product_name: cached.product_name || '',
        brands: cached.brands,
        image_url: cached.image_url,
        image_front_url: cached.image_front_url,
        ingredients_text: cached.ingredients_text,
        ingredients_raw: cached.ingredients_raw,
        ingredients_tokens: cached.ingredients_tokens || [],
        allergens: cached.allergens,
        allergens_tags: cached.allergens_tags || [],
        traces: cached.traces,
        traces_tags: cached.traces_tags || [],
        categories: cached.categories,
        categories_tags: cached.categories_tags || [],
        detected_allergens: detectedAllergens,
        source_url: cached.source_url,
        confidence: cached.confidence || 0.5,
      },
      source: (cached.source as ProductSource) || 'openfoodfacts',
      cachedAt,
      expiresAt,
      isExpired,
      confidence: cached.confidence || 0.5,
      detectedAllergens,
    };
  } catch (error) {
    console.error('[ProductLookup] Cache lookup error:', error);
    return null;
  }
}

interface TTLFactors {
  scanCount: number;
  confidence: number;
  hasIngredients: boolean;
  hasAllergenInfo: boolean;
  source: ProductSource;
}

function calculateDynamicTTL(factors: TTLFactors): number {
  let ttlMs = TTL_DEFAULT_MS;
  
  // Factor 1: Popularity (high scan count = refresh more often)
  if (factors.scanCount >= HIGH_SCAN_THRESHOLD) {
    ttlMs = Math.min(ttlMs, 2 * 24 * 60 * 60 * 1000); // 2 days for very popular
  } else if (factors.scanCount >= MED_SCAN_THRESHOLD) {
    ttlMs = Math.min(ttlMs, 4 * 24 * 60 * 60 * 1000); // 4 days for moderately popular
  }
  
  // Factor 2: Data quality (low confidence = refresh sooner)
  if (factors.confidence < VERY_LOW_CONFIDENCE_THRESHOLD) {
    ttlMs = Math.min(ttlMs, 2 * 24 * 60 * 60 * 1000); // 2 days for very low confidence
  } else if (factors.confidence < LOW_CONFIDENCE_THRESHOLD) {
    ttlMs = Math.min(ttlMs, 4 * 24 * 60 * 60 * 1000); // 4 days for low confidence
  } else if (factors.confidence >= 0.9) {
    ttlMs = Math.max(ttlMs, 14 * 24 * 60 * 60 * 1000); // 14+ days for high confidence
  }
  
  // Factor 3: Missing critical data = refresh sooner
  if (!factors.hasIngredients) {
    ttlMs = Math.min(ttlMs, 3 * 24 * 60 * 60 * 1000); // 3 days if no ingredients
  }
  if (!factors.hasAllergenInfo && !factors.hasIngredients) {
    ttlMs = Math.min(ttlMs, 1 * 24 * 60 * 60 * 1000); // 1 day if no allergen data at all
  }
  
  // Factor 4: Source reliability affects stability
  const stableSources: ProductSource[] = ['openfoodfacts', 'usda'];
  if (stableSources.includes(factors.source) && factors.confidence >= 0.85) {
    ttlMs = Math.max(ttlMs, 10 * 24 * 60 * 60 * 1000); // 10+ days for stable sources
  }
  
  // Clamp to min/max bounds
  return Math.max(TTL_MIN_MS, Math.min(TTL_MAX_MS, ttlMs));
}

function formatTTLDays(ttlMs: number): string {
  const days = Math.round(ttlMs / (24 * 60 * 60 * 1000));
  return `${days} day${days !== 1 ? 's' : ''}`;
}

async function upsertProduct(
  product: NormalizedProduct,
  source: ProductSource,
  existingScanCount: number = 0
): Promise<{ expiresAt: string }> {
  const now = new Date();
  const nowISO = now.toISOString();
  
  // Calculate dynamic TTL based on product quality
  const ttlFactors: TTLFactors = {
    scanCount: existingScanCount + 1,
    confidence: product.confidence,
    hasIngredients: !!(product.ingredients_text && product.ingredients_text.length > 10),
    hasAllergenInfo: product.detected_allergens.length > 0 || 
                     (product.allergens_tags && product.allergens_tags.length > 0),
    source,
  };
  
  const ttlMs = calculateDynamicTTL(ttlFactors);
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();
  
  console.log(`[ProductLookup] Calculated TTL: ${formatTTLDays(ttlMs)} for product ${product.code}`);
  console.log(`[ProductLookup] TTL factors: scanCount=${ttlFactors.scanCount}, confidence=${ttlFactors.confidence.toFixed(2)}, hasIngredients=${ttlFactors.hasIngredients}, hasAllergenInfo=${ttlFactors.hasAllergenInfo}`);

  try {
    await SupabaseService.upsertProduct({
      code: product.code,
      product_name: product.product_name,
      brands: product.brands,
      image_url: product.image_url,
      image_front_url: product.image_front_url,
      ingredients_text: product.ingredients_text,
      ingredients_raw: product.ingredients_raw,
      ingredients_tokens: product.ingredients_tokens,
      allergens: product.allergens,
      allergens_tags: product.allergens_tags,
      traces: product.traces,
      traces_tags: product.traces_tags,
      categories: product.categories,
      categories_tags: product.categories_tags,
      detected_allergens: product.detected_allergens,
      source,
      source_url: product.source_url,
      confidence: product.confidence,
      cached_at: nowISO,
      last_fetched_at: nowISO,
      normalized_at: nowISO,
      expires_at: expiresAt,
      scan_count: existingScanCount + 1,
    });
    console.log(`[ProductLookup] Product upserted with dynamic TTL: ${product.code}, expires: ${expiresAt}`);
    return { expiresAt };
  } catch (error) {
    console.error('[ProductLookup] Error upserting product:', error);
    return { expiresAt };
  }
}

export const productLookupRoute = publicProcedure
  .input(z.object({
    barcode: z.string().min(1),
    forceRefresh: z.boolean().optional().default(false),
  }))
  .query(async ({ input }): Promise<LookupResult> => {
    const { barcode, forceRefresh } = input;
    console.log(`[ProductLookup] Looking up barcode: ${barcode}, forceRefresh: ${forceRefresh}`);

    // Step 1: Check cache
    const cached = await getCachedProduct(barcode);

    if (cached && !forceRefresh && !cached.isExpired) {
      console.log(`[ProductLookup] Returning cached product (fresh)`);
      
      SupabaseService.logProductFetch({
        barcode,
        source: 'cache',
        success: true,
        latency_ms: 0,
        from_cache: true,
        cache_hit: true,
        cache_expired: false,
        confidence: cached.confidence,
      }).catch(() => {});
      
      await SupabaseService.incrementScanCount(barcode).catch(e => 
        console.error('[ProductLookup] Error incrementing scan count:', e)
      );

      return {
        product: cached.product,
        fromCache: true,
        source: 'cache',
        freshness: 'fresh',
        expiresAt: cached.expiresAt,
        confidence: cached.confidence,
        detectedAllergens: cached.detectedAllergens,
      };
    }

    // Step 2: Acquire lock to prevent thundering herd
    const lockAcquired = await SupabaseService.acquireFetchLock(barcode, undefined, LOCK_TTL_SECONDS);

    if (!lockAcquired) {
      // Someone else is fetching - wait and re-check cache
      console.log(`[ProductLookup] Lock not acquired, waiting for other fetch to complete: ${barcode}`);
      
      for (let retry = 0; retry < MAX_LOCK_RETRIES; retry++) {
        await new Promise(resolve => setTimeout(resolve, LOCK_WAIT_MS));
        
        // Re-check cache - another request may have populated it
        const refreshedCache = await getCachedProduct(barcode);
        if (refreshedCache && !refreshedCache.isExpired) {
          console.log(`[ProductLookup] Cache populated by another request: ${barcode}`);
          await SupabaseService.incrementScanCount(barcode).catch(e => 
            console.error('[ProductLookup] Error incrementing scan count:', e)
          );
          return {
            product: refreshedCache.product,
            fromCache: true,
            source: 'cache',
            freshness: 'fresh',
            expiresAt: refreshedCache.expiresAt,
            confidence: refreshedCache.confidence,
            detectedAllergens: refreshedCache.detectedAllergens,
          };
        }

        // Check if lock is released
        const stillLocked = await SupabaseService.isFetchLocked(barcode);
        if (!stillLocked) {
          console.log(`[ProductLookup] Lock released, breaking wait loop: ${barcode}`);
          break;
        }
      }

      // Final cache check after wait
      const finalCache = await getCachedProduct(barcode);
      if (finalCache) {
        return {
          product: finalCache.product,
          fromCache: true,
          source: 'cache',
          freshness: finalCache.isExpired ? 'stale' : 'fresh',
          expiresAt: finalCache.expiresAt,
          confidence: finalCache.confidence,
          detectedAllergens: finalCache.detectedAllergens,
        };
      }
    }

    // Track if we had an expired cache before fetching
    const hadExpiredCache = cached?.isExpired ?? false;
    const hadCacheHit = cached !== null;

    // Step 3: Fetch from external APIs (we have the lock or gave up waiting)
    try {
      const fetched = await fetchFromExternalApis(barcode);

      if (fetched) {
        // Log the successful external fetch with proper cache flags
        SupabaseService.logProductFetch({
          barcode,
          source: fetched.source,
          success: true,
          latency_ms: 0, // Already logged per-source in fetchFromExternalApis
          from_cache: false,
          cache_hit: hadCacheHit,
          cache_expired: hadExpiredCache,
          confidence: fetched.product.confidence,
        }).catch(() => {});

        // Step 4: Upsert to cache
        const existingScanCount = cached ? 
          (await SupabaseService.getProduct(barcode))?.scan_count || 0 : 0;
        const { expiresAt: newExpiresAt } = await upsertProduct(fetched.product, fetched.source, existingScanCount);

        return {
          product: {
            code: fetched.product.code,
            product_name: fetched.product.product_name,
            brands: fetched.product.brands,
            image_url: fetched.product.image_url,
            image_front_url: fetched.product.image_front_url,
            ingredients_text: fetched.product.ingredients_text,
            ingredients_raw: fetched.product.ingredients_raw,
            ingredients_tokens: fetched.product.ingredients_tokens,
            allergens: fetched.product.allergens,
            allergens_tags: fetched.product.allergens_tags,
            traces: fetched.product.traces,
            traces_tags: fetched.product.traces_tags,
            categories: fetched.product.categories,
            categories_tags: fetched.product.categories_tags,
            detected_allergens: fetched.product.detected_allergens,
            source_url: fetched.product.source_url,
            confidence: fetched.product.confidence,
          },
          fromCache: false,
          source: fetched.source,
          freshness: hadExpiredCache ? 'expired' : 'new',
          expiresAt: newExpiresAt,
          confidence: fetched.product.confidence,
          detectedAllergens: fetched.product.detected_allergens,
        };
      }
    } finally {
      // Always release lock
      if (lockAcquired) {
        await SupabaseService.releaseFetchLock(barcode);
      }
    }

    // Step 5: Return stale cache if available, otherwise not found
    if (cached) {
      console.log(`[ProductLookup] Returning stale cached product`);
      
      SupabaseService.logProductFetch({
        barcode,
        source: 'cache',
        success: true,
        latency_ms: 0,
        from_cache: true,
        cache_hit: true,
        cache_expired: true,
        confidence: cached.confidence,
      }).catch(() => {});
      
      await SupabaseService.incrementScanCount(barcode).catch(e => 
        console.error('[ProductLookup] Error incrementing scan count:', e)
      );

      return {
        product: cached.product,
        fromCache: true,
        source: 'cache',
        freshness: 'stale',
        expiresAt: cached.expiresAt,
        confidence: cached.confidence,
        detectedAllergens: cached.detectedAllergens,
      };
    }

    console.log(`[ProductLookup] Product not found: ${barcode}`);
    
    SupabaseService.logProductFetch({
      barcode,
      source: 'not_found',
      success: false,
      latency_ms: 0,
      from_cache: false,
      cache_hit: hadCacheHit,
      cache_expired: hadExpiredCache,
      error_message: 'Product not found in any source',
    }).catch(() => {});
    
    return {
      product: null,
      fromCache: false,
      source: 'not_found',
      freshness: 'new',
      expiresAt: null,
      confidence: 0,
      detectedAllergens: [],
    };
  });
