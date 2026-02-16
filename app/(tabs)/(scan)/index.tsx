import { useState, useEffect, useRef } from 'react';
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
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, Href } from 'expo-router';

import { Camera, Search, X, AlertCircle, CheckCircle, AlertTriangle, ImageIcon, Clock, Flashlight, FlashlightOff, Upload } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { useUser } from '@/contexts/UserContext';
import { searchProductByBarcode, searchProductsByName, searchProductByUrl } from '@/api/products';
import { generateText } from '@rork-ai/toolkit-sdk';
import { getSearchHistory, addToSearchHistory } from '@/storage/searchHistory';
import { calculateVerdict, getVerdictColor, getVerdictIcon } from '@/utils/verdict';
import { Product } from '@/types';
import { getRelationshipIcon } from '@/constants/profileColors';
import { BUILD_ID } from '@/constants/appVersion';
import { upsertProduct, recordScanEvent } from '@/services/supabaseProducts';

export default function ScanScreen() {
  const router = useRouter();
  const { currentUser } = useUser();
  const { activeProfile, profiles, isLoading: profilesLoading, isSwitchingProfile, setActiveProfile } = useProfiles();
  
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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [noResults, setNoResults] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;


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
    }
  }, [cameraActive]);

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
    
    setCameraActive(false);
    
    setTimeout(() => {
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

  const cameraRef = useRef<CameraView | null>(null);

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
        <ActivityIndicator size="large" color="#0891B2" />
      </View>
    );
  }

  if (!activeProfile) {
    if (profiles.length > 0) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#0891B2" />
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
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          enableTorch={torchEnabled}
          onBarcodeScanned={imageRecognitionMode ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={imageRecognitionMode ? undefined : {
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
        
        {/* Header */}
        <View style={styles.cameraHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              console.log('Back button pressed - closing camera');
              setCameraActive(false);
            }}
            testID="camera-back-button"
            activeOpacity={0.7}
          >
            <X size={22} color="#FFFFFF" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          
          <View style={styles.headerRight}>
            {scanned && <View style={styles.processingDot} />}
          </View>
        </View>
        
        {/* Corner Brackets */}
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
          
          {imageRecognitionMode ? (
            <View style={styles.photoFrameContainer}>
              {/* Photo Frame Corners */}
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
              
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
              {/* Corner Brackets */}
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
              
              {scanned && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
              )}
            </View>
          )}
        </View>
        
        {/* Flash Toggle - Bottom Left */}
        <TouchableOpacity
          style={styles.flashButtonBottomLeft}
          onPress={async () => {
            console.log('Flash button pressed, current state:', torchEnabled);
            if (Platform.OS !== 'web') {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            setTorchEnabled(!torchEnabled);
          }}
          testID="flash-button"
          activeOpacity={0.7}
        >
          {torchEnabled ? (
            <Flashlight size={24} color="#FBBF24" />
          ) : (
            <FlashlightOff size={24} color="#FFFFFF" />
          )}
          <Text style={[styles.flashButtonText, torchEnabled && styles.flashButtonTextActive]}>
            {torchEnabled ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>

        {/* Bottom Status Card */}
        <View style={styles.bottomCard}>
          <View style={styles.bottomCardIcon}>
            <Camera size={20} color="#FFFFFF" />
          </View>
          <View style={styles.bottomCardContent}>
            <Text style={styles.bottomCardTitle}>
              {imageRecognitionMode ? 'Photo Mode' : scanned ? 'Processing...' : 'Ready to Scan'}
            </Text>
            <Text style={styles.bottomCardSubtitle}>
              {imageRecognitionMode 
                ? 'Tap button to capture product' 
                : scanned 
                  ? 'Analyzing barcode...' 
                  : 'Position barcode in frame'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (isAnalyzing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0891B2" />
        <Text style={styles.loadingText}>Analyzing product image...</Text>
        {capturedImage && (
          <Image source={{ uri: capturedImage }} style={styles.previewImage} />
        )}
        <Text style={styles.loadingSubtext}>This may take a few moments</Text>
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
                <ActivityIndicator size="small" color="#0891B2" />
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

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

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
                onPress={() => router.push('/manual-ingredient-entry')}
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
                    <Text style={styles.resultName} numberOfLines={2}>
                      {product.product_name || 'Unknown Product'}
                    </Text>
                    {product.brands && (
                      <Text style={styles.resultBrand} numberOfLines={1}>
                        {product.brands}
                      </Text>
                    )}
                  </View>
                  {renderVerdictBadge(product)}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}



        <View style={styles.disclaimer}>
          <AlertCircle size={16} color="#9CA3AF" />
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
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 16,
    paddingBottom: 40,
    minHeight: '100%',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  profileLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
  },
  changeLink: {
    fontSize: 16,
    color: '#0891B2',
    fontWeight: '600' as const,
  },
  allergensList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergenTag: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  allergenText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500' as const,
  },
  scanButton: {
    backgroundColor: '#0891B2',
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 24,
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  scanButtonText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '600' as const,
  },
  searchSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  searchButton: {
    backgroundColor: '#0891B2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  resultsSection: {
    marginBottom: 24,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultInfo: {
    flex: 1,
    marginRight: 12,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 4,
  },
  resultBrand: {
    fontSize: 14,
    color: '#6B7280',
  },
  verdictBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  headerLeft: {
    width: 44,
    height: 44,
  },
  backButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  processingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FBBF24',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanAreaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrameContainer: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  photoFrameContainer: {
    width: 280,
    height: 280,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderColor: '#FFFFFF',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 4,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 4,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 4,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 4,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
  },
  bottomCard: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  bottomCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCardContent: {
    flex: 1,
  },
  bottomCardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  bottomCardSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  captureButtonModern: {
    position: 'absolute',
    bottom: -80,
    alignSelf: 'center',
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginBottom: 24,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 18,
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
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: '#0891B2',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  profileSwitcher: {
    marginBottom: 20,
  },
  switcherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  switcherLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  profilesScroll: {
    flexGrow: 0,
  },
  profileChip: {
    alignItems: 'center',
    marginRight: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    minWidth: 80,
  },
  profileChipActive: {
    borderColor: '#0891B2',
    backgroundColor: '#F0FDFA',
  },
  profileChipAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  profileChipAvatarActive: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  profileChipEmoji: {
    fontSize: 24,
  },
  profileChipName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
    textAlign: 'center',
  },
  profileChipNameActive: {
    color: '#0891B2',
  },
  activeIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  photoOptionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  imageRecognitionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#8B5CF6',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadPhotoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#059669',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  imageButtonContent: {
    flex: 1,
  },
  imageButtonTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  imageButtonSubtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },

  focusIndicator: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: '#FFD700',
    borderRadius: 40,
    zIndex: 100,
  },

  previewImage: {
    width: 300,
    height: 300,
    borderRadius: 16,
    marginTop: 24,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  searchHistoryContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  searchHistoryHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchHistoryTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  searchHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchHistoryText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  searchHistoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  searchHistoryBadgeText: {
    fontSize: 12,
  },
  buildId: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    marginTop: 8,
    marginBottom: 16,
  },
  flashButtonBottomLeft: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 140 : 120,
    left: 20,
    backgroundColor: 'rgba(30, 30, 30, 0.9)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 10,
  },
  flashButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  flashButtonTextActive: {
    color: '#FBBF24',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center' as const,
    marginTop: 8,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  noResultsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  noResultsActions: {
    width: '100%',
    gap: 12,
  },
  noResultsButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noResultsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  noResultsButtonSecondary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  noResultsButtonSecondaryText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
