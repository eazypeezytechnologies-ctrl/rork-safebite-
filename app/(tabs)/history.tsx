import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { History, Heart, Trash2, Clock, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { useUser } from '@/contexts/UserContext';
import { getScanHistory, clearScanHistory, removeFromScanHistory, ScanHistoryItem } from '@/storage/scanHistory';
import { getFavorites, removeFromFavorites, addToFavorites, FavoriteItem } from '@/storage/favorites';
import { getVerdictColor } from '@/utils/verdict';
import { SwipeableListItem } from '@/components/SwipeableListItem';
import * as Haptics from 'expo-haptics';

type TabType = 'history' | 'favorites';

export default function HistoryScreen() {
  const router = useRouter();
  const { activeProfile } = useProfiles();
  const { currentUser } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>('history');
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const userId = currentUser?.id;

  const loadData = useCallback(async () => {
    try {
      console.log('[History] Loading data for user:', userId);
      const [historyData, favoritesData] = await Promise.all([
        getScanHistory(userId),
        getFavorites(userId),
      ]);
      
      console.log('[History] Loaded', historyData.length, 'history items and', favoritesData.length, 'favorites');
      
      if (activeProfile) {
        setHistory(historyData.filter(item => item.profileId === activeProfile.id));
        setFavorites(favoritesData.filter(item => item.profileId === activeProfile.id));
      } else {
        setHistory(historyData);
        setFavorites(favoritesData);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeProfile, userId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear History',
      'Are you sure you want to clear all scan history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearScanHistory(userId);
              await loadData();
            } catch {
              Alert.alert('Error', 'Failed to clear history');
            }
          },
        },
      ]
    );
  };

  const handleRemoveFavorite = (id: string, productName: string) => {
    Alert.alert(
      'Remove Favorite',
      `Remove ${productName} from favorites?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFromFavorites(id, userId);
              await loadData();
            } catch {
              Alert.alert('Error', 'Failed to remove favorite');
            }
          },
        },
      ]
    );
  };

  const getVerdictIcon = (level: string) => {
    switch (level) {
      case 'safe':
        return CheckCircle;
      case 'caution':
        return AlertTriangle;
      case 'danger':
        return AlertCircle;
      default:
        return AlertCircle;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0891B2" />
        <Text style={styles.loadingText}>Loading your products...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Products</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <History size={20} color={activeTab === 'history' ? '#0891B2' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              History
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'favorites' && styles.tabActive]}
            onPress={() => setActiveTab('favorites')}
          >
            <Heart size={20} color={activeTab === 'favorites' ? '#0891B2' : '#6B7280'} />
            <Text style={[styles.tabText, activeTab === 'favorites' && styles.tabTextActive]}>
              Favorites
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'history' && (
          <>
            {history.length > 0 && (
              <TouchableOpacity style={styles.clearButton} onPress={handleClearHistory}>
                <Trash2 size={16} color="#DC2626" />
                <Text style={styles.clearButtonText}>Clear History</Text>
              </TouchableOpacity>
            )}

            {history.length === 0 ? (
              <View style={styles.emptyState}>
                <History size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No scan history</Text>
                <Text style={styles.emptySubtext}>
                  Products you scan will appear here
                </Text>
              </View>
            ) : (
              history.map((item) => {
                const VerdictIcon = item.verdict ? getVerdictIcon(item.verdict.level) : AlertCircle;
                const verdictColor = item.verdict ? getVerdictColor(item.verdict.level) : '#9CA3AF';

                const handleNavigate = () => {
                  const productCode = item.product?.code;
                  
                  if (!productCode || productCode === 'undefined' || productCode === 'null' || productCode.trim() === '') {
                    Alert.alert('Error', 'This product has an invalid code and cannot be viewed. Please scan it again.');
                    return;
                  }
                  
                  router.push(`/product/${encodeURIComponent(productCode)}`);
                };

                const handleAddToFavorites = async () => {
                  if (!activeProfile) return;
                  
                  try {
                    await addToFavorites({
                      id: `${item.product.code}_${activeProfile.id}_${Date.now()}`,
                      product: item.product,
                      profileId: activeProfile.id,
                      addedAt: new Date().toISOString(),
                    }, userId);
                    
                    if (Platform.OS !== 'web') {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                    Alert.alert('Added', 'Product added to favorites');
                  } catch {
                    Alert.alert('Error', 'Failed to add to favorites');
                  }
                };

                return (
                  <SwipeableListItem
                    key={item.id}
                    leftAction={{
                      icon: 'favorite',
                      color: '#10B981',
                      onPress: handleAddToFavorites,
                    }}
                    rightAction={{
                      icon: 'delete',
                      color: '#DC2626',
                      onPress: async () => {
                        try {
                          await removeFromScanHistory(item.id, userId);
                          await loadData();
                        } catch {
                          Alert.alert('Error', 'Failed to remove item');
                        }
                      },
                    }}
                    onPress={handleNavigate}
                  >
                    <View style={styles.itemCard}>
                      <View style={styles.itemContent}>
                        <View style={[styles.verdictBadge, { backgroundColor: verdictColor + '20', borderColor: verdictColor }]}>
                          <VerdictIcon size={20} color={verdictColor} />
                        </View>
                        <View style={styles.itemInfo}>
                          <Text style={styles.itemName} numberOfLines={2}>
                            {item.product.product_name || 'Unknown Product'}
                          </Text>
                          {item.product.brands && (
                            <Text style={styles.itemBrand} numberOfLines={1}>
                              {item.product.brands}
                            </Text>
                          )}
                          <View style={styles.itemMeta}>
                            <Clock size={12} color="#9CA3AF" />
                            <Text style={styles.itemDate}>{formatDate(item.scannedAt)}</Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  </SwipeableListItem>
                );
              })
            )}
          </>
        )}

        {activeTab === 'favorites' && (
          <>
            {favorites.length === 0 ? (
              <View style={styles.emptyState}>
                <Heart size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No favorites</Text>
                <Text style={styles.emptySubtext}>
                  Tap the heart icon on products to save them here
                </Text>
              </View>
            ) : (
              favorites.map((item) => (
                <View key={item.id} style={styles.itemCard}>
                  <TouchableOpacity
                    style={styles.itemContent}
                    onPress={() => {
                      const productCode = item.product?.code;
                      console.log('=== Favorite Item Clicked ===');
                      console.log('Full item:', JSON.stringify(item, null, 2));
                      console.log('Product object:', JSON.stringify(item.product, null, 2));
                      console.log('Product code:', productCode);
                      console.log('Product code type:', typeof productCode);
                      console.log('Product name:', item.product?.product_name);
                      console.log('Navigating to:', `/product/${productCode}`);
                      
                      if (!productCode || productCode === 'undefined' || productCode === 'null' || productCode.trim() === '') {
                        console.error('Invalid product code detected in favorite item');
                        Alert.alert('Error', 'This product has an invalid code and cannot be viewed. Please scan it again.');
                        return;
                      }
                      
                      console.log('Pushing to router with path:', `/product/${encodeURIComponent(productCode)}`);
                      router.push(`/product/${encodeURIComponent(productCode)}`);
                    }}
                  >
                    <View style={styles.favoriteIcon}>
                      <Heart size={20} color="#DC2626" fill="#DC2626" />
                    </View>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.product.product_name || 'Unknown Product'}
                      </Text>
                      {item.product.brands && (
                        <Text style={styles.itemBrand} numberOfLines={1}>
                          {item.product.brands}
                        </Text>
                      )}
                      {item.notes && (
                        <Text style={styles.itemNotes} numberOfLines={2}>
                          {item.notes}
                        </Text>
                      )}
                      <View style={styles.itemMeta}>
                        <Clock size={12} color="#9CA3AF" />
                        <Text style={styles.itemDate}>{formatDate(item.addedAt)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveFavorite(item.id, item.product.product_name || 'this product')}
                  >
                    <Trash2 size={20} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  tabActive: {
    backgroundColor: '#F0FDFA',
    borderWidth: 2,
    borderColor: '#0891B2',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#0891B2',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  verdictBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  favoriteIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  itemBrand: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  itemNotes: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  removeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
