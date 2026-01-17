import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, Verdict } from '@/types';

export interface ScanHistoryItem {
  id: string;
  product: Product;
  verdict: Verdict | null;
  profileId: string;
  profileName: string;
  scannedAt: string;
}

const SCAN_HISTORY_KEY = '@allergy_guardian_scan_history';
const MAX_HISTORY_ITEMS = 100;

export async function getScanHistory(): Promise<ScanHistoryItem[]> {
  try {
    const data = await AsyncStorage.getItem(SCAN_HISTORY_KEY);
    if (!data) return [];
    
    const history: ScanHistoryItem[] = JSON.parse(data);
    
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
      await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(validHistory));
    }
    
    return validHistory;
  } catch (error) {
    console.error('Error loading scan history:', error);
    return [];
  }
}

export async function addToScanHistory(item: ScanHistoryItem): Promise<void> {
  try {
    if (!item.product?.code || item.product.code === 'undefined' || item.product.code === 'null') {
      console.error('Attempted to save history item with invalid product code:', item);
      throw new Error('Cannot save history item: product code is missing or invalid');
    }
    
    console.log('Adding to scan history:', {
      productCode: item.product.code,
      productName: item.product.product_name,
      profileId: item.profileId,
      profileName: item.profileName
    });
    
    const history = await getScanHistory();
    
    const existingIndex = history.findIndex(
      h => h.product.code === item.product.code && h.profileId === item.profileId
    );
    
    if (existingIndex >= 0) {
      console.log('Removing existing history entry at index:', existingIndex);
      history.splice(existingIndex, 1);
    }
    
    history.unshift(item);
    
    if (history.length > MAX_HISTORY_ITEMS) {
      history.splice(MAX_HISTORY_ITEMS);
    }
    
    await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(history));
    console.log('Successfully saved to scan history. Total items:', history.length);
  } catch (error) {
    console.error('Error adding to scan history:', error);
    throw error;
  }
}

export async function clearScanHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SCAN_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing scan history:', error);
    throw error;
  }
}

export async function removeFromScanHistory(id: string): Promise<void> {
  try {
    const history = await getScanHistory();
    const filtered = history.filter(item => item.id !== id);
    await AsyncStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from scan history:', error);
    throw error;
  }
}

export async function getHistoryByProfile(profileId: string): Promise<ScanHistoryItem[]> {
  try {
    const history = await getScanHistory();
    return history.filter(item => item.profileId === profileId);
  } catch (error) {
    console.error('Error getting history by profile:', error);
    return [];
  }
}
