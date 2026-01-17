import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '@/types';

const SHOPPING_LIST_KEY = '@allergy_guardian_shopping_list';

export interface ShoppingListItem {
  id: string;
  product?: Product;
  name: string;
  barcode?: string;
  notes?: string;
  checked: boolean;
  addedAt: string;
  profileId?: string;
}

export async function getShoppingList(): Promise<ShoppingListItem[]> {
  try {
    const data = await AsyncStorage.getItem(SHOPPING_LIST_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading shopping list:', error);
    return [];
  }
}

export async function addToShoppingList(item: ShoppingListItem): Promise<void> {
  try {
    const list = await getShoppingList();
    list.unshift(item);
    await AsyncStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(list));
    console.log('Added to shopping list:', item.name);
  } catch (error) {
    console.error('Error adding to shopping list:', error);
    throw error;
  }
}

export async function updateShoppingListItem(id: string, updates: Partial<ShoppingListItem>): Promise<void> {
  try {
    const list = await getShoppingList();
    const index = list.findIndex(item => item.id === id);
    
    if (index !== -1) {
      list[index] = { ...list[index], ...updates };
      await AsyncStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(list));
      console.log('Updated shopping list item:', id);
    }
  } catch (error) {
    console.error('Error updating shopping list item:', error);
    throw error;
  }
}

export async function removeFromShoppingList(id: string): Promise<void> {
  try {
    const list = await getShoppingList();
    const filtered = list.filter(item => item.id !== id);
    await AsyncStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(filtered));
    console.log('Removed from shopping list:', id);
  } catch (error) {
    console.error('Error removing from shopping list:', error);
    throw error;
  }
}

export async function clearShoppingList(): Promise<void> {
  try {
    await AsyncStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify([]));
    console.log('Shopping list cleared');
  } catch (error) {
    console.error('Error clearing shopping list:', error);
    throw error;
  }
}

export async function clearCheckedItems(): Promise<void> {
  try {
    const list = await getShoppingList();
    const unchecked = list.filter(item => !item.checked);
    await AsyncStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(unchecked));
    console.log('Cleared checked items from shopping list');
  } catch (error) {
    console.error('Error clearing checked items:', error);
    throw error;
  }
}
