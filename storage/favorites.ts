import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types';

export interface FavoriteItem {
  id: string;
  product: Product;
  profileId: string;
  addedAt: string;
  notes?: string;
  userId?: string;
}

const FAVORITES_KEY = '@allergy_guardian_favorites';

function getUserFavoritesKey(userId?: string): string {
  return userId ? `${FAVORITES_KEY}_${userId}` : FAVORITES_KEY;
}

export async function getFavorites(userId?: string): Promise<FavoriteItem[]> {
  try {
    const key = getUserFavoritesKey(userId);
    const data = await AsyncStorage.getItem(key);
    
    // Also try to get from the old key for migration
    let legacyData: FavoriteItem[] = [];
    if (userId) {
      const oldData = await AsyncStorage.getItem(FAVORITES_KEY);
      if (oldData) {
        legacyData = JSON.parse(oldData);
      }
    }
    
    if (!data && legacyData.length === 0) return [];
    
    let favorites: FavoriteItem[] = data ? JSON.parse(data) : [];
    
    // Merge legacy data that might belong to this user
    if (legacyData.length > 0 && userId) {
      const existingIds = new Set(favorites.map(f => f.id));
      const newLegacyItems = legacyData.filter(item => !existingIds.has(item.id));
      if (newLegacyItems.length > 0) {
        favorites = [...newLegacyItems, ...favorites];
        await AsyncStorage.setItem(key, JSON.stringify(favorites));
        console.log(`[Favorites] Migrated ${newLegacyItems.length} items to user-specific storage`);
      }
    }
    
    return favorites;
  } catch (error) {
    console.error('Error loading favorites:', error);
    return [];
  }
}

export async function addToFavorites(item: FavoriteItem, userId?: string): Promise<void> {
  try {
    const favorites = await getFavorites(userId);
    
    const exists = favorites.some(
      f => f.product.code === item.product.code && f.profileId === item.profileId
    );
    
    if (!exists) {
      const itemWithUser = { ...item, userId };
      favorites.unshift(itemWithUser);
      const key = getUserFavoritesKey(userId);
      await AsyncStorage.setItem(key, JSON.stringify(favorites));
    }
  } catch (error) {
    console.error('Error adding to favorites:', error);
    throw error;
  }
}

export async function removeFromFavorites(id: string, userId?: string): Promise<void> {
  try {
    const favorites = await getFavorites(userId);
    const filtered = favorites.filter(item => item.id !== id);
    const key = getUserFavoritesKey(userId);
    await AsyncStorage.setItem(key, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from favorites:', error);
    throw error;
  }
}

export async function isFavorite(productCode: string, profileId: string, userId?: string): Promise<boolean> {
  try {
    const favorites = await getFavorites(userId);
    return favorites.some(f => f.product.code === productCode && f.profileId === profileId);
  } catch (error) {
    console.error('Error checking favorite:', error);
    return false;
  }
}

export async function getFavoritesByProfile(profileId: string, userId?: string): Promise<FavoriteItem[]> {
  try {
    const favorites = await getFavorites(userId);
    return favorites.filter(item => item.profileId === profileId);
  } catch (error) {
    console.error('Error getting favorites by profile:', error);
    return [];
  }
}

export async function updateFavoriteNotes(id: string, notes: string, userId?: string): Promise<void> {
  try {
    const favorites = await getFavorites(userId);
    const index = favorites.findIndex(f => f.id === id);
    
    if (index >= 0) {
      favorites[index].notes = notes;
      const key = getUserFavoritesKey(userId);
      await AsyncStorage.setItem(key, JSON.stringify(favorites));
    }
  } catch (error) {
    console.error('Error updating favorite notes:', error);
    throw error;
  }
}
