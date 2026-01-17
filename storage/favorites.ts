import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types';

export interface FavoriteItem {
  id: string;
  product: Product;
  profileId: string;
  addedAt: string;
  notes?: string;
}

const FAVORITES_KEY = '@allergy_guardian_favorites';

export async function getFavorites(): Promise<FavoriteItem[]> {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading favorites:', error);
    return [];
  }
}

export async function addToFavorites(item: FavoriteItem): Promise<void> {
  try {
    const favorites = await getFavorites();
    
    const exists = favorites.some(
      f => f.product.code === item.product.code && f.profileId === item.profileId
    );
    
    if (!exists) {
      favorites.unshift(item);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }
  } catch (error) {
    console.error('Error adding to favorites:', error);
    throw error;
  }
}

export async function removeFromFavorites(id: string): Promise<void> {
  try {
    const favorites = await getFavorites();
    const filtered = favorites.filter(item => item.id !== id);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from favorites:', error);
    throw error;
  }
}

export async function isFavorite(productCode: string, profileId: string): Promise<boolean> {
  try {
    const favorites = await getFavorites();
    return favorites.some(f => f.product.code === productCode && f.profileId === profileId);
  } catch (error) {
    console.error('Error checking favorite:', error);
    return false;
  }
}

export async function getFavoritesByProfile(profileId: string): Promise<FavoriteItem[]> {
  try {
    const favorites = await getFavorites();
    return favorites.filter(item => item.profileId === profileId);
  } catch (error) {
    console.error('Error getting favorites by profile:', error);
    return [];
  }
}

export async function updateFavoriteNotes(id: string, notes: string): Promise<void> {
  try {
    const favorites = await getFavorites();
    const index = favorites.findIndex(f => f.id === id);
    
    if (index >= 0) {
      favorites[index].notes = notes;
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }
  } catch (error) {
    console.error('Error updating favorite notes:', error);
    throw error;
  }
}
