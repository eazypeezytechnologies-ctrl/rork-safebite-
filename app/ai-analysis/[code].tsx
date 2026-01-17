import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Sparkles, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { useProfiles } from '@/contexts/ProfileContext';
import { searchProductByBarcode } from '@/api/products';
import { Product } from '@/types';
import { generateText } from '@rork-ai/toolkit-sdk';

export default function AIAnalysisScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { activeProfile } = useProfiles();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProductAndAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      const prompt = `You are an expert allergist and food safety specialist. Analyze this product for someone with the following allergies: ${activeProfile.allergens.join(', ')}.

Product: ${productData.product_name || 'Unknown'}
Brand: ${productData.brands || 'Unknown'}
Ingredients: ${productData.ingredients_text || 'Not available'}
Listed Allergens: ${productData.allergens || 'None listed'}
May Contain Traces: ${productData.traces || 'None listed'}

Please provide:
1. A clear safety assessment (SAFE, CAUTION, or DANGER)
2. Explanation of any allergen risks found
3. Analysis of cross-contamination risks
4. Specific ingredients of concern
5. Recommendations for this person

Be thorough but concise. Use clear, non-technical language.`;

      const result = await generateText(prompt);
      setAnalysis(result);
    } catch (err) {
      console.error('Error analyzing product:', err);
      setError('Failed to analyze product. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Sparkles size={64} color="#0891B2" />
        <Text style={styles.loadingText}>AI is analyzing ingredients...</Text>
        <Text style={styles.loadingSubtext}>This may take a moment</Text>
      </View>
    );
  }

  if (error || !product) {
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

        <View style={styles.analysisCard}>
          <View style={styles.analysisHeader}>
            <Sparkles size={20} color="#0891B2" />
            <Text style={styles.analysisTitle}>Expert Analysis</Text>
          </View>
          <Text style={styles.analysisText}>{analysis}</Text>
        </View>

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
