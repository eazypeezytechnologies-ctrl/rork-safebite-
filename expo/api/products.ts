import { Product, ProductSearchResult } from '@/types';
import { getCachedProduct, cacheProduct } from '@/storage/productCache';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeFetch } from '@/utils/safeFetch';
import { upsertProduct, searchProducts as supabaseSearchProducts, getProductByCode } from '@/services/supabaseProducts';

const MANUAL_ENTRIES_KEY = 'manual_ingredient_entries';
const OFFLINE_CACHE_KEY = '@allergy_guardian_offline_products';
const MAX_OFFLINE_PRODUCTS = 50;
const BARCODE_DEBOUNCE_MS = 500;

let lastBarcodeTime = 0;
let lastBarcode = '';

export function resetBarcodeDebounce(): void {
  lastBarcode = '';
  lastBarcodeTime = 0;
  console.log('[Products] Barcode debounce reset');
}

interface OfflineCacheEntry {
  product: Product;
  cachedAt: string;
}

async function getOfflineCache(): Promise<Record<string, OfflineCacheEntry>> {
  try {
    const data = await AsyncStorage.getItem(OFFLINE_CACHE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

async function addToOfflineCache(product: Product): Promise<void> {
  try {
    const cache = await getOfflineCache();
    cache[product.code] = { product, cachedAt: new Date().toISOString() };
    
    const entries = Object.entries(cache);
    if (entries.length > MAX_OFFLINE_PRODUCTS) {
      entries.sort((a, b) => {
        return (b[1].cachedAt || '').localeCompare(a[1].cachedAt || '');
      });
      const trimmed = Object.fromEntries(entries.slice(0, MAX_OFFLINE_PRODUCTS));
      await AsyncStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(trimmed));
    } else {
      await AsyncStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(cache));
    }
  } catch (error) {
    if (__DEV__) console.log('[Products] Failed to cache for offline:', error);
  }
}

async function getFromOfflineCache(barcode: string): Promise<Product | null> {
  try {
    const cache = await getOfflineCache();
    const entry = cache[barcode];
    if (!entry) return null;
    return entry.product;
  } catch {
    return null;
  }
}

const OFF_API = 'https://world.openfoodfacts.org/api/v2';
const USDA_API = 'https://api.nal.usda.gov/fdc/v1';
const DATAKICK_API = 'https://www.datakick.org/api/items';

const FAST_TIMEOUT_MS = 8000;

export async function searchProductByBarcode(barcode: string, useCache: boolean = true): Promise<Product | null> {
  const normalizedBarcode = barcode.trim();
  const now = Date.now();
  if (normalizedBarcode === lastBarcode && now - lastBarcodeTime < BARCODE_DEBOUNCE_MS) {
    if (__DEV__) console.log('[Products] Debouncing duplicate barcode request');
    return null;
  }
  lastBarcode = normalizedBarcode;
  lastBarcodeTime = now;

  const lookupStart = Date.now();
  if (__DEV__) console.log('[Products] Searching for barcode:', normalizedBarcode);

  if (useCache) {
    const cached = await getCachedProduct(normalizedBarcode);
    if (cached) {
      console.log('[Products] ✅ Returning local cached product (' + (Date.now() - lookupStart) + 'ms)');
      return cached;
    }
  }

  const [supabaseResult, manualResult, offlineResult] = await Promise.all([
    getProductByCode(normalizedBarcode).catch((err) => {
      console.log('[Products] Supabase lookup failed (non-critical):', err);
      return null;
    }),
    AsyncStorage.getItem(MANUAL_ENTRIES_KEY).then((stored) => {
      if (!stored) return null;
      try {
        const entries = JSON.parse(stored);
        const entry = entries.find((e: any) => e.barcode === normalizedBarcode);
        if (entry) {
          return {
            code: entry.barcode,
            product_name: entry.productName,
            brands: entry.brand,
            ingredients_text: entry.ingredients,
            allergens_tags: [],
            traces_tags: [],
            source: 'manual_entry' as const,
          } as Product;
        }
      } catch (error) {
        console.error('Error reading manual entries:', error);
      }
      return null;
    }).catch(() => null),
    getFromOfflineCache(normalizedBarcode).catch(() => null),
  ]);

  if (manualResult && manualResult.ingredients_text) {
    console.log('[Products] ✅ User-corrected manual entry takes priority (' + (Date.now() - lookupStart) + 'ms)');
    return manualResult;
  }

  if (supabaseResult && supabaseResult.product_name && supabaseResult.product_name !== 'Unknown Product') {
    const isCorrected = supabaseResult.source === 'manual_entry' && supabaseResult.ingredients_text;
    if (isCorrected) {
      console.log('[Products] ✅ User-corrected Supabase data takes priority (' + (Date.now() - lookupStart) + 'ms):', supabaseResult.product_name);
      cacheProduct(supabaseResult).catch(() => {});
      return supabaseResult;
    }
    console.log('[Products] ✅ Found in Supabase (' + (Date.now() - lookupStart) + 'ms):', supabaseResult.product_name);
    cacheProduct(supabaseResult).catch(() => {});
    return supabaseResult;
  }

  if (manualResult) {
    console.log('[Products] ✅ Found manual entry (' + (Date.now() - lookupStart) + 'ms)');
    return manualResult;
  }

  const isNumericBarcode = /^\d{8,14}$/.test(normalizedBarcode);

  if (!isNumericBarcode) {
    console.log('[Products] Non-numeric barcode, skipping external APIs:', normalizedBarcode.substring(0, 30));
    if (offlineResult) return offlineResult;
    return null;
  }

  const externalResult = await fetchFromExternalSourcesParallel(normalizedBarcode);

  if (externalResult) {
    if (supabaseResult && supabaseResult.ingredients_text && !externalResult.ingredients_text) {
      console.log('[Products] ✅ Supabase has better data than external, using Supabase (' + (Date.now() - lookupStart) + 'ms)');
      cacheProduct(supabaseResult).catch(() => {});
      return supabaseResult;
    }
    console.log('[Products] ✅ Found externally (' + (Date.now() - lookupStart) + 'ms):', externalResult.product_name);
    cacheProduct(externalResult).catch(() => {});
    addToOfflineCache(externalResult).catch(() => {});
    upsertProduct(externalResult).catch((err) => {
      console.log('[Products] Non-critical: failed to persist to Supabase:', err);
    });
    return externalResult;
  }

  if (offlineResult) {
    if (__DEV__) console.log('[Products] Found in offline cache (' + (Date.now() - lookupStart) + 'ms)');
    return offlineResult;
  }

  if (__DEV__) console.log('[Products] Product not found in any database (' + (Date.now() - lookupStart) + 'ms)');
  return null;
}

async function fetchWithTimeout(url: string, timeoutMs: number, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function fetchOpenFoodFacts(barcode: string): Promise<Product | null> {
  try {
    const response = await fetchWithTimeout(`${OFF_API}/product/${barcode}.json`, FAST_TIMEOUT_MS);
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
      source: 'openfoodfacts' as const,
    };
  } catch (error) {
    console.log('[Products] OpenFoodFacts fetch error:', error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchUsda(barcode: string): Promise<Product | null> {
  try {
    const response = await fetchWithTimeout(`${USDA_API}/foods/search?query=${barcode}&api_key=DEMO_KEY`, FAST_TIMEOUT_MS);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.foods || data.foods.length === 0) return null;
    const food = data.foods[0];
    return {
      code: barcode,
      product_name: food.description || '',
      brands: food.brandOwner || '',
      ingredients_text: food.ingredients || '',
      allergens_tags: [],
      traces_tags: [],
      categories: food.foodCategory || '',
      categories_tags: food.foodCategory ? [food.foodCategory] : [],
      source: 'usda' as const,
    };
  } catch (error) {
    console.log('[Products] USDA fetch error:', error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchDatakick(barcode: string): Promise<Product | null> {
  try {
    const response = await fetchWithTimeout(`${DATAKICK_API}/${barcode}`, FAST_TIMEOUT_MS);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.name) return null;
    return {
      code: barcode,
      product_name: data.name,
      brands: data.brand_name || '',
      image_url: data.images?.[0]?.url || '',
      image_front_url: data.images?.[0]?.url || '',
      ingredients_text: data.ingredients || '',
      allergens: data.allergens || '',
      allergens_tags: [],
      traces_tags: [],
      categories: data.category || '',
      categories_tags: data.category ? [data.category] : [],
      source: 'datakick' as const,
    };
  } catch (error) {
    console.log('[Products] Datakick fetch error:', error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchFromExternalSourcesParallel(barcode: string): Promise<Product | null> {
  console.log('[Products] Fetching from external sources (parallel primary)...');
  const primaryStart = Date.now();

  const [offResult, usdaResult] = await Promise.all([
    fetchOpenFoodFacts(barcode),
    fetchUsda(barcode),
  ]);

  if (offResult && offResult.product_name) {
    console.log('[Products] Primary hit: OpenFoodFacts (' + (Date.now() - primaryStart) + 'ms)');
    return offResult;
  }

  if (usdaResult && usdaResult.product_name) {
    console.log('[Products] Primary hit: USDA (' + (Date.now() - primaryStart) + 'ms)');
    return usdaResult;
  }

  console.log('[Products] Primary sources empty, trying Datakick...');
  const datakickResult = await fetchDatakick(barcode);
  if (datakickResult && datakickResult.product_name) {
    console.log('[Products] Secondary hit: Datakick (' + (Date.now() - primaryStart) + 'ms)');
    return datakickResult;
  }

  console.log('[Products] All external sources exhausted (' + (Date.now() - primaryStart) + 'ms)');
  return null;
}

export async function searchProductsByName(query: string, page: number = 1, userId?: string): Promise<ProductSearchResult> {
  console.log('[Products] Searching for product name:', query, 'userId:', userId);
  
  const allProducts: Product[] = [];
  const seenCodes = new Set<string>();
  
  try {
    const supabaseResults = await supabaseSearchProducts(query, userId, 20);
    for (const p of supabaseResults) {
      if (p.code && !seenCodes.has(p.code)) {
        seenCodes.add(p.code);
        allProducts.push(p);
      }
    }
    console.log(`[Products] Found ${supabaseResults.length} from Supabase`);

    if (allProducts.length === 0) {
      try {
        console.log('[Products] No Supabase results, trying OpenFoodFacts API...');
        const data = await safeFetch(
          `${OFF_API}/search?search_terms=${encodeURIComponent(query)}&page=${page}&page_size=10&fields=code,product_name,brands,image_url,image_front_url,ingredients_text,allergens,allergens_tags,traces,traces_tags,categories,categories_tags`
        );
        
        const apiProducts = (data.products || []).map((p: Product) => ({
          ...p,
          source: 'openfoodfacts' as const,
        })).filter((p: Product) => {
          const pName = (p.product_name || '').toLowerCase();
          const pBrand = (p.brands || '').toLowerCase();
          const q = query.toLowerCase();
          return pName.includes(q) || pBrand.includes(q) || q.includes(pName);
        });
        
        for (const p of apiProducts) {
          if (p.code && !seenCodes.has(p.code)) {
            seenCodes.add(p.code);
            allProducts.push(p);
            upsertProduct(p).catch(() => {});
          }
        }
        
        console.log(`[Products] Found ${apiProducts.length} relevant results from OpenFoodFacts API`);
      } catch (apiError) {
        console.log('[Products] OpenFoodFacts API search failed:', apiError);
      }
    }

    console.log(`[Products] Total search results: ${allProducts.length}`);
    
    return {
      products: allProducts,
      count: allProducts.length,
      page: page,
      page_size: 20,
    };
  } catch (error) {
    console.error('[Products] Error searching products:', error);
    return {
      products: allProducts.length > 0 ? allProducts : [],
      count: allProducts.length,
      page: 1,
      page_size: 20,
    };
  }
}

export async function searchProductByUrl(url: string): Promise<Product | null> {
  console.log('Extracting product from URL:', url);
  
  const barcodeMatch = url.match(/\/product\/(\d+)/);
  if (barcodeMatch) {
    const barcode = barcodeMatch[1];
    return searchProductByBarcode(barcode);
  }
  
  console.log('Could not extract barcode from URL');
  return null;
}
