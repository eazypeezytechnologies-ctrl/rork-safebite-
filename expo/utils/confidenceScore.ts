import { Product, ConfidenceBreakdown, ConfidenceFactor } from '@/types';

export function calculateConfidence(product: Product): ConfidenceBreakdown {
  const factors: ConfidenceFactor[] = [];

  const hasName = !!product.product_name?.trim();
  factors.push({
    name: 'Product Name',
    present: hasName,
    weight: 8,
    description: hasName ? 'Product name available' : 'Missing product name',
  });

  const hasBrand = !!product.brands?.trim();
  factors.push({
    name: 'Brand',
    present: hasBrand,
    weight: 5,
    description: hasBrand ? `Brand: ${product.brands}` : 'No brand information',
  });

  const hasIngredients = !!product.ingredients_text?.trim();
  const ingredientLength = (product.ingredients_text || '').trim().length;
  const ingredientDetail = ingredientLength > 100;
  factors.push({
    name: 'Ingredients List',
    present: hasIngredients,
    weight: 30,
    description: hasIngredients
      ? `${ingredientLength} characters of ingredient data`
      : 'No ingredient data available',
  });

  if (hasIngredients) {
    factors.push({
      name: 'Detailed Ingredients',
      present: ingredientDetail,
      weight: 10,
      description: ingredientDetail
        ? 'Comprehensive ingredient list'
        : 'Limited ingredient data',
    });
  }

  const hasAllergenTags = (product.allergens_tags?.length || 0) > 0;
  factors.push({
    name: 'Allergen Tags',
    present: hasAllergenTags,
    weight: 15,
    description: hasAllergenTags
      ? `${product.allergens_tags!.length} allergen tag(s) listed`
      : 'No allergen tags from database',
  });

  const hasTracesTags = (product.traces_tags?.length || 0) > 0;
  factors.push({
    name: 'Traces Information',
    present: hasTracesTags,
    weight: 8,
    description: hasTracesTags
      ? `${product.traces_tags!.length} trace warning(s)`
      : 'No trace information',
  });

  const hasImage = !!product.image_front_url?.trim();
  factors.push({
    name: 'Product Image',
    present: hasImage,
    weight: 4,
    description: hasImage ? 'Product image available' : 'No product image',
  });

  const hasCategories = (product.categories_tags?.length || 0) > 0;
  factors.push({
    name: 'Category Data',
    present: hasCategories,
    weight: 5,
    description: hasCategories
      ? 'Product categorized'
      : 'No category information',
  });

  const isReliableSource = ['openfoodfacts', 'openbeautyfacts', 'usda'].includes(product.source);
  factors.push({
    name: 'Data Source Quality',
    present: isReliableSource,
    weight: 10,
    description: isReliableSource
      ? `Verified database: ${product.source}`
      : `Source: ${product.source}`,
  });

  const isFresh = product.lastUpdated
    ? (Date.now() - new Date(product.lastUpdated).getTime()) < 180 * 24 * 60 * 60 * 1000
    : false;
  factors.push({
    name: 'Data Freshness',
    present: isFresh,
    weight: 5,
    description: isFresh
      ? 'Recently updated'
      : 'Data may be outdated',
  });

  const baseScore = 15;
  let earnedWeight = 0;
  let totalWeight = 0;

  for (const factor of factors) {
    totalWeight += factor.weight;
    if (factor.present) {
      earnedWeight += factor.weight;
    }
  }

  const score = Math.min(100, Math.round(baseScore + (earnedWeight / totalWeight) * 85));

  let label: ConfidenceBreakdown['label'];
  let color: string;

  if (score >= 85) {
    label = 'Very High';
    color = '#059669';
  } else if (score >= 70) {
    label = 'High';
    color = '#10B981';
  } else if (score >= 50) {
    label = 'Moderate';
    color = '#D97706';
  } else if (score >= 30) {
    label = 'Low';
    color = '#F59E0B';
  } else {
    label = 'Very Low';
    color = '#DC2626';
  }

  console.log(`[Confidence] Score: ${score}/100 (${label}) for ${product.product_name}`);

  return { score, label, factors, color };
}
