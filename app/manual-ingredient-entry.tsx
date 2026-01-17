import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { AlertCircle, Save } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { calculateVerdict, getVerdictLabel } from '@/utils/verdict';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MANUAL_ENTRIES_KEY = 'manual_ingredient_entries';

interface ManualEntry {
  barcode: string;
  productName: string;
  brand: string;
  ingredients: string;
  enteredAt: string;
  updatedAt: string;
}

export default function ManualIngredientEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; productName?: string }>();
  const { activeProfile } = useProfiles();

  const [barcode, setBarcode] = useState(params.code || '');
  const [productName, setProductName] = useState(params.productName || '');
  const [brand, setBrand] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!productName.trim()) {
      Alert.alert('Missing Information', 'Please enter a product name');
      return;
    }

    if (!ingredients.trim()) {
      Alert.alert('Missing Information', 'Please enter the ingredients list');
      return;
    }

    setIsSaving(true);

    try {
      const entry: ManualEntry = {
        barcode: barcode.trim(),
        productName: productName.trim(),
        brand: brand.trim(),
        ingredients: ingredients.trim(),
        enteredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const stored = await AsyncStorage.getItem(MANUAL_ENTRIES_KEY);
      const entries: ManualEntry[] = stored ? JSON.parse(stored) : [];

      const existingIndex = entries.findIndex(e => e.barcode === entry.barcode);
      if (existingIndex >= 0) {
        entries[existingIndex] = entry;
      } else {
        entries.push(entry);
      }

      await AsyncStorage.setItem(MANUAL_ENTRIES_KEY, JSON.stringify(entries));

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (activeProfile && ingredients.trim()) {
        const mockProduct = {
          code: barcode,
          product_name: productName,
          brands: brand,
          ingredients_text: ingredients,
          allergens_tags: [],
          traces_tags: [],
          source: 'manual_entry' as const,
        };

        const verdict = calculateVerdict(mockProduct, activeProfile);

        Alert.alert(
          '✓ Saved Successfully',
          `Ingredients saved for ${productName}\n\nSafety Check: ${getVerdictLabel(verdict.level)}\n${verdict.message}`,
          [
            {
              text: 'View Details',
              onPress: () => {
                router.replace(`/product/${barcode}`);
              },
            },
            { text: 'OK' },
          ]
        );
      } else {
        Alert.alert('✓ Saved', 'Ingredients saved successfully');
        router.back();
      }
    } catch (error) {
      console.error('Error saving manual entry:', error);
      Alert.alert('Error', 'Failed to save ingredient information');
    } finally {
      setIsSaving(false);
    }
  };

  const performQuickCheck = () => {
    if (!ingredients.trim()) {
      Alert.alert('No Ingredients', 'Please enter ingredients first');
      return;
    }

    if (!activeProfile) {
      Alert.alert('No Profile', 'Please select an allergy profile first');
      return;
    }

    const mockProduct = {
      code: barcode || 'manual',
      product_name: productName || 'Manual Entry',
      brands: brand,
      ingredients_text: ingredients,
      allergens_tags: [],
      traces_tags: [],
      source: 'manual_entry' as const,
    };

    const verdict = calculateVerdict(mockProduct, activeProfile);
    const label = getVerdictLabel(verdict.level);

    if (Platform.OS !== 'web') {
      if (verdict.level === 'danger') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else if (verdict.level === 'caution') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }

    Alert.alert(
      `${label} - ${activeProfile.name}`,
      verdict.message + 
      (verdict.matches.length > 0 ? `\n\nDetected: ${verdict.matches.map(m => m.matchedText).join(', ')}` : ''),
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Stack.Screen
        options={{
          title: 'Manual Ingredient Entry',
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              <Save size={24} color={isSaving ? '#9CA3AF' : '#0891B2'} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <AlertCircle size={48} color="#0891B2" />
          <Text style={styles.infoTitle}>Manual Ingredient Entry</Text>
          <Text style={styles.infoText}>
            When a product is not in our database, you can manually enter its ingredients. This helps you check for allergens and saves the information for future scans.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Barcode (Optional)</Text>
          <TextInput
            style={styles.input}
            value={barcode}
            onChangeText={setBarcode}
            placeholder="Enter barcode if available"
            keyboardType="numeric"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Product Name *</Text>
          <TextInput
            style={styles.input}
            value={productName}
            onChangeText={setProductName}
            placeholder="e.g., Cantu Curl Activator"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Brand (Optional)</Text>
          <TextInput
            style={styles.input}
            value={brand}
            onChangeText={setBrand}
            placeholder="e.g., Cantu"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Ingredients List *</Text>
          <Text style={styles.helperText}>
            Copy the full ingredients list from the product label, separated by commas
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={ingredients}
            onChangeText={setIngredients}
            placeholder="e.g., Water, Butyrospermum Parkii (Shea Butter), Cetyl Alcohol, Glycerin, Fragrance..."
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>💡 Tips for Accuracy</Text>
          <Text style={styles.tipText}>• Copy the exact ingredients from the label</Text>
          <Text style={styles.tipText}>• Include parenthetical scientific names (e.g., Shea Butter becomes Butyrospermum Parkii)</Text>
          <Text style={styles.tipText}>• Separate ingredients with commas</Text>
          <Text style={styles.tipText}>• Check both sides of the package</Text>
        </View>

        {activeProfile && (
          <TouchableOpacity
            style={styles.quickCheckButton}
            onPress={performQuickCheck}
          >
            <Text style={styles.quickCheckText}>⚡ Quick Safety Check for {activeProfile.name}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Save size={24} color="#FFFFFF" />
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Ingredients'}
          </Text>
        </TouchableOpacity>

        <View style={styles.disclaimer}>
          <AlertCircle size={16} color="#92400E" />
          <Text style={styles.disclaimerText}>
            Manually entered data is stored locally on your device. Always verify ingredients on the actual product label before use.
          </Text>
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
  content: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#E0F2FE',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0891B2',
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textArea: {
    minHeight: 150,
    paddingTop: 16,
  },
  tipCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#92400E',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#78350F',
    marginBottom: 6,
    lineHeight: 20,
  },
  quickCheckButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  quickCheckText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#0891B2',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 32,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
});
