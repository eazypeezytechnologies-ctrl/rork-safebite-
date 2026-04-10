import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
  Easing,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  ShieldX,
  AlertTriangle,
  Heart,
  Share2,
  Ban,
  Bookmark,
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp,
  Droplets,
  Flame,
  Wheat,
  ShieldOff,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProfiles } from '@/contexts/ProfileContext';
import { useUser } from '@/contexts/UserContext';
import { Product, Verdict, VerdictLevel, ConfidenceBreakdown } from '@/types';
import { getVerdictColor } from '@/utils/verdict';
import {
  evaluateProduct,
  EvaluationResult,
  evalVerdictToLegacyLevel,
  MatchedConcern,
} from '@/utils/evaluationEngine';
import { runUnifiedEvaluation } from '@/utils/unifiedEvaluation';
import { addToFavorites, removeFromFavorites, isFavorite, getFavorites } from '@/storage/favorites';
import { addToAvoidList, isOnAvoidList, removeFromAvoidList, getAvoidList } from '@/storage/avoidList';
import { arcaneColors } from '@/constants/theme';
import { addToScanHistory } from '@/storage/scanHistory';
import { searchProductByBarcode } from '@/api/products';
import { getAIVerdict, AIVerdictRecord } from '@/storage/aiVerdict';
import { getTrustedProduct, TrustedProduct } from '@/storage/trustedProducts';

type IssueType = 'allergy' | 'sensitivity' | 'eczema';

interface TriggerDetail {
  ingredient: string;
  issueType: IssueType;
  source: string;
  profileName: string;
}

function getIssueTypeLabel(type: IssueType): string {
  switch (type) {
    case 'allergy': return 'Allergy Concern';
    case 'sensitivity': return 'Sensitivity';
    case 'eczema': return 'Eczema Trigger';
  }
}

function getIssueTypeDescription(type: IssueType): string {
  switch (type) {
    case 'allergy': return 'Direct allergen match — may cause allergic reaction';
    case 'sensitivity': return 'Sensitivity concern — may cause discomfort';
    case 'eczema': return 'Eczema trigger — may irritate skin, not a food allergy';
  }
}

function getIssueTypeColor(type: IssueType): string {
  switch (type) {
    case 'allergy': return '#DC2626';
    case 'sensitivity': return '#D97706';
    case 'eczema': return '#7C3AED';
  }
}

function getIssueTypeBg(type: IssueType): string {
  switch (type) {
    case 'allergy': return '#FEF2F2';
    case 'sensitivity': return '#FFFBEB';
    case 'eczema': return '#F5F3FF';
  }
}

function getIssueTypeIcon(type: IssueType) {
  switch (type) {
    case 'allergy': return Flame;
    case 'sensitivity': return Wheat;
    case 'eczema': return Droplets;
  }
}

function getVerdictBg(level: VerdictLevel): string {
  switch (level) {
    case 'safe': return '#ECFDF5';
    case 'caution': return '#FFFBEB';
    case 'danger': return '#FEF2F2';
    case 'unknown': return '#F3F4F6';
  }
}

function getVerdictBorder(level: VerdictLevel): string {
  switch (level) {
    case 'safe': return '#A7F3D0';
    case 'caution': return '#FDE68A';
    case 'danger': return '#FECACA';
    case 'unknown': return '#D1D5DB';
  }
}

function getVerdictDisplayLabel(level: VerdictLevel): string {
  switch (level) {
    case 'safe': return 'Safe';
    case 'caution': return 'Caution';
    case 'danger': return 'Avoid';
    case 'unknown': return 'Unknown';
  }
}

function VerdictIcon({ level, size }: { level: VerdictLevel; size: number }) {
  const color = '#FFFFFF';
  switch (level) {
    case 'safe': return <ShieldCheck size={size} color={color} />;
    case 'caution': return <ShieldAlert size={size} color={color} />;
    case 'danger': return <ShieldX size={size} color={color} />;
    case 'unknown': return <ShieldQuestion size={size} color={color} />;
  }
}

