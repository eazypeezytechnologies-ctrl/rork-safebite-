import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Sparkles, AlertCircle, ArrowLeft, RefreshCw, ShieldCheck, ShieldAlert, Shield } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { useUser } from '@/contexts/UserContext';
import { searchProductByBarcode } from '@/api/products';
import { Product } from '@/types';
import { calculateVerdict } from '@/utils/verdict';
import { generateText } from '@rork-ai/toolkit-sdk';
import { saveAIVerdict, parseAIVerdictFromText, getAIVerdict, AIVerdictRecord } from '@/storage/aiVerdict';
import { ArcaneSpinner } from '@/components/ArcaneSpinner';
import { updateProductAIVerdict } from '@/services/supabaseProducts';
import * as Haptics from 'expo-haptics';

export default function AIAnalysisScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { activeProfile } = useProfiles();
  const { currentUser } = useUser();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiVerdictRecord, setAiVerdictRecord] = useState<AIVerdictRecord | null>(null);
  const [isRerunning, setIsRerunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  useEffect(() => {
    loadProductAndAnalyze();
  }, [code]);

  const loadProductAndAnalyze = async () => {
    if (!code || !activeProfile) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const productData = await searchProductByBarcode(code);
      
      if (!productData) {
        setError('Product not found in database');
        setIsLoading(false);
        return;
      }
      
      setProduct(productData);

      const existingVerdict = await getAIVerdict(code, activeProfile.id, currentUser?.id);
      if (existingVerdict) {
        console.log('[AIAnalysis] Found cached AI verdict:', existingVerdict.aiVerdict);
        setAiVerdictRecord(existingVerdict);
        setLastRunAt(existingVerdict.updatedAt);
      }

      await runAnalysis(productData);
    } catch (err) {
      console.error('Error analyzing product:', err);
      setError('Failed to analyze product. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const runAnalysis = async (productData: Product) => {
    if (!activeProfile || !code) return;

    const ruleVerdict = calculateVerdict(productData, activeProfile);
    
    const prompt = `You are an expert allergist and food safety specialist. Analyze this product for someone with the following allergies: ${activeProfile.allergens.join(', ')}.

Product: ${productData.product_name || 'Unknown'}
Brand: ${productData.brands || 'Unknown'}
Ingredients: ${productData.ingredients_text || 'Not available'}
Listed Allergens: ${productData.allergens || 'None listed'}
May Contain Traces: ${productData.traces || 'None listed'}

Our rule-based system currently shows: ${ruleVerdict.level.toUpperCase()} — ${ruleVerdict.message}
${ruleVerdict.matches.length > 0 ? `Rule-based allergen matches: ${ruleVerdict.matches.map(m => `${m.allergen} (${m.source}: ${m.matchedText})`).join(', ')}` : 'No rule-based allergen matches found.'}

Please provide:
1. A clear safety assessment (SAFE, CAUTION, or DANGER) — state this clearly at the start
2. Whether you agree or disagree with the rule-based verdict above, and why
3. Explanation of any allergen risks found
4. Analysis of cross-contamination risks
5. Specific ingredients of concern
6. Recommendations for this person

Be thorough but concise. Use clear, non-technical language.`;

    const result = await generateText(prompt);
    setAnalysis(result);
    setLastRunAt(new Date().toISOString());

    const { verdict: aiVerdict, confidence } = parseAIVerdictFromText(result);
    console.log('[AIAnalysis] Parsed AI verdict:', aiVerdict, 'confidence:', confidence);

    const hasRuleAllergenMatch = ruleVerdict.matches.some(
      m => m.source === 'allergens_tags' || m.source === 'ingredients' || m.source === 'custom_keyword'
    );

    let hasConflict = false;
    let conflictReason: string | undefined;

    if (aiVerdict === 'safe' && hasRuleAllergenMatch) {
      hasConflict = true;
      conflictReason = `Rule-based system detected direct allergen matches (${ruleVerdict.matches.map(m => m.allergen).join(', ')}), but AI assessment says SAFE. The rule-based allergen match takes priority for safety.`;
      console.log('[AIAnalysis] CONFLICT: AI says safe but rule-based found allergens');
    } else if (aiVerdict === 'danger' && ruleVerdict.level === 'safe') {
      hasConflict = true;
      conflictReason = `AI detected potential allergen risks not caught by the rule-based system. Please review carefully.`;
    }

    const record: AIVerdictRecord = {
      productCode: code,
      profileId: activeProfile.id,
      aiVerdict,
      aiSummary: result.substring(0, 500),
      aiConfidence: confidence,
      hasConflict,
      conflictReason,
      updatedAt: new Date().toISOString(),
    };

    await saveAIVerdict(record, currentUser?.id);
    setAiVerdictRecord(record);

    updateProductAIVerdict(code, aiVerdict, result.substring(0, 500)).catch((err) =>
      console.log('[AIAnalysis] Non-critical: could not persist AI verdict to product record:', err)
    );

    if (Platform.OS !== 'web') {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    }
  };

  const handleRerun = useCallback(async () => {
    if (!product || !activeProfile || isRerunning) return;

    const now = Date.now();
    if (lastRunAt) {
      const lastRun = new Date(lastRunAt).getTime();
      const diffSeconds = (now - lastRun) / 1000;
      if (diffSeconds < 30) {
        setError(`Please wait ${Math.ceil(30 - diffSeconds)} seconds before re-running.`);
        return;
      }
    }

    setIsRerunning(true);
    setError(null);

    try {
      await runAnalysis(product);
    } catch (err) {
      console.error('Error re-running analysis:', err);
      setError('Failed to re-run analysis. Please try again.');
    } finally {
      setIsRerunning(false);
    }
  }, [product, activeProfile, isRerunning, lastRunAt]);

  const getVerdictDisplay = () => {
    if (!aiVerdictRecord) return null;

    const v = aiVerdictRecord.aiVerdict;
    const color = v === 'safe' ? '#10B981' : v === 'caution' ? '#F59E0B' : '#DC2626';
    const label = v === 'safe' ? 'AI-VERIFIED SAFE' : v === 'caution' ? 'AI: CAUTION' : 'AI: UNSAFE';
    const Icon = v === 'safe' ? ShieldCheck : v === 'caution' ? Shield : ShieldAlert;
    const bgColor = v === 'safe' ? '#D1FAE5' : v === 'caution' ? '#FEF3C7' : '#FEE2E2';

    return { color, label, Icon, bgColor };
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ArcaneSpinner size={80} />
        <Text style={styles.loadingText}>AI is analyzing ingredients...</Text>
        <Text style={styles.loadingSubtext}>Comparing with your allergy profile</Text>
      </View>
    );
  }

  if (error && !product) {
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={64} color="#DC2626" />
        <Text style={styles.errorText}>{error || 'Product not found'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProductAndAnalyze}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerContainer}>
        <AlertCircle size={64} color="#DC2626" />
        <Text style={styles.errorText}>Product not found</Text>
      </View>
    );
  }

  const verdictDisplay = getVerdictDisplay();

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'AI Analysis',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 16 }}>
              <ArrowLeft size={24} color="#111827" />
            </TouchableOpacity>
          ),
        }} 
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Sparkles size={32} color="#0891B2" />
          </View>
          <Text style={styles.title}>AI-Powered Analysis</Text>
          <Text style={styles.subtitle}>
            Detailed ingredient analysis for {activeProfile?.name}
          </Text>
        </View>

        <View style={styles.productCard}>
          <Text style={styles.productName}>{product.product_name || 'Unknown Product'}</Text>
          {product.brands && (
            <Text style={styles.productBrand}>{product.brands}</Text>
          )}
        </View>

        {verdictDisplay && (
          <View style={[styles.aiVerdictCard, { backgroundColor: verdictDisplay.bgColor, borderColor: verdictDisplay.color }]}>
            <View style={[styles.aiVerdictBadge, { backgroundColor: verdictDisplay.color }]}>
              <verdictDisplay.Icon size={28} color="#FFFFFF" />
            </View>
            <View style={styles.aiVerdictContent}>
              <Text style={[styles.aiVerdictLabel, { color: verdictDisplay.color }]}>
                {verdictDisplay.label}
              </Text>
              <Text style={styles.aiVerdictConfidence}>
                Confidence: {aiVerdictRecord?.aiConfidence === 'high' ? 'High' : aiVerdictRecord?.aiConfidence === 'medium' ? 'Medium' : 'Low'}
              </Text>
              {lastRunAt && (
                <Text style={styles.aiVerdictTimestamp}>
                  Updated: {new Date(lastRunAt).toLocaleString()}
                </Text>
              )}
            </View>
          </View>
        )}

        {aiVerdictRecord?.hasConflict && (
          <View style={styles.conflictCard}>
            <View style={styles.conflictHeader}>
              <AlertCircle size={20} color="#DC2626" />
              <Text style={styles.conflictTitle}>Conflict Detected</Text>
            </View>
            <Text style={styles.conflictText}>
              {aiVerdictRecord.conflictReason}
            </Text>
            <Text style={styles.conflictAdvice}>
              When in doubt, trust the more conservative assessment and consult your healthcare provider.
            </Text>
          </View>
        )}

        <View style={styles.analysisCard}>
          <View style={styles.analysisHeader}>
            <Sparkles size={20} color="#0891B2" />
            <Text style={styles.analysisTitle}>Expert Analysis</Text>
          </View>
          <Text style={styles.analysisText}>{analysis}</Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <AlertCircle size={16} color="#DC2626" />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.rerunButton, isRerunning && styles.rerunButtonDisabled]}
          onPress={handleRerun}
          disabled={isRerunning}
        >
          <RefreshCw size={20} color={isRerunning ? '#9CA3AF' : '#0891B2'} />
          <Text style={[styles.rerunButtonText, isRerunning && styles.rerunButtonTextDisabled]}>
            {isRerunning ? 'Re-analyzing...' : 'Re-run AI Analysis'}
          </Text>
        </TouchableOpacity>

        <View style={styles.disclaimer}>
          <AlertCircle size={16} color="#F59E0B" />
          <Text style={styles.disclaimerText}>
            This AI analysis is for informational purposes only. Always read product labels yourself and consult with your healthcare provider for medical advice.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back to Product</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
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
  scrollContent: {
    padding: 16,
  },
  loadingText: {
    marginTop: 24,
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#111827',
    textAlign: 'center',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#DC2626',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#0891B2',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  productName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 16,
    color: '#6B7280',
  },
  aiVerdictCard: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  aiVerdictBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  aiVerdictContent: {
    flex: 1,
  },
  aiVerdictLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 2,
  },
  aiVerdictConfidence: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  aiVerdictTimestamp: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  conflictCard: {
    backgroundColor: '#FFF5F5',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },
  conflictHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  conflictTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#DC2626',
  },
  conflictText: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 20,
    marginBottom: 8,
  },
  conflictAdvice: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '600' as const,
    fontStyle: 'italic',
  },
  analysisCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#0891B2',
    shadowColor: '#0891B2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
  },
  analysisText: {
    fontSize: 16,
    color: '#111827',
    lineHeight: 26,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#991B1B',
  },
  rerunButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#0891B2',
  },
  rerunButtonDisabled: {
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  rerunButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#0891B2',
  },
  rerunButtonTextDisabled: {
    color: '#9CA3AF',
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 16,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  backButton: {
    backgroundColor: '#0891B2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
