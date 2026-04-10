import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect, Href } from 'expo-router';
import { ShoppingCart, Plus, Trash2, Check, AlertCircle, CheckCircle, AlertTriangle, X, DollarSign, MapPin, Share2, Upload, Lock, Sparkles } from 'lucide-react-native';
import { arcaneColors, arcaneRadius, arcaneShadows } from '@/constants/theme';
import { RuneCard } from '@/components/RuneCard';
import { SigilBadge } from '@/components/SigilBadge';
import { useProfiles } from '@/contexts/ProfileContext';
import { useFamily } from '@/contexts/FamilyContext';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { getShoppingList, addToShoppingList, updateShoppingListItem, removeFromShoppingList, clearCheckedItems, ShoppingListItem } from '@/storage/shoppingList';
import { searchProductByBarcode } from '@/api/products';
import { getVerdictColor } from '@/utils/verdict';
import { evaluateProduct } from '@/utils/evaluationEngine';
import { engineToLegacyVerdict } from '@/utils/unifiedEvaluation';
import * as Haptics from 'expo-haptics';

export default function ShoppingListScreen() {
  const router = useRouter();
  const { activeProfile, profiles } = useProfiles();
  const { viewMode, getFamilyMembers, activeFamilyGroup } = useFamily();
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemBarcode, setNewItemBarcode] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const loadItems = async () => {
    try {
      const list = await getShoppingList();
      const filtered = activeProfile 
        ? list.filter(item => !item.profileId || item.profileId === activeProfile.id)
        : list;
      setItems(filtered);
    } catch (error) {
      console.error('Error loading shopping list:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadItems();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProfile])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) {
      Alert.alert('Missing Name', 'Please enter an item name');
      return;
    }

    setIsAdding(true);
    try {
      let product = undefined;
      
      if (newItemBarcode.trim()) {
        const fetchedProduct = await searchProductByBarcode(newItemBarcode.trim());
        product = fetchedProduct || undefined;
      }

      const item: ShoppingListItem = {
        id: `${Date.now()}_${Math.random()}`,
        name: newItemName.trim(),
        barcode: newItemBarcode.trim() || undefined,
        product,
        checked: false,
        addedAt: new Date().toISOString(),
        profileId: activeProfile?.id,
      };

      await addToShoppingList(item);
      await loadItems();
      setNewItemName('');
      setNewItemBarcode('');
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert('Error', 'Failed to add item');
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleCheck = async (item: ShoppingListItem) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    try {
      await updateShoppingListItem(item.id, { checked: !item.checked });
      await loadItems();
    } catch {
      Alert.alert('Error', 'Failed to update item');
    }
  };

  const handleRemoveItem = (item: ShoppingListItem) => {
    Alert.alert(
      'Remove Item',
      `Remove "${item.name}" from shopping list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFromShoppingList(item.id);
              await loadItems();
            } catch {
              Alert.alert('Error', 'Failed to remove item');
            }
          },
        },
      ]
    );
  };

  const handleClearChecked = () => {
    const checkedCount = items.filter(item => item.checked).length;
    if (checkedCount === 0) {
      Alert.alert('No Items', 'No checked items to clear');
      return;
    }

    Alert.alert(
      'Clear Checked Items',
      `Remove ${checkedCount} checked item${checkedCount !== 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearCheckedItems();
              await loadItems();
            } catch {
              Alert.alert('Error', 'Failed to clear items');
            }
          },
        },
      ]
    );
  };

  const renderVerdictBadge = (item: ShoppingListItem) => {
    if (!item.product) return null;

    if (viewMode === 'family' && activeFamilyGroup) {
      const familyMembers = getFamilyMembers(profiles);
      if (familyMembers.length === 0) return null;

      let worstLevel: 'safe' | 'caution' | 'danger' = 'safe';
      const affectedMembers: string[] = [];

      familyMembers.forEach(member => {
        const verdict = engineToLegacyVerdict(evaluateProduct(item.product!, member));
        if (verdict.level === 'danger') {
          worstLevel = 'danger';
          affectedMembers.push(member.name);
        } else if (verdict.level === 'caution' && worstLevel !== 'danger') {
          worstLevel = 'caution';
          affectedMembers.push(member.name);
        }
      });

      const color = getVerdictColor(worstLevel);
      const Icon = worstLevel === 'safe' ? CheckCircle : worstLevel === 'caution' ? AlertTriangle : AlertCircle;

      return (
        <View style={styles.verdictContainer}>
          <View style={[styles.verdictBadge, { backgroundColor: color + '20', borderColor: color }]}>
            <Icon size={16} color={color} />
          </View>
          {affectedMembers.length > 0 && (
            <Text style={[styles.affectedText, { color }]} numberOfLines={1}>
              {affectedMembers.join(', ')}
            </Text>
          )}
        </View>
      );
    }

    if (!activeProfile) return null;

    const verdict = engineToLegacyVerdict(evaluateProduct(item.product, activeProfile));
    const color = getVerdictColor(verdict.level);
    
    const Icon = verdict.level === 'safe' ? CheckCircle : verdict.level === 'caution' ? AlertTriangle : AlertCircle;

    return (
      <View style={[styles.verdictBadge, { backgroundColor: color + '20', borderColor: color }]}>
        <Icon size={16} color={color} />
      </View>
    );
  };

  const uncheckedItems = items.filter(item => !item.checked);
  const checkedItems = items.filter(item => item.checked);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Shopping List</Text>
        {checkedItems.length > 0 && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearChecked}>
            <Trash2 size={20} color="#DC2626" />
            <Text style={styles.clearButtonText}>Clear ({checkedItems.length})</Text>
          </TouchableOpacity>
        )}
      </View>

      {activeFamilyGroup && activeFamilyGroup.memberIds.length > 1 && (
        <View style={styles.viewModeSection}>
          <ViewModeToggle />
        </View>
      )}

      <View style={styles.addSection}>
        <TextInput
          style={styles.input}
          placeholder="Item name"
          value={newItemName}
          onChangeText={setNewItemName}
          editable={!isAdding}
        />
        <TextInput
          style={styles.input}
          placeholder="Barcode (optional)"
          value={newItemBarcode}
          onChangeText={setNewItemBarcode}
          keyboardType="numeric"
          editable={!isAdding}
        />
        <TouchableOpacity
          style={[styles.addButton, isAdding && styles.addButtonDisabled]}
          onPress={handleAddItem}
          disabled={isAdding}
        >
          <Plus size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>{isAdding ? 'Adding...' : 'Add Item'}</Text>
        </TouchableOpacity>
      </View>

      {!activeProfile && viewMode === 'individual' && (
        <View style={styles.warningBanner}>
          <AlertCircle size={20} color="#F59E0B" />
          <Text style={styles.warningText}>
            Select a profile to check items for allergens
          </Text>
        </View>
      )}

      {viewMode === 'family' && activeFamilyGroup && (
        <View style={styles.infoBanner}>
          <AlertCircle size={20} color="#0891B2" />
          <Text style={styles.infoText}>
            Showing allergen warnings for all {getFamilyMembers(profiles).length} family members
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <ShoppingCart size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Your shopping list is empty</Text>
            <Text style={styles.emptySubtext}>Add items to start shopping</Text>
          </View>
        ) : (
          <>
            {uncheckedItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>To Buy ({uncheckedItems.length})</Text>
                {uncheckedItems.map(item => (
                  <View key={item.id} style={styles.itemCard}>
                    <TouchableOpacity
                      style={styles.checkButton}
                      onPress={() => handleToggleCheck(item)}
                    >
                      <View style={styles.checkbox} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.itemContent}
                      onPress={() => item.barcode && router.push(`/product/${item.barcode}` as Href)}
                      disabled={!item.barcode}
                    >
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {item.barcode && (
                          <Text style={styles.itemBarcode}>Barcode: {item.barcode}</Text>
                        )}
                        {item.notes && (
                          <Text style={styles.itemNotes}>{item.notes}</Text>
                        )}
                      </View>
                      {renderVerdictBadge(item)}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveItem(item)}
                    >
                      <X size={20} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {checkedItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Checked ({checkedItems.length})</Text>
                {checkedItems.map(item => (
                  <View key={item.id} style={[styles.itemCard, styles.itemCardChecked]}>
                    <TouchableOpacity
                      style={styles.checkButton}
                      onPress={() => handleToggleCheck(item)}
                    >
                      <View style={[styles.checkbox, styles.checkboxChecked]}>
                        <Check size={16} color="#FFFFFF" />
                      </View>
                    </TouchableOpacity>

                    <View style={styles.itemContent}>
                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemName, styles.itemNameChecked]}>{item.name}</Text>
                        {item.barcode && (
                          <Text style={styles.itemBarcode}>Barcode: {item.barcode}</Text>
                        )}
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => handleRemoveItem(item)}
                    >
                      <X size={20} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        <View style={styles.comingSoonSection}>
          <View style={styles.comingSoonHeader}>
            <Sparkles size={18} color={arcaneColors.gold} />
            <Text style={styles.comingSoonSectionTitle}>Coming Soon</Text>
          </View>

          <RuneCard variant="gold">
            <View style={styles.comingSoonSmartHeader}>
              <ShoppingCart size={20} color={arcaneColors.goldDark} />
              <Text style={styles.comingSoonSmartTitle}>Shopping List: Smart Mode</Text>
            </View>
            <Text style={styles.comingSoonSmartDesc}>
              Add scanned items, screenshots, or manual entries. Compare prices, find nearby stores, and share with family.
            </Text>
            <SigilBadge label="Planned" status="legendary" size="sm" />
          </RuneCard>

          <View style={styles.comingSoonLockedCard}>
            <View style={styles.comingSoonLockedIcon}>
              <Lock size={14} color={arcaneColors.textMuted} />
            </View>
            <View style={[styles.comingSoonLockedIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.10)' }]}>
              <DollarSign size={20} color={arcaneColors.gold} />
            </View>
            <View style={styles.comingSoonLockedContent}>
              <Text style={styles.comingSoonLockedTitle}>Price Compare</Text>
              <Text style={styles.comingSoonLockedDesc}>
                Compare prices across stores. Find the best deals for allergy-safe products.
              </Text>
            </View>
            <SigilBadge label="Planned" status="legendary" size="sm" />
          </View>

          <View style={styles.comingSoonLockedCard}>
            <View style={styles.comingSoonLockedIcon}>
              <Lock size={14} color={arcaneColors.textMuted} />
            </View>
            <View style={[styles.comingSoonLockedIconBg, { backgroundColor: 'rgba(59, 130, 246, 0.10)' }]}>
              <MapPin size={20} color="#3B82F6" />
            </View>
            <View style={styles.comingSoonLockedContent}>
              <Text style={styles.comingSoonLockedTitle}>Distance / Store Finder</Text>
              <Text style={styles.comingSoonLockedDesc}>
                See which nearby stores carry your items and get directions.
              </Text>
            </View>
            <SigilBadge label="Planned" status="legendary" size="sm" />
          </View>

          <View style={styles.comingSoonLockedCard}>
            <View style={styles.comingSoonLockedIcon}>
              <Lock size={14} color={arcaneColors.textMuted} />
            </View>
            <View style={[styles.comingSoonLockedIconBg, { backgroundColor: arcaneColors.accentMuted }]}>
              <Share2 size={20} color={arcaneColors.accent} />
            </View>
            <View style={styles.comingSoonLockedContent}>
              <Text style={styles.comingSoonLockedTitle}>Share List</Text>
              <Text style={styles.comingSoonLockedDesc}>
                Share your shopping list with family and friends for coordinated shopping.
              </Text>
            </View>
            <SigilBadge label="Planned" status="legendary" size="sm" />
          </View>

          <View style={styles.comingSoonLockedCard}>
            <View style={styles.comingSoonLockedIcon}>
              <Lock size={14} color={arcaneColors.textMuted} />
            </View>
            <View style={[styles.comingSoonLockedIconBg, { backgroundColor: arcaneColors.primaryMuted }]}>
              <Upload size={20} color={arcaneColors.primary} />
            </View>
            <View style={styles.comingSoonLockedContent}>
              <Text style={styles.comingSoonLockedTitle}>Auto-Add from Screenshots</Text>
              <Text style={styles.comingSoonLockedDesc}>
                Upload screenshots or product photos to auto-add items.
              </Text>
            </View>
            <SigilBadge label="Planned" status="legendary" size="sm" />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: arcaneColors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: arcaneColors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: arcaneColors.border,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    letterSpacing: 0.5,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: arcaneRadius.md,
    backgroundColor: arcaneColors.dangerMuted,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: arcaneColors.danger,
  },
  addSection: {
    padding: 16,
    backgroundColor: arcaneColors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: arcaneColors.border,
  },
  input: {
    backgroundColor: arcaneColors.bgMist,
    borderRadius: arcaneRadius.md,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    marginBottom: 12,
    color: arcaneColors.text,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: arcaneColors.primary,
    borderRadius: arcaneRadius.lg,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: arcaneColors.textOnPrimary,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: arcaneColors.cautionMuted,
    borderBottomWidth: 1,
    borderBottomColor: arcaneColors.caution,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: arcaneColors.textGold,
    fontWeight: '500' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: arcaneColors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: arcaneColors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: arcaneColors.borderRune,
    ...arcaneShadows.card,
  },
  itemCardChecked: {
    opacity: 0.6,
  },
  checkButton: {
    padding: 4,
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: arcaneColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: arcaneColors.primary,
    borderColor: arcaneColors.primary,
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  itemNameChecked: {
    textDecorationLine: 'line-through' as const,
    color: arcaneColors.textMuted,
  },
  itemBarcode: {
    fontSize: 12,
    color: arcaneColors.textSecondary,
    marginBottom: 2,
  },
  itemNotes: {
    fontSize: 13,
    color: arcaneColors.textMuted,
    fontStyle: 'italic' as const,
  },
  viewModeSection: {
    padding: 16,
    backgroundColor: arcaneColors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: arcaneColors.border,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: arcaneColors.primaryMuted,
    borderBottomWidth: 1,
    borderBottomColor: arcaneColors.borderRune,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: arcaneColors.primary,
    fontWeight: '500' as const,
  },
  verdictContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
    flex: 1,
    maxWidth: 150,
  },
  verdictBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  affectedText: {
    fontSize: 11,
    fontWeight: '600' as const,
    flex: 1,
  },
  removeButton: {
    padding: 8,
    marginLeft: 8,
  },
  comingSoonSection: {
    marginTop: 28,
    marginBottom: 32,
  },
  comingSoonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  comingSoonSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: arcaneColors.text,
  },
  comingSoonSmartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  comingSoonSmartTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: arcaneColors.goldDark,
  },
  comingSoonSmartDesc: {
    fontSize: 13,
    color: arcaneColors.textSecondary,
    lineHeight: 19,
    marginBottom: 10,
  },
  comingSoonLockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    borderStyle: 'dashed' as const,
    opacity: 0.75,
    ...arcaneShadows.card,
  },
  comingSoonLockedIcon: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    zIndex: 1,
  },
  comingSoonLockedIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  comingSoonLockedContent: {
    flex: 1,
    marginRight: 8,
  },
  comingSoonLockedTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: arcaneColors.text,
    marginBottom: 2,
  },
  comingSoonLockedDesc: {
    fontSize: 12,
    color: arcaneColors.textMuted,
    lineHeight: 16,
  },
});
