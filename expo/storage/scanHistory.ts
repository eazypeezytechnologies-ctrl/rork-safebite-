import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, Verdict } from '@/types';

export interface ScanHistoryItem {
  id: string;
  product: Product;
  verdict: Verdict | null;
  profileId: string;
  profileName: string;
  scannedAt: string;
  userId?: string;
}

const SCAN_HISTORY_KEY = '@allergy_guardian_scan_history';
const MAX_HISTORY_ITEMS = 100;
const DEDUPE_WINDOW_MS = 5000;
const recentHistoryAdds = new Map<string, number>();

function getUserHistoryKey(userId?: string): string {
  return userId ? `${SCAN_HISTORY_KEY}_${userId}` : SCAN_HISTORY_KEY;
}

export async function getScanHistory(userId?: string): Promise<ScanHistoryItem[]> {
  try {
    const key = getUserHistoryKey(userId);
    console.log('[ScanHistory] Loading history for key:', key, 'userId:', userId || 'none');
    
    let data: string | null = null;
    try {
      data = await AsyncStorage.getItem(key);
    } catch (readError) {
      console.warn('[ScanHistory] Failed to read storage:', readError);
      return [];
    }
    
    let legacyData: ScanHistoryItem[] = [];
    if (userId) {
      try {
        const oldData = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
        if (oldData) {
          const parsed = JSON.parse(oldData);
          if (Array.isArray(parsed)) {
            legacyData = parsed;
          }
        }
      } catch {
        console.warn('[ScanHistory] Failed to parse legacy data');
      }
    }
    
    if (!data && legacyData.length === 0) {
      console.log('[ScanHistory] No history found');
      return [];
    }
    
    let history: ScanHistoryItem[] = [];
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          history = parsed;
        } else {
          console.warn('[ScanHistory] Data was not an array, resetting');
          await AsyncStorage.removeItem(key).catch(() => {});
        }
      } catch (parseError) {
        console.warn('[ScanHistory] Failed to parse history, resetting:', parseError);
        await AsyncStorage.removeItem(key).catch(() => {});
      }
    }
    
    if (legacyData.length > 0 && userId) {
      const existingIds = new Set(history.map(h => h.id));
      const newLegacyItems = legacyData.filter(item => !existingIds.has(item.id));
      if (newLegacyItems.length > 0) {
        history = [...newLegacyItems, ...history];
        await AsyncStorage.setItem(key, JSON.stringify(history)).catch(() => {});
        console.log(`[ScanHistory] Migrated ${newLegacyItems.length} items to user-specific storage`);
      }
    }
    
    const validHistory = history.filter(item => {
      const isValid = item.product?.code && 
                     item.product.code !== 'undefined' && 
                     item.product.code !== 'null' &&
                     item.product.code.trim() !== '';
      return isValid;
    });
    
    if (validHistory.length !== history.length) {
      console.log(`[ScanHistory] Cleaned ${history.length - validHistory.length} invalid items`);
      await AsyncStorage.setItem(key, JSON.stringify(validHistory)).catch(() => {});
    }
    
    console.log('[ScanHistory] Returning', validHistory.length, 'items for user:', userId || 'anonymous');
    return validHistory;
  } catch (error) {
    console.error('[ScanHistory] Error loading history:', error instanceof Error ? error.message : 'Unknown');
    return [];
  }
}

export async function addToScanHistory(item: ScanHistoryItem, userId?: string): Promise<void> {
  try {
    if (!item.product?.code || item.product.code === 'undefined' || item.product.code === 'null') {
      console.error('Attempted to save history item with invalid product code:', item);
      throw new Error('Cannot save history item: product code is missing or invalid');
    }
    
    const dedupeKey = `${item.product.code}_${item.profileId}_${userId || 'anon'}`;
    const now = Date.now();
    const lastAdd = recentHistoryAdds.get(dedupeKey);
    if (lastAdd && (now - lastAdd) < DEDUPE_WINDOW_MS) {
      console.log('[ScanHistory] Dedupe: skipping duplicate add for', item.product.code, 'within', DEDUPE_WINDOW_MS, 'ms');
      return;
    }
    recentHistoryAdds.set(dedupeKey, now);
    
    if (recentHistoryAdds.size > 50) {
      const cutoff = now - 60000;
      for (const [key, ts] of recentHistoryAdds) {
        if (ts < cutoff) recentHistoryAdds.delete(key);
      }
    }
    
    console.log('Adding to scan history:', {
      productCode: item.product.code,
      productName: item.product.product_name,
      profileId: item.profileId,
      profileName: item.profileName,
      userId: userId
    });
    
    const itemWithUser = { ...item, userId };
    
    const history = await getScanHistory(userId);
    
    const existingIndex = history.findIndex(
      h => h.product.code === item.product.code && h.profileId === item.profileId
    );
    
    if (existingIndex >= 0) {
      console.log('Removing existing history entry at index:', existingIndex);
      history.splice(existingIndex, 1);
    }
    
    history.unshift(itemWithUser);
    
    if (history.length > MAX_HISTORY_ITEMS) {
      history.splice(MAX_HISTORY_ITEMS);
    }
    
    const key = getUserHistoryKey(userId);
    await AsyncStorage.setItem(key, JSON.stringify(history));
    console.log('Successfully saved to scan history. Total items:', history.length);
  } catch (error) {
    console.error('Error adding to scan history:', error);
    throw error;
  }
}

export async function clearScanHistory(userId?: string): Promise<void> {
  try {
    const key = getUserHistoryKey(userId);
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Error clearing scan history:', error);
    throw error;
  }
}

export async function removeFromScanHistory(id: string, userId?: string): Promise<void> {
  try {
    const history = await getScanHistory(userId);
    const filtered = history.filter(item => item.id !== id);
    const key = getUserHistoryKey(userId);
    await AsyncStorage.setItem(key, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from scan history:', error);
    throw error;
  }
}

export async function getHistoryByProfile(profileId: string, userId?: string): Promise<ScanHistoryItem[]> {
  try {
    const history = await getScanHistory(userId);
    return history.filter(item => item.profileId === profileId);
  } catch (error) {
    console.error('Error getting history by profile:', error);
    return [];
  }
}
