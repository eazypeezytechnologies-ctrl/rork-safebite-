import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack, Href, useFocusEffect } from 'expo-router';
import { AlertCircle, CheckCircle, AlertTriangle, HelpCircle, Heart, Sparkles, ChevronDown, ChevronUp, ShoppingCart, Share2, Lightbulb, Send, MessageCircle, ShieldCheck, Ban } from 'lucide-react-native';
import ProductCaptureWizard from '@/components/ProductCaptureWizard';
import { useProfiles } from '@/contexts/ProfileContext';
import { useFamily } from '@/contexts/FamilyContext';
import { searchProductByBarcode } from '@/api/products';
import { searchRecallsByBarcode } from '@/api/recalls';
import { getVerdictColor, getVerdictLabel } from '@/utils/verdict';
import type { VerdictLevel } from '@/types';

function buildVerdictMessage(level: VerdictLevel, profileName: string, missingData?: boolean): string {
  if (missingData) return `We couldn't fully verify this product yet. Some ingredient data is missing.`;
  switch (level) {
    case 'danger': return `This product contains ingredients that may affect ${profileName}.`;
    case 'caution': return `We checked what we could, but some details are unclear for ${profileName}.`;
    case 'unknown': return `We couldn't fully verify this product yet.`;
    case 'safe': return `This product looks safe for ${profileName} based on available data.`;
    default: return `Result available for ${profileName}.`;
  }
}
import { runUnifiedEvaluation } from '@/utils/unifiedEvaluation';
import { evaluateProduct, evalVerdictToLegacyLevel } from '@/utils/evaluationEngine';
import { engineToLegacyVerdict } from '@/utils/unifiedEvaluation';
import { Product, RecallResult } from '@/types';
import { addToScanHistory } from '@/storage/scanHistory';
import { getAIVerdict, AIVerdictRecord } from '@/storage/aiVerdict';
import { useUser } from '@/contexts/UserContext';
import { useQueryClient } from '@tanstack/react-query';
import { upsertProduct, recordScanEvent } from '@/services/supabaseProducts';
import { addToFavorites, removeFromFavorites, isFavorite, getFavorites } from '@/storage/favorites';
import { getTrustedProduct, markProductTrusted, removeTrustedProduct, TrustedProduct } from '@/storage/trustedProducts';
import { resetBarcodeDebounce } from '@/api/products';
import * as Haptics from 'expo-haptics';
import { analyzeIngredient, parseIngredients, getOverallSafetyScore, IngredientInfo } from '@/utils/ingredientAnalysis';
import { TranslationCard } from '@/components/TranslationCard';
import { addToShoppingList } from '@/storage/shoppingList';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { SkeletonProductCard } from '@/components/Skeleton';
import { guessProductType, getProductTypeLabel, getProductTypeColor, getProductTypeEmoji } from '@/utils/productType';
import { generateSafeSwaps, generateNoDataSwaps } from '@/services/safeSwapService';
import { generateText } from '@rork-ai/toolkit-sdk';
import { DietaryCompatibilityCard } from '@/components/DietaryCompatibilityCard';
import { DietaryRestrictionVerdictCard } from '@/components/DietaryRestrictionVerdictCard';
import { ConfidenceScoreBar } from '@/components/ConfidenceScoreBar';
import { ManufacturerWarningsCard } from '@/components/ManufacturerWarningsCard';
import { addToAvoidList, isOnAvoidList, removeFromAvoidList, getAvoidList } from '@/storage/avoidList';
import { HouseholdVerdictCard } from '@/components/HouseholdVerdictCard';
import { BetterOptionCard } from '@/components/BetterOptionCard';
import { LegalDisclaimer } from '@/components/LegalDisclaimer';
import { calculateHouseholdVerdict } from '@/utils/householdVerdict';
import { mapErrorToFriendly } from '@/utils/friendlyErrors';
import { logProductNotFound, logMissingData } from '@/utils/autoIssueLogger';

