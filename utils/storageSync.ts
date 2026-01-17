import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SYNC_PREFIX = '@allergy_guardian_';
const SYNC_KEYS = [
  'users',
  'current_user',
  'onboarding_complete',
  'profiles',
  'active_profile',
  'scan_history',
  'favorites',
  'shopping_list'
];

export async function syncStorageToServer() {
  if (Platform.OS !== 'web') return;
  
  try {
    const data: Record<string, string> = {};
    
    for (const key of SYNC_KEYS) {
      const fullKey = `${SYNC_PREFIX}${key}`;
      const value = await AsyncStorage.getItem(fullKey);
      if (value) {
        data[key] = value;
      }
    }
    
    if (Object.keys(data).length > 0) {
      localStorage.setItem('allergy_guardian_backup', JSON.stringify(data));
      console.log('Storage synced to backup');
    }
  } catch (error) {
    console.error('Error syncing storage:', error);
  }
}

export async function restoreStorageFromServer() {
  if (Platform.OS !== 'web') return;
  
  try {
    const backup = localStorage.getItem('allergy_guardian_backup');
    if (!backup) return;
    
    const data = JSON.parse(backup);
    
    for (const [key, value] of Object.entries(data)) {
      const fullKey = `${SYNC_PREFIX}${key}`;
      const existing = await AsyncStorage.getItem(fullKey);
      
      if (!existing && typeof value === 'string') {
        await AsyncStorage.setItem(fullKey, value);
      }
    }
    
    console.log('Storage restored from backup');
  } catch (error) {
    console.error('Error restoring storage:', error);
  }
}

export async function clearAllStorage() {
  try {
    for (const key of SYNC_KEYS) {
      const fullKey = `${SYNC_PREFIX}${key}`;
      await AsyncStorage.removeItem(fullKey);
    }
    
    if (Platform.OS === 'web') {
      localStorage.removeItem('allergy_guardian_backup');
    }
    
    console.log('All storage cleared');
  } catch (error) {
    console.error('Error clearing storage:', error);
  }
}
