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
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack, Href } from 'expo-router';
import { AlertCircle, Save, Upload, Camera } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { useUser } from '@/contexts/UserContext';
import { calculateVerdict, getVerdictLabel } from '@/utils/verdict';
import { guessProductType, getProductTypeLabel, getProductTypeColor, getProductTypeEmoji } from '@/utils/productType';
import { upsertProduct, recordScanEvent } from '@/services/supabaseProducts';
import { ProductType } from '@/types';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { generateText } from '@rork-ai/toolkit-sdk';

export default function ManualIngredientEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; productName?: string }>();
  const { activeProfile } = useProfiles();
  const { currentUser } = useUser();

  const [barcode, setBarcode] = useState(params.code || '');
  const [productName, setProductName] = useState(params.productName || '');
  const [brand, setBrand] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [productType, setProductType] = useState<ProductType>('food');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadIngredientsPhoto = async () => {
    console.log('[ManualEntry] Opening image picker for ingredients photo');
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Photo library access is required to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setIsUploading(true);

        if (Platform.OS !== 'web') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        const imageUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        try {
          const analysisResult = await generateText({
            messages: [{
              role: 'user',
              content: [
                { type: 'image', image: imageUri },
                {
                  type: 'text',
                  text: `Read the ingredients list from this product label image. Extract:
1. Product Name (if visible)
2. Brand (if visible)  
3. Full ingredients list (comma-separated)

Format your response as:
PRODUCT_NAME: [name or UNKNOWN]
BRAND: [brand or UNKNOWN]
INGREDIENTS: [full comma-separated ingredients list]

If you cannot read the ingredients, respond with: CANNOT_READ`,
                },
              ],
            }],
          });

          console.log('[ManualEntry] Ingredients analysis result:', analysisResult.substring(0, 200));

          if (analysisResult.includes('CANNOT_READ')) {
            Alert.alert(
              'Could Not Read',
              'We could not read the ingredients from this photo. Please try a clearer photo or enter them manually.',
              [
                { text: 'Try Again', onPress: handleUploadIngredientsPhoto },
                { text: 'OK', style: 'cancel' },
              ]
            );
          } else {
            const nameMatch = analysisResult.match(/PRODUCT_NAME:\s*(.+?)(?:\n|$)/i);
            const brandMatch = analysisResult.match(/BRAND:\s*(.+?)(?:\n|$)/i);
            const ingredientsMatch = analysisResult.match(/INGREDIENTS:\s*(.+?)$/ims);

            const extractedName = nameMatch?.[1]?.trim();
            const extractedBrand = brandMatch?.[1]?.trim();
            const extractedIngredients = ingredientsMatch?.[1]?.trim();

            if (extractedName && extractedName !== 'UNKNOWN' && !productName) {
              setProductName(extractedName);
            }
            if (extractedBrand && extractedBrand !== 'UNKNOWN' && !brand) {
              setBrand(extractedBrand);
            }
            if (extractedIngredients) {
              setIngredients(extractedIngredients);
              const guessed = guessProductType(extractedIngredients, extractedName, '');
              setProductType(guessed);
            }

            if (Platform.OS !== 'web') {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            Alert.alert('Ingredients Extracted', 'We filled in the ingredients from your photo. Please review and edit if needed.');
          }
        } catch (aiError) {
          console.error('[ManualEntry] AI analysis error:', aiError);
          Alert.alert('Analysis Failed', 'Could not analyze the image. Please enter ingredients manually.');
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.error('[ManualEntry] Error picking image:', error);
      setIsUploading(false);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

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
      const code = barcode.trim() || `manual_${Date.now()}`;
      const product = {
        code,
        product_name: productName.trim(),
        brands: brand.trim() || undefined,
        ingredients_text: ingredients.trim(),
        allergens_tags: [] as string[],
        traces_tags: [] as string[],
        product_type: productType,
        source: 'manual_entry' as const,
      };

      const saveResult = await upsertProduct(product);
      console.log('[ManualEntry] Save result:', saveResult);

      if (currentUser?.id && activeProfile) {
        const verdict = calculateVerdict(product, activeProfile);
        await recordScanEvent({
          user_id: currentUser.id,
          profile_id: activeProfile.id,
          product_barcode: code,
          product_name: productName.trim(),
          scan_type: 'manual',
          verdict: verdict.level,
          verdict_details: verdict.message || null,
        });
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (activeProfile && ingredients.trim()) {
        const verdict = calculateVerdict(product, activeProfile);

        Alert.alert(
          'Product Saved!',
          `${productName} saved successfully.\n\nSafety Check: ${getVerdictLabel(verdict.level)}\n${verdict.message}`,
          [
            {
              text: 'Back to Scan',
              onPress: () => router.back(),
            },
            {
              text: 'View Product',
              onPress: () => {
                router.replace(`/product/${encodeURIComponent(code)}` as Href);
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Product Saved!',
          'Your product has been saved and is now searchable.',
          [
            { text: 'Back to Scan', onPress: () => router.back() },
            { text: 'OK' },
          ]
        );
      }
    } catch (error) {
      console.error('[ManualEntry] Error saving:', error);
      Alert.alert('Error', 'Failed to save product. Please try again.');
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
      allergens_tags: [] as string[],
      traces_tags: [] as string[],
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

  const productTypes: ProductType[] = ['food', 'skin', 'hair', 'other'];

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Stack.Screen
        options={{
          title: 'Add Product',
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              <Save size={24} color={isSaving ? '#9CA3AF' : '#0891B2'} />
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <AlertCircle size={40} color="#0891B2" />
          <Text style={styles.infoTitle}>Add Product Manually</Text>
          <Text style={styles.infoText}>
            Enter product details or upload a photo of the ingredients label to auto-fill.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
          onPress={handleUploadIngredientsPhoto}
          disabled={isUploading}
          activeOpacity={0.8}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Upload size={22} color="#FFFFFF" />
          )}
          <View style={styles.uploadButtonContent}>
            <Text style={styles.uploadButtonTitle}>
              {isUploading ? 'Analyzing Photo...' : 'Upload Ingredients Photo'}
            </Text>
            <Text style={styles.uploadButtonSubtitle}>
              AI will extract ingredients automatically
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.label}>Product Category</Text>
          <View style={styles.typeSelector}>
            {productTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeChip,
                  productType === type && { backgroundColor: getProductTypeColor(type) + '20', borderColor: getProductTypeColor(type) },
                ]}
                onPress={() => {
                  setProductType(type);
                  if (Platform.OS !== 'web') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                }}
              >
                <Text style={styles.typeEmoji}>{getProductTypeEmoji(type)}</Text>
                <Text style={[
                  styles.typeLabel,
                  productType === type && { color: getProductTypeColor(type), fontWeight: '700' as const },
                ]}>
                  {getProductTypeLabel(type)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
            Copy from label or upload a photo above to auto-fill
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={ingredients}
            onChangeText={setIngredients}
            placeholder="e.g., Water, Butyrospermum Parkii (Shea Butter), Cetyl Alcohol..."
            multiline
            numberOfLines={8}
            textAlignVertical="top"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {activeProfile && (
          <TouchableOpacity
            style={styles.quickCheckButton}
            onPress={performQuickCheck}
          >
            <Text style={styles.quickCheckText}>Quick Safety Check for {activeProfile.name}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Save size={24} color="#FFFFFF" />
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Product'}
          </Text>
        </TouchableOpacity>

        <View style={styles.disclaimer}>
          <AlertCircle size={16} color="#92400E" />
          <Text style={styles.disclaimerText}>
            Products are saved to your account and are searchable across devices. Always verify ingredients on the actual product label.
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
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginTop: 10,
    marginBottom: 6,
    textAlign: 'center' as const,
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#059669',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonContent: {
    flex: 1,
  },
  uploadButtonTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  uploadButtonSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
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
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  typeEmoji: {
    fontSize: 16,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#6B7280',
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
