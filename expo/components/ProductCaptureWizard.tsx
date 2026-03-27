import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  Alert,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  Search,
  Shield,
  Sparkles,
  Eye,
  FileText,
} from 'lucide-react-native';
import { generateText } from '@rork-ai/toolkit-sdk';
import { Product, ProductType } from '@/types';
import { upsertProduct, recordScanEvent } from '@/services/supabaseProducts';
import { addToShoppingList } from '@/storage/shoppingList';
import { useProfiles } from '@/contexts/ProfileContext';
import { useUser } from '@/contexts/UserContext';
import { useQueryClient } from '@tanstack/react-query';
import { calculateVerdict } from '@/utils/verdict';
import { guessProductType, getProductTypeLabel, getProductTypeColor } from '@/utils/productType';
import { addToScanHistory } from '@/storage/scanHistory';
import { cacheProduct } from '@/storage/productCache';
import { resetBarcodeDebounce } from '@/api/products';
import { arcaneColors, arcaneRadius, arcaneShadows } from '@/constants/theme';
import { ArcaneSpinner } from '@/components/ArcaneSpinner';
import { RuneCard } from '@/components/RuneCard';
import { SigilBadge } from '@/components/SigilBadge';
import { useReduceMotion } from '@/contexts/ReduceMotionContext';
import { TranslationCard } from '@/components/TranslationCard';


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
  const { reduceMotion } = useReduceMotion();
  const insets = useSafeAreaInsets();
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
  const [autoReturnCountdown, setAutoReturnCountdown] = useState(4);
  const autoReturnTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoReturnCancelled = useRef(false);

  const progressAnim = useRef(new Animated.Value(1)).current;
  const stepFadeAnim = useRef(new Animated.Value(1)).current;
  const successScaleAnim = useRef(new Animated.Value(0.9)).current;
  const successOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step,
      duration: 300,
      useNativeDriver: false,
    }).start();
    stepFadeAnim.setValue(0);
    Animated.timing(stepFadeAnim, {
      toValue: 1,
      duration: reduceMotion ? 0 : 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [step, progressAnim, stepFadeAnim, reduceMotion]);

  useEffect(() => {
    if (saveSuccess) {
      autoReturnCancelled.current = false;
      setAutoReturnCountdown(4);
      Animated.parallel([
        Animated.timing(successScaleAnim, {
          toValue: 1,
          duration: reduceMotion ? 0 : 350,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(successOpacityAnim, {
          toValue: 1,
          duration: reduceMotion ? 0 : 250,
          useNativeDriver: true,
        }),
      ]).start();

      autoReturnTimerRef.current = setInterval(() => {
        if (autoReturnCancelled.current) {
          if (autoReturnTimerRef.current) clearInterval(autoReturnTimerRef.current);
          return;
        }
        setAutoReturnCountdown(prev => {
          if (prev <= 1) {
            if (autoReturnTimerRef.current) clearInterval(autoReturnTimerRef.current);
            if (onNavigateToScan) {
              onNavigateToScan();
            } else {
              onProductSaved({ code: barcode, product_name: savedProductName, source: 'manual_entry' } as Product);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      successScaleAnim.setValue(0.9);
      successOpacityAnim.setValue(0);
    }
    return () => {
      if (autoReturnTimerRef.current) clearInterval(autoReturnTimerRef.current);
    };
  }, [saveSuccess, reduceMotion, successScaleAnim, successOpacityAnim, barcode, savedProductName, onNavigateToScan, onProductSaved]);

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

  const renderRunicStepper = () => {
    const STEP_INFO = [
      { num: 1, label: 'Front', icon: <Eye size={14} color={step >= 1 ? '#FFF' : arcaneColors.textMuted} /> },
      { num: 2, label: 'Ingredients', icon: <FileText size={14} color={step >= 2 ? '#FFF' : arcaneColors.textMuted} /> },
      { num: 3, label: 'Seal', icon: <Shield size={14} color={step >= 3 ? '#FFF' : arcaneColors.textMuted} /> },
    ];
    return (
      <View style={styles.runicStepperRow}>
        {STEP_INFO.map((s, i) => (
          <View key={s.num} style={styles.runicStepWrap}>
            {i > 0 && (
              <View style={[
                styles.runicStepLine,
                step > i ? styles.runicStepLineActive : null,
              ]} />
            )}
            <View style={[
              styles.runicStepCircle,
              step >= s.num && styles.runicStepCircleActive,
              step === s.num && styles.runicStepCircleCurrent,
            ]}>
              {s.icon}
            </View>
            <Text style={[
              styles.runicStepLabel,
              step === s.num && styles.runicStepLabelActive,
            ]}>{s.label}</Text>
          </View>
        ))}
      </View>
    );
  };

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
          <TouchableOpacity
            style={[
              styles.wizardBackPill,
              { top: insets.top + 8, left: Math.max(insets.left, 12) },
            ]}
            onPress={() => {
              setTorchEnabled(false);
              setCameraActive(false);
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="wizard-camera-back"
          >
            <X size={18} color="#FFFFFF" />
            <Text style={styles.wizardBackPillText}>Back</Text>
          </TouchableOpacity>

          <View style={[styles.cameraHeaderTitleWrap, { top: insets.top + 8 }]}>
            <Text style={styles.cameraHeaderTitle}>
              {analyzeTarget === 'front' ? 'Product Front' : 'Ingredients Label'}
            </Text>
          </View>

          <View style={styles.cameraCenterFrame}>
            <View style={[styles.cCorner, styles.cTL]} />
            <View style={[styles.cCorner, styles.cTR]} />
            <View style={[styles.cCorner, styles.cBL]} />
            <View style={[styles.cCorner, styles.cBR]} />
          </View>

          <View style={styles.cameraBottom}>
            <Pressable
              style={({ pressed }) => [
                styles.flashBtn,
                pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
              ]}
              onPress={async () => {
                if (Platform.OS !== 'web') {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                const next = !torchEnabled;
                setTorchEnabled(next);
                console.log('[CaptureWizard] Torch toggled:', next ? 'ON' : 'OFF');
              }}
              testID="wizard-flash-button"
              hitSlop={10}
            >
              {torchEnabled ? (
                <Flashlight size={22} color="#FBBF24" />
              ) : (
                <FlashlightOff size={22} color="#FFFFFF" />
              )}
              <Text style={[styles.flashLabel, torchEnabled && { color: '#FBBF24' }]}>
                {torchEnabled ? 'ON' : 'OFF'}
              </Text>
            </Pressable>

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
        {renderRunicStepper()}
        <ArcaneSpinner size={64} />
        <Text style={styles.analyzeTitle}>
          {analyzeTarget === 'front' ? 'Reading the inscription…' : 'Extracting ingredients…'}
        </Text>
        <Text style={styles.analyzeSubtitle}>Step {step} of 3</Text>
        {analysisElapsed >= 10 && analysisElapsed < 20 && (
          <RuneCard variant="gold" style={{ marginTop: 16, width: '90%' }}>
            <Text style={styles.slowText}>Calling the Archive… (may take a moment)</Text>
          </RuneCard>
        )}
        {analysisElapsed >= 20 && (
          <View style={styles.retryRow}>
            <RuneCard variant="danger" style={{ width: '90%' }}>
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
            </RuneCard>
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
      <Animated.View style={[
        styles.successContainer,
        {
          opacity: successOpacityAnim,
          transform: [{ scale: successScaleAnim }],
        },
      ]}>
        <View style={styles.successSigilRing}>
          <View style={styles.successIcon}>
            <Check size={36} color="#FFFFFF" />
          </View>
        </View>
        <Text style={styles.successTitle}>Inscription Sealed!</Text>
        <Text style={styles.successSubtitle}>
          {savedProductName || extractedData.name} is now in the Archive.
        </Text>

        <View style={styles.successActions}>
          <TouchableOpacity
            style={styles.successPrimaryBtn}
            onPress={() => {
              autoReturnCancelled.current = true;
              if (autoReturnTimerRef.current) clearInterval(autoReturnTimerRef.current);
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
              autoReturnCancelled.current = true;
              if (autoReturnTimerRef.current) clearInterval(autoReturnTimerRef.current);
              if (onNavigateToSearch) {
                onNavigateToSearch(savedProductName);
              } else {
                onProductSaved({ code: barcode, product_name: savedProductName, source: 'manual_entry' } as Product);
              }
            }}
            activeOpacity={0.8}
          >
            <Search size={18} color={arcaneColors.primary} />
            <Text style={styles.successSecondaryBtnText}>Search to Confirm</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.quickActionBtn}
            onPress={async () => {
              try {
                const productCode = barcode && /^\d{8,14}$/.test(barcode) ? barcode.trim() : `manual_${Date.now()}`;
                await addToShoppingList({
                  id: `${productCode}_${Date.now()}`,
                  name: savedProductName || 'Product',
                  barcode: productCode,
                  checked: false,
                  addedAt: new Date().toISOString(),
                  profileId: activeProfile?.id,
                });
                if (Platform.OS !== 'web') {
                  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                Alert.alert('Added', 'Product added to shopping list.');
              } catch {
                Alert.alert('Error', 'Could not add to shopping list.');
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.quickActionIcon}>🛒</Text>
            <Text style={styles.quickActionLabel}>Add to Shopping List</Text>
          </TouchableOpacity>
          <View style={[styles.quickActionBtn, styles.quickActionBtnDisabled]}>
            <Text style={styles.quickActionIcon}>📋</Text>
            <Text style={styles.quickActionLabelDisabled}>Restrictions List</Text>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
          </View>
        </View>

        {!autoReturnCancelled.current && autoReturnCountdown > 0 && (
          <TouchableOpacity
            style={styles.autoReturnRow}
            onPress={() => {
              autoReturnCancelled.current = true;
              if (autoReturnTimerRef.current) clearInterval(autoReturnTimerRef.current);
              setAutoReturnCountdown(0);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.autoReturnText}>Returning to scan in {autoReturnCountdown}s</Text>
            <Text style={styles.autoReturnCancel}>Cancel</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {renderRunicStepper()}

      {barcode && /^\d{8,14}$/.test(barcode) && (
        <View style={styles.barcodeTag}>
          <Text style={styles.barcodeTagText}>◎ {barcode}</Text>
        </View>
      )}

      {step === 1 && (
        <Animated.View style={[styles.stepBody, { opacity: stepFadeAnim }]}>
          <Text style={styles.stepTitle}>Product Front</Text>
          <RuneCard variant="default" style={{ marginBottom: 16 }}>
            <View style={styles.tipRow}>
              <Sparkles size={16} color={arcaneColors.primary} />
              <Text style={styles.tipText}>Hold steady — we’ll read Name + Brand</Text>
            </View>
          </RuneCard>

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
            <RuneCard variant="gold" style={{ marginBottom: 8 }}>
              <Text style={styles.extractedLabel}>✨ Detected</Text>
              {extractedData.name ? (
                <Text style={styles.extractedValue}>Name: {extractedData.name}</Text>
              ) : null}
              {extractedData.brand ? (
                <Text style={styles.extractedValue}>Brand: {extractedData.brand}</Text>
              ) : null}
            </RuneCard>
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
        </Animated.View>
      )}

      {step === 2 && (
        <Animated.View style={[styles.stepBody, { opacity: stepFadeAnim }]}>
          <Text style={styles.stepTitle}>Ingredients Label</Text>
          <RuneCard variant="accent" style={{ marginBottom: 16 }}>
            <View style={styles.tipRow}>
              <Sparkles size={16} color={arcaneColors.accent} />
              <Text style={styles.tipText}>Fill the frame with the ingredients list</Text>
            </View>
          </RuneCard>

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
            <RuneCard variant="gold" style={{ marginBottom: 8 }}>
              <Text style={styles.extractedLabel}>✨ Extracted ingredients</Text>
              <Text style={styles.extractedValue} numberOfLines={4}>
                {extractedData.ingredients}
              </Text>
            </RuneCard>
          ) : null}

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
              <ChevronLeft size={18} color={arcaneColors.textSecondary} />
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
        </Animated.View>
      )}

      {step === 3 && (
        <Animated.View style={[styles.stepBody, { opacity: stepFadeAnim }]}>
          <Text style={styles.stepTitle}>Confirm & Seal</Text>
          <Text style={styles.stepDesc}>
            Review, edit, and seal this product into the Archive.
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Product Category</Text>
            <View style={styles.categoryRow}>
              {(['food', 'skin', 'hair', 'other'] as ProductType[]).map((type) => {
                const isSelected = productType === type;
                const badgeStatus = type === 'food' ? 'safe' as const
                  : type === 'skin' ? 'caution' as const
                  : type === 'hair' ? 'legendary' as const
                  : 'neutral' as const;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.categoryChip,
                      isSelected && { backgroundColor: getProductTypeColor(type) + '18', borderColor: getProductTypeColor(type) },
                    ]}
                    onPress={() => {
                      setProductType(type);
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                  >
                    <SigilBadge
                      label={getProductTypeLabel(type)}
                      status={isSelected ? badgeStatus : 'neutral'}
                      size="sm"
                    />
                  </TouchableOpacity>
                );
              })}
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

          {extractedData.name && (
            <TranslationCard
              label="Product Name"
              text={extractedData.name}
              compact
              autoTranslate
              testID="wizard-translation-name"
            />
          )}
          {extractedData.ingredients && (
            <TranslationCard
              label="Ingredients"
              text={extractedData.ingredients}
              autoTranslate
              testID="wizard-translation-ingredients"
            />
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
              <ChevronLeft size={18} color={arcaneColors.textSecondary} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSaving || !extractedData.name.trim()}
            >
              {isSaving ? (
                <View style={styles.savingRow}>
                  <ArcaneSpinner size={22} />
                  <Text style={styles.saveBtnText}>Saving to Archive…</Text>
                </View>
              ) : (
                <>
                  <Shield size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>Seal Product</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: arcaneColors.bg },
  scrollContent: { padding: 16, paddingBottom: 40 },
  runicStepperRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 0, marginBottom: 24, paddingTop: 4 },
  runicStepWrap: { alignItems: 'center', gap: 6, flex: 1, position: 'relative' },
  runicStepCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: arcaneColors.bgMist, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: arcaneColors.border },
  runicStepCircleActive: { backgroundColor: arcaneColors.primary, borderColor: arcaneColors.primary },
  runicStepCircleCurrent: { borderColor: arcaneColors.gold, borderWidth: 2.5 },
  runicStepLabel: { fontSize: 11, fontWeight: '600' as const, color: arcaneColors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' as const },
  runicStepLabelActive: { color: arcaneColors.primary, fontWeight: '700' as const },
  runicStepLine: { position: 'absolute', top: 19, right: '50%', width: '100%', height: 2, backgroundColor: arcaneColors.border, zIndex: -1 },
  runicStepLineActive: { backgroundColor: arcaneColors.primary },
  barcodeTag: { alignSelf: 'center', backgroundColor: arcaneColors.primaryMuted, borderRadius: arcaneRadius.pill, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 16, borderWidth: 1, borderColor: arcaneColors.borderRune },
  barcodeTagText: { fontSize: 13, fontWeight: '600' as const, color: arcaneColors.primary },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 22, fontWeight: '700' as const, color: arcaneColors.text, marginBottom: 6 },
  stepDesc: { fontSize: 14, color: arcaneColors.textSecondary, lineHeight: 20, marginBottom: 16 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tipText: { fontSize: 14, color: arcaneColors.textSecondary, flex: 1, lineHeight: 20 },
  captureOptions: { gap: 12, marginBottom: 16 },
  captureOptionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.lg, padding: 16, borderWidth: 1, borderColor: arcaneColors.borderRune, ...arcaneShadows.card },
  captureOptionIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  captureOptionContent: { flex: 1 },
  captureOptionTitle: { fontSize: 15, fontWeight: '700' as const, color: arcaneColors.text, marginBottom: 2 },
  captureOptionDesc: { fontSize: 13, color: arcaneColors.textSecondary },
  imagePreviewWrap: { alignItems: 'center', marginBottom: 16 },
  imagePreview: { width: '100%', height: 200, borderRadius: arcaneRadius.lg, backgroundColor: arcaneColors.bgMist, marginBottom: 10 },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: arcaneRadius.pill, backgroundColor: arcaneColors.primaryMuted, borderWidth: 1, borderColor: arcaneColors.borderRune },
  retakeBtnText: { fontSize: 14, fontWeight: '600' as const, color: arcaneColors.primary },
  extractedLabel: { fontSize: 13, fontWeight: '700' as const, color: arcaneColors.goldDark, marginBottom: 4 },
  extractedValue: { fontSize: 14, color: arcaneColors.textSecondary, lineHeight: 20 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, gap: 12 },
  cancelBtn: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: arcaneRadius.lg, backgroundColor: arcaneColors.bgMist },
  cancelBtnText: { fontSize: 15, fontWeight: '600' as const, color: arcaneColors.textSecondary },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 14, borderRadius: arcaneRadius.lg, backgroundColor: arcaneColors.primary, ...arcaneShadows.card },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: 15, fontWeight: '700' as const, color: '#FFF' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, paddingVertical: 14, borderRadius: arcaneRadius.lg, backgroundColor: arcaneColors.bgMist },
  backBtnText: { fontSize: 15, fontWeight: '600' as const, color: arcaneColors.textSecondary },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: arcaneRadius.lg, backgroundColor: arcaneColors.safe, ...arcaneShadows.elevated },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#FFF' },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600' as const, color: arcaneColors.text, marginBottom: 6 },
  fieldInput: { backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.lg, padding: 14, fontSize: 15, borderWidth: 1, borderColor: arcaneColors.border, color: arcaneColors.text },
  fieldInputMulti: { minHeight: 100, textAlignVertical: 'top' as const },
  readonlyField: { backgroundColor: arcaneColors.bgMist, borderRadius: arcaneRadius.lg, padding: 14, borderWidth: 1, borderColor: arcaneColors.border },
  readonlyText: { fontSize: 15, color: arcaneColors.textSecondary },
  previewImages: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  thumbSmall: { width: 80, height: 80, borderRadius: arcaneRadius.md, backgroundColor: arcaneColors.bgMist },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  wizardBackPill: { position: 'absolute' as const, zIndex: 9999, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, backgroundColor: 'rgba(11, 15, 20, 0.8)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, minWidth: 44, minHeight: 44, borderWidth: 1, borderColor: 'rgba(11, 110, 122, 0.4)', elevation: 20 },
  wizardBackPillText: { fontSize: 16, fontWeight: '700' as const, color: '#FFF' },
  cameraHeaderTitleWrap: { position: 'absolute' as const, left: 0, right: 0, alignItems: 'center' as const, zIndex: 1 },
  cameraHeaderTitle: { fontSize: 17, fontWeight: '700' as const, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  cameraCenterFrame: { width: 280, height: 200, alignSelf: 'center' },
  cCorner: { position: 'absolute', width: 32, height: 32, borderColor: arcaneColors.primary },
  cTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  cameraBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 40 },
  flashBtn: { width: 60, alignItems: 'center', gap: 4 },
  flashLabel: { fontSize: 11, fontWeight: '700' as const, color: '#FFF' },
  captureBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: arcaneColors.primary, alignItems: 'center', justifyContent: 'center' },
  analyzeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: arcaneColors.bg },
  analyzeTitle: { marginTop: 20, fontSize: 18, fontWeight: '700' as const, color: arcaneColors.text, textAlign: 'center' },
  analyzeSubtitle: { marginTop: 6, fontSize: 14, color: arcaneColors.textSecondary },
  slowText: { fontSize: 14, color: arcaneColors.caution, fontWeight: '600' as const },
  retryRow: { alignItems: 'center', marginTop: 12, gap: 10, width: '100%' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: arcaneColors.danger, borderRadius: arcaneRadius.md, paddingHorizontal: 16, paddingVertical: 8, marginTop: 10 },
  retryBtnText: { fontSize: 14, fontWeight: '600' as const, color: '#FFF' },
  previewThumb: { width: 120, height: 90, borderRadius: arcaneRadius.md, marginTop: 20, backgroundColor: arcaneColors.bgMist },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: arcaneColors.bg },
  successSigilRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: arcaneColors.borderRune, alignItems: 'center', justifyContent: 'center', marginBottom: 20, backgroundColor: 'rgba(5, 150, 105, 0.06)' },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: arcaneColors.safe, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 24, fontWeight: '700' as const, color: arcaneColors.text, marginBottom: 8 },
  successSubtitle: { fontSize: 15, color: arcaneColors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 4 },
  successActions: { width: '100%', maxWidth: 320, gap: 10, marginTop: 20, marginBottom: 8 },
  successPrimaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: arcaneColors.primary, borderRadius: arcaneRadius.lg, paddingVertical: 16, paddingHorizontal: 24, ...arcaneShadows.elevated },
  successPrimaryBtnText: { fontSize: 16, fontWeight: '700' as const, color: '#FFF' },
  successSecondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.lg, paddingVertical: 14, paddingHorizontal: 24, borderWidth: 1, borderColor: arcaneColors.borderRune },
  successSecondaryBtnText: { fontSize: 15, fontWeight: '600' as const, color: arcaneColors.primary },
  autoReturnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, backgroundColor: arcaneColors.bgMist, borderRadius: arcaneRadius.lg, borderWidth: 1, borderColor: arcaneColors.border },
  autoReturnText: { fontSize: 13, color: arcaneColors.textSecondary, flex: 1 },
  autoReturnCancel: { fontSize: 13, fontWeight: '700' as const, color: arcaneColors.primary },
  categoryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  categoryChip: { paddingHorizontal: 4, paddingVertical: 4, borderRadius: arcaneRadius.pill, borderWidth: 2, borderColor: 'transparent', backgroundColor: 'transparent' },
  quickActionsRow: { flexDirection: 'row', gap: 10, width: '100%', maxWidth: 320, marginTop: 16 },
  quickActionBtn: { flex: 1, alignItems: 'center', backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.lg, padding: 14, borderWidth: 1, borderColor: arcaneColors.borderRune, gap: 6, ...arcaneShadows.card },
  quickActionBtnDisabled: { opacity: 0.55, borderColor: arcaneColors.border },
  quickActionIcon: { fontSize: 22 },
  quickActionLabel: { fontSize: 12, fontWeight: '600' as const, color: arcaneColors.primary, textAlign: 'center' as const },
  quickActionLabelDisabled: { fontSize: 12, fontWeight: '600' as const, color: arcaneColors.textMuted, textAlign: 'center' as const },
  comingSoonBadge: { backgroundColor: arcaneColors.cautionMuted, borderRadius: arcaneRadius.sm, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  comingSoonText: { fontSize: 9, fontWeight: '700' as const, color: arcaneColors.caution, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
});
