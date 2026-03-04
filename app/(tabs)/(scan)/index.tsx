import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, Href } from 'expo-router';

import { Camera, Search, X, AlertCircle, CheckCircle, AlertTriangle, ImageIcon, Clock, Flashlight, FlashlightOff, Upload, Plus, Shield, Sparkles, Zap, RotateCcw, Lock, Languages, Wand2 } from 'lucide-react-native';
import { LockOnReticle } from '@/components/LockOnReticle';
import { ArcaneSpinner } from '@/components/ArcaneSpinner';
import { useMysticToast } from '@/components/MysticToast';

import { useProfiles } from '@/contexts/ProfileContext';
import { useUser } from '@/contexts/UserContext';
import { searchProductByBarcode, searchProductsByName, searchProductByUrl } from '@/api/products';
import { generateText } from '@rork-ai/toolkit-sdk';
import { translateMultiple, isTranslationAvailable, TranslationResult } from '@/services/translationService';
import { TranslationCard } from '@/components/TranslationCard';
import { getSearchHistory, addToSearchHistory } from '@/storage/searchHistory';
import { calculateVerdict, getVerdictColor, getVerdictIcon } from '@/utils/verdict';
import { guessProductType, getProductTypeLabel, getProductTypeColor, getProductTypeEmoji } from '@/utils/productType';
import { Product } from '@/types';
import { getRelationshipIcon } from '@/constants/profileColors';
import { BUILD_ID } from '@/constants/appVersion';
import { upsertProduct, recordScanEvent } from '@/services/supabaseProducts';
import { arcaneColors, arcaneShadows, arcaneRadius } from '@/constants/theme';
import { ArcaneDivider } from '@/components/ArcaneDivider';
import { RuneCard } from '@/components/RuneCard';
import { SigilBadge } from '@/components/SigilBadge';

interface SmartScanResult {
  productName: string | null;
  brand: string | null;
  ingredients: string | null;
  allergens: string | null;
  barcode: string | null;
  nameTranslation: TranslationResult | null;
  ingredientsTranslation: TranslationResult | null;
  capturedImageUri: string;
}

