import { Database, DBRecallCache } from '@/backend/db/schema';
import { randomUUID } from 'crypto';

const FDA_API = 'https://api.fda.gov/food/enforcement.json';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

export class RecallService {
  static async searchRecalls(query: string): Promise<any[]> {
    const cache = await this.getFromCache(query);
    if (cache) {
      console.log('Returning cached recalls for:', query);
      return cache.recalls;
    }

    try {
      const searchTerms = query
        .split(/\s+/)
        .filter(term => term.length > 2)
        .map(term => `product_description:"${term}"`)
        .join('+OR+');

      if (!searchTerms) {
        return [];
      }

      const url = `${FDA_API}?search=${searchTerms}&limit=20`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.warn('FDA API error:', response.status);
        return [];
      }

      const data = await response.json();
      const recalls = data.results || [];

      await this.saveToCache(query, recalls);
      return recalls;
    } catch (error) {
      console.warn('Error searching recalls:', error);
      return [];
    }
  }

  static async searchRecallsByBarcode(barcode: string): Promise<any[]> {
    const cache = await this.getFromCache(barcode, barcode);
    if (cache) {
      console.log('Returning cached recalls for barcode:', barcode);
      return cache.recalls;
    }

    try {
      const url = `${FDA_API}?search=product_description:"${barcode}"&limit=20`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.warn('FDA API error:', response.status);
        return [];
      }

      const data = await response.json();
      const recalls = data.results || [];

      await this.saveToCache(barcode, recalls, barcode);
      return recalls;
    } catch (error) {
      console.warn('Error searching recalls by barcode:', error);
      return [];
    }
  }

  private static async getFromCache(searchQuery?: string, productCode?: string): Promise<DBRecallCache | null> {
    const cache = await Database.getRecallCache();
    const now = Date.now();

    const cached = cache.find(c => {
      if (productCode && c.productCode === productCode) return true;
      if (searchQuery && c.searchQuery === searchQuery) return true;
      return false;
    });

    if (cached) {
      const expiresAt = new Date(cached.expiresAt).getTime();
      if (now < expiresAt) {
        return cached;
      }
    }

    return null;
  }

  private static async saveToCache(searchQuery: string, recalls: any[], productCode?: string): Promise<void> {
    const cache = await Database.getRecallCache();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_EXPIRY_MS);

    const newCache: DBRecallCache = {
      id: randomUUID(),
      productCode,
      searchQuery,
      recalls,
      cachedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const filtered = cache.filter(c => {
      if (productCode && c.productCode === productCode) return false;
      if (c.searchQuery === searchQuery) return false;
      return true;
    });

    filtered.push(newCache);
    await Database.saveRecallCache(filtered);
  }

  static async clearExpiredCache(): Promise<void> {
    const cache = await Database.getRecallCache();
    const now = Date.now();

    const valid = cache.filter(c => {
      const expiresAt = new Date(c.expiresAt).getTime();
      return now < expiresAt;
    });

    await Database.saveRecallCache(valid);
  }
}
