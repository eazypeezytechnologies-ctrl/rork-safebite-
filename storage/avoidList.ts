import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types';

export interface AvoidListItem {
  id: string;
  product: Product;
  profileId: string;
  reason?: string;
  addedAt: string;
  userId?: string;
}

const AVOID_LIST_KEY = '@safebite_avoid_list';

function getUserAvoidKey(userId?: string): string {
  return userId ? `${AVOID_LIST_KEY}_${userId}` : AVOID_LIST_KEY;
}

export async function getAvoidList(userId?: string): Promise<AvoidListItem[]> {
  try {
    const key = getUserAvoidKey(userId);
    const data = await AsyncStorage.getItem(key);

    let legacyData: AvoidListItem[] = [];
    if (userId) {
      try {
        const oldData = await AsyncStorage.getItem(AVOID_LIST_KEY);
        if (oldData) {
          const parsed = JSON.parse(oldData);
          if (Array.isArray(parsed)) {
            legacyData = parsed;
          }
        }
      } catch {
        console.warn('[AvoidList] Failed to parse legacy data');
      }
    }

    if (!data && legacyData.length === 0) return [];

    let items: AvoidListItem[] = [];
    if (data) {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          items = parsed;
        } else {
          console.warn('[AvoidList] Data was not an array, resetting');
          await AsyncStorage.removeItem(key).catch(() => {});
        }
      } catch {
        console.warn('[AvoidList] Failed to parse avoid list, resetting');
        await AsyncStorage.removeItem(key).catch(() => {});
      }
    }

    if (legacyData.length > 0 && userId) {
      const existingIds = new Set(items.map(i => i.id));
      const newLegacyItems = legacyData.filter(item => !existingIds.has(item.id));
      if (newLegacyItems.length > 0) {
        items = [...newLegacyItems, ...items];
        await AsyncStorage.setItem(key, JSON.stringify(items)).catch(() => {});
        console.log(`[AvoidList] Migrated ${newLegacyItems.length} items to user-specific storage`);
      }
    }

    return items;
  } catch (error) {
    console.error('[AvoidList] Error loading avoid list:', error);
    return [];
  }
}

export async function addToAvoidList(item: AvoidListItem, userId?: string): Promise<void> {
  try {
    const items = await getAvoidList(userId);
    const exists = items.some(
      i => i.product.code === item.product.code && i.profileId === item.profileId
    );

    if (!exists) {
      const itemWithUser = { ...item, userId };
      items.unshift(itemWithUser);
      const key = getUserAvoidKey(userId);
      await AsyncStorage.setItem(key, JSON.stringify(items));
      console.log('[AvoidList] Added product to avoid list:', item.product.product_name);
    }
  } catch (error) {
    console.error('[AvoidList] Error adding to avoid list:', error);
    throw error;
  }
}

export async function removeFromAvoidList(id: string, userId?: string): Promise<void> {
  try {
    const items = await getAvoidList(userId);
    const filtered = items.filter(item => item.id !== id);
    const key = getUserAvoidKey(userId);
    await AsyncStorage.setItem(key, JSON.stringify(filtered));
    console.log('[AvoidList] Removed item from avoid list');
  } catch (error) {
    console.error('[AvoidList] Error removing from avoid list:', error);
    throw error;
  }
}

export async function isOnAvoidList(productCode: string, profileId: string, userId?: string): Promise<boolean> {
  try {
    const items = await getAvoidList(userId);
    return items.some(i => i.product.code === productCode && i.profileId === profileId);
  } catch (error) {
    console.error('[AvoidList] Error checking avoid list:', error);
    return false;
  }
}

export async function getAvoidListByProfile(profileId: string, userId?: string): Promise<AvoidListItem[]> {
  try {
    const items = await getAvoidList(userId);
    return items.filter(item => item.profileId === profileId);
  } catch (error) {
    console.error('[AvoidList] Error getting avoid list by profile:', error);
    return [];
  }
}