const SMART_CAPTURE_COOLDOWN_MS = 2000;
const SMART_CAPTURE_AUTO_INTERVAL_MS = 8000;

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();
  const { activeProfile, profiles, isLoading: profilesLoading, isSwitchingProfile, setActiveProfile } = useProfiles();
  const { showToast } = useMysticToast();

  
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraActive, setCameraActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<any[]>([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [imageRecognitionMode, setImageRecognitionMode] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'back' | 'front'>('back');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [noResults, setNoResults] = useState(false);
  const [detectedBannerData, setDetectedBannerData] = useState<{ code: string; show: boolean }>({ code: '', show: false });
  const [scanMode, setScanMode] = useState<'classic' | 'smart'>('classic');
  const [smartScanActive, setSmartScanActive] = useState(false);
  const [smartScanProcessing, setSmartScanProcessing] = useState(false);
  const [smartScanResults, setSmartScanResults] = useState<SmartScanResult | null>(null);
  const [autoCapture, setAutoCapture] = useState(false);
  const lastSmartCaptureRef = useRef<number>(0);
  const smartCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const detectedBannerAnim = useRef(new Animated.Value(0)).current;
  const lockPulseAnim = useRef(new Animated.Value(0)).current;


  useEffect(() => {
    if (!profilesLoading && profiles.length === 0) {
      console.log('[ScanScreen] No profiles found, will be redirected by root layout');
    }
  }, [profilesLoading, profiles]);

  useEffect(() => {
    loadSearchHistory();
  }, []);

  const loadSearchHistory = async () => {
    const history = await getSearchHistory();
    setSearchHistory(history.slice(0, 5));
  };

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (!cameraActive) {
      setScanned(false);
      setLastScannedCode(null);
      setImageRecognitionMode(false);
      setCapturedImage(null);
      setTorchEnabled(false);
      setCameraFacing('back');
      setSmartScanActive(false);
      setSmartScanProcessing(false);
      if (smartCaptureTimerRef.current) {
        clearTimeout(smartCaptureTimerRef.current);
        smartCaptureTimerRef.current = null;
      }
    }
  }, [cameraActive]);

  const handleSmartCaptureRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!smartScanActive || !autoCapture || smartScanProcessing) return;
    const scheduleAutoCapture = () => {
      smartCaptureTimerRef.current = setTimeout(() => {
        if (smartScanActive && autoCapture && !smartScanProcessing) {
          handleSmartCaptureRef.current();
        }
      }, SMART_CAPTURE_AUTO_INTERVAL_MS);
    };
    scheduleAutoCapture();
    return () => {
      if (smartCaptureTimerRef.current) {
        clearTimeout(smartCaptureTimerRef.current);
        smartCaptureTimerRef.current = null;
      }
    };
  }, [smartScanActive, autoCapture, smartScanProcessing]);

  const handleSmartCapture = async () => {
    const now = Date.now();
    if (now - lastSmartCaptureRef.current < SMART_CAPTURE_COOLDOWN_MS) {
      console.log('[SmartScan] Cooldown active, skipping capture');
      showToast('Please wait before next capture', 'caution');
      return;
    }
    if (smartScanProcessing) {
      console.log('[SmartScan] Already processing, skipping');
      return;
    }
    if (!cameraRef.current) {
      console.log('[SmartScan] Camera not ready');
      showToast('Camera not ready', 'caution');
      return;
    }

    lastSmartCaptureRef.current = now;
    setSmartScanProcessing(true);

    try {
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      console.log('[SmartScan] Capturing frame...');
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.85,
        skipProcessing: true,
      });

      if (!photo || !photo.base64) {
        showToast('Failed to capture image', 'danger');
        setSmartScanProcessing(false);
        return;
      }

      const imageUri = `data:image/jpeg;base64,${photo.base64}`;
      setCapturedImage(imageUri);

      console.log('[SmartScan] Running OCR pipeline...');
      const ocrResult = await generateText({
        messages: [{
          role: 'user',
          content: [
            { type: 'image', image: imageUri },
            {
              type: 'text',
              text: `You are an expert product label reader. Extract ALL visible text from this product image.

Return the result in EXACTLY this format:
PRODUCT_NAME: [exact product name as shown]
BRAND: [brand name or "Not visible"]
INGREDIENTS: [full ingredients list as written, preserving original language]
ALLERGENS: [any allergen warnings or "Not visible"]
BARCODE: [barcode digits if visible or "Not visible"]
LANGUAGE: [detected language of the text, e.g. "Spanish", "French", "English", etc.]

IMPORTANT: Preserve the ORIGINAL language of ingredients. Do NOT translate them. Return them exactly as written on the package.`,
            },
          ],
        }],
      });

      console.log('[SmartScan] OCR result:', ocrResult.substring(0, 200));

      const nameMatch = ocrResult.match(/PRODUCT_NAME:\s*(.+?)(?:\n|$)/i);
      const brandMatch = ocrResult.match(/BRAND:\s*(.+?)(?:\n|$)/i);
      const ingredientsMatch = ocrResult.match(/INGREDIENTS:\s*(.+?)(?:\n|$)/i);
      const allergensMatch = ocrResult.match(/ALLERGENS:\s*(.+?)(?:\n|$)/i);
      const barcodeMatch = ocrResult.match(/BARCODE:\s*([0-9]{8,14})/i);

      const extractedName = nameMatch?.[1]?.trim() || null;
      const extractedBrand = brandMatch?.[1]?.trim() || null;
      const extractedIngredients = ingredientsMatch?.[1]?.trim() || null;
      const extractedAllergens = allergensMatch?.[1]?.trim() || null;
      const extractedBarcode = barcodeMatch?.[1]?.trim() || null;

      const isVisible = (val: string | null) => val && !val.toLowerCase().includes('not visible');

      console.log('[SmartScan] Running translations...');
      const textsToTranslate: Record<string, string> = {};
      if (isVisible(extractedName)) textsToTranslate['name'] = extractedName!;
      if (isVisible(extractedIngredients)) textsToTranslate['ingredients'] = extractedIngredients!;

      let nameTranslation: TranslationResult | null = null;
      let ingredientsTranslation: TranslationResult | null = null;

      if (Object.keys(textsToTranslate).length > 0) {
        const translations = await translateMultiple(textsToTranslate);
        nameTranslation = translations['name'] || null;
        ingredientsTranslation = translations['ingredients'] || null;
      }

      const result: SmartScanResult = {
        productName: isVisible(extractedName) ? extractedName : null,
        brand: isVisible(extractedBrand) ? extractedBrand : null,
        ingredients: isVisible(extractedIngredients) ? extractedIngredients : null,
        allergens: isVisible(extractedAllergens) ? extractedAllergens : null,
        barcode: extractedBarcode,
        nameTranslation,
        ingredientsTranslation,
        capturedImageUri: imageUri,
      };

      console.log('[SmartScan] Pipeline complete:', {
        hasName: !!result.productName,
        hasBrand: !!result.brand,
        hasIngredients: !!result.ingredients,
        hasBarcode: !!result.barcode,
        nameTranslated: nameTranslation ? !nameTranslation.isEnglish : false,
        ingredientsTranslated: ingredientsTranslation ? !ingredientsTranslation.isEnglish : false,
      });

      setSmartScanResults(result);
      setCameraActive(false);

      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('[SmartScan] Pipeline error:', error);
      showToast('Smart scan failed. Please try again.', 'danger');
    } finally {
      setSmartScanProcessing(false);
    }
  };

  handleSmartCaptureRef.current = handleSmartCapture;

  const openSmartScan = async () => {
    console.log('[SmartScan] Opening smart scan camera');
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is required for Smart Scan.');
        return;
      }
    }
    setSmartScanResults(null);
    setSmartScanActive(true);
    setCameraActive(true);
    setImageRecognitionMode(false);
  };

  const handleSmartScanSaveAndView = async () => {
    if (!smartScanResults) return;
    const r = smartScanResults;
    const productCode = r.barcode || `smart_${Date.now()}`;
    const finalName = r.nameTranslation && !r.nameTranslation.isEnglish
      ? r.nameTranslation.translatedText
      : r.productName || 'Smart Scan Product';

    const finalIngredients = r.ingredientsTranslation && !r.ingredientsTranslation.isEnglish
      ? r.ingredientsTranslation.translatedText
      : r.ingredients || undefined;

    const product: Product = {
      code: productCode,
      product_name: finalName,
      brands: r.brand || undefined,
      ingredients_text: finalIngredients,
      allergens: r.allergens || undefined,
      allergens_tags: [],
      traces_tags: [],
      source: 'manual_entry' as const,
    };

    try {
      await upsertProduct(product);
      console.log('[SmartScan] Product saved');
    } catch (err) {
      console.log('[SmartScan] Non-critical save error:', err);
    }

    if (currentUser?.id && activeProfile) {
      const verdict = calculateVerdict(product, activeProfile);
      recordScanEvent({
        user_id: currentUser.id,
        profile_id: activeProfile.id,
        product_barcode: productCode,
        product_name: product.product_name || 'Smart Scan',
        scan_type: 'photo',
        verdict: verdict.level,
        verdict_details: verdict.message || null,
      }).catch(() => {});
    }

    setSmartScanResults(null);
    router.push(`/product/${encodeURIComponent(productCode)}` as Href);
  };

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    console.log('=== Barcode Scan Event ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Type:', type);
    console.log('Data:', data);
    console.log('Scanned state:', scanned);
    console.log('Last scanned code:', lastScannedCode);
    console.log('Camera active:', cameraActive);
    
    if (scanned || !data || data === lastScannedCode) {
      console.log('Barcode scan ignored - duplicate or already processing');
      return;
    }
    
    console.log('Processing barcode scan...');
    
    let barcode = data.trim();
    console.log('Trimmed barcode:', barcode);
    console.log('Barcode length:', barcode.length);
    
    if (barcode.startsWith('http://') || barcode.startsWith('https://') || barcode.includes('://')) {
      console.log('❌ SCAN ERROR: URL detected instead of barcode');
      setScanned(false);
      setLastScannedCode(null);
      
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch (error) {
          console.log('Haptics error:', error);
        }
      }
      
      Alert.alert(
        'Invalid Scan',
        'This appears to be a QR code or URL. Please scan a product barcode instead.\n\nProduct barcodes are typically found on the back or bottom of packages.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!/^[0-9]+$/.test(barcode) || barcode.length < 8 || barcode.length > 14) {
      console.log('❌ SCAN ERROR: Invalid barcode format');
      console.log('Is numeric:', /^[0-9]+$/.test(barcode));
      console.log('Length valid:', barcode.length >= 8 && barcode.length <= 14);
      setScanned(false);
      setLastScannedCode(null);
      
      if (Platform.OS !== 'web') {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch (error) {
          console.log('Haptics error:', error);
        }
      }
      
      Alert.alert(
        'Invalid Barcode',
        'The scanned code is not a valid product barcode.\n\nValid barcodes are 8-14 digits long (UPC, EAN, etc.). Please try scanning again.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    console.log('✅ Valid barcode detected!');
    setScanned(true);
    setLastScannedCode(barcode);
    
    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (error) {
        console.log('Haptics error:', error);
      }
    }

    setDetectedBannerData({ code: barcode, show: true });
    Animated.timing(detectedBannerAnim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.sequence([
      Animated.timing(lockPulseAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(lockPulseAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    
    setTimeout(() => {
      setCameraActive(false);
      setDetectedBannerData({ code: '', show: false });
      detectedBannerAnim.setValue(0);
      console.log('=== Initiating Navigation ===');
      console.log('Barcode:', barcode);
      console.log('Barcode type:', typeof barcode);
      console.log('Barcode length:', barcode.length);
      console.log('Is valid:', barcode && barcode !== 'undefined' && barcode !== 'null' && barcode.trim() !== '');
      
      if (!barcode || barcode === 'undefined' || barcode === 'null' || barcode.trim() === '') {
        console.error('❌ Invalid barcode detected before navigation:', barcode);
        Alert.alert('Error', 'Invalid barcode. Please try scanning again.');
        setScanned(false);
        setLastScannedCode(null);
        return;
      }
      
      console.log('Encoded barcode:', encodeURIComponent(barcode));
      console.log('Full path:', `/product/${encodeURIComponent(barcode)}`);
      console.log('Active profile:', activeProfile?.name || 'none');
      
      try {
        router.push(`/product/${encodeURIComponent(barcode)}` as Href);
        console.log('✅ Navigation initiated successfully');
      } catch (error) {
        console.error('❌ Navigation error:', error);
        Alert.alert('Navigation Error', 'Failed to open product details. Please try again.');
        setScanned(false);
        setLastScannedCode(null);
      }
    }, 300);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchResults([]);
    setShowSearchHistory(false);
    setSearchError(null);
    setNoResults(false);
    
    try {
      let searchType: 'barcode' | 'name' | 'url' = 'name';
      
      if (searchQuery.includes('openfoodfacts.org') || searchQuery.includes('openbeautyfacts.org')) {
        searchType = 'url';
        const product = await searchProductByUrl(searchQuery);
        if (product) {
          await addToSearchHistory({ query: searchQuery, type: searchType });
          await loadSearchHistory();
          console.log('Navigating to product from URL search:', product.code);
          router.push(`/product/${encodeURIComponent(product.code)}` as Href);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } else {
          Alert.alert('Not Found', 'Could not find product from URL');
        }
      } else if (/^\d+$/.test(searchQuery.trim())) {
        searchType = 'barcode';
        const product = await searchProductByBarcode(searchQuery.trim());
        if (product) {
          await addToSearchHistory({ query: searchQuery, type: searchType });
          await loadSearchHistory();
          console.log('Navigating to product from barcode search:', product.code);
          router.push(`/product/${encodeURIComponent(product.code)}` as Href);
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } else {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
          Alert.alert('Not Found', 'Product not found in database');
        }
      } else {
        // Pass userId for improved search (scan history + cached products)
        const result = await searchProductsByName(searchQuery, 1, currentUser?.id);
        setSearchResults(result.products);
        if (result.products.length > 0) {
          await addToSearchHistory({ query: searchQuery, type: searchType });
          await loadSearchHistory();
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        } else {
          setNoResults(true);
        }
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError('Failed to search products. Please check your connection and try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const openCamera = async () => {
    console.log('Opening camera, current permission:', permission);
    
    if (!permission?.granted) {
      console.log('Requesting camera permission...');
      const result = await requestPermission();
      console.log('Permission result:', result);
      
      if (!result.granted) {
        Alert.alert(
          'Permission Required', 
          'Camera permission is required to scan barcodes. Please enable it in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              if (Platform.OS === 'ios') {
                Alert.alert('Open Settings', 'Go to Settings > Allergy Guardian > Camera');
              } else {
                Alert.alert('Open Settings', 'Go to Settings > Apps > Allergy Guardian > Permissions > Camera');
              }
            }}
          ]
        );
        return;
      }
    }
    
    console.log('Camera permission granted, activating camera');
    setCameraActive(true);
    setImageRecognitionMode(false);
  };

  const openImageRecognition = async () => {
    console.log('Opening image recognition mode');
    
    if (!permission?.granted) {
      console.log('Requesting camera permission...');
      const result = await requestPermission();
      console.log('Permission result:', result);
      
      if (!result.granted) {
        Alert.alert(
          'Permission Required', 
          'Camera permission is required to take photos of products.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              if (Platform.OS === 'ios') {
                Alert.alert('Open Settings', 'Go to Settings > Allergy Guardian > Camera');
              } else {
                Alert.alert('Open Settings', 'Go to Settings > Apps > Allergy Guardian > Permissions > Camera');
              }
            }}
          ]
        );
        return;
      }
    }
    
    console.log('Camera permission granted, activating image recognition mode');
    setImageRecognitionMode(true);
    setCameraActive(true);
  };

  const pickImageFromGallery = async () => {
    console.log('Opening image picker from gallery');
    
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Photo library access is required to select images.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              Alert.alert('Open Settings', 'Go to Settings > Allergy Guardian > Photos');
            }}
          ]
        );
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
        console.log('Image selected from gallery');
        
        if (Platform.OS !== 'web') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        
        if (asset.base64) {
          const imageUri = `data:image/jpeg;base64,${asset.base64}`;
          setCapturedImage(imageUri);
          analyzeProductImage(imageUri);
        } else if (asset.uri) {
          setCapturedImage(asset.uri);
          analyzeProductImage(asset.uri);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image from gallery. Please try again.');
    }
  };

  const handleUploadBarcodePhoto = async () => {
    console.log('Opening image picker for barcode photo');
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Photo library access is required to upload barcode images.');
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
        console.log('Barcode image selected from gallery');

        if (Platform.OS !== 'web') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }

        setIsAnalyzing(true);
        const imageUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;

        try {
          const analysisResult = await generateText({
            messages: [{
              role: 'user',
              content: [
                { type: 'image', image: imageUri },
                { type: 'text', text: 'Look at this image and find any barcode (UPC, EAN, etc). Return ONLY the barcode number digits. If you cannot find a readable barcode, respond with: NO_BARCODE_FOUND' },
              ],
            }],
          });

          setIsAnalyzing(false);

          const barcodeMatch = analysisResult.match(/\b(\d{8,14})\b/);
          if (barcodeMatch && barcodeMatch[1]) {
            const extractedBarcode = barcodeMatch[1];
            console.log('Extracted barcode from photo:', extractedBarcode);

            if (Platform.OS !== 'web') {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }

            router.push(`/product/${encodeURIComponent(extractedBarcode)}` as Href);
          } else {
            Alert.alert(
              'Barcode Not Found',
              'Could not read a barcode from this photo. You can try again or enter the barcode manually.',
              [
                { text: 'Try Again', onPress: handleUploadBarcodePhoto },
                {
                  text: 'Enter Manually',
                  onPress: () => {
                    router.push('/manual-ingredient-entry' as Href);
                  },
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }
        } catch (aiError) {
          setIsAnalyzing(false);
          console.error('Barcode photo analysis error:', aiError);
          Alert.alert(
            'Analysis Failed',
            'Could not analyze the barcode image. Please try scanning directly or enter manually.',
            [
              { text: 'Enter Manually', onPress: () => router.push('/manual-ingredient-entry' as Href) },
              { text: 'OK', style: 'cancel' },
            ]
          );
        }
      }
    } catch (error) {
      console.error('Error picking barcode image:', error);
      setIsAnalyzing(false);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current) {
      Alert.alert('Error', 'Camera not ready');
      return;
    }

    try {
      console.log('Capturing photo...');
      
      if (Platform.OS !== 'web') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.8,
        skipProcessing: true,
      });

      if (!photo || !photo.base64) {
        Alert.alert('Error', 'Failed to capture photo');
        return;
      }

      console.log('Photo captured successfully');
      const imageUri = `data:image/jpeg;base64,${photo.base64}`;
      
      setCapturedImage(imageUri);
      
      setTimeout(() => {
        setCameraActive(false);
        analyzeProductImage(imageUri);
      }, 50);
    } catch (error) {
      console.error('Error capturing photo:', error);
      
      if (error instanceof Error && (error.message.includes('unmounted') || error.message.includes('Camera'))) {
        console.log('Camera error during capture - resetting state');
        setCameraActive(false);
        setCapturedImage(null);
        return;
      }
      
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
      setCameraActive(false);
    }
  };

  const handleCameraPress = (event: any) => {
    if (!imageRecognitionMode) return;
    
    const { locationX, locationY } = event.nativeEvent;
    console.log('Camera tapped at:', locationX, locationY);
    setFocusPoint({ x: locationX, y: locationY });
    
    setTimeout(() => {
      setFocusPoint(null);
    }, 1000);
  };

  const analyzeProductImage = async (imageUri: string) => {
    setIsAnalyzing(true);
    
    try {
      console.log('Analyzing product image with AI...');
      
      const analysisResult = await generateText({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: imageUri,
              },
              {
                type: 'text',
                text: `You are an expert at reading product packaging. Your job is to extract information from product photos.

IMPORTANT IMAGE QUALITY CHECK:
- First, assess if the image is clear enough to read text
- Check if product name and important details are visible
- If the image is too blurry, too dark, or text is not readable, you MUST say so

If the image quality is GOOD, extract:
1. Product name (exact text from package)
2. Brand name
3. Main ingredients list if visible
4. Any visible allergen warnings or "Contains:" statements
5. If there's a barcode visible, try to read the numbers (UPC/EAN)

If the image quality is POOR (blurry, dark, text not readable), respond with:
IMAGE_QUALITY_ISSUE: [specific reason - e.g., "too blurry", "too dark", "text not in focus", "product label not visible", "too far away"]

Otherwise, format your response as:
Product Name: [name or "Not visible"]
Brand: [brand or "Not visible"]
Ingredients: [list or "Not visible"]
Allergens: [allergens or "Not visible"]
Barcode: [barcode numbers if visible or "Not visible"]`,
              },
            ],
          },
        ],
      });

      console.log('Image analysis complete:', analysisResult);
      
      if (analysisResult.includes('IMAGE_QUALITY_ISSUE:')) {
        const issueMatch = analysisResult.match(/IMAGE_QUALITY_ISSUE:\s*(.+)/i);
        const issue = issueMatch ? issueMatch[1].trim() : 'image quality is too poor';
        
        Alert.alert(
          '📸 Image Quality Issue',
          `We couldn't read the product details because the ${issue}.\n\n💡 Tips for better photos:\n\n• Hold phone steady and tap to focus\n• Ensure good lighting (avoid shadows)\n• Get close enough to read text clearly\n• Center the product name and ingredients\n• Make sure text is sharp and in focus\n• Avoid glare from plastic packaging\n• Try taking photo from straight angle`,
          [
            {
              text: 'Take New Photo',
              onPress: () => {
                setCapturedImage(null);
                setIsAnalyzing(false);
                openImageRecognition();
              },
              style: 'default'
            },
            {
              text: 'Try Barcode Scan Instead',
              onPress: () => {
                setCapturedImage(null);
                setIsAnalyzing(false);
                openCamera();
              },
            },
            {
              text: 'Cancel',
              onPress: () => {
                setCapturedImage(null);
                setIsAnalyzing(false);
              },
              style: 'cancel'
            }
          ]
        );
        return;
      }
      
      let detectedBarcode: string | null = null;
      
      const barcodeMatch = analysisResult.match(/barcode:?\s*([0-9]{8,14})/i);
      if (barcodeMatch && barcodeMatch[1]) {
        detectedBarcode = barcodeMatch[1];
        console.log('Detected barcode from image:', detectedBarcode);
      }
      
      const productNameMatch = analysisResult.match(/Product Name:\s*(.+?)(?:\n|$)/i);
      const brandMatch = analysisResult.match(/Brand:\s*(.+?)(?:\n|$)/i);
      const ingredientsMatch = analysisResult.match(/Ingredients:\s*(.+?)(?:\n|$)/i);
      const allergensMatch = analysisResult.match(/Allergens:\s*(.+?)(?:\n|$)/i);

      const extractedName = productNameMatch?.[1]?.trim();
      const extractedBrand = brandMatch?.[1]?.trim();
      const extractedIngredients = ingredientsMatch?.[1]?.trim();
      const extractedAllergens = allergensMatch?.[1]?.trim();

      const hasName = extractedName && !extractedName.toLowerCase().includes('not visible');
      const hasBrand = extractedBrand && !extractedBrand.toLowerCase().includes('not visible');
      const hasIngredients = extractedIngredients && !extractedIngredients.toLowerCase().includes('not visible');

      const productCode = detectedBarcode || `photo_${Date.now()}`;
      const photoProduct: Product = {
        code: productCode,
        product_name: hasName ? extractedName : 'Photo Scan Product',
        brands: hasBrand ? extractedBrand : undefined,
        ingredients_text: hasIngredients ? extractedIngredients : undefined,
        allergens: extractedAllergens && !extractedAllergens.toLowerCase().includes('not visible') ? extractedAllergens : undefined,
        allergens_tags: [],
        traces_tags: [],
        source: 'manual_entry' as const,
      };

      upsertProduct(photoProduct).then(() => {
        console.log('[ScanScreen] Photo product saved to Supabase');
      }).catch((err) => {
        console.log('[ScanScreen] Non-critical: failed to save photo product:', err);
      });

      if (currentUser?.id && activeProfile) {
        const verdict = calculateVerdict(photoProduct, activeProfile);
        recordScanEvent({
          user_id: currentUser.id,
          profile_id: activeProfile.id,
          product_barcode: productCode,
          product_name: photoProduct.product_name || 'Photo Scan',
          scan_type: 'photo',
          verdict: verdict.level,
          verdict_details: verdict.message || null,
        }).catch(() => {});
      }

      if (detectedBarcode) {
        Alert.alert(
          'Product Recognized!',
          `Barcode: ${detectedBarcode}\nName: ${hasName ? extractedName : 'Unknown'}\n\nProduct saved. Would you like to view details?`,
          [
            {
              text: 'View Product',
              onPress: () => {
                setCapturedImage(null);
                setIsAnalyzing(false);
                router.push(`/product/${encodeURIComponent(detectedBarcode)}` as Href);
              }
            },
            {
              text: 'Done',
              onPress: () => {
                setCapturedImage(null);
                setIsAnalyzing(false);
              },
              style: 'cancel'
            }
          ]
        );
      } else {
        Alert.alert(
          'Product Saved',
          `${hasName ? extractedName : 'Product'} has been saved and is now searchable.\n\n${analysisResult}`,
          [
            {
              text: 'Search Now',
              onPress: () => {
                if (hasName) {
                  setSearchQuery(extractedName!);
                }
                setCapturedImage(null);
                setIsAnalyzing(false);
              }
            },
            {
              text: 'Take Another',
              onPress: () => {
                setCapturedImage(null);
                setIsAnalyzing(false);
                openImageRecognition();
              },
            },
            {
              text: 'Done',
              onPress: () => {
                setCapturedImage(null);
                setIsAnalyzing(false);
              },
              style: 'cancel'
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      Alert.alert(
        'Analysis Failed',
        `Could not analyze the product image: ${error instanceof Error ? error.message : 'Unknown error'}\n\n💡 Tips for better photos:\n\n• Hold phone steady and tap to focus\n• Ensure good lighting (avoid shadows)\n• Get close enough to read text clearly\n• Center the product name and ingredients\n• Make sure text is sharp and in focus\n• Avoid glare from plastic packaging\n• Try taking photo from straight angle`,
        [
          {
            text: 'Take New Photo',
            onPress: () => {
              setCapturedImage(null);
              setIsAnalyzing(false);
              openImageRecognition();
            },
            style: 'default'
          },
          {
            text: 'Try Barcode Scan',
            onPress: () => {
              setCapturedImage(null);
              setIsAnalyzing(false);
              openCamera();
            }
          },
          {
            text: 'Cancel',
            onPress: () => {
              setCapturedImage(null);
              setIsAnalyzing(false);
            },
            style: 'cancel'
          }
        ]
      );
    }
  };

  const cameraRef = useRef<CameraView>(null);

  const renderVerdictBadge = (product: Product) => {
    if (!activeProfile) return null;
    
    const verdict = calculateVerdict(product, activeProfile);
    const color = getVerdictColor(verdict.level);
    const iconName = getVerdictIcon(verdict.level);
    
    const Icon = iconName === 'check-circle' ? CheckCircle : iconName === 'alert-triangle' ? AlertTriangle : AlertCircle;
    
    return (
      <View style={[styles.verdictBadge, { backgroundColor: color + '20', borderColor: color }]}>
        <Icon size={16} color={color} />
      </View>
    );
  };

  if (profilesLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={arcaneColors.primary} />
      </View>
    );
  }

  if (!activeProfile) {
    if (profiles.length > 0) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={arcaneColors.primary} />
          <Text style={styles.loadingText}>Setting up profile...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={48} color="#9CA3AF" />
        <Text style={styles.emptyText}>No profile yet</Text>
        <Text style={styles.emptySubtext}>Create a profile to start scanning products</Text>
        <TouchableOpacity 
          style={styles.primaryButton} 
          onPress={() => router.push('/wizard' as Href)}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Create Profile</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (cameraActive) {
    console.log('Rendering camera view, scanned state:', scanned, 'image mode:', imageRecognitionMode);

    const bannerTranslateY = detectedBannerAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [-60, 0],
    });

    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing={cameraFacing}
          enableTorch={cameraFacing === 'back' && torchEnabled}
          onBarcodeScanned={(imageRecognitionMode || smartScanActive) ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={(imageRecognitionMode || smartScanActive) ? undefined : {
            barcodeTypes: [
              'ean13',
              'ean8',
              'upc_a',
              'upc_e',
              'code128',
              'code39',
              'qr',
            ],
          }}
          onTouchEnd={handleCameraPress}
        />
        
        {/* Header - Back/Exit pill — safe-area aware, always on top */}
        <View style={styles.cameraHeaderOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={[
              styles.backButtonAbsolute,
              { top: insets.top + 8, left: Math.max(insets.left, 12) },
            ]}
            onPress={() => {
              console.log('Back button pressed - closing camera');
              setCameraActive(false);
              setDetectedBannerData({ code: '', show: false });
              detectedBannerAnim.setValue(0);
            }}
            testID="camera-back-button"
            activeOpacity={0.7}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          >
            <X size={18} color="#FFFFFF" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </View>

        {scanned && (
          <View style={[styles.processingDotAbsolute, { top: insets.top + 14, right: Math.max(insets.right, 20) }]}>
            <View style={styles.processingDot} />
          </View>
        )}

        {/* Detected Banner */}
        {detectedBannerData.show && (
          <Animated.View
            style={[
              styles.detectedBanner,
              {
                top: insets.top + 60,
                opacity: detectedBannerAnim,
                transform: [{ translateY: bannerTranslateY }],
              },
            ]}
          >
            <View style={styles.detectedBannerGlow} />
            <View style={styles.detectedBannerContent}>
              <View style={styles.detectedBannerIcon}>
                <Shield size={16} color="#10B981" />
              </View>
              <View style={styles.detectedBannerTextWrap}>
                <Text style={styles.detectedBannerTitle}>Barcode Detected</Text>
                <Text style={styles.detectedBannerCode}>{detectedBannerData.code}</Text>
              </View>
            </View>
          </Animated.View>
        )}
        
        {/* Lock-On Reticle */}
        <View style={styles.scanAreaContainer}>
          {focusPoint && (
            <View
              style={[
                styles.focusIndicator,
                {
                  left: focusPoint.x - 40,
                  top: focusPoint.y - 40,
                },
              ]}
            />
          )}
          
          {smartScanActive ? (
            <View style={styles.photoFrameContainer}>
              <LockOnReticle size={280} color="rgba(109, 40, 217, 0.6)" />
              
              {smartScanProcessing ? (
                <View style={styles.smartProcessingOverlay}>
                  <ArcaneSpinner size={48} />
                  <Text style={styles.smartProcessingText}>Analyzing...</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.smartCaptureButton}
                  onPress={handleSmartCapture}
                  activeOpacity={0.8}
                  testID="smart-capture-button"
                >
                  <View style={styles.smartCaptureButtonInner}>
                    <Sparkles size={28} color="#FFFFFF" />
                  </View>
                  <Text style={styles.smartCaptureLabel}>Smart Capture</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : imageRecognitionMode ? (
            <View style={styles.photoFrameContainer}>
              <LockOnReticle size={280} color="rgba(109, 40, 217, 0.6)" />
              
              <TouchableOpacity 
                style={styles.captureButtonModern} 
                onPress={capturePhoto}
                activeOpacity={0.8}
              >
                <View style={styles.captureButtonInner}>
                  <Camera size={28} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.scanFrameContainer}>
              <LockOnReticle
                size={280}
                locked={scanned}
                color="rgba(11, 110, 122, 0.7)"
                lockedColor="#10B981"
              />
              
              {scanned && (
                <View style={styles.processingOverlay}>
                  <ArcaneSpinner size={40} />
                </View>
              )}
            </View>
          )}
        </View>
        
        {/* Flash Toggle - Bottom Left */}
        <Pressable
          style={({ pressed }) => [
            styles.flashButtonBottomLeft,
            cameraFacing === 'front' && styles.flashButtonDisabled,
            pressed && cameraFacing === 'back' && styles.flashButtonPressed,
          ]}
          onPress={async () => {
            if (cameraFacing === 'front') {
              console.log('Torch not available on front camera');
              showToast('Torch not available on front camera', 'caution');
              return;
            }
            console.log('Flash button pressed, current state:', torchEnabled);
            if (Platform.OS !== 'web') {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            const next = !torchEnabled;
            setTorchEnabled(next);
            showToast(next ? 'Torch ON' : 'Torch OFF', 'info');
          }}
          testID="flash-button"
          hitSlop={10}
          disabled={false}
        >
          {cameraFacing === 'front' ? (
            <FlashlightOff size={22} color="#6B7280" />
          ) : torchEnabled ? (
            <Flashlight size={22} color="#FBBF24" />
          ) : (
            <FlashlightOff size={22} color="#FFFFFF" />
          )}
          <Text style={[
            styles.flashButtonText,
            torchEnabled && cameraFacing === 'back' && styles.flashButtonTextActive,
            cameraFacing === 'front' && styles.flashButtonTextDisabled,
          ]}>
            {cameraFacing === 'front' ? 'N/A' : torchEnabled ? 'ON' : 'OFF'}
          </Text>
        </Pressable>

        {/* Auto-capture toggle for Smart Scan */}
        {smartScanActive && !smartScanProcessing && (
          <TouchableOpacity
            style={[
              styles.autoCaptureToggle,
              { bottom: Platform.OS === 'ios' ? 140 : 120, right: 20 },
              autoCapture && styles.autoCaptureToggleActive,
            ]}
            onPress={() => {
              setAutoCapture(prev => !prev);
              showToast(autoCapture ? 'Auto-capture OFF' : 'Auto-capture ON (every 8s)', 'info');
            }}
            activeOpacity={0.7}
          >
            <Zap size={18} color={autoCapture ? '#F5C542' : '#FFFFFF'} />
            <Text style={[styles.autoCaptureText, autoCapture && styles.autoCaptureTextActive]}>
              {autoCapture ? 'Auto' : 'Auto'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Upload Barcode Photo - Bottom Right */}
        <TouchableOpacity
          style={[styles.uploadBarcodeButton, { bottom: Platform.OS === 'ios' ? insets.bottom + 100 : 120 }]}
          onPress={async () => {
            console.log('Upload barcode photo pressed');
            if (Platform.OS !== 'web') {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            setCameraActive(false);
            handleUploadBarcodePhoto();
          }}
          testID="upload-barcode-button"
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Upload size={18} color="#FFFFFF" />
          <Text style={styles.uploadBarcodeText}>Upload</Text>
        </TouchableOpacity>

        {/* Bottom Status Card */}
        <View style={styles.bottomCard}>
          <View style={styles.bottomCardIcon}>
            <Shield size={20} color={scanned ? '#10B981' : '#FFFFFF'} />
          </View>
          <View style={styles.bottomCardContent}>
            <Text style={styles.bottomCardTitle}>
              {smartScanActive ? 'AI Smart Scan' : imageRecognitionMode ? 'Photo Mode' : scanned ? 'Lock-On!' : 'Guardian Active'}
            </Text>
            <Text style={styles.bottomCardSubtitle}>
              {smartScanActive
                ? smartScanProcessing
                  ? 'Processing — please hold steady...'
                  : 'Tap Smart Capture to scan product'
                : imageRecognitionMode 
                  ? 'Tap button to capture product' 
                  : scanned 
                    ? 'Barcode acquired — analyzing...' 
                    : 'Position barcode in the reticle'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (isAnalyzing) {
    return (
      <View style={styles.centerContainer}>
        <ArcaneSpinner size={64} />
        <Text style={styles.loadingText}>Calling the Archive…</Text>
        {capturedImage && (
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
        )}
        <Text style={styles.loadingSubtext}>Analyzing your product image</Text>
      </View>
    );
  }

  if (smartScanResults) {
    const r = smartScanResults;
    return (
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          bounces={true}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
          <View style={styles.smartResultsHeader}>
            <View style={styles.smartResultsIconWrap}>
              <Sparkles size={22} color={arcaneColors.accent} />
            </View>
            <View style={styles.smartResultsHeaderText}>
              <Text style={styles.smartResultsTitle}>AI Smart Scan Results</Text>
              <Text style={styles.smartResultsSubtitle}>Single-frame OCR + Translation</Text>
            </View>
          </View>

          {r.capturedImageUri && (
            <Image source={{ uri: r.capturedImageUri }} style={styles.smartResultImage} />
          )}

          <View style={styles.smartFieldCard}>
            <Text style={styles.smartFieldLabel}>Product Name</Text>
            <Text style={styles.smartFieldValue} selectable>{r.productName || 'Not detected'}</Text>
          </View>

          {r.nameTranslation && isTranslationAvailable(r.nameTranslation) && (
            <TranslationCard
              originalText={r.nameTranslation.originalText}
              translatedText={r.nameTranslation.translatedText}
              detectedLanguage={r.nameTranslation.detectedLanguage}
              isEnglish={r.nameTranslation.isEnglish}
              onReportIssue={() => Alert.alert('Feedback', 'Translation issue reported. Thank you!')}
              testID="name-translation-card"
            />
          )}

          {r.brand && (
            <View style={styles.smartFieldCard}>
              <Text style={styles.smartFieldLabel}>Brand</Text>
              <Text style={styles.smartFieldValue} selectable>{r.brand}</Text>
            </View>
          )}

          <View style={styles.smartFieldCard}>
            <Text style={styles.smartFieldLabel}>Ingredients</Text>
            <Text style={[styles.smartFieldValue, !r.ingredients && styles.smartFieldMissing]} selectable>
              {r.ingredients || 'Not detected — try capturing the ingredients panel'}
            </Text>
          </View>

          {r.ingredientsTranslation && isTranslationAvailable(r.ingredientsTranslation) && (
            <TranslationCard
              originalText={r.ingredientsTranslation.originalText}
              translatedText={r.ingredientsTranslation.translatedText}
              detectedLanguage={r.ingredientsTranslation.detectedLanguage}
              isEnglish={r.ingredientsTranslation.isEnglish}
              onReportIssue={() => Alert.alert('Feedback', 'Translation issue reported. Thank you!')}
              testID="ingredients-translation-card"
            />
          )}

          {r.allergens && (
            <View style={[styles.smartFieldCard, styles.smartFieldCardDanger]}>
              <Text style={[styles.smartFieldLabel, { color: arcaneColors.danger }]}>Allergen Warnings</Text>
              <Text style={styles.smartFieldValue} selectable>{r.allergens}</Text>
            </View>
          )}

          {r.barcode && (
            <View style={styles.smartFieldCard}>
              <Text style={styles.smartFieldLabel}>Barcode</Text>
              <Text style={styles.smartFieldValue} selectable>{r.barcode}</Text>
            </View>
          )}

          <View style={styles.smartResultActions}>
            <TouchableOpacity
              style={styles.smartActionPrimary}
              onPress={handleSmartScanSaveAndView}
              activeOpacity={0.8}
            >
              <Shield size={20} color="#FFFFFF" />
              <Text style={styles.smartActionPrimaryText}>Save & View Product</Text>
            </TouchableOpacity>

            <View style={styles.smartActionRow}>
              <TouchableOpacity
                style={styles.smartActionSecondary}
                onPress={() => {
                  setSmartScanResults(null);
                  openSmartScan();
                }}
                activeOpacity={0.8}
              >
                <RotateCcw size={18} color={arcaneColors.primary} />
                <Text style={styles.smartActionSecondaryText}>Re-scan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.smartActionSecondary}
                onPress={() => setSmartScanResults(null)}
                activeOpacity={0.8}
              >
                <X size={18} color={arcaneColors.textSecondary} />
                <Text style={styles.smartActionSecondaryText}>Discard</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.disclaimer}>
            <AlertCircle size={16} color="#9CA3AF" />
            <Text style={styles.disclaimerText}>
              AI Smart Scan is in Beta. Results may be imperfect. Always verify ingredients on the physical label.
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        overScrollMode="always"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        {profiles.length > 1 && (
          <View style={styles.profileSwitcher}>
            <View style={styles.switcherHeader}>
              <Text style={styles.switcherLabel}>Quick Switch</Text>
              {isSwitchingProfile && (
                <ActivityIndicator size="small" color={arcaneColors.primary} />
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profilesScroll}>
              {profiles.map((profile) => {
                const isActive = activeProfile.id === profile.id;
                return (
                  <TouchableOpacity
                    key={profile.id}
                    style={[
                      styles.profileChip,
                      isActive && styles.profileChipActive,
                    ]}
                    onPress={async () => {
                      if (isActive || isSwitchingProfile) return;
                      if (Platform.OS !== 'web') {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                      setActiveProfile(profile.id);
                    }}
                    disabled={isSwitchingProfile}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.profileChipAvatar,
                      { backgroundColor: profile.avatarColor || '#0891B2' },
                      isActive && styles.profileChipAvatarActive,
                    ]}>
                      <Text style={styles.profileChipEmoji}>{getRelationshipIcon(profile.relationship)}</Text>
                    </View>
                    <Text style={[
                      styles.profileChipName,
                      isActive && styles.profileChipNameActive,
                    ]}>
                      {profile.name}
                    </Text>
                    {isActive && (
                      <View style={styles.activeIndicator} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View>
              <Text style={styles.profileLabel}>Scanning for</Text>
              <Text style={styles.profileName}>{activeProfile.name}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/profiles' as Href)}>
              <Text style={styles.changeLink}>Manage</Text>
            </TouchableOpacity>
          </View>
          {activeProfile.allergens.length > 0 && (
            <View style={styles.allergensList}>
              {activeProfile.allergens.slice(0, 5).map((allergen, index) => (
                <View key={index} style={styles.allergenTag}>
                  <Text style={styles.allergenText}>{allergen}</Text>
                </View>
              ))}
              {activeProfile.allergens.length > 5 && (
                <View style={styles.allergenTag}>
                  <Text style={styles.allergenText}>+{activeProfile.allergens.length - 5}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.modeToggleContainer}>
          <TouchableOpacity
            style={[styles.modeToggleBtn, scanMode === 'classic' && styles.modeToggleBtnActive]}
            onPress={() => setScanMode('classic')}
            activeOpacity={0.7}
          >
            <Camera size={16} color={scanMode === 'classic' ? '#FFFFFF' : arcaneColors.textSecondary} />
            <Text style={[styles.modeToggleText, scanMode === 'classic' && styles.modeToggleTextActive]}>Classic Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeToggleBtn, scanMode === 'smart' && styles.modeToggleBtnSmart]}
            onPress={() => setScanMode('smart')}
            activeOpacity={0.7}
          >
            <Sparkles size={16} color={scanMode === 'smart' ? '#FFFFFF' : arcaneColors.accent} />
            <Text style={[styles.modeToggleText, scanMode === 'smart' && styles.modeToggleTextActive]}>AI Smart Scan</Text>
            <View style={styles.betaBadge}>
              <Text style={styles.betaBadgeText}>Beta</Text>
            </View>
          </TouchableOpacity>
        </View>

        {scanMode === 'classic' ? (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity 
              style={styles.scanButton} 
              onPress={() => {
                Animated.sequence([
                  Animated.timing(scaleAnim, {
                    toValue: 0.95,
                    duration: 100,
                    useNativeDriver: true,
                  }),
                  Animated.timing(scaleAnim, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                  }),
                ]).start();
                openCamera();
              }}
              activeOpacity={0.9}
            >
              <Camera size={32} color="#FFFFFF" />
              <Text style={styles.scanButtonText}>Scan Barcode</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity
            style={styles.smartScanMainButton}
            onPress={openSmartScan}
            activeOpacity={0.85}
            testID="smart-scan-main-button"
          >
            <View style={styles.smartScanMainIcon}>
              <Sparkles size={28} color="#FFFFFF" />
            </View>
            <View style={styles.smartScanMainContent}>
              <Text style={styles.smartScanMainTitle}>AI Smart Capture</Text>
              <Text style={styles.smartScanMainSubtitle}>OCR + Language Detection + Translation</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.photoOptionsContainer}>
          <TouchableOpacity 
            style={styles.imageRecognitionButton} 
            onPress={() => {
              Animated.sequence([
                Animated.timing(scaleAnim, {
                  toValue: 0.95,
                  duration: 100,
                  useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                  toValue: 1,
                  duration: 100,
                  useNativeDriver: true,
                }),
              ]).start();
              openImageRecognition();
            }}
            activeOpacity={0.9}
          >
            <Camera size={24} color="#FFFFFF" />
            <View style={styles.imageButtonContent}>
              <Text style={styles.imageButtonTitle}>Take Photo</Text>
              <Text style={styles.imageButtonSubtitle}>Capture product label</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.uploadPhotoButton} 
            onPress={() => {
              Animated.sequence([
                Animated.timing(scaleAnim, {
                  toValue: 0.95,
                  duration: 100,
                  useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                  toValue: 1,
                  duration: 100,
                  useNativeDriver: true,
                }),
              ]).start();
              pickImageFromGallery();
            }}
            activeOpacity={0.9}
          >
            <Upload size={24} color="#FFFFFF" />
            <View style={styles.imageButtonContent}>
              <Text style={styles.imageButtonTitle}>Upload Photo</Text>
              <Text style={styles.imageButtonSubtitle}>From camera roll</Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.addManualButton}
          onPress={() => {
            if (Platform.OS !== 'web') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            router.push('/manual-ingredient-entry' as Href);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.addManualIcon}>
            <Plus size={20} color="#0891B2" />
          </View>
          <View style={styles.addManualContent}>
            <Text style={styles.addManualTitle}>Add Product Manually</Text>
            <Text style={styles.addManualSubtitle}>Type or upload ingredients • No barcode needed</Text>
          </View>
        </TouchableOpacity>

        <ArcaneDivider label="OR" />

        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>Search Products</Text>
          <View style={styles.searchBar}>
            <Search size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Product name, barcode, or URL"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                setShowSearchHistory(text.length === 0 && searchHistory.length > 0);
              }}
              onFocus={() => {
                if (searchQuery.length === 0 && searchHistory.length > 0) {
                  setShowSearchHistory(true);
                }
              }}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => {
                setSearchQuery('');
                setShowSearchHistory(searchHistory.length > 0);
              }}>
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          
          {showSearchHistory && searchHistory.length > 0 && (
            <View style={styles.searchHistoryContainer}>
              <View style={styles.searchHistoryHeader}>
                <Text style={styles.searchHistoryTitle}>Recent Searches</Text>
              </View>
              {searchHistory.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.searchHistoryItem}
                  onPress={() => {
                    setSearchQuery(item.query);
                    setShowSearchHistory(false);
                    setTimeout(() => handleSearch(), 100);
                  }}
                >
                  <Clock size={16} color="#9CA3AF" />
                  <Text style={styles.searchHistoryText} numberOfLines={1}>{item.query}</Text>
                  <View style={styles.searchHistoryBadge}>
                    <Text style={styles.searchHistoryBadgeText}>
                      {item.type === 'barcode' ? '🔢' : item.type === 'url' ? '🔗' : '📝'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity
            style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>

        {searchError && (
          <View style={styles.errorContainer}>
            <AlertCircle size={24} color="#DC2626" />
            <Text style={styles.errorText}>{searchError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleSearch}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {noResults && !searchError && (
          <View style={styles.noResultsContainer}>
            <Search size={48} color="#9CA3AF" />
            <Text style={styles.noResultsTitle}>No Results Found</Text>
            <Text style={styles.noResultsText}>
              We could not find any products matching &quot;{searchQuery}&quot;
            </Text>
            <View style={styles.noResultsActions}>
              <TouchableOpacity 
                style={styles.noResultsButton}
                onPress={openImageRecognition}
              >
                <ImageIcon size={20} color="#FFFFFF" />
                <Text style={styles.noResultsButtonText}>Try Photo Recognition</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.noResultsButtonSecondary}
                onPress={() => router.push('/manual-ingredient-entry' as Href)}
              >
                <Text style={styles.noResultsButtonSecondaryText}>Enter Ingredients Manually</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {searchResults.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Results ({searchResults.length})</Text>
            {searchResults.map((product) => (
              <TouchableOpacity
                key={product.code}
                style={styles.resultCard}
                onPress={() => {
                  console.log('Navigating to product from search results:', product.code);
                  if (!product.code || product.code === 'undefined' || product.code === 'null' || product.code.trim() === '') {
                    console.error('Invalid product code in search results:', product.code);
                    Alert.alert('Error', 'This product has an invalid code.');
                    return;
                  }
                  router.push(`/product/${encodeURIComponent(product.code)}` as Href);
                }}
              >
                <View style={styles.resultContent}>
                  <View style={styles.resultInfo}>
                    <View style={styles.resultNameRow}>
                      <Text style={styles.resultName} numberOfLines={2}>
                        {product.product_name || 'Unknown Product'}
                      </Text>
                    </View>
                    <View style={styles.resultMetaRow}>
                      {(() => {
                        const pType = product.product_type || guessProductType(product.ingredients_text, product.product_name, product.categories);
                        const typeColor = getProductTypeColor(pType);
                        return (
                          <View style={[styles.productTypeBadge, { backgroundColor: typeColor + '15', borderColor: typeColor }]}>
                            <Text style={styles.productTypeEmoji}>{getProductTypeEmoji(pType)}</Text>
                            <Text style={[styles.productTypeText, { color: typeColor }]}>{getProductTypeLabel(pType)}</Text>
                          </View>
                        );
                      })()}
                      {product.brands && (
                        <Text style={styles.resultBrand} numberOfLines={1}>
                          {product.brands}
                        </Text>
                      )}
                    </View>
                  </View>
                  {renderVerdictBadge(product)}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}



        <ArcaneDivider label="Coming Soon" variant="gold" />

        <View style={styles.comingSoonSection}>
          <RuneCard variant="accent">
            <View style={styles.comingSoonCardHeader}>
              <View style={[styles.comingSoonIconBg, { backgroundColor: arcaneColors.accentMuted }]}>
                <Wand2 size={20} color={arcaneColors.accent} />
              </View>
              <View style={styles.comingSoonCardContent}>
                <Text style={styles.comingSoonCardTitle}>Smart Scan Auto-Capture</Text>
                <Text style={styles.comingSoonCardDesc}>
                  Hands-free scanning with automatic steady-detection and continuous product recognition.
                </Text>
              </View>
            </View>
            <SigilBadge label="Beta — Improving" status="legendary" size="sm" />
          </RuneCard>

          <RuneCard variant="gold">
            <View style={styles.comingSoonCardHeader}>
              <View style={[styles.comingSoonIconBg, { backgroundColor: arcaneColors.goldMuted }]}>
                <Languages size={20} color={arcaneColors.goldDark} />
              </View>
              <View style={styles.comingSoonCardContent}>
                <Text style={styles.comingSoonCardTitle}>OCR Translation Improvements</Text>
                <Text style={styles.comingSoonCardDesc}>
                  Enhanced multi-language support, better ingredient detection, and offline translation cache.
                </Text>
              </View>
            </View>
            <SigilBadge label="Planned" status="legendary" size="sm" />
          </RuneCard>

          <View style={styles.comingSoonLockedRow}>
            <View style={styles.comingSoonLockedItem}>
              <Lock size={14} color={arcaneColors.textMuted} />
              <Text style={styles.comingSoonLockedText}>Batch Scan</Text>
            </View>
            <View style={styles.comingSoonLockedItem}>
              <Lock size={14} color={arcaneColors.textMuted} />
              <Text style={styles.comingSoonLockedText}>Scan History Export</Text>
            </View>
          </View>
        </View>

        <View style={styles.disclaimer}>
          <AlertCircle size={16} color={arcaneColors.textMuted} />
          <Text style={styles.disclaimerText}>
            This app is informational only. Databases may be incomplete. Always read labels and follow medical guidance.
          </Text>
        </View>

        <Text style={styles.buildId}>Build: {BUILD_ID}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: arcaneColors.bg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: arcaneColors.bg },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 16, paddingBottom: 40, minHeight: '100%' },
  profileCard: { backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.xl, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: arcaneColors.borderRune, ...arcaneShadows.card },
  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  profileLabel: { fontSize: 14, color: arcaneColors.textSecondary, marginBottom: 4 },
  profileName: { fontSize: 24, fontWeight: '700' as const, color: arcaneColors.text },
  changeLink: { fontSize: 16, color: arcaneColors.primary, fontWeight: '600' as const },
  allergensList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  allergenTag: { backgroundColor: arcaneColors.goldMuted, paddingHorizontal: 12, paddingVertical: 6, borderRadius: arcaneRadius.pill },
  allergenText: { fontSize: 14, color: arcaneColors.textGold, fontWeight: '500' as const },
  scanButton: { backgroundColor: arcaneColors.primary, borderRadius: arcaneRadius.xl, padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24, ...arcaneShadows.elevated },
  scanButtonText: { fontSize: 20, fontWeight: '700' as const, color: '#FFF' },

  searchSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700' as const, color: arcaneColors.text, marginBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.lg, padding: 12, gap: 12, marginBottom: 12, borderWidth: 1, borderColor: arcaneColors.border },
  searchInput: { flex: 1, fontSize: 16, color: arcaneColors.text },
  searchButton: { backgroundColor: arcaneColors.primary, borderRadius: arcaneRadius.lg, padding: 16, alignItems: 'center' },
  searchButtonDisabled: { opacity: 0.6 },
  searchButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#FFF' },
  resultsSection: { marginBottom: 24 },
  resultCard: { backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: arcaneColors.borderRune, ...arcaneShadows.card },
  resultContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultInfo: { flex: 1, marginRight: 12 },
  resultNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  resultName: { fontSize: 16, fontWeight: '600' as const, color: arcaneColors.text, flex: 1 },
  resultMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  productTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  productTypeEmoji: { fontSize: 11 },
  productTypeText: { fontSize: 11, fontWeight: '600' as const },
  resultBrand: { fontSize: 13, color: arcaneColors.textSecondary },
  verdictBadge: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  cameraContainer: { flex: 1, backgroundColor: '#000', position: 'relative' as const },
  cameraHeaderOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, elevation: 9999 },
  backButtonAbsolute: { position: 'absolute' as const, zIndex: 9999, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, backgroundColor: 'rgba(11, 15, 20, 0.85)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, minWidth: 44, minHeight: 44, borderWidth: 1, borderColor: 'rgba(11, 110, 122, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 25 },
  backButtonText: { fontSize: 16, fontWeight: '700' as const, color: '#FFF' },
  processingDotAbsolute: { position: 'absolute' as const, zIndex: 9998, elevation: 19 },
  processingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FBBF24' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  scanAreaContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scanFrameContainer: { width: 280, height: 280, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  photoFrameContainer: { width: 280, height: 280, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  detectedBanner: { position: 'absolute' as const, left: 20, right: 20, zIndex: 20 },
  detectedBannerGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 14, backgroundColor: 'rgba(16, 185, 129, 0.08)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)' },
  detectedBannerContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  detectedBannerIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(16, 185, 129, 0.2)', alignItems: 'center', justifyContent: 'center' },
  detectedBannerTextWrap: { flex: 1 },
  detectedBannerTitle: { fontSize: 14, fontWeight: '700' as const, color: '#10B981', marginBottom: 1 },
  detectedBannerCode: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' as const },
  processingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8 },
  bottomCard: { position: 'absolute', bottom: Platform.OS === 'ios' ? 50 : 30, left: 20, right: 20, backgroundColor: 'rgba(30,30,30,0.95)', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  bottomCardIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  bottomCardContent: { flex: 1 },
  bottomCardTitle: { fontSize: 16, fontWeight: '600' as const, color: '#FFF', marginBottom: 2 },
  bottomCardSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  captureButtonModern: { position: 'absolute', bottom: -80, alignSelf: 'center' },
  captureButtonInner: { width: 70, height: 70, borderRadius: 35, backgroundColor: arcaneColors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#FFF' },
  disclaimer: { flexDirection: 'row', gap: 8, padding: 16, backgroundColor: arcaneColors.bgMist, borderRadius: arcaneRadius.lg, marginBottom: 24 },
  disclaimerText: { flex: 1, fontSize: 12, color: arcaneColors.textSecondary, lineHeight: 18 },
  emptyText: { fontSize: 20, fontWeight: '600' as const, color: arcaneColors.text, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 16, color: arcaneColors.textSecondary, marginBottom: 24 },
  primaryButton: { backgroundColor: arcaneColors.primary, borderRadius: arcaneRadius.lg, paddingHorizontal: 24, paddingVertical: 12 },
  primaryButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#FFF' },
  profileSwitcher: { marginBottom: 20 },
  switcherHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  switcherLabel: { fontSize: 14, fontWeight: '600' as const, color: arcaneColors.textSecondary },
  profilesScroll: { flexGrow: 0 },
  profileChip: { alignItems: 'center', marginRight: 16, paddingVertical: 8, paddingHorizontal: 12, borderRadius: arcaneRadius.xl, backgroundColor: arcaneColors.bgCard, borderWidth: 2, borderColor: arcaneColors.border, minWidth: 80 },
  profileChipActive: { borderColor: arcaneColors.primary, backgroundColor: arcaneColors.primaryMuted },
  profileChipAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  profileChipAvatarActive: { borderWidth: 3, borderColor: '#FFF' },
  profileChipEmoji: { fontSize: 24 },
  profileChipName: { fontSize: 12, fontWeight: '600' as const, color: arcaneColors.textSecondary, textAlign: 'center' as const },
  profileChipNameActive: { color: arcaneColors.primary },
  activeIndicator: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  addManualButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.lg, padding: 16, marginBottom: 16, borderWidth: 1.5, borderColor: arcaneColors.primary, borderStyle: 'dashed' as const },
  addManualIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: arcaneColors.primaryMuted, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  addManualContent: { flex: 1 },
  addManualTitle: { fontSize: 15, fontWeight: '700' as const, color: arcaneColors.primary, marginBottom: 2 },
  addManualSubtitle: { fontSize: 12, color: arcaneColors.textSecondary },
  photoOptionsContainer: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  imageRecognitionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: arcaneColors.accent, borderRadius: arcaneRadius.xl, padding: 16, ...arcaneShadows.glow },
  uploadPhotoButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: arcaneColors.safe, borderRadius: arcaneRadius.xl, padding: 16, shadowColor: arcaneColors.safe, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  imageButtonContent: { flex: 1 },
  imageButtonTitle: { fontSize: 14, fontWeight: '700' as const, color: '#FFF', marginBottom: 2 },
  imageButtonSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  focusIndicator: { position: 'absolute', width: 80, height: 80, borderWidth: 2, borderColor: '#FFD700', borderRadius: 40, zIndex: 100 },
  previewImage: { width: 300, height: 300, borderRadius: 16, marginTop: 24, marginBottom: 16 },
  loadingText: { marginTop: 16, fontSize: 18, fontWeight: '600' as const, color: arcaneColors.text },
  loadingSubtext: { marginTop: 8, fontSize: 14, color: arcaneColors.textSecondary },
  searchHistoryContainer: { backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.lg, marginBottom: 12, borderWidth: 1, borderColor: arcaneColors.border, overflow: 'hidden' },
  searchHistoryHeader: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: arcaneColors.border },
  searchHistoryTitle: { fontSize: 14, fontWeight: '600' as const, color: arcaneColors.textSecondary },
  searchHistoryItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: arcaneColors.borderLight },
  searchHistoryText: { flex: 1, fontSize: 15, color: arcaneColors.text },
  searchHistoryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: arcaneColors.bgMist },
  searchHistoryBadgeText: { fontSize: 12 },
  buildId: { fontSize: 11, color: arcaneColors.textMuted, textAlign: 'center' as const, marginTop: 8, marginBottom: 16 },
  flashButtonBottomLeft: { position: 'absolute', bottom: Platform.OS === 'ios' ? 140 : 120, left: 20, backgroundColor: 'rgba(30,30,30,0.9)', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, zIndex: 100, elevation: 100, minWidth: 44, minHeight: 44 },
  flashButtonDisabled: { backgroundColor: 'rgba(30,30,30,0.5)', borderWidth: 1, borderColor: 'rgba(107,114,128,0.3)' },
  flashButtonPressed: { backgroundColor: 'rgba(50,50,50,0.95)', transform: [{ scale: 0.96 }] },
  flashButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
  flashButtonTextActive: { color: '#FBBF24' },
  flashButtonTextDisabled: { color: '#6B7280' },
  uploadBarcodeButton: { position: 'absolute', right: 20, backgroundColor: 'rgba(8,145,178,0.9)', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 100, elevation: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  uploadBarcodeText: { color: '#FFF', fontSize: 15, fontWeight: '700' as const },
  errorContainer: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 20, marginBottom: 24, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
  errorText: { color: '#DC2626', fontSize: 14, textAlign: 'center' as const, marginTop: 8, marginBottom: 12 },
  retryButton: { backgroundColor: '#DC2626', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' as const },
  noResultsContainer: { backgroundColor: arcaneColors.bgMist, borderRadius: arcaneRadius.xl, padding: 24, marginBottom: 24, alignItems: 'center', borderWidth: 1, borderColor: arcaneColors.border },
  noResultsTitle: { fontSize: 18, fontWeight: '700' as const, color: arcaneColors.text, marginTop: 16, marginBottom: 8 },
  noResultsText: { fontSize: 14, color: arcaneColors.textSecondary, textAlign: 'center' as const, marginBottom: 20 },
  noResultsActions: { width: '100%', gap: 12 },
  noResultsButton: { backgroundColor: arcaneColors.accent, borderRadius: arcaneRadius.lg, paddingVertical: 14, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  noResultsButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' as const },
  noResultsButtonSecondary: { backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.lg, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center', borderWidth: 2, borderColor: arcaneColors.border },
  noResultsButtonSecondaryText: { color: arcaneColors.textSecondary, fontSize: 16, fontWeight: '600' as const },

  modeToggleContainer: { flexDirection: 'row', backgroundColor: arcaneColors.bgElevated, borderRadius: arcaneRadius.lg, padding: 4, marginBottom: 16, gap: 4 },
  modeToggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: arcaneRadius.md },
  modeToggleBtnActive: { backgroundColor: arcaneColors.primary, ...arcaneShadows.card },
  modeToggleBtnSmart: { backgroundColor: arcaneColors.accent, ...arcaneShadows.glow },
  modeToggleText: { fontSize: 13, fontWeight: '600' as const, color: arcaneColors.textSecondary },
  modeToggleTextActive: { color: '#FFFFFF' },
  betaBadge: { backgroundColor: 'rgba(245, 197, 66, 0.25)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  betaBadgeText: { fontSize: 9, fontWeight: '700' as const, color: arcaneColors.goldDark, letterSpacing: 0.5 },

  smartScanMainButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: arcaneColors.accent, borderRadius: arcaneRadius.xl, padding: 20, marginBottom: 24, gap: 16, ...arcaneShadows.glow },
  smartScanMainIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  smartScanMainContent: { flex: 1 },
  smartScanMainTitle: { fontSize: 18, fontWeight: '700' as const, color: '#FFFFFF', marginBottom: 3 },
  smartScanMainSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  smartCaptureButton: { position: 'absolute', bottom: -90, alignSelf: 'center', alignItems: 'center', gap: 6 },
  smartCaptureButtonInner: { width: 74, height: 74, borderRadius: 37, backgroundColor: arcaneColors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#FFF', ...arcaneShadows.glow },
  smartCaptureLabel: { fontSize: 12, fontWeight: '700' as const, color: '#FFF', letterSpacing: 0.3 },
  smartProcessingOverlay: { position: 'absolute', bottom: -80, alignSelf: 'center', alignItems: 'center', gap: 8 },
  smartProcessingText: { fontSize: 13, fontWeight: '600' as const, color: '#FFF' },

  autoCaptureToggle: { position: 'absolute' as const, backgroundColor: 'rgba(30,30,30,0.9)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, zIndex: 10, minWidth: 44, minHeight: 44 },
  autoCaptureToggleActive: { backgroundColor: 'rgba(109, 40, 217, 0.85)', borderWidth: 1, borderColor: 'rgba(245, 197, 66, 0.4)' },
  autoCaptureText: { color: '#FFF', fontSize: 13, fontWeight: '600' as const },
  autoCaptureTextActive: { color: '#F5C542' },

  smartResultsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: arcaneColors.borderAccent },
  smartResultsIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: arcaneColors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  smartResultsHeaderText: { flex: 1 },
  smartResultsTitle: { fontSize: 20, fontWeight: '700' as const, color: arcaneColors.accent },
  smartResultsSubtitle: { fontSize: 12, color: arcaneColors.textMuted, marginTop: 2 },
  smartResultImage: { width: '100%' as const, height: 200, borderRadius: arcaneRadius.lg, marginBottom: 16, backgroundColor: arcaneColors.bgElevated },
  smartFieldCard: { backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.md, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: arcaneColors.border },
  smartFieldCardDanger: { borderColor: arcaneColors.dangerMuted, backgroundColor: 'rgba(220, 38, 38, 0.04)' },
  smartFieldLabel: { fontSize: 11, fontWeight: '700' as const, color: arcaneColors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 6 },
  smartFieldValue: { fontSize: 14, lineHeight: 20, color: arcaneColors.text },
  smartFieldMissing: { color: arcaneColors.textMuted, fontStyle: 'italic' as const },
  smartResultActions: { marginTop: 12, marginBottom: 16, gap: 10 },
  smartActionPrimary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: arcaneColors.primary, borderRadius: arcaneRadius.lg, paddingVertical: 16, ...arcaneShadows.elevated },
  smartActionPrimaryText: { fontSize: 16, fontWeight: '700' as const, color: '#FFFFFF' },
  smartActionRow: { flexDirection: 'row', gap: 10 },
  smartActionSecondary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.md, paddingVertical: 12, borderWidth: 1, borderColor: arcaneColors.border },
  smartActionSecondaryText: { fontSize: 14, fontWeight: '600' as const, color: arcaneColors.textSecondary },

  comingSoonSection: { marginBottom: 16 },
  comingSoonCardHeader: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12, marginBottom: 10 },
  comingSoonIconBg: { width: 40, height: 40, borderRadius: 10, alignItems: 'center' as const, justifyContent: 'center' as const },
  comingSoonCardContent: { flex: 1 },
  comingSoonCardTitle: { fontSize: 15, fontWeight: '700' as const, color: arcaneColors.text, marginBottom: 4 },
  comingSoonCardDesc: { fontSize: 13, color: arcaneColors.textSecondary, lineHeight: 18 },
  comingSoonLockedRow: { flexDirection: 'row' as const, gap: 10, marginTop: 4 },
  comingSoonLockedItem: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6, backgroundColor: arcaneColors.bgCard, borderRadius: arcaneRadius.md, paddingVertical: 12, borderWidth: 1, borderColor: arcaneColors.border, borderStyle: 'dashed' as const, opacity: 0.65 },
  comingSoonLockedText: { fontSize: 12, fontWeight: '600' as const, color: arcaneColors.textMuted },
});
