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
const OBF_API = 'https://world.openbeautyfacts.org/api/v2';
const OPF_API = 'https://world.openproductsfacts.org/api/v2';
const UPC_DATABASE_API = 'https://api.upcdatabase.org/product';
const BARCODE_LOOKUP_API = 'https://api.barcodelookup.com/v3/products';
const EAN_SEARCH_API = 'https://ean-search.org/api';
const USDA_API = 'https://api.nal.usda.gov/fdc/v1';
const NUTRITIONIX_API = 'https://trackapi.nutritionix.com/v2';
const EDAMAM_API = 'https://api.edamam.com/api/food-database/v2';
const UPC_ITEM_DB_API = 'https://api.upcitemdb.com/prod/trial/lookup';
const WORLD_UPC_API = 'https://api.worldupc.com/api/v2';
const DATAKICK_API = 'https://www.datakick.org/api/items';

export async function searchProductByBarcode(barcode: string, useCache: boolean = true): Promise<Product | null> {
  const normalizedBarcode = barcode.trim();
  const now = Date.now();
  if (normalizedBarcode === lastBarcode && now - lastBarcodeTime < BARCODE_DEBOUNCE_MS) {
    if (__DEV__) console.log('[Products] Debouncing duplicate barcode request');
    return null;
  }
  lastBarcode = normalizedBarcode;
  lastBarcodeTime = now;

  if (__DEV__) console.log('[Products] Searching for barcode:', normalizedBarcode);

  try {
    const supabaseProduct = await getProductByCode(normalizedBarcode);
    if (supabaseProduct && supabaseProduct.product_name && supabaseProduct.product_name !== 'Unknown Product') {
      console.log('[Products] ✅ Found in Supabase products table:', supabaseProduct.product_name);
      await cacheProduct(supabaseProduct);
      return supabaseProduct;
    }
  } catch (err) {
    console.log('[Products] Supabase lookup failed (non-critical):', err);
  }

  const manualStored = await AsyncStorage.getItem(MANUAL_ENTRIES_KEY);
  if (manualStored) {
    try {
      const manualEntries = JSON.parse(manualStored);
      const manualEntry = manualEntries.find((e: any) => e.barcode === barcode);
      if (manualEntry) {
        console.log('Found manual entry for barcode:', barcode);
        return {
          code: manualEntry.barcode,
          product_name: manualEntry.productName,
          brands: manualEntry.brand,
          ingredients_text: manualEntry.ingredients,
          allergens_tags: [],
          traces_tags: [],
          source: 'manual_entry' as const,
        };
      }
    } catch (error) {
      console.error('Error reading manual entries:', error);
    }
  }
  
  if (useCache) {
    const cached = await getCachedProduct(barcode);
    if (cached) {
      console.log('Returning cached product');
      return cached;
    }
  }
  
  const sources = [
    { api: OFF_API, source: 'openfoodfacts' as const, type: 'openx' },
    { api: OBF_API, source: 'openbeautyfacts' as const, type: 'openx' },
    { api: OPF_API, source: 'openproductsfacts' as const, type: 'openx' },
    { api: UPC_DATABASE_API, source: 'upcdatabase' as const, type: 'upc' },
    { api: UPC_ITEM_DB_API, source: 'upcitemdb' as const, type: 'upcitemdb' },
    { api: BARCODE_LOOKUP_API, source: 'barcodelookup' as const, type: 'barcodelookup' },
    { api: WORLD_UPC_API, source: 'worldupc' as const, type: 'worldupc' },
    { api: EAN_SEARCH_API, source: 'eansearch' as const, type: 'eansearch' },
    { api: DATAKICK_API, source: 'datakick' as const, type: 'datakick' },
    { api: USDA_API, source: 'usda' as const, type: 'usda' },
    { api: NUTRITIONIX_API, source: 'nutritionix' as const, type: 'nutritionix' },
    { api: EDAMAM_API, source: 'edamam' as const, type: 'edamam' },
  ];

  for (const { api, source, type } of sources) {
    try {
      let data: any = null;
      let productData: any = null;

      switch (type) {
        case 'openx':
          data = await safeFetch(`${api}/product/${barcode}.json`);
          if (data.status === 1 && data.product) {
            productData = { ...data.product, source };
          }
          break;

        case 'upc':
          data = await safeFetch(`${api}/${barcode}`, {
            headers: { 'Accept': 'application/json' }
          });
          if (data.success && data.product) {
            productData = {
              code: barcode,
              product_name: data.product.title || data.product.description,
              brands: data.product.brand,
              image_url: data.product.image,
              image_front_url: data.product.image,
              ingredients_text: data.product.ingredients || '',
              allergens: data.product.allergens || '',
              allergens_tags: [],
              traces: '',
              traces_tags: [],
              categories: data.product.category,
              categories_tags: data.product.category ? [data.product.category] : [],
              source,
            };
          }
          break;

        case 'barcodelookup':
          console.log('Skipping barcodelookup: API key required');
          continue;

        case 'eansearch':
          try {
            const eanResponse = await safeFetch(`${api}?op=barcode-lookup&barcode=${barcode}&format=json`);
            if (!eanResponse) {
              console.log('eansearch returned empty response');
              continue;
            }
            if (typeof eanResponse === 'string') {
              if (eanResponse.trim().length === 0 || eanResponse.startsWith('<')) {
                console.log('eansearch returned invalid string response');
                continue;
              }
              try {
                data = JSON.parse(eanResponse);
              } catch {
                console.log('eansearch returned unparseable JSON string');
                continue;
              }
            } else {
              data = eanResponse;
            }
          } catch {
            console.log('eansearch request failed');
            continue;
          }
          if (Array.isArray(data) && data.length > 0 && data[0].name) {
            productData = {
              code: barcode,
              product_name: data[0].name,
              brands: data[0].company || '',
              image_url: '',
              image_front_url: '',
              ingredients_text: '',
              allergens: '',
              allergens_tags: [],
              traces: '',
              traces_tags: [],
              categories: data[0].category || '',
              categories_tags: data[0].category ? [data[0].category] : [],
              source,
            };
          }
          break;

        case 'usda':
          data = await safeFetch(`${api}/foods/search?query=${barcode}&api_key=DEMO_KEY`);
          if (data.foods && data.foods.length > 0) {
            const food = data.foods[0];
            productData = {
              code: barcode,
              product_name: food.description,
              brands: food.brandOwner || '',
              image_url: '',
              image_front_url: '',
              ingredients_text: food.ingredients || '',
              allergens: '',
              allergens_tags: [],
              traces: '',
              traces_tags: [],
              categories: food.foodCategory || '',
              categories_tags: food.foodCategory ? [food.foodCategory] : [],
              source,
            };
          }
          break;

        case 'nutritionix':
          console.log('Skipping nutritionix: API credentials required');
          continue;

        case 'edamam':
          console.log('Skipping edamam: API credentials required');
          continue;

        case 'worldupc':
          console.log('Skipping worldupc: API key required');
          continue;

        case 'upcitemdb':
          try {
            data = await safeFetch(`${api}?upc=${barcode}`);
          } catch {
            console.log(`upcitemdb request failed`);
            continue;
          }
          if (data.items && data.items.length > 0) {
            const item = data.items[0];
            productData = {
              code: barcode,
              product_name: item.title || item.description,
              brands: item.brand || '',
              image_url: item.images?.[0] || '',
              image_front_url: item.images?.[0] || '',
              ingredients_text: '',
              allergens: '',
              allergens_tags: [],
              traces: '',
              traces_tags: [],
              categories: item.category || '',
              categories_tags: item.category ? [item.category] : [],
              source,
            };
          }
          break;

        case 'datakick':
          try {
            data = await safeFetch(`${api}/${barcode}`);
          } catch {
            console.log(`datakick request failed`);
            continue;
          }
          if (data.name) {
            productData = {
              code: barcode,
              product_name: data.name,
              brands: data.brand_name || '',
              image_url: data.images?.[0]?.url || '',
              image_front_url: data.images?.[0]?.url || '',
              ingredients_text: data.ingredients || '',
              allergens: data.allergens || '',
              allergens_tags: [],
              traces: '',
              traces_tags: [],
              categories: data.category || '',
              categories_tags: data.category ? [data.category] : [],
              source,
            };
          }
          break;
      }

      if (productData) {
        if (__DEV__) console.log(`[Products] Found in ${source}:`, productData.product_name);
        await cacheProduct(productData);
        addToOfflineCache(productData).catch(() => {});
        upsertProduct(productData).catch((err) => {
          console.log('[Products] Non-critical: failed to persist to Supabase:', err);
        });
        return productData;
      }
    } catch (error) {
      console.error(`Error searching ${source}:`, error);
    }
  }

  const offlineProduct = await getFromOfflineCache(barcode);
  if (offlineProduct) {
    if (__DEV__) console.log('[Products] Found in offline cache:', offlineProduct.product_name);
    return offlineProduct;
  }

  if (__DEV__) console.log('[Products] Product not found in any database');
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
