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

function getUserHistoryKey(userId?: string): string {
  return userId ? `${SCAN_HISTORY_KEY}_${userId}` : SCAN_HISTORY_KEY;
}

export async function getScanHistory(userId?: string): Promise<ScanHistoryItem[]> {
  try {
    const key = getUserHistoryKey(userId);
    const data = await AsyncStorage.getItem(key);
    
    // Also try to get from the old key for migration
    let legacyData: ScanHistoryItem[] = [];
    if (userId) {
      const oldData = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
      if (oldData) {
        legacyData = JSON.parse(oldData);
      }
    }
    
    if (!data && legacyData.length === 0) return [];
    
    let history: ScanHistoryItem[] = data ? JSON.parse(data) : [];
    
    // Merge legacy data that might belong to this user
    if (legacyData.length > 0 && userId) {
      const existingIds = new Set(history.map(h => h.id));
      const newLegacyItems = legacyData.filter(item => !existingIds.has(item.id));
      if (newLegacyItems.length > 0) {
        history = [...newLegacyItems, ...history];
        // Save merged data to user-specific key
        await AsyncStorage.setItem(key, JSON.stringify(history));
        console.log(`[ScanHistory] Migrated ${newLegacyItems.length} items to user-specific storage`);
      }
    }
    
    const validHistory = history.filter(item => {
      const isValid = item.product?.code && 
                     item.product.code !== 'undefined' && 
                     item.product.code !== 'null' &&
                     item.product.code.trim() !== '';
      
      if (!isValid) {
        console.warn('Filtering out invalid history item:', {
          id: item.id,
          productName: item.product?.product_name,
          code: item.product?.code
        });
      }
      
      return isValid;
    });
    
    if (validHistory.length !== history.length) {
      console.log(`Cleaned history: removed ${history.length - validHistory.length} invalid items`);
      await AsyncStorage.setItem(key, JSON.stringify(validHistory));
    }
    
    return validHistory;
  } catch (error) {
    console.error('Error loading scan history:', error);
    return [];
  }
}

export async function addToScanHistory(item: ScanHistoryItem, userId?: string): Promise<void> {
  try {
    if (!item.product?.code || item.product.code === 'undefined' || item.product.code === 'null') {
      console.error('Attempted to save history item with invalid product code:', item);
      throw new Error('Cannot save history item: product code is missing or invalid');
    }
    
    console.log('Adding to scan history:', {
      productCode: item.product.code,
      productName: item.product.product_name,
      profileId: item.profileId,
      profileName: item.profileName,
      userId: userId
    });
    
    // Add userId to the item
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
