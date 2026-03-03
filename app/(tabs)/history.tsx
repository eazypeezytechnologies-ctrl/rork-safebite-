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
import { useRouter, useFocusEffect, Href } from 'expo-router';
import { History, Heart, Trash2, Clock, AlertCircle, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { useUser } from '@/contexts/UserContext';
import { guessProductType, getProductTypeLabel, getProductTypeColor, getProductTypeEmoji } from '@/utils/productType';
import { getFavorites, removeFromFavorites, addToFavorites, FavoriteItem } from '@/storage/favorites';
import { getVerdictColor } from '@/utils/verdict';
import { SwipeableListItem } from '@/components/SwipeableListItem';
import * as Haptics from 'expo-haptics';
import {
  getScanHistory as getSupabaseScanHistory,
  clearUserScanHistory,
  removeOneScanHistory,
} from '@/services/supabaseProducts';
import { arcaneColors, arcaneShadows, arcaneRadius } from '@/constants/theme';

type TabType = 'history' | 'favorites';

interface SupabaseHistoryItem {
  id: string;
  product_code: string;
  product_name: string;
  verdict: string;
  scanned_at: string;
  profile_id: string;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { activeProfile } = useProfiles();
  const { currentUser } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>('history');
  const [history, setHistory] = useState<SupabaseHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const userId = currentUser?.id;

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      console.log('[History] Loading data for user:', userId);

      const profileId = activeProfile?.id;

      const [historyData, favoritesData] = await Promise.all([
        userId ? getSupabaseScanHistory(userId, profileId, 50) : Promise.resolve([]),
        getFavorites(userId),
      ]);

      console.log('[History] Loaded', historyData.length, 'history items and', favoritesData.length, 'favorites');

      setHistory(historyData);

      if (activeProfile) {
        setFavorites(favoritesData.filter(item => item.profileId === activeProfile.id));
      } else {
        setFavorites(favoritesData);
      }
    } catch (err) {
      console.error('[History] Error loading data:', err);
      setLoadError('Failed to load history. Pull down to retry.');
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
      'Are you sure you want to clear all scan history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            try {
              const result = await clearUserScanHistory(userId);
              if (result.success) {
                setHistory([]);
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
              } else {
                Alert.alert('Error', result.error || 'Failed to clear history');
              }
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
        <ActivityIndicator size="large" color={arcaneColors.primary} />
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
            <History size={20} color={activeTab === 'history' ? arcaneColors.primary : arcaneColors.textSecondary} />
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
              History
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'favorites' && styles.tabActive]}
            onPress={() => setActiveTab('favorites')}
          >
            <Heart size={20} color={activeTab === 'favorites' ? arcaneColors.primary : arcaneColors.textSecondary} />
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
        {loadError && (
          <View style={styles.errorBanner}>
            <AlertCircle size={18} color="#DC2626" />
            <Text style={styles.errorBannerText}>{loadError}</Text>
            <TouchableOpacity onPress={onRefresh}>
              <RefreshCw size={18} color="#DC2626" />
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'history' && (
          <>
            {history.length > 0 && (
              <TouchableOpacity style={styles.clearButton} onPress={handleClearHistory}>
                <Trash2 size={16} color="#DC2626" />
                <Text style={styles.clearButtonText}>Clear History</Text>
              </TouchableOpacity>
            )}

            {history.length === 0 && !loadError ? (
              <View style={styles.emptyState}>
                <History size={64} color="#D1D5DB" />
                <Text style={styles.emptyText}>No scan history</Text>
                <Text style={styles.emptySubtext}>
                  Products you scan will appear here and sync across all your devices
                </Text>
              </View>
            ) : (
              history.map((item) => {
                const VerdictIcon = getVerdictIcon(item.verdict);
                const verdictColor = getVerdictColor(item.verdict as any) || '#9CA3AF';

                const handleNavigate = () => {
                  const productCode = item.product_code;
                  if (!productCode || productCode === 'undefined' || productCode === 'null' || productCode.trim() === '') {
                    Alert.alert('Error', 'This product has an invalid code. Please scan it again.');
                    return;
                  }
                  router.push(`/product/${encodeURIComponent(productCode)}` as Href);
                };

                const handleAddToFavorites = async () => {
                  if (!activeProfile) return;
                  try {
                    await addToFavorites({
                      id: `${item.product_code}_${activeProfile.id}_${Date.now()}`,
                      product: {
                        code: item.product_code,
                        product_name: item.product_name,
                        source: 'openfoodfacts' as const,
                      },
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
                          const result = await removeOneScanHistory(item.id);
                          if (result.success) {
                            setHistory(prev => prev.filter(h => h.id !== item.id));
                          } else {
                            Alert.alert('Error', 'Failed to remove item');
                          }
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
                            {item.product_name || 'Unknown Product'}
                          </Text>
                          <View style={styles.itemMetaRow}>
                            {(() => {
                              const pType = guessProductType(undefined, item.product_name, undefined);
                              const typeColor = getProductTypeColor(pType);
                              return (
                                <View style={[styles.typeBadge, { backgroundColor: typeColor + '15', borderColor: typeColor }]}>
                                  <Text style={styles.typeBadgeEmoji}>{getProductTypeEmoji(pType)}</Text>
                                  <Text style={[styles.typeBadgeText, { color: typeColor }]}>{getProductTypeLabel(pType)}</Text>
                                </View>
                              );
                            })()}
                            <View style={styles.itemMeta}>
                              <Clock size={12} color="#9CA3AF" />
                              <Text style={styles.itemDate}>{formatDate(item.scanned_at)}</Text>
                            </View>
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
                      if (!productCode || productCode === 'undefined' || productCode === 'null' || productCode.trim() === '') {
                        Alert.alert('Error', 'This product has an invalid code. Please scan it again.');
                        return;
                      }
                      router.push(`/product/${encodeURIComponent(productCode)}` as Href);
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
    backgroundColor: arcaneColors.bg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: arcaneColors.bg,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: arcaneColors.bgCard,
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: arcaneColors.border,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    marginBottom: 16,
    letterSpacing: 0.5,
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
    borderRadius: arcaneRadius.lg,
    backgroundColor: arcaneColors.bgMist,
  },
  tabActive: {
    backgroundColor: arcaneColors.primaryMuted,
    borderWidth: 1,
    borderColor: arcaneColors.primary,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: arcaneColors.textSecondary,
  },
  tabTextActive: {
    color: arcaneColors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#DC2626',
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
    textAlign: 'center' as const,
    paddingHorizontal: 32,
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: arcaneColors.borderRune,
    ...arcaneShadows.card,
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
    color: arcaneColors.text,
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
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeEmoji: {
    fontSize: 10,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
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
