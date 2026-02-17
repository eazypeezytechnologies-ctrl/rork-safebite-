import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  Camera,
  Upload,
  Flashlight,
  FlashlightOff,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
} from 'lucide-react-native';
import { generateText } from '@rork-ai/toolkit-sdk';
import { Product, ProductType } from '@/types';
import { upsertProduct, recordScanEvent } from '@/services/supabaseProducts';
import { useProfiles } from '@/contexts/ProfileContext';
import { useUser } from '@/contexts/UserContext';
import { useQueryClient } from '@tanstack/react-query';
import { calculateVerdict } from '@/utils/verdict';
import { guessProductType, getProductTypeLabel, getProductTypeColor, getProductTypeEmoji } from '@/utils/productType';
import { addToScanHistory } from '@/storage/scanHistory';
import { cacheProduct } from '@/storage/productCache';
import { resetBarcodeDebounce } from '@/api/products';

interface ProductCaptureWizardProps {
  barcode: string;
  onProductSaved: (product: Product) => void;
  onCancel: () => void;
  onNavigateToScan?: () => void;
  onNavigateToSearch?: (query?: string) => void;
}

type WizardStep = 1 | 2 | 3;

interface ExtractedData {
  name: string;
  brand: string;
  ingredients: string;
  allergens: string;
}