export default function ProductDetailsScreen() {
  const params = useLocalSearchParams<{ code: string | string[] }>();
  const router = useRouter();
  const { activeProfile, profiles } = useProfiles();
  const { trackActivity, currentUser } = useUser();
  const { viewMode, getFamilyMembers, activeFamilyGroup } = useFamily();
  const queryClient = useQueryClient();
  
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  
  let code = '';
  if (rawCode && rawCode !== 'undefined' && rawCode !== 'null') {
    try {
      code = decodeURIComponent(rawCode).trim();
    } catch (err) {
      console.error('Failed to decode URI:', err);
      code = rawCode.trim();
    }
  }
  
  if (code && (code.startsWith('http://') || code.startsWith('https://'))) {
    console.log('URL detected in product code, extracting barcode from URL');
    try {
      const url = new URL(code);
      const barcodeParam = url.searchParams.get('barcode') || url.searchParams.get('code');
      if (barcodeParam) {
        code = barcodeParam;
        console.log('Extracted barcode from URL:', code);
      } else {
        console.error('No barcode found in URL, setting code to empty');
        code = '';
      }
    } catch (err) {
      console.error('Failed to parse URL:', err);
      code = '';
    }
  }
  
  if (__DEV__) console.log('[ProductDetail] Mounted, code:', code, 'profile:', activeProfile?.name);
  
  const [product, setProduct] = useState<Product | null>(null);
  const [recalls, setRecalls] = useState<RecallResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [analyzedIngredients, setAnalyzedIngredients] = useState<IngredientInfo[]>([]);
  const [expandedIngredients, setExpandedIngredients] = useState<Set<string>>(new Set());
  const [isAddingToList, setIsAddingToList] = useState(false);
  const [alternativeRecommendations, setAlternativeRecommendations] = useState<string>('');
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [noDataAlternatives, setNoDataAlternatives] = useState<string>('');
  const [isLoadingNoDataAlternatives, setIsLoadingNoDataAlternatives] = useState(false);
  const [showNoDataAlternatives, setShowNoDataAlternatives] = useState(false);
  const [showCaptureWizard, setShowCaptureWizard] = useState(false);
  const [aiReplyInput, setAiReplyInput] = useState('');
  const [aiConversation, setAiConversation] = useState<{role: 'ai' | 'user'; text: string}[]>([]);
  const [isAiReplying, setIsAiReplying] = useState(false);
  const [aiVerdictRecord, setAiVerdictRecord] = useState<AIVerdictRecord | null>(null);
  const [trustedProduct, setTrustedProduct] = useState<TrustedProduct | null>(null);
  const [showMismatchExplainer, setShowMismatchExplainer] = useState(false);
  const [isAvoided, setIsAvoided] = useState(false);
  const hasLoadedInitially = useRef(false);
  const wizardShownForCodeRef = useRef<string | null>(null);
  const loadProductLockRef = useRef<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedInitially.current) {
        hasLoadedInitially.current = true;
        return;
      }
      if (code && activeProfile && currentUser) {
        console.log('[ProductDetail] Screen focused, refreshing AI verdict + trusted status...');
        resetBarcodeDebounce();
        void getAIVerdict(code, activeProfile.id, currentUser.id).then((stored) => {
          console.log('[ProductDetail] Refreshed AI verdict:', stored ? stored.aiVerdict : 'none');
          setAiVerdictRecord(stored);
        }).catch((err) => console.log('[ProductDetail] AI verdict refresh error:', err));

        void getTrustedProduct(code, activeProfile.id, currentUser.id).then((trusted) => {
          console.log('[ProductDetail] Refreshed trusted status:', trusted ? 'trusted' : 'not trusted');
          setTrustedProduct(trusted);
        }).catch((err) => console.log('[ProductDetail] Trusted status refresh error:', err));
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, activeProfile?.id, currentUser?.id])
  );
  const scrollViewRef = useRef<ScrollView>(null);

  const prevProfileIdRef = useRef<string | undefined>(activeProfile?.id);

  useEffect(() => {
    if (activeProfile?.id && activeProfile.id !== prevProfileIdRef.current && product && code) {
      console.log('[ProductDetail] Profile changed from', prevProfileIdRef.current, 'to', activeProfile.id, '— refreshing AI/trusted state');
      prevProfileIdRef.current = activeProfile.id;
      setAiVerdictRecord(null);
      setTrustedProduct(null);
      if (currentUser) {
        void getAIVerdict(code, activeProfile.id, currentUser.id).then((stored) => {
          console.log('[ProductDetail] Profile-switch AI verdict:', stored ? stored.aiVerdict : 'none');
          setAiVerdictRecord(stored);
        }).catch(() => {});
        void getTrustedProduct(code, activeProfile.id, currentUser.id).then((trusted) => {
          console.log('[ProductDetail] Profile-switch trusted:', trusted ? 'yes' : 'no');
          setTrustedProduct(trusted);
        }).catch(() => {});
      }
    } else {
      prevProfileIdRef.current = activeProfile?.id;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfile?.id]);

  useEffect(() => {
    if (__DEV__) console.log('[ProductDetail] useEffect code:', code);
    
    if (code && code !== 'undefined' && code !== 'null' && code.trim() !== '' && !/^https?:\/\//.test(code)) {
      if (loadProductLockRef.current) {
        console.log('[ProductDetail] loadProduct already in progress, skipping duplicate call');
      } else {
        console.log('Code is valid, loading product...');
        void loadProduct();
      }
    } else {
      console.error('Invalid code detected:', code);
      if (code && /^https?:\/\//.test(code)) {
        setError('Invalid scan: This appears to be a URL or QR code. Please scan a product barcode.');
      } else {
        setError(`Invalid product code: "${code}"`);
      }
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const loadProduct = async () => {
    if (loadProductLockRef.current) {
      console.log('[ProductDetail] loadProduct skipped — already running');
      return;
    }
    loadProductLockRef.current = true;
    if (__DEV__) console.log('[ProductDetail] loadProduct started for:', code);
    
    if (!code || code === 'undefined' || code === 'null' || code.trim() === '') {
      console.error('Invalid code provided to loadProduct:', code);
      setError(`Cannot load product with code: "${code}"`);
      setIsLoading(false);
      return;
    }
    
    console.log('Code passed validation, proceeding with API call...');
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Calling searchProductByBarcode with code:', code);
      const productData = await searchProductByBarcode(code);
      console.log('API response received:', productData ? 'Product found' : 'No product');
      
      if (!productData) {
        if (wizardShownForCodeRef.current === code) {
          console.log('[ProductDetail] Wizard already shown for code:', code, '— skipping duplicate launch');
          setIsLoading(false);
          return;
        }
        console.log('[ProductDetail] Product not found, showing capture wizard for code:', code);
        wizardShownForCodeRef.current = code;
        setShowCaptureWizard(true);
        setIsLoading(false);
        logProductNotFound(code, currentUser?.id);
        return;
      }
      
      console.log('Product loaded successfully:', productData.product_name);
      
      setProduct(productData);
      setIsLoading(false);
      
      if (productData.ingredients_text) {
        const ingredientNames = parseIngredients(productData.ingredients_text);
        const analyzed = ingredientNames.map(name => analyzeIngredient(name));
        setAnalyzedIngredients(analyzed);
      }
      
      const [recallData, storedAiVerdict, trusted, favStatus, avoidStatus] = await Promise.all([
        searchRecallsByBarcode(code).catch(() => ({ results: [] as RecallResult[] })),
        activeProfile ? getAIVerdict(code, activeProfile.id, currentUser?.id).catch(() => null) : Promise.resolve(null),
        activeProfile ? getTrustedProduct(code, activeProfile.id, currentUser?.id).catch(() => null) : Promise.resolve(null),
        activeProfile ? isFavorite(code, activeProfile.id).catch(() => false) : Promise.resolve(false),
        activeProfile ? isOnAvoidList(code, activeProfile.id, currentUser?.id).catch(() => false) : Promise.resolve(false),
      ]);

      setRecalls(recallData.results);
      setIsFav(favStatus);
      setIsAvoided(avoidStatus);
      
      if (activeProfile) {
        if (storedAiVerdict) {
          console.log('[ProductDetail] Found stored AI verdict:', storedAiVerdict.aiVerdict);
          setAiVerdictRecord(storedAiVerdict);
        } else {
          setAiVerdictRecord(null);
        }

        if (trusted) {
          console.log('[ProductDetail] Product is trusted for this profile');
          setTrustedProduct(trusted);
        } else {
          setTrustedProduct(null);
        }

        const unified = runUnifiedEvaluation(productData, activeProfile, storedAiVerdict, trusted);
        unified.debugLog.forEach(l => console.log(l));
        const verdict = unified.verdict;
        console.log(`[ProductDetail] Unified verdict: ${verdict.level}, source: ${unified.verdictSource}, concerns: ${unified.evalResult.matchedConcerns.length}`);
        await addToScanHistory({
          id: `${code}_${activeProfile.id}_${Date.now()}`,
          product: productData,
          verdict,
          profileId: activeProfile.id,
          profileName: activeProfile.name,
          scannedAt: new Date().toISOString(),
        }, currentUser?.id);

        upsertProduct(productData).catch(() => {});

        if (currentUser?.id) {
          recordScanEvent({
            user_id: currentUser.id,
            profile_id: activeProfile.id,
            product_barcode: code,
            product_name: productData.product_name || 'Unknown',
            scan_type: 'barcode',
            verdict: verdict.level,
            verdict_details: verdict.message || null,
          }).catch((err) => console.log('[ProductDetail] Non-critical scan event error:', err));
        }

        void trackActivity('product_scan', {
          productCode: code,
          productName: productData.product_name,
          profileId: activeProfile.id,
          profileName: activeProfile.name,
          verdictLevel: verdict.level,
        });
        
        if (verdict.level === 'danger') {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
            setTimeout(() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); }, 300);
            setTimeout(() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); }, 600);
          }
          
          Alert.alert(
            'Not Safe for ' + activeProfile.name,
            `This product contains ingredients that may affect ${activeProfile.name}.\n\nDetected: ${verdict.matches.map(m => m.allergen).join(', ')}${activeProfile.hasAnaphylaxis ? '\n\nIf exposed, use your epinephrine auto-injector and call 911.' : ''}`,
            [
              { text: 'Understood', style: 'default' },
              { text: 'Exposure Help', onPress: () => {
                router.push('/exposure-guidance' as Href);
              }}
            ]
          );
          
          void loadAlternativeRecommendations(productData, verdict);
        } else if (verdict.level === 'caution') {
          void loadAlternativeRecommendations(productData, verdict);
        }
        
        if (verdict.missingData) {
          void loadNoDataAlternativeRecommendations(productData);
          logMissingData(code, productData.product_name, currentUser?.id, activeProfile?.id, activeProfile?.name);
        }
        
        if (verdict.level === 'caution') {
          if (Platform.OS !== 'web') {
            try {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            } catch (error) {
              console.log('Haptics error:', error);
            }
          }
          
          Alert.alert(
            'Use With Care',
            `Some details are unclear. This product may contain traces of allergens relevant to your profile.`,
            [
              { text: 'Got It', style: 'default' }
            ]
          );
        }
        
      }
    } catch (err) {
      console.error('=== Error loading product ===');
      console.error('Error details:', err);
      console.error('Error message:', err instanceof Error ? err.message : String(err));
      console.error('Code that caused error:', code);
      const friendly = mapErrorToFriendly(err);
      console.error('[ProductDetail] Raw error:', err instanceof Error ? err.message : err);
      setError(friendly.message);
      const reason = err instanceof Error ? err.message : String(err);
      import('@/utils/autoIssueLogger')
        .then(m => m.logProductLookupFailed(code, reason, currentUser?.id, activeProfile?.id, activeProfile?.name))
        .catch(() => {});
    } finally {
      console.log('loadProduct finished, isLoading set to false');
      loadProductLockRef.current = false;
      setIsLoading(false);
    }
  };

  const loadAlternativeRecommendations = async (unsafeProduct: Product, verdict: any) => {
    if (!activeProfile) return;
    
    setIsLoadingAlternatives(true);
    setShowAlternatives(true);
    
    try {
      console.log('Generating safe swap recommendations for unsafe product...');
      const recommendations = await generateSafeSwaps(unsafeProduct, verdict, activeProfile);
      setAlternativeRecommendations(recommendations);
    } catch (error: any) {
      console.error('Error generating alternative recommendations:', error);
      setAlternativeRecommendations(
        `Unable to generate AI recommendations at this time. Please:\n• Search for "${activeProfile.allergens[0]}-free" alternatives\n• Consult store staff for recommendations\n• Check with your allergist for safe product suggestions\n• Look for specialty allergen-free brands`
      );
    } finally {
      setIsLoadingAlternatives(false);
    }
  };

  const loadNoDataAlternativeRecommendations = async (productWithNoData: Product) => {
    if (!activeProfile) return;
    
    setIsLoadingNoDataAlternatives(true);
    setShowNoDataAlternatives(true);
    
    try {
      console.log('Generating safe swap recommendations for product with no data...');
      const recommendations = await generateNoDataSwaps(productWithNoData, activeProfile);
      setNoDataAlternatives(recommendations);
    } catch (error: any) {
      console.error('Error generating no-data alternative recommendations:', error);
      setNoDataAlternatives(
        `Unable to generate AI recommendations at this time. Please:\n• Look for similar products with clear ingredient labels\n• Shop at stores with good allergen-free sections\n• Check with your allergist for safe product suggestions\n• Use allergy apps like Spokin or Fig to find alternatives`
      );
    } finally {
      setIsLoadingNoDataAlternatives(false);
    }
  };

  if (__DEV__) console.log('[ProductDetail] Render:', isLoading ? 'LOADING' : error ? 'ERROR' : product ? product.product_name : 'NO_PRODUCT');

  if (isLoading) {
    console.log('Rendering loading state');
    return (
      <>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <SkeletonProductCard />
        </ScrollView>
      </>
    );
  }

  if (showCaptureWizard && !product) {
    return (
      <>
        <Stack.Screen options={{ title: 'Add Product' }} />
        <ProductCaptureWizard
          barcode={code}
          onProductSaved={(savedProduct) => {
            console.log('[ProductDetail] Product saved via wizard:', savedProduct.product_name);
            setProduct(savedProduct);
            setShowCaptureWizard(false);
            setIsLoading(false);
            setError(null);
            void queryClient.invalidateQueries({ queryKey: ['supabase-scan-history'] });
            void queryClient.invalidateQueries({ queryKey: ['supabase-product', code] });
            queryClient.removeQueries({ queryKey: ['supabase-product', code] });
          }}
          onCancel={() => router.back()}
          onNavigateToScan={() => {
            router.replace('/(tabs)/(scan)' as Href);
          }}
          onNavigateToSearch={(_query) => {
            router.replace('/(tabs)/(scan)' as Href);
          }}
        />
      </>
    );
  }

  if (error || !product) {
    console.log('Rendering error state:', { error, hasProduct: !!product });
    return (
      <>
        <Stack.Screen options={{ title: 'Product' }} />
        <ScrollView style={styles.container} contentContainerStyle={styles.centerContainer}>
          <HelpCircle size={56} color="#6B7280" />
          <Text style={styles.errorText}>{error || 'We couldn\'t find this product'}</Text>
          <Text style={styles.errorSubtext}>Try scanning again or search by name</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadProduct}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: '#0891B2', marginTop: 12 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </>
    );
  }

  const getUnifiedVerdictInfo = () => {
    if (!activeProfile) return { verdict: null, verdictColor: '#9CA3AF', verdictLabel: 'NO PROFILE', affectedMembers: [] as string[], aiAdjusted: false, aiConflict: false };

    if (viewMode === 'family' && activeFamilyGroup) {
      const familyMembers = getFamilyMembers(profiles);
      if (familyMembers.length === 0) {
        const unified = runUnifiedEvaluation(product, activeProfile, aiVerdictRecord, trustedProduct);
        unified.debugLog.forEach(l => console.log(l));
        return {
          verdict: unified.verdict,
          verdictColor: getVerdictColor(unified.verdict.level),
          verdictLabel: unified.verdictLabel,
          affectedMembers: [] as string[],
          aiAdjusted: unified.aiAdjusted,
          aiConflict: unified.aiConflict,
        };
      }

      let worstLevel: 'safe' | 'caution' | 'danger' | 'unknown' = 'safe';
      const affectedMembers: string[] = [];
      const allMatches: any[] = [];

      familyMembers.forEach(member => {
        const evalResult = evaluateProduct(product, member);
        const memberVerdict = engineToLegacyVerdict(evalResult);
        if (memberVerdict.level === 'danger') {
          worstLevel = 'danger';
          affectedMembers.push(member.name);
          allMatches.push(...memberVerdict.matches);
        } else if (memberVerdict.level === 'caution' && worstLevel !== 'danger') {
          worstLevel = 'caution';
          affectedMembers.push(member.name);
          allMatches.push(...memberVerdict.matches);
        } else if (memberVerdict.level === 'unknown' && worstLevel === 'safe') {
          worstLevel = 'unknown';
        }
      });

      const uniqueMatches = allMatches.filter((match: any, index: number, self: any[]) =>
        index === self.findIndex((m: any) => m.allergen === match.allergen && m.source === match.source)
      );

      const familyVerdict = {
        level: worstLevel as 'safe' | 'caution' | 'danger' | 'unknown',
        matches: uniqueMatches,
        message: worstLevel === 'safe'
          ? 'No allergens detected for any family member'
          : `Allergens detected for: ${affectedMembers.join(', ')}`,
        missingData: false,
      };

      return {
        verdict: familyVerdict,
        verdictColor: getVerdictColor(worstLevel),
        verdictLabel: getVerdictLabel(worstLevel),
        affectedMembers,
        aiAdjusted: false,
        aiConflict: false,
      };
    }

    const unified = runUnifiedEvaluation(product, activeProfile, aiVerdictRecord, trustedProduct);
    unified.debugLog.forEach(l => console.log(l));
    return {
      verdict: unified.verdict,
      verdictColor: getVerdictColor(unified.verdict.level),
      verdictLabel: unified.verdictLabel,
      affectedMembers: [] as string[],
      aiAdjusted: unified.aiAdjusted,
      aiConflict: unified.aiConflict,
    };
  };

  const { verdict, verdictColor, verdictLabel, affectedMembers, aiAdjusted, aiConflict } = getUnifiedVerdictInfo();
  
  const VerdictIcon = verdict?.level === 'safe' ? CheckCircle : verdict?.level === 'caution' ? AlertTriangle : verdict?.level === 'unknown' ? HelpCircle : AlertCircle;

  const householdVerdict = (viewMode === 'family' && activeFamilyGroup && product)
    ? calculateHouseholdVerdict(product, getFamilyMembers(profiles))
    : null;

  const unifiedResult = (activeProfile && product) ? runUnifiedEvaluation(product, activeProfile, aiVerdictRecord, trustedProduct) : null;
  const confidence = unifiedResult ? unifiedResult.confidence : null;
  
  const handleToggleFavorite = async () => {
    if (!activeProfile) return;
    
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    try {
      if (isFav) {
        const favorites = await getFavorites();
        const fav = favorites.find(f => f.product.code === code && f.profileId === activeProfile.id);
        if (fav) {
          await removeFromFavorites(fav.id);
          setIsFav(false);
        }
      } else {
        await addToFavorites({
          id: `${code}_${activeProfile.id}_${Date.now()}`,
          product,
          profileId: activeProfile.id,
          addedAt: new Date().toISOString(),
        });
        setIsFav(true);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Error', 'Failed to update favorites');
    }
  };

  const handleToggleAvoid = async () => {
    if (!activeProfile || !product) return;

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    try {
      if (isAvoided) {
        const avoidItems = await getAvoidList(currentUser?.id);
        const item = avoidItems.find(a => a.product.code === code && a.profileId === activeProfile.id);
        if (item) {
          await removeFromAvoidList(item.id, currentUser?.id);
          setIsAvoided(false);
          Alert.alert('Removed', 'Product removed from your avoid list');
        }
      } else {
        const reason = verdict?.level === 'danger'
          ? `Contains allergens: ${verdict.matches.map(m => m.allergen).join(', ')}`
          : verdict?.level === 'caution'
            ? `May contain traces of allergens`
            : undefined;
        await addToAvoidList({
          id: `${code}_${activeProfile.id}_${Date.now()}`,
          product,
          profileId: activeProfile.id,
          reason,
          addedAt: new Date().toISOString(),
        }, currentUser?.id);
        setIsAvoided(true);
        Alert.alert('Added', 'Product added to your avoid list');
      }
    } catch (error) {
      console.error('Error toggling avoid:', error);
      Alert.alert('Error', 'Failed to update avoid list');
    }
  };

  const confidenceScore = confidence?.score ?? 50;

  const handleAddToShoppingList = async () => {
    if (!product) return;
    
    setIsAddingToList(true);
    try {
      await addToShoppingList({
        id: `${code}_${Date.now()}`,
        product,
        name: product.product_name || 'Unknown Product',
        barcode: code,
        checked: false,
        addedAt: new Date().toISOString(),
        profileId: activeProfile?.id,
      });
      
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      
      Alert.alert('Added', 'Product added to shopping list');
    } catch (error) {
      console.error('Error adding to shopping list:', error);
      Alert.alert('Error', 'Failed to add to shopping list');
    } finally {
      setIsAddingToList(false);
    }
  };

  const handleAiReply = async () => {
    const userMessage = aiReplyInput.trim();
    if (!userMessage || isAiReplying) return;
    
    setAiConversation(prev => [...prev, { role: 'user', text: userMessage }]);
    setAiReplyInput('');
    setIsAiReplying(true);
    
    try {
      const context = alternativeRecommendations || noDataAlternatives;
      const allergenList = activeProfile?.allergens.join(', ') || 'unknown';
      
      const conversationHistory = aiConversation.map(msg => 
        `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.text}`
      ).join('\n');
      
      const prompt = `You are a helpful allergen-safety assistant for the SafeBite app.

Product: ${product?.product_name || 'Unknown'}
Brand: ${product?.brands || 'Unknown'}
User's Allergies: ${allergenList}

Previous recommendations:
${context}

${conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n` : ''}User's follow-up question: ${userMessage}

Provide a helpful, specific answer. Keep it concise but thorough. If recommending products, include brand names and where to find them. Always remind to verify labels.`;

      const reply = await generateText({
        messages: [{ role: 'user', content: prompt }],
      });
      
      setAiConversation(prev => [...prev, { role: 'ai', text: reply }]);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
    } catch (error) {
      console.error('[ProductDetail] AI reply error:', error);
      setAiConversation(prev => [...prev, { role: 'ai', text: 'Sorry, I couldn\'t process your question right now. Please try again.' }]);
    } finally {
      setIsAiReplying(false);
    }
  };

  const handleShare = async () => {
    if (!product) return;
    
    try {
      const productName = product.product_name || 'this product';
      const verdictText = verdict ? `\nSafety Rating: ${getVerdictLabel(verdict.level)}` : '';
      const allergenInfo = verdict && verdict.matches.length > 0 
        ? `\nAllergens Detected: ${verdict.matches.map(m => m.allergen).join(', ')}`
        : '';
      
      const message = `🛡️ Allergy Guardian Product Check\n\n${productName}\nBarcode: ${code}${verdictText}${allergenInfo}\n\nScanned with Allergy Guardian - Your personal allergy safety companion`;
      
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: `${productName} - Allergy Guardian`,
            text: message,
          });
        } else {
          await navigator.clipboard.writeText(message);
          Alert.alert('Copied!', 'Product information copied to clipboard');
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Share = require('react-native').Share;
        await Share.share({
          message: message,
          title: `${productName} - Allergy Guardian`,
        });
      }
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error('Error sharing:', error);
      }
    }
  };

  if (__DEV__) console.log('[ProductDetail] Rendering:', product.product_name, 'verdict:', verdict?.level);

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Stack.Screen 
        options={{ 
          title: product.product_name || 'Product',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 16, marginRight: 16 }}>
              <TouchableOpacity onPress={handleShare}>
                <Share2 size={24} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleToggleFavorite}>
                <Heart 
                  size={24} 
                  color={isFav ? '#DC2626' : '#6B7280'}
                  fill={isFav ? '#DC2626' : 'none'}
                />
              </TouchableOpacity>
            </View>
          ),
        }} 
      />
      <ScrollView ref={scrollViewRef} style={styles.container} contentContainerStyle={styles.scrollContent}>
        {activeFamilyGroup && activeFamilyGroup.memberIds.length > 1 && (
          <View style={styles.viewModeSection}>
            <ViewModeToggle />
          </View>
        )}

        {product.image_front_url && product.image_front_url.trim() !== '' && (
          <Image
            source={{ uri: product.image_front_url }}
            style={styles.productImage}
            resizeMode="contain"
          />
        )}

        <View style={[styles.verdictCard, { borderColor: verdict?.missingData ? '#F59E0B' : verdictColor }]}>
          <View style={[styles.verdictBadge, { backgroundColor: verdict?.missingData ? '#F59E0B' : verdictColor }]}>
            <VerdictIcon size={32} color="#FFFFFF" />
          </View>
          <View style={styles.verdictContent}>
            <Text style={[styles.verdictLabel, { color: verdict?.missingData ? '#F59E0B' : verdictColor }]}>
              {verdict?.missingData ? 'We Need More Info' : verdictLabel}
            </Text>
            {verdict && (
              <Text style={styles.verdictMessage}>
                {buildVerdictMessage(verdict.level, activeProfile?.name || 'you', verdict.missingData)}
              </Text>
            )}
            {viewMode === 'family' && activeFamilyGroup && affectedMembers.length > 0 ? (
              <Text style={styles.verdictProfile}>Family View: {activeFamilyGroup.name}</Text>
            ) : activeProfile ? (
              <Text style={styles.verdictProfile}>For: {activeProfile.name}</Text>
            ) : null}
          </View>
        </View>

        {aiVerdictRecord && verdict && (() => {
          const engineResult = activeProfile ? evaluateProduct(product, activeProfile) : null;
          const ruleLevel = engineResult ? evalVerdictToLegacyLevel(engineResult.verdict) : null;
          const aiLevel = aiVerdictRecord.aiVerdict;
          const hasMismatch = ruleLevel !== aiLevel;

          if (!hasMismatch && !aiAdjusted) return null;

          return (
            <View style={styles.splitVerdictSection}>
              {hasMismatch && (
                <View style={styles.splitVerdictRow}>
                  <View style={styles.splitVerdictItem}>
                    <Text style={styles.splitVerdictLabel}>Preliminary Check</Text>
                    <View style={[styles.splitVerdictBadge, { backgroundColor: getVerdictColor(ruleLevel || 'safe') + '18', borderColor: getVerdictColor(ruleLevel || 'safe') }]}>
                      <Text style={[styles.splitVerdictBadgeText, { color: getVerdictColor(ruleLevel || 'safe') }]}>
                        {getVerdictLabel(ruleLevel || 'safe')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.splitVerdictArrow}>
                    <Text style={styles.splitVerdictArrowText}>→</Text>
                  </View>
                  <View style={styles.splitVerdictItem}>
                    <Text style={styles.splitVerdictLabel}>AI Review</Text>
                    <View style={[styles.splitVerdictBadge, { backgroundColor: getVerdictColor(aiLevel) + '18', borderColor: getVerdictColor(aiLevel) }]}>
                      <Text style={[styles.splitVerdictBadgeText, { color: getVerdictColor(aiLevel) }]}>
                        {aiLevel === 'safe' ? 'AI-VERIFIED SAFE' : aiLevel === 'caution' ? 'AI: CAUTION' : 'AI: UNSAFE'}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {hasMismatch && (
                <TouchableOpacity
                  style={styles.mismatchToggle}
                  onPress={() => setShowMismatchExplainer(!showMismatchExplainer)}
                >
                  <AlertTriangle size={14} color="#D97706" />
                  <Text style={styles.mismatchToggleText}>Why the mismatch?</Text>
                  {showMismatchExplainer ? <ChevronUp size={16} color="#D97706" /> : <ChevronDown size={16} color="#D97706" />}
                </TouchableOpacity>
              )}

              {hasMismatch && showMismatchExplainer && (
                <View style={styles.mismatchExplainer}>
                  <Text style={styles.mismatchExplainerText}>
                    The preliminary check uses automated rules that match allergen tags, traces, and ingredient keywords. It can flag false positives from:
                  </Text>
                  <Text style={styles.mismatchExplainerBullet}>{'  • Generic "may contain" trace warnings'}</Text>
                  <Text style={styles.mismatchExplainerBullet}>  • Outdated or cached product data</Text>
                  <Text style={styles.mismatchExplainerBullet}>  • Overly broad keyword matches</Text>
                  <Text style={styles.mismatchExplainerText}>
                    The AI review analyzes the full ingredient list in context and may determine the product is actually safe for your profile.
                  </Text>
                  <View style={styles.mismatchDisclaimer}>
                    <AlertCircle size={12} color="#92400E" />
                    <Text style={styles.mismatchDisclaimerText}>
                      Always read the physical label. This is educational only — not medical advice.
                    </Text>
                  </View>
                </View>
              )}

              {!aiAdjusted && !aiConflict && !hasMismatch && (
                <View style={styles.aiUpdatedBanner}>
                  <ShieldCheck size={18} color="#065F46" />
                  <Text style={styles.aiUpdatedText}>AI analysis confirms the preliminary verdict</Text>
                </View>
              )}
            </View>
          );
        })()}

        {aiAdjusted && (
          <View style={styles.aiUpdatedBanner}>
            <ShieldCheck size={18} color="#065F46" />
            <Text style={styles.aiUpdatedText}>Updated after expert AI analysis</Text>
          </View>
        )}

        {aiConflict && aiVerdictRecord && (
          <View style={styles.aiConflictBanner}>
            <AlertCircle size={18} color="#991B1B" />
            <View style={{ flex: 1 }}>
              <Text style={styles.aiConflictTitle}>AI / Rule-Based Conflict</Text>
              <Text style={styles.aiConflictText}>
                {aiVerdictRecord.conflictReason || 'The AI assessment differs from the rule-based check. Please review carefully.'}
              </Text>
            </View>
          </View>
        )}

        {aiVerdictRecord && activeProfile && !trustedProduct && (aiAdjusted || (aiVerdictRecord.aiVerdict === 'safe')) && (
          <TouchableOpacity
            style={styles.trustButton}
            onPress={async () => {
              await markProductTrusted(code, activeProfile.id, currentUser?.id, 'AI review confirmed safe');
              setTrustedProduct({ productCode: code, profileId: activeProfile.id, trustedAt: new Date().toISOString(), reason: 'AI review confirmed safe' });
              if (Platform.OS !== 'web') {
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              Alert.alert('Trusted', 'This product has been marked as trusted for this profile. You can remove this any time.');
            }}
          >
            <ShieldCheck size={18} color="#059669" />
            <Text style={styles.trustButtonText}>Mark as Trusted for {activeProfile.name}</Text>
          </TouchableOpacity>
        )}

        {trustedProduct && activeProfile && (
          <View style={styles.trustedBanner}>
            <View style={styles.trustedBannerContent}>
              <ShieldCheck size={18} color="#059669" />
              <View style={{ flex: 1 }}>
                <Text style={styles.trustedBannerTitle}>Trusted Product</Text>
                <Text style={styles.trustedBannerText}>
                  Marked trusted on {new Date(trustedProduct.trustedAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.removeTrustButton}
              onPress={async () => {
                await removeTrustedProduct(code, activeProfile.id, currentUser?.id);
                setTrustedProduct(null);
                if (Platform.OS !== 'web') {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
            >
              <Text style={styles.removeTrustButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}

        {householdVerdict && householdVerdict.memberVerdicts.length > 1 && (
          <HouseholdVerdictCard
            householdVerdict={householdVerdict}
            familyGroupName={activeFamilyGroup?.name}
            testID="household-verdict-card"
          />
        )}

        {activeProfile && product && verdict && verdict.level !== 'safe' && (
          <BetterOptionCard
            product={product}
            profile={activeProfile}
            verdict={verdict}
            testID="better-option-card"
          />
        )}

        {'explanation' in (verdict || {}) && (verdict as any)?.explanation && (
          <View style={styles.whyResultCard}>
            <Text style={styles.whyResultTitle}>Why this result?</Text>
            <Text style={styles.whyResultText}>{(verdict as any).explanation}</Text>
          </View>
        )}

        {product && (
          <ConfidenceScoreBar
            score={confidenceScore}
            testID="confidence-score-bar"
          />
        )}

        {product && (
          <ManufacturerWarningsCard
            product={product}
            testID="manufacturer-warnings-card"
          />
        )}

        {activeProfile && product && (
          <DietaryCompatibilityCard
            product={product}
            profile={activeProfile}
            testID="dietary-compatibility-card"
          />
        )}

        {activeProfile && product && (
          <DietaryRestrictionVerdictCard
            product={product}
            profile={activeProfile}
            testID="dietary-restriction-verdict-card"
          />
        )}

        {activeProfile && product && (
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonShoppingList]}
              onPress={handleAddToShoppingList}
              disabled={isAddingToList}
              activeOpacity={0.7}
            >
              <ShoppingCart size={18} color="#0891B2" />
              <Text style={styles.actionButtonTextShoppingList}>
                {isAddingToList ? 'Adding...' : 'Shopping List'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, isAvoided ? styles.actionButtonAvoidActive : styles.actionButtonAvoid]}
              onPress={handleToggleAvoid}
              activeOpacity={0.7}
            >
              <Ban size={18} color={isAvoided ? '#FFFFFF' : '#DC2626'} />
              <Text style={[styles.actionButtonTextAvoid, isAvoided && styles.actionButtonTextAvoidActive]}>
                {isAvoided ? 'Avoided' : 'Avoid'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {verdict && verdict.missingData && showNoDataAlternatives && (
          <View style={styles.alternativesSection}>
            <View style={styles.alternativesHeader}>
              <Lightbulb size={28} color="#10B981" />
              <Text style={styles.alternativesTitle}>Recommended Safe Alternatives</Text>
            </View>
            
            {isLoadingNoDataAlternatives ? (
              <View style={styles.alternativesLoading}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.alternativesLoadingText}>Finding products with clear labels...</Text>
                <Text style={styles.alternativesLoadingSubtext}>Searching for alternatives free from {activeProfile?.allergens.join(', ')}</Text>
              </View>
            ) : (
              <View style={styles.alternativesCard}>
                <View style={styles.alternativesIntro}>
                  <Text style={styles.alternativesIntroText}>
                    💡 Since this product has no ingredient data, here are alternatives with clear labeling that are free from your allergens:
                  </Text>
                </View>
                <Text style={styles.alternativesText}>{noDataAlternatives}</Text>
                <View style={styles.alternativesDisclaimer}>
                  <AlertCircle size={14} color="#F59E0B" />
                  <Text style={styles.alternativesDisclaimerText}>
                    Always verify ingredients on product labels before purchasing. When possible, contact manufacturers directly.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {verdict && verdict.missingData && !showNoDataAlternatives && (
          <View style={[styles.recommendationCard, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
            <Text style={styles.recommendationTitle}>
              We Need More Info
            </Text>
            <Text style={styles.recommendationText}>
              {`We couldn't fully verify this product yet. Ingredient data is missing from our databases.`}
              {activeProfile && activeProfile.hasAnaphylaxis && `\n\nGiven your sensitivity level, please verify the physical label before using.`}
            </Text>
            <TouchableOpacity
              style={styles.contributeProductBtn}
              onPress={() => router.push(`/manual-ingredient-entry?code=${code}&productName=${encodeURIComponent(product.product_name || '')}` as Href)}
              activeOpacity={0.7}
            >
              <Text style={styles.contributeProductBtnText}>Scan Ingredients Label</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.contributeProductBtn, { backgroundColor: '#F3F4F6', marginTop: 8 }]}
              onPress={() => router.push(`/manual-ingredient-entry?code=${code}&productName=${encodeURIComponent(product.product_name || '')}` as Href)}
              activeOpacity={0.7}
            >
              <Text style={[styles.contributeProductBtnText, { color: '#374151' }]}>Add Product Details</Text>
            </TouchableOpacity>
          </View>
        )}

        {verdict && !verdict.missingData && (
          <View style={[styles.recommendationCard, getRecommendationStyle(verdict.level)]}>
            <Text style={styles.recommendationTitle}>
              {getRecommendationTitle(verdict.level)}
            </Text>
            <Text style={styles.recommendationText}>
              {getRecommendationMessage(verdict.level, activeProfile)}
            </Text>
          </View>
        )}

        {verdict && verdict.level !== 'safe' && (
          <TouchableOpacity
            style={styles.exposureGuidanceButton}
            onPress={() => router.push('/exposure-guidance' as Href)}
          >
            <AlertCircle size={24} color="#FFFFFF" />
            <View style={styles.exposureGuidanceContent}>
              <Text style={styles.exposureGuidanceTitle}>Exposure Response Guide</Text>
              <Text style={styles.exposureGuidanceSubtitle}>
                What to do if you have skin contact, inhaled, or severe reaction
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {verdict && verdict.level === 'caution' && showAlternatives && (
          <View style={styles.alternativesSection}>
            <View style={styles.alternativesHeader}>
              <Lightbulb size={28} color="#F59E0B" />
              <Text style={[styles.alternativesTitle, { color: '#F59E0B' }]}>Safer Alternative Products</Text>
            </View>
            
            {isLoadingAlternatives ? (
              <View style={[styles.alternativesLoading, { borderColor: '#F59E0B' }]}>
                <ActivityIndicator size="large" color="#F59E0B" />
                <Text style={styles.alternativesLoadingText}>Finding safer alternatives...</Text>
                <Text style={styles.alternativesLoadingSubtext}>Looking for products without {verdict.matches.map((m: any) => m.allergen).join(', ')}</Text>
              </View>
            ) : (
              <View style={[styles.alternativesCard, { borderColor: '#F59E0B' }]}>
                <View style={[styles.alternativesIntro, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
                  <Text style={[styles.alternativesIntroText, { color: '#92400E' }]}>
                    ⚡ Due to cross-contamination risk, consider these alternatives that are produced in facilities free from {verdict.matches.map((m: any) => m.allergen).join(', ')}:
                  </Text>
                </View>
                <Text style={styles.alternativesText}>{alternativeRecommendations}</Text>
                <View style={styles.alternativesDisclaimer}>
                  <AlertCircle size={14} color="#F59E0B" />
                  <Text style={styles.alternativesDisclaimerText}>
                    Always verify ingredients and manufacturing processes. Contact manufacturers about cross-contamination policies.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {verdict && verdict.level === 'danger' && showAlternatives && (
          <View style={styles.alternativesSection}>
            <View style={styles.alternativesHeader}>
              <Lightbulb size={28} color="#10B981" />
              <Text style={styles.alternativesTitle}>Safe Alternative Products</Text>
            </View>
            
            {isLoadingAlternatives ? (
              <View style={styles.alternativesLoading}>
                <ActivityIndicator size="large" color="#10B981" />
                <Text style={styles.alternativesLoadingText}>AI is finding safe alternatives...</Text>
                <Text style={styles.alternativesLoadingSubtext}>Analyzing products without {verdict.matches.map((m: any) => m.allergen).join(', ')}</Text>
              </View>
            ) : (
              <View style={styles.alternativesCard}>
                <View style={styles.alternativesIntro}>
                  <Text style={styles.alternativesIntroText}>
                    🛡️ These alternatives are recommended based on your allergy profile and are free from {verdict.matches.map((m: any) => m.allergen).join(', ')}:
                  </Text>
                </View>
                <Text style={styles.alternativesText}>{alternativeRecommendations}</Text>
                <View style={styles.alternativesDisclaimer}>
                  <AlertCircle size={14} color="#F59E0B" />
                  <Text style={styles.alternativesDisclaimerText}>
                    Always verify ingredients on product labels before purchasing. Formulations can change.
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {showAlternatives && !isLoadingAlternatives && (alternativeRecommendations || noDataAlternatives) && (
          <View style={styles.aiReplySection}>
            <View style={styles.aiReplyHeader}>
              <MessageCircle size={20} color="#0891B2" />
              <Text style={styles.aiReplyHeaderText}>Ask a follow-up question</Text>
            </View>
            
            {aiConversation.length > 0 && (
              <View style={styles.aiConversationThread}>
                {aiConversation.map((msg, idx) => (
                  <View key={idx} style={[
                    styles.aiConversationBubble,
                    msg.role === 'user' ? styles.aiConversationUser : styles.aiConversationAi,
                  ]}>
                    <Text style={[
                      styles.aiConversationRole,
                      msg.role === 'user' ? styles.aiConversationRoleUser : styles.aiConversationRoleAi,
                    ]}>
                      {msg.role === 'user' ? 'You' : 'SafeBite AI'}
                    </Text>
                    <Text style={[
                      styles.aiConversationText,
                      msg.role === 'user' ? styles.aiConversationTextUser : styles.aiConversationTextAi,
                    ]}>
                      {msg.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            
            {isAiReplying && (
              <View style={styles.aiReplyLoading}>
                <ActivityIndicator size="small" color="#0891B2" />
                <Text style={styles.aiReplyLoadingText}>Thinking...</Text>
              </View>
            )}
            
            <View style={styles.aiReplyInputRow}>
              <TextInput
                style={styles.aiReplyInput}
                placeholder="e.g. Are any of these nut-free too?"
                placeholderTextColor="#9CA3AF"
                value={aiReplyInput}
                onChangeText={setAiReplyInput}
                multiline
                editable={!isAiReplying}
                returnKeyType="send"
                onSubmitEditing={() => {
                  if (aiReplyInput.trim() && !isAiReplying) void handleAiReply();
                }}
              />
              <TouchableOpacity
                style={[
                  styles.aiReplySendButton,
                  (!aiReplyInput.trim() || isAiReplying) && styles.aiReplySendButtonDisabled,
                ]}
                onPress={handleAiReply}
                disabled={!aiReplyInput.trim() || isAiReplying}
              >
                <Send size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {!product.ingredients_text && !product.allergens_tags && !product.traces_tags && (
          <View style={styles.section}>
            <View style={styles.missingDataWarning}>
              <HelpCircle size={40} color="#F59E0B" />
              <Text style={styles.missingDataTitle}>Help Improve This Product</Text>
              <Text style={styles.missingDataText}>
                {`This product doesn't have ingredient info in our databases yet. You can help by adding it!`}
              </Text>
              <TouchableOpacity
                style={styles.contributeProductBtn}
                onPress={() => router.push(`/manual-ingredient-entry?code=${code}&productName=${encodeURIComponent(product.product_name || '')}` as Href)}
                activeOpacity={0.7}
              >
                <Text style={styles.contributeProductBtnText}>Scan Ingredients Label</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contributeProductBtn, { backgroundColor: '#F3F4F6', marginTop: 8 }]}
                onPress={() => router.push(`/manual-ingredient-entry?code=${code}&productName=${encodeURIComponent(product.product_name || '')}` as Href)}
                activeOpacity={0.7}
              >
                <Text style={[styles.contributeProductBtnText, { color: '#374151' }]}>Add Details Manually</Text>
              </TouchableOpacity>
              <Text style={styles.contributeHelpText}>
                Your contribution helps everyone who scans this product in the future.
              </Text>
            </View>
          </View>
        )}

        {verdict && verdict.matches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detected Allergens</Text>
            {verdict.matches.map((match, index) => (
              <View key={index} style={styles.matchCard}>
                <View style={styles.matchHeader}>
                  <Text style={styles.matchAllergen}>{match.allergen}</Text>
                  <View style={[styles.matchBadge, getSourceBadgeStyle(match.source)]}>
                    <Text style={styles.matchBadgeText}>{getSourceLabel(match.source)}</Text>
                  </View>
                </View>
                {match.matchedText && (
                  <Text style={styles.matchText}>Matched: {match.matchedText}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Product Information</Text>
          {(() => {
            const pType = product.product_type || guessProductType(product.ingredients_text, product.product_name, product.categories);
            const typeColor = getProductTypeColor(pType);
            return (
              <View style={[styles.productTypeBadge, { backgroundColor: typeColor + '15', borderColor: typeColor }]}>
                <Text style={styles.productTypeEmoji}>{getProductTypeEmoji(pType)}</Text>
                <Text style={[styles.productTypeLabel, { color: typeColor }]}>{getProductTypeLabel(pType)}</Text>
              </View>
            );
          })()}
          <View style={styles.infoCard}>
            <InfoRow label="Name" value={product.product_name || 'Unknown'} />
            {product.brands && <InfoRow label="Brand" value={product.brands} />}
            <InfoRow label="Barcode" value={code} />
            {product.categories && <InfoRow label="Categories" value={product.categories} />}
          </View>
          {product.product_name && (
            <TranslationCard
              label="Product Name"
              text={product.product_name}
              compact
              autoTranslate
              testID="translation-product-name"
            />
          )}
        </View>

        {analyzedIngredients.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ingredient Analysis</Text>
              {(() => {
                const safety = getOverallSafetyScore(analyzedIngredients);
                const color = safety.rating === 'excellent' || safety.rating === 'good' ? '#10B981' : 
                             safety.rating === 'fair' ? '#F59E0B' : '#DC2626';
                return (
                  <View style={[styles.safetyBadge, { backgroundColor: color + '20', borderColor: color }]}>
                    <Text style={[styles.safetyScore, { color }]}>{safety.score}/100</Text>
                  </View>
                );
              })()}
            </View>
            
            {(() => {
              const safety = getOverallSafetyScore(analyzedIngredients);
              if (safety.harmfulCount > 0 || safety.concerningCount > 0) {
                return (
                  <View style={styles.safetyAlert}>
                    <AlertCircle size={20} color="#DC2626" />
                    <Text style={styles.safetyAlertText}>
                      Found {safety.harmfulCount} harmful and {safety.concerningCount} concerning ingredients
                    </Text>
                  </View>
                );
              }
              return null;
            })()}
            
            {analyzedIngredients.map((ingredient, index) => {
              const isExpanded = expandedIngredients.has(ingredient.name);
              const hasInfo = ingredient.concerns.length > 0 || ingredient.description;
              
              const getBgColor = () => {
                if (ingredient.safetyRating === 'harmful') return '#FEE2E2';
                if (ingredient.safetyRating === 'concerning') return '#FEF3C7';
                if (ingredient.safetyRating === 'moderate') return '#FEF9C3';
                return '#F3F4F6';
              };
              
              const getBorderColor = () => {
                if (ingredient.safetyRating === 'harmful') return '#DC2626';
                if (ingredient.safetyRating === 'concerning') return '#F59E0B';
                if (ingredient.safetyRating === 'moderate') return '#EAB308';
                return '#E5E7EB';
              };
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.ingredientCard, { backgroundColor: getBgColor(), borderColor: getBorderColor() }]}
                  onPress={() => {
                    if (hasInfo) {
                      const newExpanded = new Set(expandedIngredients);
                      if (isExpanded) {
                        newExpanded.delete(ingredient.name);
                      } else {
                        newExpanded.add(ingredient.name);
                      }
                      setExpandedIngredients(newExpanded);
                    }
                  }}
                  disabled={!hasInfo}
                >
                  <View style={styles.ingredientHeader}>
                    <View style={styles.ingredientNameContainer}>
                      <Text style={styles.ingredientName}>{ingredient.name}</Text>
                      <View style={[styles.categoryBadge, getCategoryStyle(ingredient.category)]}>
                        <Text style={styles.categoryText}>{ingredient.category}</Text>
                      </View>
                    </View>
                    {hasInfo && (
                      isExpanded ? <ChevronUp size={20} color="#6B7280" /> : <ChevronDown size={20} color="#6B7280" />
                    )}
                  </View>
                  
                  {isExpanded && (
                    <View style={styles.ingredientDetails}>
                      {ingredient.description && (
                        <Text style={styles.ingredientDescription}>{ingredient.description}</Text>
                      )}
                      
                      {ingredient.concerns.length > 0 && (
                        <View style={styles.concernsSection}>
                          <Text style={styles.concernsTitle}>⚠️ Health Concerns:</Text>
                          {ingredient.concerns.map((concern, i) => (
                            <Text key={i} style={styles.concernText}>• {concern}</Text>
                          ))}
                        </View>
                      )}
                      
                      {ingredient.commonUses.length > 0 && (
                        <View style={styles.usesSection}>
                          <Text style={styles.usesTitle}>Common in:</Text>
                          <Text style={styles.usesText}>{ingredient.commonUses.join(', ')}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
        
        {product.ingredients_text && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Raw Ingredients List</Text>
            <View style={styles.ingredientsCard}>
              <Text style={styles.ingredientsText}>{product.ingredients_text}</Text>
            </View>
            <TranslationCard
              label="Ingredients"
              text={product.ingredients_text}
              autoTranslate
              testID="translation-ingredients"
            />
          </View>
        )}

        {product.allergens && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Listed Allergens</Text>
            <View style={styles.infoCard}>
              <Text style={styles.allergensText}>{product.allergens}</Text>
            </View>
          </View>
        )}

        {product.traces && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>May Contain Traces</Text>
            <View style={styles.infoCard}>
              <Text style={styles.tracesText}>{product.traces}</Text>
            </View>
          </View>
        )}

        {recalls.length > 0 && (
          <View style={styles.section}>
            <View style={styles.recallHeader}>
              <AlertCircle size={24} color="#DC2626" />
              <Text style={styles.recallTitle}>FDA Recalls Found</Text>
            </View>
            {recalls.map((recall, index) => (
              <View key={index} style={styles.recallCard}>
                <Text style={styles.recallReason}>{recall.reason_for_recall}</Text>
                <Text style={styles.recallDate}>
                  {new Date(recall.recall_initiation_date).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.shoppingListButton, isAddingToList && styles.actionButtonDisabled]}
            onPress={handleAddToShoppingList}
            disabled={isAddingToList}
          >
            <ShoppingCart size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>
              {isAddingToList ? 'Adding...' : 'Add to Shopping List'}
            </Text>
          </TouchableOpacity>
        </View>

        {activeProfile && product.ingredients_text && (
          <TouchableOpacity
            style={styles.aiButton}
            onPress={() => router.push(`/ai-analysis/${code}` as Href)}
          >
            <Sparkles size={24} color="#FFFFFF" />
            <View style={styles.aiButtonContent}>
              <Text style={styles.aiButtonTitle}>Get AI Analysis</Text>
              <Text style={styles.aiButtonSubtitle}>Detailed ingredient breakdown powered by AI</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.sourceCard}>
          <Text style={styles.sourceText}>
            Source: {product.source === 'manual_entry' ? 'Manual Entry (Your Device)' : product.source === 'openfoodfacts' ? 'Open Food Facts' : product.source === 'openbeautyfacts' ? 'Open Beauty Facts' : product.source}
          </Text>
          {product.source === 'manual_entry' && (
            <TouchableOpacity
              style={styles.editManualButton}
              onPress={() => router.push(`/manual-ingredient-entry?code=${code}&productName=${encodeURIComponent(product.product_name || '')}` as Href)}
            >
              <Text style={styles.editManualButtonText}>Edit Manual Entry</Text>
            </TouchableOpacity>
          )}
        </View>

        <LegalDisclaimer
          hasAnaphylaxis={activeProfile?.hasAnaphylaxis}
          variant="compact"
          testID="legal-disclaimer"
        />
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function getSourceLabel(source: string): string {
  switch (source) {
    case 'allergens_tags':
      return 'Listed Allergen';
    case 'traces_tags':
      return 'Trace';
    case 'ingredients':
      return 'Ingredient';
    case 'custom_keyword':
      return 'Custom Keyword';
    default:
      return source;
  }
}

function getSourceBadgeStyle(source: string) {
  switch (source) {
    case 'allergens_tags':
    case 'ingredients':
    case 'custom_keyword':
      return { backgroundColor: '#FEE2E2' };
    case 'traces_tags':
      return { backgroundColor: '#FEF3C7' };
    default:
      return { backgroundColor: '#F3F4F6' };
  }
}

function getRecommendationTitle(level: string): string {
  switch (level) {
    case 'danger':
      return 'Not Safe — Allergen Detected';
    case 'caution':
      return 'Partially Verified — Review Recommended';
    case 'safe':
      return 'Safe to Use — No Issues Found';
    default:
      return 'Needs Review';
  }
}

function getRecommendationMessage(level: string, profile: any): string {
  const hasAnaphylaxis = profile?.hasAnaphylaxis;
  const name = profile?.name || 'you';
  
  switch (level) {
    case 'danger':
      return hasAnaphylaxis
        ? `This product contains ingredients that may affect ${name}. Avoid this product. If accidentally exposed, use your epinephrine auto-injector and call 911.`
        : `This product contains ingredients that may affect ${name}. We recommend choosing a different product. Always verify with the physical label.`;
    
    case 'caution':
      return hasAnaphylaxis
        ? `We checked what we could, but some details are unclear. Given ${name}'s sensitivity level, we recommend choosing a verified alternative.`
        : `We checked what we could, but some details are unclear for ${name}. Consider verifying the label or choosing a product with clearer ingredient data.`;
    
    case 'safe':
      return `This product looks safe for ${name} based on available data. No allergen matches found. Always double-check the physical label as formulations can change.`;
    
    default:
      return `We couldn't fully verify this product. Please check the label directly.`;
  }
}

function getRecommendationStyle(level: string) {
  switch (level) {
    case 'danger':
      return { backgroundColor: '#FEE2E2', borderColor: '#DC2626' };
    case 'caution':
      return { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' };
    case 'safe':
      return { backgroundColor: '#D1FAE5', borderColor: '#10B981' };
    default:
      return { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' };
  }
}

function getCategoryStyle(category: string) {
  switch (category) {
    case 'harmful':
    case 'artificial':
      return { backgroundColor: '#FEE2E2' };
    case 'concerning':
    case 'preservative':
      return { backgroundColor: '#FEF3C7' };
    case 'processed':
    case 'additive':
      return { backgroundColor: '#FEF9C3' };
    case 'natural':
      return { backgroundColor: '#D1FAE5' };
    default:
      return { backgroundColor: '#F3F4F6' };
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F9FAFB' },
  scrollContent: { padding: 16 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6B7280' },
  errorSubtext: { marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 8 },
  errorText: { marginTop: 16, fontSize: 18, fontWeight: '600' as const, color: '#374151', textAlign: 'center' },
  retryButton: { marginTop: 24, backgroundColor: '#0891B2', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  retryButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#FFF' },
  productImage: { width: '100%', height: 250, borderRadius: 16, backgroundColor: '#FFF', marginBottom: 16 },
  verdictCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  verdictBadge: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  verdictContent: { flex: 1, justifyContent: 'center' },
  verdictLabel: { fontSize: 24, fontWeight: '700' as const, marginBottom: 4 },
  verdictMessage: { fontSize: 16, color: '#111827', marginBottom: 4 },
  verdictProfile: { fontSize: 14, color: '#6B7280' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700' as const, color: '#111827', marginBottom: 12 },
  matchCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#FEE2E2' },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  matchAllergen: { fontSize: 16, fontWeight: '700' as const, color: '#111827' },
  matchBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  matchBadgeText: { fontSize: 12, fontWeight: '600' as const, color: '#111827' },
  matchText: { fontSize: 14, color: '#6B7280' },
  infoCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: 14, fontWeight: '600' as const, color: '#6B7280' },
  infoValue: { fontSize: 14, color: '#111827', flex: 1, textAlign: 'right' },
  ingredientsCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  ingredientsText: { fontSize: 14, color: '#111827', lineHeight: 22 },
  allergensText: { fontSize: 14, color: '#DC2626', fontWeight: '600' as const },
  tracesText: { fontSize: 14, color: '#F59E0B', fontWeight: '600' as const },
  recallHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  recallTitle: { fontSize: 20, fontWeight: '700' as const, color: '#DC2626' },
  recallCard: { backgroundColor: '#FEE2E2', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#DC2626' },
  recallReason: { fontSize: 14, fontWeight: '600' as const, color: '#111827', marginBottom: 4 },
  recallDate: { fontSize: 12, color: '#6B7280' },
  sourceCard: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, marginBottom: 16 },
  sourceText: { fontSize: 12, color: '#6B7280', textAlign: 'center' },
  disclaimer: { flexDirection: 'row', gap: 8, padding: 16, backgroundColor: '#FEF3C7', borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B' },
  disclaimerText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
  whyResultCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  whyResultTitle: { fontSize: 14, fontWeight: '700' as const, color: '#374151', marginBottom: 8 },
  whyResultText: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  recommendationCard: { borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  recommendationTitle: { fontSize: 18, fontWeight: '700' as const, color: '#111827', marginBottom: 12, lineHeight: 24 },
  recommendationText: { fontSize: 15, color: '#111827', lineHeight: 24 },
  aiUpdatedBanner: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, backgroundColor: '#D1FAE5', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#6EE7B7' },
  aiUpdatedText: { fontSize: 13, fontWeight: '600' as const, color: '#065F46' },
  aiConflictBanner: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 10, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: '#FCA5A5' },
  aiConflictTitle: { fontSize: 14, fontWeight: '700' as const, color: '#991B1B', marginBottom: 4 },
  aiConflictText: { fontSize: 13, color: '#7F1D1D', lineHeight: 18 },
  splitVerdictSection: { marginBottom: 16 },
  splitVerdictRow: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
  splitVerdictItem: { flex: 1, alignItems: 'center' as const, gap: 6 },
  splitVerdictLabel: { fontSize: 11, fontWeight: '600' as const, color: '#6B7280', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  splitVerdictBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1.5 },
  splitVerdictBadgeText: { fontSize: 12, fontWeight: '700' as const },
  splitVerdictArrow: { paddingHorizontal: 8 },
  splitVerdictArrowText: { fontSize: 18, color: '#9CA3AF', fontWeight: '600' as const },
  mismatchToggle: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingVertical: 8, paddingHorizontal: 4 },
  mismatchToggleText: { fontSize: 13, fontWeight: '600' as const, color: '#D97706', flex: 1 },
  mismatchExplainer: { backgroundColor: '#FFFBEB', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#FDE68A' },
  mismatchExplainerText: { fontSize: 13, color: '#78350F', lineHeight: 20, marginBottom: 6 },
  mismatchExplainerBullet: { fontSize: 13, color: '#92400E', lineHeight: 20, marginBottom: 2 },
  mismatchDisclaimer: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#FDE68A' },
  mismatchDisclaimerText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16 },
  trustButton: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 8, backgroundColor: '#D1FAE5', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: '#6EE7B7' },
  trustButtonText: { fontSize: 14, fontWeight: '600' as const, color: '#059669' },
  trustedBanner: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, backgroundColor: '#ECFDF5', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1.5, borderColor: '#A7F3D0' },
  trustedBannerContent: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, flex: 1 },
  trustedBannerTitle: { fontSize: 14, fontWeight: '700' as const, color: '#065F46' },
  trustedBannerText: { fontSize: 12, color: '#047857' },
  removeTrustButton: { backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  removeTrustButtonText: { fontSize: 12, fontWeight: '600' as const, color: '#DC2626' },
  aiButton: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#0891B2', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#0891B2', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  aiButtonContent: { flex: 1 },
  aiButtonTitle: { fontSize: 18, fontWeight: '700' as const, color: '#FFF', marginBottom: 4 },
  aiButtonSubtitle: { fontSize: 14, color: '#F0FDFA' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  safetyBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 2 },
  safetyScore: { fontSize: 16, fontWeight: '700' as const },
  safetyAlert: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEE2E2', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#DC2626' },
  safetyAlertText: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: '#DC2626' },
  ingredientCard: { borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 2 },
  ingredientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ingredientNameContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  ingredientName: { fontSize: 16, fontWeight: '600' as const, color: '#111827' },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  categoryText: { fontSize: 11, fontWeight: '600' as const, color: '#111827', textTransform: 'uppercase' as const },
  ingredientDetails: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  ingredientDescription: { fontSize: 14, color: '#6B7280', marginBottom: 12, lineHeight: 20 },
  concernsSection: { marginBottom: 12 },
  concernsTitle: { fontSize: 14, fontWeight: '700' as const, color: '#DC2626', marginBottom: 6 },
  concernText: { fontSize: 13, color: '#111827', marginBottom: 4, lineHeight: 18 },
  usesSection: { marginTop: 8 },
  usesTitle: { fontSize: 13, fontWeight: '600' as const, color: '#6B7280', marginBottom: 4 },
  usesText: { fontSize: 13, color: '#111827', lineHeight: 18 },
  actionButtons: { gap: 12, marginBottom: 16 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 12, padding: 16 },
  shoppingListButton: { backgroundColor: '#10B981' },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#FFF' },
  viewModeSection: { marginBottom: 16 },
  exposureGuidanceButton: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#EF4444', borderRadius: 16, padding: 20, marginBottom: 24, shadowColor: '#EF4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  exposureGuidanceContent: { flex: 1 },
  exposureGuidanceTitle: { fontSize: 18, fontWeight: '700' as const, color: '#FFF', marginBottom: 4 },
  exposureGuidanceSubtitle: { fontSize: 14, color: '#FEE2E2', lineHeight: 20 },
  alternativesSection: { marginBottom: 24 },
  alternativesHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, paddingHorizontal: 4 },
  alternativesTitle: { fontSize: 22, fontWeight: '700' as const, color: '#10B981' },
  alternativesLoading: { backgroundColor: '#FFF', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 2, borderColor: '#10B981' },
  alternativesLoadingText: { marginTop: 16, fontSize: 18, fontWeight: '600' as const, color: '#111827', textAlign: 'center' },
  alternativesLoadingSubtext: { marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center' },
  alternativesCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, borderWidth: 2, borderColor: '#10B981', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 4 },
  alternativesIntro: { backgroundColor: '#D1FAE5', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#10B981' },
  alternativesIntroText: { fontSize: 15, color: '#065F46', fontWeight: '600' as const, lineHeight: 22 },
  alternativesText: { fontSize: 15, color: '#111827', lineHeight: 24, marginBottom: 16 },
  alternativesDisclaimer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B' },
  alternativesDisclaimerText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 16 },
  notFoundCard: { backgroundColor: '#FEF3C7', borderRadius: 16, padding: 20, marginTop: 24, marginBottom: 16, borderWidth: 2, borderColor: '#F59E0B', width: '100%', maxWidth: 400 },
  notFoundTitle: { fontSize: 18, fontWeight: '700' as const, color: '#92400E', marginBottom: 12 },
  notFoundReason: { fontSize: 14, color: '#78350F', marginBottom: 8, lineHeight: 20 },
  alternativeCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: '#E5E7EB', width: '100%', maxWidth: 400 },
  alternativeTitle: { fontSize: 18, fontWeight: '700' as const, color: '#111827', marginBottom: 16 },
  alternativeButton: { backgroundColor: '#8B5CF6', borderRadius: 12, padding: 16, marginBottom: 12, alignItems: 'center' },
  alternativeButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#FFF' },
  missingDataWarning: { backgroundColor: '#FEF3C7', borderRadius: 16, padding: 24, borderWidth: 2, borderColor: '#F59E0B', alignItems: 'center' },
  missingDataTitle: { fontSize: 20, fontWeight: '700' as const, color: '#92400E', marginTop: 12, marginBottom: 8, textAlign: 'center' },
  missingDataText: { fontSize: 15, color: '#78350F', lineHeight: 24, textAlign: 'center', marginBottom: 20 },
  missingDataActions: { width: '100%', backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#F59E0B' },
  missingDataActionsTitle: { fontSize: 16, fontWeight: '700' as const, color: '#111827', marginBottom: 12 },
  missingDataActionItem: { fontSize: 14, color: '#111827', marginBottom: 8, lineHeight: 20 },
  editManualButton: { backgroundColor: '#0891B2', borderRadius: 8, padding: 8, marginTop: 8, alignItems: 'center' as const },
  editManualButtonText: { fontSize: 12, fontWeight: '600' as const, color: '#FFF' },
  aiReplySection: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#BAE6FD', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  aiReplyHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 12 },
  aiReplyHeaderText: { fontSize: 15, fontWeight: '600' as const, color: '#0891B2' },
  aiConversationThread: { marginBottom: 12, gap: 8 },
  aiConversationBubble: { borderRadius: 12, padding: 12, maxWidth: '90%' as any },
  aiConversationUser: { backgroundColor: '#0891B2', alignSelf: 'flex-end' as const },
  aiConversationAi: { backgroundColor: '#F0FDFA', alignSelf: 'flex-start' as const, borderWidth: 1, borderColor: '#BAE6FD' },
  aiConversationRole: { fontSize: 11, fontWeight: '700' as const, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  aiConversationRoleUser: { color: '#B2F5EA' },
  aiConversationRoleAi: { color: '#0891B2' },
  aiConversationText: { fontSize: 14, lineHeight: 20 },
  aiConversationTextUser: { color: '#FFF' },
  aiConversationTextAi: { color: '#111827' },
  aiReplyLoading: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 12, padding: 8 },
  aiReplyLoadingText: { fontSize: 14, color: '#6B7280', fontStyle: 'italic' as const },
  aiReplyInputRow: { flexDirection: 'row' as const, alignItems: 'flex-end' as const, gap: 8 },
  aiReplyInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', maxHeight: 80, borderWidth: 1, borderColor: '#E5E7EB' },
  aiReplySendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#0891B2', alignItems: 'center' as const, justifyContent: 'center' as const },
  aiReplySendButtonDisabled: { backgroundColor: '#D1D5DB' },
  captureWizardHeader: { alignItems: 'center', marginBottom: 28, paddingTop: 8 },
  captureIconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#FDE68A' },
  captureTitle: { fontSize: 24, fontWeight: '700' as const, color: '#111827', marginBottom: 8, textAlign: 'center' },
  captureSubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, paddingHorizontal: 16 },
  barcodeTag: { marginTop: 12, backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  barcodeTagText: { fontSize: 13, fontWeight: '600' as const, color: '#6B7280', fontVariant: ['tabular-nums'] as any },
  captureStepHeader: { fontSize: 17, fontWeight: '700' as const, color: '#111827', marginBottom: 14 },
  captureOptionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  captureOptionIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  captureOptionContent: { flex: 1 },
  captureOptionTitle: { fontSize: 16, fontWeight: '700' as const, color: '#111827', marginBottom: 4 },
  captureOptionDesc: { fontSize: 13, color: '#6B7280', lineHeight: 19 },
  captureTips: { backgroundColor: '#F0F9FF', borderRadius: 14, padding: 16, marginTop: 12, marginBottom: 20, borderWidth: 1, borderColor: '#BAE6FD' },
  captureTipsTitle: { fontSize: 14, fontWeight: '700' as const, color: '#0369A1', marginBottom: 10 },
  captureTipItem: { fontSize: 13, color: '#0C4A6E', marginBottom: 6, lineHeight: 19 },
  captureActions: { marginBottom: 32 },
  productTypeBadge: { flexDirection: 'row' as const, alignItems: 'center' as const, alignSelf: 'flex-start' as const, gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5, marginBottom: 12 },
  productTypeEmoji: { fontSize: 16 },
  productTypeLabel: { fontSize: 14, fontWeight: '700' as const },
  actionButtonsRow: { flexDirection: 'row' as const, gap: 10, marginBottom: 16 },
  actionButtonShoppingList: { flex: 1, backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#0891B2' },
  actionButtonTextShoppingList: { fontSize: 14, fontWeight: '600' as const, color: '#0891B2' },
  actionButtonAvoid: { flex: 1, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#DC2626' },
  actionButtonAvoidActive: { flex: 1, backgroundColor: '#DC2626', borderWidth: 1, borderColor: '#DC2626' },
  actionButtonTextAvoid: { fontSize: 14, fontWeight: '600' as const, color: '#DC2626' },
  actionButtonTextAvoidActive: { color: '#FFFFFF' },
  contributeProductBtn: { backgroundColor: '#0B6E7A', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' as const, marginTop: 16 },
  contributeProductBtnText: { fontSize: 15, fontWeight: '600' as const, color: '#FFFFFF' },
  contributeHelpText: { fontSize: 12, color: '#6B7280', textAlign: 'center' as const, marginTop: 12, lineHeight: 18 },
});