export default function ResultScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { activeProfile } = useProfiles();
  const { currentUser } = useUser();

  const code = Array.isArray(params.code) ? params.code[0] : params.code || '';

  const [product, setProduct] = useState<Product | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceBreakdown | null>(null);
  const [isFav, setIsFav] = useState(false);
  const [isAvoided, setIsAvoided] = useState(false);
  const [showConfidenceDetails, setShowConfidenceDetails] = useState(false);
  const [aiVerdictRecord, setAiVerdictRecord] = useState<AIVerdictRecord | null>(null);
  const [trustedProduct, setTrustedProduct] = useState<TrustedProduct | null>(null);
  const [verdictLabel, setVerdictLabel] = useState<string>('');

  const verdictScale = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (!code || !activeProfile) {
      console.log('[Result] Missing code or profile, cannot render result');
      return;
    }

    const loadResult = async () => {
      try {
        const productData = await searchProductByBarcode(code);
        if (!productData) {
          console.log('[Result] No product data found for code:', code);
          return;
        }

        setProduct(productData);

        const [storedAiVerdict, storedTrusted] = await Promise.all([
          getAIVerdict(code, activeProfile.id, currentUser?.id),
          getTrustedProduct(code, activeProfile.id, currentUser?.id),
        ]);

        console.log('[Result] AI verdict:', storedAiVerdict ? storedAiVerdict.aiVerdict : 'none');
        setAiVerdictRecord(storedAiVerdict);
        console.log('[Result] Trusted:', storedTrusted ? 'yes' : 'no');
        setTrustedProduct(storedTrusted);

        const unified = runUnifiedEvaluation(productData, activeProfile, storedAiVerdict, storedTrusted);
        unified.debugLog.forEach(l => console.log(l));

        setEvalResult(unified.evalResult);
        setVerdict(unified.verdict);
        setVerdictLabel(unified.verdictLabel);
        setConfidence(unified.confidence);

        console.log('[Result] Unified verdict:', unified.verdict.level, '| Source:', unified.verdictSource);
        console.log('[Result] Confidence:', unified.confidence.score, unified.confidence.label);

        const [favStatus, avoidStatus] = await Promise.all([
          isFavorite(code, activeProfile.id, currentUser?.id),
          isOnAvoidList(code, activeProfile.id, currentUser?.id),
        ]);
        setIsFav(favStatus);
        setIsAvoided(avoidStatus);

        await addToScanHistory({
          id: `${code}_${activeProfile.id}_${Date.now()}`,
          product: productData,
          verdict: unified.verdict,
          profileId: activeProfile.id,
          profileName: activeProfile.name,
          scannedAt: new Date().toISOString(),
        }, currentUser?.id);

        if (unified.verdict.level === 'danger' && Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        } else if (unified.verdict.level === 'caution' && Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }

        Animated.parallel([
          Animated.spring(verdictScale, {
            toValue: 1,
            friction: 6,
            tension: 80,
            useNativeDriver: true,
          }),
          Animated.timing(fadeIn, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(slideUp, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
      } catch (err) {
        console.error('[Result] Error loading result:', err);
      }
    };

    setAiVerdictRecord(null);
    setTrustedProduct(null);
    setVerdict(null);
    setEvalResult(null);
    setConfidence(null);
    verdictScale.setValue(0);
    fadeIn.setValue(0);
    slideUp.setValue(30);

    void loadResult();
  }, [code, activeProfile?.id, currentUser?.id, verdictScale, fadeIn, slideUp]);

  const triggers = useMemo<TriggerDetail[]>(() => {
    if (!activeProfile) return [];

    if (evalResult) {
      const details: TriggerDetail[] = [];
      for (const concern of evalResult.matchedConcerns) {
        let issueType: IssueType;
        let source: string;
        switch (concern.concernType) {
          case 'allergy':
            issueType = 'allergy';
            source = concern.source === 'allergen_tag' ? 'Listed allergen'
              : concern.source === 'traces_tag' ? 'Trace warning'
              : concern.source === 'ingredient_text' ? 'Found in ingredients'
              : concern.source === 'custom_keyword' ? 'Custom keyword'
              : 'Detected';
            break;
          case 'sensitivity':
            issueType = 'sensitivity';
            source = concern.source === 'food_sensitivity' ? 'Food sensitivity'
              : concern.notes || 'Sensitivity concern';
            break;
          case 'eczema':
            issueType = 'eczema';
            source = `Eczema trigger (${concern.profileAllergen})`;
            break;
        }
        details.push({
          ingredient: concern.matchedText || concern.ingredient,
          issueType,
          source,
          profileName: activeProfile.name,
        });
      }

      for (const advisory of evalResult.advisoryMatches) {
        details.push({
          ingredient: advisory.allergen,
          issueType: advisory.affectsSevereAllergen ? 'allergy' : 'sensitivity',
          source: advisory.type === 'facility_warning' ? 'Facility risk' : 'May contain warning',
          profileName: activeProfile.name,
        });
      }

      return details;
    }

    if (!verdict) return [];

    const details: TriggerDetail[] = [];
    for (const match of verdict.matches) {
      let issueType: IssueType = 'allergy';
      if (match.source === 'traces_tags') {
        issueType = 'sensitivity';
      }
      details.push({
        ingredient: match.matchedText || match.allergen,
        issueType,
        source: match.source === 'allergens_tags' ? 'Listed allergen'
          : match.source === 'traces_tags' ? 'Trace warning'
          : match.source === 'ingredients' ? 'Found in ingredients'
          : 'Custom keyword',
        profileName: activeProfile.name,
      });
    }

    if (verdict.eczemaTriggers) {
      for (const trigger of verdict.eczemaTriggers) {
        details.push({
          ingredient: trigger.matchedText,
          issueType: 'eczema',
          source: `Eczema trigger (${trigger.triggerGroup})`,
          profileName: activeProfile.name,
        });
      }
    }

    return details;
  }, [evalResult, verdict, activeProfile]);

  const confidenceReasons = useMemo<string[]>(() => {
    if (evalResult) {
      return evalResult.confidenceReasons
        .filter(r => r.impact === 'negative')
        .map(r => r.detail);
    }
    if (!confidence) return [];
    return confidence.factors
      .filter(f => !f.present)
      .map(f => f.description);
  }, [evalResult, confidence]);

  const handleToggleFavorite = useCallback(async () => {
    if (!activeProfile || !product) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    try {
      if (isFav) {
        const favorites = await getFavorites(currentUser?.id);
        const fav = favorites.find(f => f.product.code === code && f.profileId === activeProfile.id);
        if (fav) {
          await removeFromFavorites(fav.id, currentUser?.id);
          setIsFav(false);
        }
      } else {
        await addToFavorites({
          id: `${code}_${activeProfile.id}_${Date.now()}`,
          product,
          profileId: activeProfile.id,
          addedAt: new Date().toISOString(),
        }, currentUser?.id);
        setIsFav(true);
      }
    } catch (error) {
      console.error('[Result] Toggle favorite error:', error);
      Alert.alert('Error', 'Failed to update favorites');
    }
  }, [isFav, activeProfile, product, code, currentUser?.id]);

  const handleToggleAvoid = useCallback(async () => {
    if (!activeProfile || !product) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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
            ? 'May contain traces of allergens'
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
      console.error('[Result] Toggle avoid error:', error);
      Alert.alert('Error', 'Failed to update avoid list');
    }
  }, [isAvoided, activeProfile, product, code, currentUser?.id, verdict]);

  const handleSaveToSafeList = useCallback(async () => {
    if (!activeProfile || !product) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    try {
      await addToFavorites({
        id: `safe_${code}_${activeProfile.id}_${Date.now()}`,
        product,
        profileId: activeProfile.id,
        addedAt: new Date().toISOString(),
        notes: 'Saved as safe product',
      }, currentUser?.id);
      Alert.alert('Saved', 'Product saved to your safe list');
    } catch (error) {
      console.error('[Result] Save to safe list error:', error);
      Alert.alert('Error', 'Failed to save product');
    }
  }, [activeProfile, product, code, currentUser?.id]);

  const handleShare = useCallback(async () => {
    if (!product || !verdict) return;
    const productName = product.product_name || 'this product';
    const verdictText = `Safety: ${getVerdictDisplayLabel(verdict.level)}`;
    const allergenInfo = verdict.matches.length > 0
      ? `\nConcerns: ${verdict.matches.map(m => m.allergen).join(', ')}`
      : '';

    const message = `SafeBite Product Check\n\n${productName}\n${verdictText}${allergenInfo}\n\nFor: ${activeProfile?.name || 'Unknown'}\n\nScanned with SafeBite`;

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.share) {
          await navigator.share({ title: `${productName} - SafeBite`, text: message });
        } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(message);
          Alert.alert('Copied!', 'Product information copied to clipboard');
        }
      } else {
        await Share.share({ message, title: `${productName} - SafeBite` });
      }
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        console.error('[Result] Share error:', error);
      }
    }
  }, [product, verdict, activeProfile]);

  const handleFindAlternatives = useCallback(() => {
    if (product) {
      router.push(`/product/${code}` as any);
    }
  }, [product, code, router]);

  if (!product || !verdict || !activeProfile) {
    return (
      <>
        <Stack.Screen options={{ title: 'Result', headerStyle: { backgroundColor: '#FFFFFF' }, headerTintColor: arcaneColors.primary }} />
        <View style={styles.loadingContainer}>
          <ShieldQuestion size={48} color={arcaneColors.textMuted} />
          <Text style={styles.loadingText}>Loading result...</Text>
        </View>
      </>
    );
  }

  const verdictColor = getVerdictColor(verdict.level);
  const verdictBg = getVerdictBg(verdict.level);
  const _verdictBorder = getVerdictBorder(verdict.level);
  const confidenceScore = confidence?.score ?? 50;
  const confidenceLabel = confidence?.label ?? 'Moderate';

  return (
    <View style={styles.screen} testID="result-screen">
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: verdictBg },
          headerTintColor: verdictColor,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={[styles.scrollView, { backgroundColor: verdictBg }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.verdictHero,
            {
              backgroundColor: verdictBg,
              transform: [{ scale: verdictScale }],
            },
          ]}
        >
          <View style={[styles.verdictIconCircle, { backgroundColor: verdictColor }]}>
            <VerdictIcon level={verdict.level} size={36} />
          </View>
          <Text style={[styles.verdictTitle, { color: verdictColor }]} testID="verdict-label">
            {getVerdictDisplayLabel(verdict.level)}
          </Text>
          <Text style={styles.verdictProductName} numberOfLines={2}>
            {product.product_name || 'Unknown Product'}
          </Text>
          {product.brands && (
            <Text style={styles.verdictBrand}>{product.brands}</Text>
          )}
        </Animated.View>

        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>
          <View style={styles.mainContent}>
            <View style={[styles.card, styles.explanationCard]}>
              <View style={styles.cardHeader}>
                <Info size={18} color={arcaneColors.text} />
                <Text style={styles.cardTitle}>Why this result</Text>
              </View>
              <Text style={styles.explanationText} testID="verdict-explanation">
                {verdict.explanation || verdict.message}
              </Text>
              <View style={styles.profileChip}>
                <Text style={styles.profileChipLabel}>Checked for</Text>
                <View style={[styles.profileBadge, { backgroundColor: activeProfile.avatarColor || arcaneColors.primary + '18' }]}>
                  <Text style={[styles.profileBadgeText, { color: activeProfile.avatarColor ? '#FFFFFF' : arcaneColors.primary }]}>
                    {activeProfile.name}
                  </Text>
                </View>
              </View>
            </View>

            {triggers.length > 0 && (
              <View style={[styles.card, styles.triggersCard]}>
                <View style={styles.cardHeader}>
                  <AlertTriangle size={18} color="#92400E" />
                  <Text style={styles.cardTitle}>Flagged Ingredients</Text>
                </View>
                {triggers.map((trigger, index) => {
                  const IssueIcon = getIssueTypeIcon(trigger.issueType);
                  const issueColor = getIssueTypeColor(trigger.issueType);
                  const issueBg = getIssueTypeBg(trigger.issueType);

                  return (
                    <View key={index} style={[styles.triggerRow, { backgroundColor: issueBg }]} testID={`trigger-${index}`}>
                      <View style={[styles.triggerIconCircle, { backgroundColor: issueColor + '20' }]}>
                        <IssueIcon size={16} color={issueColor} />
                      </View>
                      <View style={styles.triggerContent}>
                        <Text style={styles.triggerIngredient}>{trigger.ingredient}</Text>
                        <View style={styles.triggerMeta}>
                          <View style={[styles.issueTypeBadge, { backgroundColor: issueColor + '15', borderColor: issueColor + '40' }]}>
                            <Text style={[styles.issueTypeText, { color: issueColor }]}>
                              {getIssueTypeLabel(trigger.issueType)}
                            </Text>
                          </View>
                          <Text style={styles.triggerSource}>{trigger.source}</Text>
                        </View>
                        <Text style={styles.triggerDescription}>{getIssueTypeDescription(trigger.issueType)}</Text>
                        <Text style={styles.triggerProfile}>Affects: {trigger.profileName}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={[styles.card, styles.confidenceCard]}>
              <TouchableOpacity
                style={styles.confidenceHeader}
                onPress={() => setShowConfidenceDetails(!showConfidenceDetails)}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.confidenceDot, { backgroundColor: confidence?.color || '#D97706' }]} />
                  <Text style={styles.cardTitle}>Confidence: {confidenceLabel}</Text>
                </View>
                <View style={styles.confidenceScoreRow}>
                  <View style={styles.confidenceTrack}>
                    <View
                      style={[
                        styles.confidenceFill,
                        {
                          width: `${confidenceScore}%`,
                          backgroundColor: confidence?.color || '#D97706',
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.confidencePercent, { color: confidence?.color || '#D97706' }]}>
                    {confidenceScore}%
                  </Text>
                  {showConfidenceDetails
                    ? <ChevronUp size={16} color={arcaneColors.textMuted} />
                    : <ChevronDown size={16} color={arcaneColors.textMuted} />
                  }
                </View>
              </TouchableOpacity>

              {showConfidenceDetails && confidenceReasons.length > 0 && (
                <View style={styles.confidenceReasons}>
                  <Text style={styles.confidenceReasonsTitle}>Why confidence is reduced:</Text>
                  {confidenceReasons.map((reason, i) => (
                    <View key={i} style={styles.confidenceReasonRow}>
                      <ShieldOff size={12} color="#9CA3AF" />
                      <Text style={styles.confidenceReasonText}>{reason}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.actionsSection}>
              <Text style={styles.actionsSectionTitle}>Actions</Text>

              <View style={styles.actionsGrid}>
                {verdict.level === 'safe' && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnSafe]}
                    onPress={handleSaveToSafeList}
                    activeOpacity={0.7}
                    testID="save-safe-list"
                  >
                    <Bookmark size={20} color="#059669" />
                    <Text style={[styles.actionBtnText, { color: '#059669' }]}>Save to Safe List</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.actionBtn, isAvoided ? styles.actionBtnAvoidActive : styles.actionBtnAvoid]}
                  onPress={handleToggleAvoid}
                  activeOpacity={0.7}
                  testID="toggle-avoid"
                >
                  <Ban size={20} color={isAvoided ? '#FFFFFF' : '#DC2626'} />
                  <Text style={[styles.actionBtnText, { color: isAvoided ? '#FFFFFF' : '#DC2626' }]}>
                    {isAvoided ? 'On Avoid List' : 'Add to Avoid List'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, isFav ? styles.actionBtnFavActive : styles.actionBtnFav]}
                  onPress={handleToggleFavorite}
                  activeOpacity={0.7}
                  testID="toggle-favorite"
                >
                  <Heart size={20} color={isFav ? '#FFFFFF' : '#E11D48'} fill={isFav ? '#FFFFFF' : 'none'} />
                  <Text style={[styles.actionBtnText, { color: isFav ? '#FFFFFF' : '#E11D48' }]}>
                    {isFav ? 'Favorited' : 'Favorite'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnShare]}
                  onPress={handleShare}
                  activeOpacity={0.7}
                  testID="share-result"
                >
                  <Share2 size={20} color={arcaneColors.primary} />
                  <Text style={[styles.actionBtnText, { color: arcaneColors.primary }]}>Share</Text>
                </TouchableOpacity>
              </View>

              {(verdict.level === 'danger' || verdict.level === 'caution') && (
                <TouchableOpacity
                  style={styles.findAlternativesBtn}
                  onPress={handleFindAlternatives}
                  activeOpacity={0.7}
                  testID="find-alternatives"
                >
                  <View style={styles.findAlternativesContent}>
                    <Text style={styles.findAlternativesTitle}>Find Alternatives</Text>
                    <Text style={styles.findAlternativesSubtitle}>
                      Get AI-powered safe product suggestions
                    </Text>
                  </View>
                  <ArrowRight size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.trustFooter} testID="trust-footer">
              <ShieldAlert size={16} color="#92400E" />
              <Text style={styles.trustFooterText}>
                Not medical advice. For severe allergies, always verify with the manufacturer and consult your doctor.
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: arcaneColors.textMuted,
    fontWeight: '500' as const,
  },
  verdictHero: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 24,
  },
  verdictIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  verdictTitle: {
    fontSize: 32,
    fontWeight: '800' as const,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  verdictProductName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: arcaneColors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  verdictBrand: {
    fontSize: 14,
    color: arcaneColors.textSecondary,
    marginTop: 2,
  },
  mainContent: {
    backgroundColor: '#F7FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -12,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    shadowColor: 'rgba(0,0,0,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    flex: 1,
  },
  explanationCard: {},
  explanationText: {
    fontSize: 15,
    color: arcaneColors.textSecondary,
    lineHeight: 23,
    marginBottom: 14,
  },
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileChipLabel: {
    fontSize: 13,
    color: arcaneColors.textMuted,
    fontWeight: '500' as const,
  },
  profileBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  profileBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
  },
  triggersCard: {},
  triggerRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    alignItems: 'flex-start',
  },
  triggerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  triggerContent: {
    flex: 1,
  },
  triggerIngredient: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    marginBottom: 6,
  },
  triggerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  issueTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  issueTypeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  triggerSource: {
    fontSize: 12,
    color: arcaneColors.textMuted,
  },
  triggerDescription: {
    fontSize: 12,
    color: arcaneColors.textSecondary,
    fontStyle: 'italic' as const,
    marginTop: 2,
    lineHeight: 17,
  },
  triggerProfile: {
    fontSize: 12,
    color: arcaneColors.textSecondary,
    marginTop: 2,
  },
  confidenceCard: {
    paddingBottom: 14,
  },
  confidenceHeader: {},
  confidenceScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  confidenceTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: 6,
    borderRadius: 3,
  },
  confidencePercent: {
    fontSize: 14,
    fontWeight: '700' as const,
    minWidth: 38,
    textAlign: 'right' as const,
  },
  confidenceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  confidenceReasons: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  confidenceReasonsTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: arcaneColors.textSecondary,
    marginBottom: 8,
  },
  confidenceReasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  confidenceReasonText: {
    fontSize: 12,
    color: arcaneColors.textMuted,
    flex: 1,
    lineHeight: 17,
  },
  actionsSection: {
    marginTop: 4,
    marginBottom: 16,
  },
  actionsSectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    marginBottom: 12,
    marginLeft: 2,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  actionBtnSafe: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  actionBtnAvoid: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  actionBtnAvoidActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  actionBtnFav: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
  },
  actionBtnFavActive: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  actionBtnShare: {
    backgroundColor: arcaneColors.primaryMuted,
    borderColor: arcaneColors.borderRune,
  },
  findAlternativesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: arcaneColors.primary,
    borderRadius: 14,
    padding: 18,
    marginTop: 12,
    shadowColor: arcaneColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  findAlternativesContent: {
    flex: 1,
  },
  findAlternativesTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  findAlternativesSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
  },
  trustFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 8,
  },
  trustFooterText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
    fontWeight: '500' as const,
  },
});