export default function ProductCaptureWizard({ barcode, onProductSaved, onCancel, onNavigateToScan, onNavigateToSearch }: ProductCaptureWizardProps) {
  const { activeProfile } = useProfiles();
  const { currentUser } = useUser();
  const queryClient = useQueryClient();
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState<WizardStep>(1);
  const [cameraActive, setCameraActive] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);

  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [ingredientsImage, setIngredientsImage] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeTarget, setAnalyzeTarget] = useState<'front' | 'ingredients' | null>(null);
  const [analysisElapsed, setAnalysisElapsed] = useState(0);
  const analysisTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [extractedData, setExtractedData] = useState<ExtractedData>({
    name: '',
    brand: '',
    ingredients: '',
    allergens: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [productType, setProductType] = useState<ProductType>('food');
  const [savedProductName, setSavedProductName] = useState('');

  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step, progressAnim]);

  useEffect(() => {
    if (isAnalyzing) {
      setAnalysisElapsed(0);
      analysisTimerRef.current = setInterval(() => {
        setAnalysisElapsed(prev => prev + 1);
      }, 1000);
    } else {
      if (analysisTimerRef.current) {
        clearInterval(analysisTimerRef.current);
        analysisTimerRef.current = null;
      }
      setAnalysisElapsed(0);
    }
    return () => {
      if (analysisTimerRef.current) {
        clearInterval(analysisTimerRef.current);
      }
    };
  }, [isAnalyzing]);

  const analyzeImage = useCallback(async (imageUri: string, target: 'front' | 'ingredients') => {
    setIsAnalyzing(true);
    setAnalyzeTarget(target);

    const prompt = target === 'front'
      ? `You are reading a product package front. Extract:
Product Name: [exact text]
Brand: [brand name]
If you cannot read text clearly, still try your best guess.
Format response exactly as above, one per line.`
      : `You are reading a product ingredients label. Extract:
Ingredients: [full ingredient list text]
Allergens: [any allergen warnings like "Contains:" or "May contain:"]
If you cannot read text clearly, still try your best guess and note uncertainty.
Format response exactly as above, one per line.`;

    try {
      console.log('[CaptureWizard] Analyzing', target, 'image...');

      const result = await generateText({
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', image: imageUri },
              { type: 'text', text: prompt },
            ],
          },
        ],
      });

      console.log('[CaptureWizard] Analysis result:', result);

      if (target === 'front') {
        const nameMatch = result.match(/Product Name:\s*(.+?)(?:\n|$)/i);
        const brandMatch = result.match(/Brand:\s*(.+?)(?:\n|$)/i);
        const name = nameMatch?.[1]?.trim() || '';
        const brand = brandMatch?.[1]?.trim() || '';
        setExtractedData(prev => ({
          ...prev,
          name: name && !name.toLowerCase().includes('not visible') ? name : prev.name,
          brand: brand && !brand.toLowerCase().includes('not visible') ? brand : prev.brand,
        }));
      } else {
        const ingredientsMatch = result.match(/Ingredients:\s*(.+?)(?:\nAllergens:|$)/is);
        const allergensMatch = result.match(/Allergens:\s*(.+?)$/is);
        const ingredients = ingredientsMatch?.[1]?.trim() || '';
        const allergens = allergensMatch?.[1]?.trim() || '';
        setExtractedData(prev => ({
          ...prev,
          ingredients: ingredients && !ingredients.toLowerCase().includes('not visible') ? ingredients : prev.ingredients,
          allergens: allergens && !allergens.toLowerCase().includes('not visible') ? allergens : prev.allergens,
        }));
      }

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[CaptureWizard] Analysis error:', error);
      Alert.alert(
        'Analysis Issue',
        'Could not fully analyze the image. You can edit the fields manually or retake the photo.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const openCameraForStep = useCallback(async (target: 'front' | 'ingredients') => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
        return;
      }
    }
    setAnalyzeTarget(target);
    setCameraActive(true);
    setTorchEnabled(false);
  }, [permission, requestPermission]);

  const pickFromGallery = useCallback(async (target: 'front' | 'ingredients') => {
    try {
      const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permResult.granted) {
        Alert.alert('Permission Required', 'Photo library access is needed.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (Platform.OS !== 'web') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        const imageUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        if (target === 'front') {
          setFrontImage(imageUri);
          analyzeImage(imageUri, 'front');
        } else {
          setIngredientsImage(imageUri);
          analyzeImage(imageUri, 'ingredients');
        }
      }
    } catch (error) {
      console.error('[CaptureWizard] Gallery pick error:', error);
      Alert.alert('Error', 'Failed to select image.');
    }
  }, [analyzeImage]);

  const capturePhoto = useCallback(async () => {
    if (!cameraRef.current || !analyzeTarget) return;
    try {
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
        skipProcessing: true,
      });
      if (!photo?.base64) {
        Alert.alert('Error', 'Failed to capture photo.');
        return;
      }
      const imageUri = `data:image/jpeg;base64,${photo.base64}`;
      setCameraActive(false);
      if (analyzeTarget === 'front') {
        setFrontImage(imageUri);
        analyzeImage(imageUri, 'front');
      } else {
        setIngredientsImage(imageUri);
        analyzeImage(imageUri, 'ingredients');
      }
    } catch (error) {
      console.error('[CaptureWizard] Capture error:', error);
      setCameraActive(false);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  }, [analyzeTarget, analyzeImage]);

  const handleSave = useCallback(async () => {
    if (!extractedData.name.trim()) {
      Alert.alert('Name Required', 'Please enter at least a product name.');
      return;
    }

    setIsSaving(true);
    try {
      const productCode = barcode && /^\d{8,14}$/.test(barcode) ? barcode.trim() : `manual_${Date.now()}`;

      const allergensFromText: string[] = [];
      if (extractedData.allergens) {
        const parts = extractedData.allergens
          .replace(/contains:/i, '')
          .replace(/may contain:/i, '')
          .split(/[,;]/)
          .map(s => s.trim())
          .filter(Boolean);
        allergensFromText.push(...parts);
      }

      const guessedType = guessProductType(
        extractedData.ingredients,
        extractedData.name,
        ''
      );
      const finalType = productType || guessedType;

      const product: Product = {
        code: productCode,
        product_name: extractedData.name.trim(),
        brands: extractedData.brand.trim() || undefined,
        ingredients_text: extractedData.ingredients.trim() || undefined,
        allergens: extractedData.allergens.trim() || undefined,
        allergens_tags: allergensFromText.map(a => `en:${a.toLowerCase()}`),
        traces_tags: [],
        product_type: finalType,
        source: 'manual_entry' as const,
      };

      console.log('[CaptureWizard] Saving product:', product.code, product.product_name);

      const upsertResult = await upsertProduct(product);
      if (!upsertResult.success) {
        console.error('[CaptureWizard] ❌ Upsert FAILED:', upsertResult.error);
        Alert.alert(
          'Save Issue',
          `Product could not be saved to the database: ${upsertResult.error || 'Unknown error'}. You can retry or continue.`,
          [
            { text: 'Retry', onPress: () => handleSave() },
            { text: 'Continue Anyway', style: 'cancel', onPress: () => {
              onProductSaved(product);
            }},
          ]
        );
        setIsSaving(false);
        return;
      }

      if (!upsertResult.verified) {
        console.warn('[CaptureWizard] ⚠️ Save not verified - product may not be queryable');
      } else {
        console.log('[CaptureWizard] ✅ Product verified in database');
      }

      await cacheProduct(product);
      resetBarcodeDebounce();

      if (currentUser?.id && activeProfile) {
        const verdict = calculateVerdict(product, activeProfile);
        const [, scanResult] = await Promise.all([
          addToScanHistory({
            id: `${productCode}_${activeProfile.id}_${Date.now()}`,
            product,
            verdict,
            profileId: activeProfile.id,
            profileName: activeProfile.name,
            scannedAt: new Date().toISOString(),
          }, currentUser.id),
          recordScanEvent({
            user_id: currentUser.id,
            profile_id: activeProfile.id,
            product_barcode: productCode,
            product_name: product.product_name || 'Manual Entry',
            scan_type: 'manual',
            verdict: verdict.level,
            verdict_details: verdict.message || null,
          }),
        ]);

        console.log('[CaptureWizard] History saved, scan event:', scanResult.success ? 'OK' : scanResult.error);
      }

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      console.log('[CaptureWizard] Invalidating all caches after save...');
      await queryClient.invalidateQueries({ queryKey: ['supabase-scan-history'] });
      await queryClient.invalidateQueries({ queryKey: ['supabase-product', productCode] });
      queryClient.invalidateQueries({ queryKey: ['supabase-favorites'] });
      queryClient.removeQueries({ queryKey: ['supabase-product', productCode] });

      setSaveSuccess(true);
      setSavedProductName(extractedData.name.trim());
      console.log('[CaptureWizard] ✅ Product saved, verified, and caches invalidated');
    } catch (error) {
      console.error('[CaptureWizard] Save error:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Save Failed', `Could not save the product: ${msg}. Please try again.`);
    } finally {
      setIsSaving(false);
    }
  }, [barcode, extractedData, currentUser, activeProfile, onProductSaved]);

  if (cameraActive) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={torchEnabled}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.cameraHeader}>
            <TouchableOpacity
              style={styles.cameraCloseBtn}
              onPress={() => setCameraActive(false)}
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.cameraHeaderTitle}>
              {analyzeTarget === 'front' ? 'Product Front' : 'Ingredients Label'}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.cameraCenterFrame}>
            <View style={[styles.cCorner, styles.cTL]} />
            <View style={[styles.cCorner, styles.cTR]} />
            <View style={[styles.cCorner, styles.cBL]} />
            <View style={[styles.cCorner, styles.cBR]} />
          </View>

          <View style={styles.cameraBottom}>
            <TouchableOpacity
              style={styles.flashBtn}
              onPress={async () => {
                if (Platform.OS !== 'web') {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setTorchEnabled(!torchEnabled);
              }}
              testID="wizard-flash-button"
            >
              {torchEnabled ? (
                <Flashlight size={22} color="#FBBF24" />
              ) : (
                <FlashlightOff size={22} color="#FFFFFF" />
              )}
              <Text style={[styles.flashLabel, torchEnabled && { color: '#FBBF24' }]}>
                {torchEnabled ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.captureBtn}
              onPress={capturePhoto}
              activeOpacity={0.8}
            >
              <View style={styles.captureBtnInner}>
                <Camera size={28} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <View style={{ width: 60 }} />
          </View>
        </View>
      </View>
    );
  }

  if (isAnalyzing) {
    return (
      <View style={styles.analyzeContainer}>
        <View style={styles.stepperRow}>
          {[1, 2, 3].map(s => (
            <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]} />
          ))}
        </View>
        <ActivityIndicator size="large" color="#0891B2" />
        <Text style={styles.analyzeTitle}>
          {analyzeTarget === 'front' ? 'Reading product label...' : 'Extracting ingredients...'}
        </Text>
        <Text style={styles.analyzeSubtitle}>Step {step} of 3</Text>
        {analysisElapsed >= 10 && analysisElapsed < 20 && (
          <Text style={styles.slowText}>Still working...</Text>
        )}
        {analysisElapsed >= 20 && (
          <View style={styles.retryRow}>
            <Text style={styles.slowText}>Taking longer than expected</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setIsAnalyzing(false);
                Alert.alert('Timeout', 'Analysis took too long. You can edit the fields manually or try again.');
              }}
            >
              <RefreshCw size={16} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
        {(analyzeTarget === 'front' && frontImage) && (
          <Image source={{ uri: frontImage }} style={styles.previewThumb} />
        )}
        {(analyzeTarget === 'ingredients' && ingredientsImage) && (
          <Image source={{ uri: ingredientsImage }} style={styles.previewThumb} />
        )}
      </View>
    );
  }

  if (saveSuccess) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Check size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.successTitle}>Product Saved!</Text>
        <Text style={styles.successSubtitle}>
          {savedProductName || extractedData.name} is now searchable and in your history.
        </Text>

        <View style={styles.successActions}>
          <TouchableOpacity
            style={styles.successPrimaryBtn}
            onPress={() => {
              if (onNavigateToScan) {
                onNavigateToScan();
              } else {
                onProductSaved({ code: barcode, product_name: savedProductName, source: 'manual_entry' } as Product);
              }
            }}
            activeOpacity={0.8}
          >
            <Camera size={20} color="#FFFFFF" />
            <Text style={styles.successPrimaryBtnText}>Back to Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.successSecondaryBtn}
            onPress={() => {
              if (onNavigateToSearch) {
                onNavigateToSearch(savedProductName);
              } else {
                onProductSaved({ code: barcode, product_name: savedProductName, source: 'manual_entry' } as Product);
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.successSecondaryBtnText}>Search to Confirm</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonIcon}>🛒</Text>
          <Text style={styles.comingSoonTitle}>Add to Shopping List</Text>
          <Text style={styles.comingSoonLabel}>Coming Soon</Text>
          <Text style={styles.comingSoonDesc}>
            Save products to a shared shopping list with price comparison and store locations.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.stepperRow}>
        {[1, 2, 3].map(s => (
          <View key={s} style={styles.stepIndicatorWrap}>
            <View style={[styles.stepCircle, step >= s && styles.stepCircleActive]}>
              <Text style={[styles.stepCircleText, step >= s && styles.stepCircleTextActive]}>
                {s}
              </Text>
            </View>
            <Text style={[styles.stepLabel, step === s && styles.stepLabelActive]}>
              {s === 1 ? 'Front' : s === 2 ? 'Ingredients' : 'Save'}
            </Text>
          </View>
        ))}
      </View>

      {barcode && /^\d{8,14}$/.test(barcode) && (
        <View style={styles.barcodeTag}>
          <Text style={styles.barcodeTagText}>Barcode: {barcode}</Text>
        </View>
      )}

      {step === 1 && (
        <View style={styles.stepBody}>
          <Text style={styles.stepTitle}>Step 1: Product Front</Text>
          <Text style={styles.stepDesc}>
            Take or upload a photo of the product front so we can identify it.
          </Text>

          {frontImage ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: frontImage }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => setFrontImage(null)}
              >
                <RefreshCw size={16} color="#0891B2" />
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.captureOptions}>
              <TouchableOpacity
                style={styles.captureOptionCard}
                onPress={() => openCameraForStep('front')}
                activeOpacity={0.8}
              >
                <View style={[styles.captureOptionIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Camera size={24} color="#2563EB" />
                </View>
                <View style={styles.captureOptionContent}>
                  <Text style={styles.captureOptionTitle}>Take Photo</Text>
                  <Text style={styles.captureOptionDesc}>Use camera to capture</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.captureOptionCard}
                onPress={() => pickFromGallery('front')}
                activeOpacity={0.8}
              >
                <View style={[styles.captureOptionIcon, { backgroundColor: '#D1FAE5' }]}>
                  <Upload size={24} color="#059669" />
                </View>
                <View style={styles.captureOptionContent}>
                  <Text style={styles.captureOptionTitle}>Upload Photo</Text>
                  <Text style={styles.captureOptionDesc}>From camera roll</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {(extractedData.name || extractedData.brand) && (
            <View style={styles.extractedSection}>
              <Text style={styles.extractedLabel}>Detected:</Text>
              {extractedData.name ? (
                <Text style={styles.extractedValue}>Name: {extractedData.name}</Text>
              ) : null}
              {extractedData.brand ? (
                <Text style={styles.extractedValue}>Brand: {extractedData.brand}</Text>
              ) : null}
            </View>
          )}

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.nextBtn, !frontImage && styles.nextBtnDisabled]}
              onPress={() => setStep(2)}
              disabled={!frontImage}
            >
              <Text style={styles.nextBtnText}>Next</Text>
              <ChevronRight size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 2 && (
        <View style={styles.stepBody}>
          <Text style={styles.stepTitle}>Step 2: Ingredients Label</Text>
          <Text style={styles.stepDesc}>
            Capture the ingredients list so we can check for allergens. This is strongly encouraged for accurate results.
          </Text>

          {ingredientsImage ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: ingredientsImage }} style={styles.imagePreview} />
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => setIngredientsImage(null)}
              >
                <RefreshCw size={16} color="#0891B2" />
                <Text style={styles.retakeBtnText}>Retake</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.captureOptions}>
              <TouchableOpacity
                style={styles.captureOptionCard}
                onPress={() => openCameraForStep('ingredients')}
                activeOpacity={0.8}
              >
                <View style={[styles.captureOptionIcon, { backgroundColor: '#DBEAFE' }]}>
                  <Camera size={24} color="#2563EB" />
                </View>
                <View style={styles.captureOptionContent}>
                  <Text style={styles.captureOptionTitle}>Take Photo</Text>
                  <Text style={styles.captureOptionDesc}>Capture ingredients label</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.captureOptionCard}
                onPress={() => pickFromGallery('ingredients')}
                activeOpacity={0.8}
              >
                <View style={[styles.captureOptionIcon, { backgroundColor: '#D1FAE5' }]}>
                  <Upload size={24} color="#059669" />
                </View>
                <View style={styles.captureOptionContent}>
                  <Text style={styles.captureOptionTitle}>Upload Photo</Text>
                  <Text style={styles.captureOptionDesc}>From camera roll</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {extractedData.ingredients ? (
            <View style={styles.extractedSection}>
              <Text style={styles.extractedLabel}>Extracted ingredients:</Text>
              <Text style={styles.extractedValue} numberOfLines={4}>
                {extractedData.ingredients}
              </Text>
            </View>
          ) : null}

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
              <ChevronLeft size={18} color="#6B7280" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.nextBtn}
              onPress={() => setStep(3)}
            >
              <Text style={styles.nextBtnText}>
                {ingredientsImage ? 'Next' : 'Skip'}
              </Text>
              <ChevronRight size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 3 && (
        <View style={styles.stepBody}>
          <Text style={styles.stepTitle}>Step 3: Confirm & Save</Text>
          <Text style={styles.stepDesc}>
            Review and edit the information below, then save.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Product Category</Text>
            <View style={styles.categoryRow}>
              {(['food', 'skin', 'hair', 'other'] as ProductType[]).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.categoryChip,
                    productType === type && { backgroundColor: getProductTypeColor(type) + '18', borderColor: getProductTypeColor(type) },
                  ]}
                  onPress={() => {
                    setProductType(type);
                    if (Platform.OS !== 'web') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                >
                  <Text style={styles.categoryEmoji}>{getProductTypeEmoji(type)}</Text>
                  <Text style={[
                    styles.categoryLabel,
                    productType === type && { color: getProductTypeColor(type), fontWeight: '700' as const },
                  ]}>
                    {getProductTypeLabel(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Product Name *</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g., Organic Granola Bar"
              value={extractedData.name}
              onChangeText={(t) => setExtractedData(prev => ({ ...prev, name: t }))}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Brand</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="e.g., Nature Valley"
              value={extractedData.brand}
              onChangeText={(t) => setExtractedData(prev => ({ ...prev, brand: t }))}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Ingredients</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldInputMulti]}
              placeholder="Paste or type ingredients list"
              value={extractedData.ingredients}
              onChangeText={(t) => setExtractedData(prev => ({ ...prev, ingredients: t }))}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Allergen Warnings</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder='e.g., Contains: milk, wheat'
              value={extractedData.allergens}
              onChangeText={(t) => setExtractedData(prev => ({ ...prev, allergens: t }))}
            />
          </View>

          {barcode && /^\d{8,14}$/.test(barcode) && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Barcode</Text>
              <View style={styles.readonlyField}>
                <Text style={styles.readonlyText}>{barcode}</Text>
              </View>
            </View>
          )}

          <View style={styles.previewImages}>
            {frontImage && (
              <Image source={{ uri: frontImage }} style={styles.thumbSmall} />
            )}
            {ingredientsImage && (
              <Image source={{ uri: ingredientsImage }} style={styles.thumbSmall} />
            )}
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
              <ChevronLeft size={18} color="#6B7280" />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSaving || !extractedData.name.trim()}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Check size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Save Product</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    marginBottom: 20,
    paddingTop: 4,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  stepDotActive: {
    backgroundColor: '#0891B2',
  },
  stepIndicatorWrap: {
    alignItems: 'center',
    gap: 6,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#0891B2',
  },
  stepCircleText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#9CA3AF',
  },
  stepCircleTextActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#9CA3AF',
  },
  stepLabelActive: {
    color: '#0891B2',
  },
  barcodeTag: {
    alignSelf: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  barcodeTagText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  stepBody: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  captureOptions: {
    gap: 12,
    marginBottom: 16,
  },
  captureOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  captureOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  captureOptionContent: {
    flex: 1,
  },
  captureOptionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 2,
  },
  captureOptionDesc: {
    fontSize: 13,
    color: '#6B7280',
  },
  imagePreviewWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    marginBottom: 10,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  retakeBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#0891B2',
  },
  extractedSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  extractedLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#166534',
    marginBottom: 4,
  },
  extractedValue: {
    fontSize: 14,
    color: '#15803D',
    lineHeight: 20,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0891B2',
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#10B981',
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 6,
  },
  fieldInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: '#111827',
  },
  fieldInputMulti: {
    minHeight: 100,
    textAlignVertical: 'top' as const,
  },
  readonlyField: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  readonlyText: {
    fontSize: 15,
    color: '#6B7280',
  },
  previewImages: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  thumbSmall: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  cameraCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraHeaderTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  cameraCenterFrame: {
    width: 280,
    height: 200,
    alignSelf: 'center',
  },
  cCorner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#FFFFFF',
  },
  cTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  cameraBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  flashBtn: {
    width: 60,
    alignItems: 'center',
    gap: 4,
  },
  flashLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  analyzeTitle: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center',
  },
  analyzeSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#6B7280',
  },
  slowText: {
    marginTop: 12,
    fontSize: 14,
    color: '#D97706',
    fontWeight: '600' as const,
  },
  retryRow: {
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  previewThumb: {
    width: 120,
    height: 90,
    borderRadius: 10,
    marginTop: 20,
    backgroundColor: '#E5E7EB',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  successActions: {
    width: '100%',
    maxWidth: 320,
    gap: 10,
    marginTop: 20,
    marginBottom: 8,
  },
  successPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0891B2',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  successPrimaryBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  successSecondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  successSecondaryBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#374151',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  categoryEmoji: {
    fontSize: 15,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#6B7280',
  },
  comingSoonCard: {
    marginTop: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E0E7FF',
    borderStyle: 'dashed' as const,
    width: '100%',
    maxWidth: 320,
  },
  comingSoonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  comingSoonTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#374151',
    marginBottom: 4,
  },
  comingSoonLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#6366F1',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden' as const,
    marginBottom: 8,
  },
  comingSoonDesc: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 18,
  },
});
