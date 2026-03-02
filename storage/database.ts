import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DBUser {
  id: string;
  email: string;
  password: string;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt?: string;
  settings?: {
    notifications: boolean;
    autoSync: boolean;
    theme: 'light' | 'dark' | 'auto';
  };
}

export interface DBProfile {
  id: string;
  userId: string;
  name: string;
  relationship?: string;
  dateOfBirth?: string;
  allergens: string[];
  customKeywords: string[];
  hasAnaphylaxis: boolean;
  emergencyContacts: {
    name: string;
    phone: string;
    relationship: string;
  }[];
  medications: string[];
  createdAt: string;
  updatedAt: string;
  avatarColor?: string;
  syncedAt?: string;
}

export interface DBProduct {
  code: string;
  product_name?: string;
  brands?: string;
  image_url?: string;
  image_front_url?: string;
  ingredients_text?: string;
  allergens?: string;
  allergens_tags?: string[];
  traces?: string;
  traces_tags?: string[];
  categories?: string;
  categories_tags?: string[];
  source: 'openfoodfacts' | 'openbeautyfacts' | 'openproductsfacts' | 'upcdatabase' | 'upcitemdb' | 'barcodelookup' | 'worldupc' | 'eansearch' | 'datakick' | 'usda' | 'nutritionix' | 'edamam';
  cachedAt: string;
  lastFetchedAt: string;
  scanCount: number;
}

export interface DBScanHistory {
  id: string;
  userId: string;
  profileId: string;
  productCode: string;
  productName?: string;
  verdict: 'safe' | 'caution' | 'danger';
  scannedAt: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  syncedAt?: string;
}

export interface DBFavorite {
  id: string;
  userId: string;
  profileId: string;
  productCode: string;
  productName?: string;
  addedAt: string;
  syncedAt?: string;
}

