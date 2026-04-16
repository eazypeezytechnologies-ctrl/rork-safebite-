import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types';

const CACHE_KEY = '@allergy_guardian_product_cache';
const CATEGORY_OVERRIDES_KEY = '@safebite_category_overrides';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedProduct {
  product: Product;
  cachedAt: string;
}

interface ProductCache {
  [barcode: string]: CachedProduct;
}

export async function getCachedProduct(barcode: string): Promise<Product | null> {
  try {
    const cacheStr = await AsyncStorage.getItem(CACHE_KEY);
    if (!cacheStr) return null;

    const cache: ProductCache = JSON.parse(cacheStr);
    const cached = cache[barcode];

    if (!cached) return null;

    const age = Date.now() - new Date(cached.cachedAt).getTime();
    if (age > CACHE_EXPIRY_MS) {
      delete cache[barcode];
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      return null;
    }

    console.log('Product loaded from cache:', barcode);
    return cached.product;
  } catch (error) {
    console.error('Error reading product cache:', error);
    return null;
  }
}

export async function cacheProduct(product: Product): Promise<void> {
  try {
    const cacheStr = await AsyncStorage.getItem(CACHE_KEY);
    const cache: ProductCache = cacheStr ? JSON.parse(cacheStr) : {};

    const existing = cache[product.code];
    const mergedProduct = { ...product };

    if (existing?.product?.product_type && !product.product_type) {
      mergedProduct.product_type = existing.product.product_type;
      console.log('[ProductCache] Preserving user-set category:', existing.product.product_type);
    }

    cache[product.code] = {
      product: mergedProduct,
      cachedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    console.log('Product cached:', product.code);
  } catch (error) {
    console.error('Error caching product:', error);
  }
}

export async function setProductCategory(barcode: string, category: import('@/types').ProductType): Promise<void> {
  try {
    const cacheStr = await AsyncStorage.getItem(CACHE_KEY);
    const cache: ProductCache = cacheStr ? JSON.parse(cacheStr) : {};
    const cached = cache[barcode];
    if (cached) {
      cached.product.product_type = category;
      cached.cachedAt = new Date().toISOString();
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      console.log('[ProductCache] Category set for', barcode, '->', category);
    }

    const overridesStr = await AsyncStorage.getItem(CATEGORY_OVERRIDES_KEY);
    const overrides: Record<string, string> = overridesStr ? JSON.parse(overridesStr) : {};
    overrides[barcode] = category;
    await AsyncStorage.setItem(CATEGORY_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (error) {
    console.error('[ProductCache] Error setting category:', error);
  }
}

export async function getUserCategoryOverride(barcode: string): Promise<import('@/types').ProductType | null> {
  try {
    const overridesStr = await AsyncStorage.getItem(CATEGORY_OVERRIDES_KEY);
    if (!overridesStr) return null;
    const overrides: Record<string, string> = JSON.parse(overridesStr);
    return (overrides[barcode] as import('@/types').ProductType) || null;
  } catch {
    return null;
  }
}

export async function removeCachedProduct(barcode: string): Promise<void> {
  try {
    const cacheStr = await AsyncStorage.getItem(CACHE_KEY);
    if (!cacheStr) return;
    const cache: ProductCache = JSON.parse(cacheStr);
    if (cache[barcode]) {
      delete cache[barcode];
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      console.log('[ProductCache] Removed cached product:', barcode);
    }
  } catch (error) {
    console.error('[ProductCache] Error removing cached product:', error);
  }
}

export async function clearProductCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
    console.log('Product cache cleared');
  } catch (error) {
    console.error('Error clearing product cache:', error);
  }
}

export async function getCacheSize(): Promise<number> {
  try {
    const cacheStr = await AsyncStorage.getItem(CACHE_KEY);
    if (!cacheStr) return 0;

    const cache: ProductCache = JSON.parse(cacheStr);
    return Object.keys(cache).length;
  } catch (error) {
    console.error('Error getting cache size:', error);
    return 0;
  }
}
