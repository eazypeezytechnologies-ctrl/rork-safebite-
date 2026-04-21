import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { Sparkles, Heart, ShoppingCart, Bookmark, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { arcaneColors, arcaneRadius, arcaneShadows } from '@/constants/theme';
import { BetterOption, BetterOptionResult, generateBetterOptions } from '@/services/betterOptionService';
import { Product, Profile, Verdict } from '@/types';
import { addToShoppingList } from '@/storage/shoppingList';
import { addToFavorites } from '@/storage/favorites';

interface BetterOptionCardProps {
  product: Product;
  profile: Profile;
  verdict: Verdict | null;
  testID?: string;
}

type SavedState = Record<string, { fav?: boolean; list?: boolean; saved?: boolean }>;

function optionKey(o: BetterOption): string {
  return `${o.brand}__${o.productName}`.toLowerCase();
}

function optionToProduct(o: BetterOption, sourceProduct: Product): Product {
  return {
    code: `rec_${optionKey(o)}_${Date.now()}`,
    product_name: o.productName,
    brands: o.brand,
    source: 'manual_entry',
    product_type: sourceProduct.product_type,
  };
}

export const BetterOptionCard = React.memo(function BetterOptionCard({ product, profile, verdict, testID }: BetterOptionCardProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<BetterOptionResult | null>(null);
  const [saved, setSaved] = useState<SavedState>({});
  const [error, setError] = useState<string | null>(null);

  const loadOptions = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await generateBetterOptions(product, profile, verdict);
      setResult(r);
      if (r.options.length === 0) {
        setError('No alternatives could be generated right now.');
      }
    } catch (err) {
      console.log('[BetterOptionCard] error:', err);
      setError('Recommendations unavailable. Try again later.');
    } finally {
      setLoading(false);
    }
  }, [product, profile, verdict, loading]);

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleSave = useCallback(async (o: BetterOption) => {
    haptic();
    const key = optionKey(o);
    setSaved(prev => ({ ...prev, [key]: { ...(prev[key] || {}), saved: true } }));
  }, [haptic]);

  const handleFavorite = useCallback(async (o: BetterOption) => {
    haptic();
    const key = optionKey(o);
    try {
      const recProduct = optionToProduct(o, product);
      await addToFavorites({
        id: `${recProduct.code}_${profile.id}`,
        product: recProduct,
        profileId: profile.id,
        addedAt: new Date().toISOString(),
        notes: `Recommended alternative to ${product.product_name || product.code}`,
      });
      setSaved(prev => ({ ...prev, [key]: { ...(prev[key] || {}), fav: true } }));
    } catch (err) {
      console.log('[BetterOptionCard] favorite error:', err);
      Alert.alert('Error', 'Could not save favorite.');
    }
  }, [haptic, product, profile.id]);

  const handleAddToList = useCallback(async (o: BetterOption) => {
    haptic();
    const key = optionKey(o);
    try {
      const recProduct = optionToProduct(o, product);
      await addToShoppingList({
        id: `${recProduct.code}_${Date.now()}`,
        product: recProduct,
        name: `${o.brand} ${o.productName}`,
        notes: o.reason,
        checked: false,
        addedAt: new Date().toISOString(),
        profileId: profile.id,
      });
      setSaved(prev => ({ ...prev, [key]: { ...(prev[key] || {}), list: true } }));
    } catch (err) {
      console.log('[BetterOptionCard] shopping list error:', err);
      Alert.alert('Error', 'Could not add to shopping list.');
    }
  }, [haptic, product, profile.id]);

  const needsButton = useMemo(() => !result && !loading, [result, loading]);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.header}>
        <Sparkles size={20} color={arcaneColors.accent} />
        <Text style={styles.headerTitle}>Better options for {profile.name}</Text>
      </View>
      <Text style={styles.subtitle}>
        {verdict?.level === 'danger'
          ? 'This product may not be ideal for your profile. Try one of these instead:'
          : verdict?.missingData
            ? 'Missing ingredient data — here are picks with transparent labels:'
            : 'Picks that match your profile and category:'}
      </Text>

      {needsButton && (
        <TouchableOpacity style={styles.loadBtn} onPress={loadOptions} activeOpacity={0.85} testID="load-better-options">
          <Sparkles size={16} color="#FFFFFF" />
          <Text style={styles.loadBtnText}>Show Better Options</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={arcaneColors.accent} />
          <Text style={styles.loadingText}>Finding safer picks for {profile.name}...</Text>
        </View>
      )}

      {error && !loading && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadOptions}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && result.options.length > 0 && (
        <View style={styles.list}>
          {result.options.map((o, i) => {
            const key = optionKey(o);
            const s = saved[key] || {};
            return (
              <View key={key + i} style={styles.optionCard}>
                <View style={styles.optionHeader}>
                  <Text style={styles.optionBrand}>{o.brand}</Text>
                  <Text style={styles.optionName}>{o.productName}</Text>
                </View>
                {o.reason ? <Text style={styles.optionReason}>{o.reason}</Text> : null}
                {o.features.length > 0 && (
                  <View style={styles.tagsRow}>
                    {o.features.map((f, idx) => (
                      <View key={idx} style={styles.tag}>
                        <Text style={styles.tagText}>{f}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {o.whereToFind ? <Text style={styles.whereText}>Find at: {o.whereToFind}</Text> : null}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, s.saved && styles.actionBtnActive]}
                    onPress={() => handleSave(o)}
                    activeOpacity={0.8}
                    testID={`save-${i}`}
                  >
                    {s.saved ? <Check size={14} color="#FFFFFF" /> : <Bookmark size={14} color={arcaneColors.primary} />}
                    <Text style={[styles.actionText, s.saved && styles.actionTextActive]}>
                      {s.saved ? 'Saved' : 'Save'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, s.fav && styles.actionBtnFavActive]}
                    onPress={() => handleFavorite(o)}
                    activeOpacity={0.8}
                    testID={`favorite-${i}`}
                  >
                    <Heart size={14} color={s.fav ? '#FFFFFF' : '#DC2626'} fill={s.fav ? '#FFFFFF' : 'none'} />
                    <Text style={[styles.actionText, s.fav && styles.actionTextActive, !s.fav && { color: '#DC2626' }]}>
                      {s.fav ? 'Favorited' : 'Favorite'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, s.list && styles.actionBtnListActive]}
                    onPress={() => handleAddToList(o)}
                    activeOpacity={0.8}
                    testID={`list-${i}`}
                  >
                    <ShoppingCart size={14} color={s.list ? '#FFFFFF' : arcaneColors.primary} />
                    <Text style={[styles.actionText, s.list && styles.actionTextActive]}>
                      {s.list ? 'Added' : 'List'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.xl,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: arcaneColors.borderAccent,
    ...arcaneShadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: arcaneColors.text,
  },
  subtitle: {
    fontSize: 13,
    color: arcaneColors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  loadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: arcaneColors.accent,
    borderRadius: arcaneRadius.lg,
    paddingVertical: 12,
  },
  loadBtnText: {
    color: '#FFFFFF',
    fontWeight: '700' as const,
    fontSize: 14,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  loadingText: {
    color: arcaneColors.textSecondary,
    fontSize: 13,
  },
  errorBox: {
    padding: 12,
    alignItems: 'center',
  },
  errorText: {
    color: arcaneColors.textSecondary,
    fontSize: 13,
    marginBottom: 6,
  },
  retryText: {
    color: arcaneColors.accent,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  list: {
    gap: 12,
  },
  optionCard: {
    backgroundColor: arcaneColors.bgMist,
    borderRadius: arcaneRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: arcaneColors.border,
  },
  optionHeader: {
    marginBottom: 6,
  },
  optionBrand: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: arcaneColors.accent,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    marginTop: 2,
  },
  optionReason: {
    fontSize: 13,
    color: arcaneColors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    backgroundColor: arcaneColors.safeMuted,
    borderRadius: arcaneRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    color: arcaneColors.safe,
    fontWeight: '600' as const,
  },
  whereText: {
    fontSize: 12,
    color: arcaneColors.textMuted,
    marginBottom: 10,
    fontStyle: 'italic' as const,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: arcaneColors.border,
  },
  actionBtnActive: {
    backgroundColor: arcaneColors.primary,
    borderColor: arcaneColors.primary,
  },
  actionBtnFavActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  actionBtnListActive: {
    backgroundColor: arcaneColors.primary,
    borderColor: arcaneColors.primary,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: arcaneColors.primary,
  },
  actionTextActive: {
    color: '#FFFFFF',
  },
});