export interface DBShoppingListItem {
  id: string;
  userId: string;
  productCode?: string;
  productName: string;
  quantity: number;
  checked: boolean;
  addedAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export interface DBAnalytics {
  id: string;
  userId: string;
  eventType: 'scan' | 'search' | 'recall_check' | 'profile_create' | 'profile_update' | 'login' | 'signup' | 'favorite_add' | 'favorite_remove' | 'shopping_list_add' | 'shopping_list_remove';
  eventData?: Record<string, any>;
  timestamp: string;
  syncedAt?: string;
}

export interface DBRecallCache {
  id: string;
  productCode?: string;
  searchQuery?: string;
  recalls: any[];
  cachedAt: string;
  expiresAt: string;
}

const DB_KEYS = {
  USERS: '@safebite_users',
  PROFILES: '@safebite_profiles',
  PRODUCTS: '@safebite_products',
  SCAN_HISTORY: '@safebite_scan_history',
  FAVORITES: '@safebite_favorites',
  SHOPPING_LIST: '@safebite_shopping_list',
  ANALYTICS: '@safebite_analytics',
  RECALL_CACHE: '@safebite_recall_cache',
  SYNC_QUEUE: '@safebite_sync_queue',
} as const;

export class Database {
  static async getUsers(): Promise<DBUser[]> {
    try {
      const data = await AsyncStorage.getItem(DB_KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  static async saveUsers(users: DBUser[]): Promise<void> {
    try {
      await AsyncStorage.setItem(DB_KEYS.USERS, JSON.stringify(users));
    } catch (error) {
      console.error('Error saving users:', error);
    }
  }

  static async getProfiles(): Promise<DBProfile[]> {
    try {
      const data = await AsyncStorage.getItem(DB_KEYS.PROFILES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting profiles:', error);
      return [];
    }
  }

  static async saveProfiles(profiles: DBProfile[]): Promise<void> {
    try {
      await AsyncStorage.setItem(DB_KEYS.PROFILES, JSON.stringify(profiles));
    } catch (error) {
      console.error('Error saving profiles:', error);
    }
  }

  static async getProducts(): Promise<DBProduct[]> {
    try {
      const data = await AsyncStorage.getItem(DB_KEYS.PRODUCTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting products:', error);
      return [];
    }
  }

  static async saveProducts(products: DBProduct[]): Promise<void> {
    try {
      await AsyncStorage.setItem(DB_KEYS.PRODUCTS, JSON.stringify(products));
    } catch (error) {
      console.error('Error saving products:', error);
    }
  }

  static async getScanHistory(): Promise<DBScanHistory[]> {
    try {
      const data = await AsyncStorage.getItem(DB_KEYS.SCAN_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting scan history:', error);
      return [];
    }
  }

  static async saveScanHistory(history: DBScanHistory[]): Promise<void> {
    try {
      await AsyncStorage.setItem(DB_KEYS.SCAN_HISTORY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving scan history:', error);
    }
  }

  static async getFavorites(): Promise<DBFavorite[]> {
    try {
      const data = await AsyncStorage.getItem(DB_KEYS.FAVORITES);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting favorites:', error);
      return [];
    }
  }

  static async saveFavorites(favorites: DBFavorite[]): Promise<void> {
    try {
      await AsyncStorage.setItem(DB_KEYS.FAVORITES, JSON.stringify(favorites));
    } catch (error) {
      console.error('Error saving favorites:', error);
    }
  }

  static async getShoppingList(): Promise<DBShoppingListItem[]> {
    try {
      const data = await AsyncStorage.getItem(DB_KEYS.SHOPPING_LIST);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting shopping list:', error);
      return [];
    }
  }

  static async saveShoppingList(items: DBShoppingListItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(DB_KEYS.SHOPPING_LIST, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving shopping list:', error);
    }
  }

  static async getAnalytics(): Promise<DBAnalytics[]> {
    try {
      const data = await AsyncStorage.getItem(DB_KEYS.ANALYTICS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting analytics:', error);
      return [];
    }
  }

  static async saveAnalytics(analytics: DBAnalytics[]): Promise<void> {
    try {
      await AsyncStorage.setItem(DB_KEYS.ANALYTICS, JSON.stringify(analytics));
    } catch (error) {
      console.error('Error saving analytics:', error);
    }
  }

  static async getRecallCache(): Promise<DBRecallCache[]> {
    try {
      const data = await AsyncStorage.getItem(DB_KEYS.RECALL_CACHE);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting recall cache:', error);
      return [];
    }
  }

  static async saveRecallCache(cache: DBRecallCache[]): Promise<void> {
    try {
      await AsyncStorage.setItem(DB_KEYS.RECALL_CACHE, JSON.stringify(cache));
    } catch (error) {
      console.error('Error saving recall cache:', error);
    }
  }

  static async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(DB_KEYS));
      console.log('Database cleared');
    } catch (error) {
      console.error('Error clearing database:', error);
    }
  }

  static async exportData(): Promise<string> {
    try {
      const data = {
        users: await this.getUsers(),
        profiles: await this.getProfiles(),
        products: await this.getProducts(),
        scanHistory: await this.getScanHistory(),
        favorites: await this.getFavorites(),
        shoppingList: await this.getShoppingList(),
        analytics: await this.getAnalytics(),
        exportedAt: new Date().toISOString(),
      };
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Error exporting data:', error);
      throw error;
    }
  }

  static async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      if (data.users) await this.saveUsers(data.users);
      if (data.profiles) await this.saveProfiles(data.profiles);
      if (data.products) await this.saveProducts(data.products);
      if (data.scanHistory) await this.saveScanHistory(data.scanHistory);
      if (data.favorites) await this.saveFavorites(data.favorites);
      if (data.shoppingList) await this.saveShoppingList(data.shoppingList);
      if (data.analytics) await this.saveAnalytics(data.analytics);
      console.log('Data imported successfully');
    } catch (error) {
      console.error('Error importing data:', error);
      throw error;
    }
  }
}
