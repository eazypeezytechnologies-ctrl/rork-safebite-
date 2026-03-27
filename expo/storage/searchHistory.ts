import AsyncStorage from '@react-native-async-storage/async-storage';

const SEARCH_HISTORY_KEY = '@search_history';
const MAX_HISTORY_ITEMS = 50;

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: string;
  type: 'barcode' | 'name' | 'url';
}

export async function getSearchHistory(): Promise<SearchHistoryItem[]> {
  try {
    const data = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading search history:', error);
    return [];
  }
}

export async function addToSearchHistory(item: Omit<SearchHistoryItem, 'id' | 'timestamp'>): Promise<void> {
  try {
    const history = await getSearchHistory();
    
    const existingIndex = history.findIndex(h => 
      h.query.toLowerCase() === item.query.toLowerCase() && h.type === item.type
    );
    
    if (existingIndex !== -1) {
      history.splice(existingIndex, 1);
    }
    
    const newItem: SearchHistoryItem = {
      ...item,
      id: `search_${Date.now()}_${Math.random()}`,
      timestamp: new Date().toISOString(),
    };
    
    history.unshift(newItem);
    
    if (history.length > MAX_HISTORY_ITEMS) {
      history.splice(MAX_HISTORY_ITEMS);
    }
    
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Error saving search history:', error);
  }
}

export async function clearSearchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing search history:', error);
  }
}

export async function removeFromSearchHistory(id: string): Promise<void> {
  try {
    const history = await getSearchHistory();
    const filtered = history.filter(item => item.id !== id);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from search history:', error);
  }
}
