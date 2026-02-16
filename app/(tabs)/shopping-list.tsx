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
import { ShoppingCart, Plus, Trash2, Check, AlertCircle, CheckCircle, AlertTriangle, X, DollarSign, MapPin, Share2, Bell } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { useFamily } from '@/contexts/FamilyContext';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { getShoppingList, addToShoppingList, updateShoppingListItem, removeFromShoppingList, clearCheckedItems, ShoppingListItem } from '@/storage/shoppingList';
import { searchProductByBarcode } from '@/api/products';
import { calculateVerdict, getVerdictColor } from '@/utils/verdict';
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
        const verdict = calculateVerdict(item.product!, member);
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

    const verdict = calculateVerdict(item.product, activeProfile);
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
          <Text style={styles.comingSoonSectionTitle}>Coming Soon</Text>

          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonIconWrap}>
              <DollarSign size={24} color="#F59E0B" />
            </View>
            <View style={styles.comingSoonContent}>
              <Text style={styles.comingSoonTitle}>Price Compare</Text>
              <Text style={styles.comingSoonDesc}>
                Compare prices across stores for items on your list. Find the best deals for allergy-safe products.
              </Text>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonBadgeText}>Soon</Text>
            </View>
          </View>

          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonIconWrap}>
              <MapPin size={24} color="#3B82F6" />
            </View>
            <View style={styles.comingSoonContent}>
              <Text style={styles.comingSoonTitle}>Store Distance & Pickup</Text>
              <Text style={styles.comingSoonDesc}>
                See which nearby stores carry your items and get directions or schedule pickup.
              </Text>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonBadgeText}>Soon</Text>
            </View>
          </View>

          <View style={styles.comingSoonCard}>
            <View style={styles.comingSoonIconWrap}>
              <Share2 size={24} color="#8B5CF6" />
            </View>
            <View style={styles.comingSoonContent}>
              <Text style={styles.comingSoonTitle}>Share with Friends</Text>
              <Text style={styles.comingSoonDesc}>
                Share your shopping list with friends and family outside your family group.
              </Text>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonBadgeText}>Soon</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#111827',
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  addSection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#0891B2',
    borderRadius: 12,
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
    color: '#FFFFFF',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
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
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 12,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0891B2',
    borderColor: '#0891B2',
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
    color: '#111827',
    marginBottom: 4,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through' as const,
    color: '#6B7280',
  },
  itemBarcode: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  itemNotes: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic' as const,
  },
  viewModeSection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#DBEAFE',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
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
    marginTop: 24,
    marginBottom: 32,
  },
  comingSoonSectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 12,
  },
  comingSoonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed' as const,
  },
  comingSoonIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  comingSoonContent: {
    flex: 1,
    marginRight: 10,
  },
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 3,
  },
  comingSoonDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  comingSoonBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  comingSoonBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#D97706',
  },
});
