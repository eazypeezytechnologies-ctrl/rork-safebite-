import { publicProcedure } from '@/backend/trpc/create-context';
import { z } from 'zod';
import { SupabaseService } from '@/backend/services/supabaseService';

const profileInputSchema = z.object({
  allergens: z.array(z.string()),
  customKeywords: z.array(z.string()).optional().default([]),
});

const scanInputSchema = z.object({
  barcode: z.string().min(1),
  profile: profileInputSchema,
});

type VerdictResult = 'SAFE' | 'CAUTION' | 'AVOID';

const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  'milk': ['milk', 'dairy', 'casein', 'whey', 'lactose', 'lactalbumin', 'butter', 'cream', 'cheese', 'yogurt', 'ghee'],
  'eggs': ['egg', 'eggs', 'albumin', 'ovalbumin', 'mayonnaise', 'meringue'],
  'fish': ['fish', 'anchovy', 'cod', 'salmon', 'tuna', 'fish sauce', 'worcestershire'],
  'shellfish': ['shellfish', 'shrimp', 'prawn', 'crab', 'lobster', 'oyster', 'mussel', 'scallop', 'squid', 'calamari'],
  'tree nuts': ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut', 'pine nut', 'shea butter', 'shea'],
  'peanuts': ['peanut', 'groundnut', 'arachis'],
  'wheat': ['wheat', 'flour', 'gluten', 'semolina', 'durum', 'spelt', 'farina'],
  'gluten': ['gluten', 'wheat', 'barley', 'rye', 'malt', 'oats'],
  'soybeans': ['soy', 'soya', 'tofu', 'tempeh', 'miso', 'edamame', 'soy lecithin'],
  'sesame': ['sesame', 'tahini', 'sesame oil'],
  'mustard': ['mustard'],
  'celery': ['celery', 'celeriac'],
  'lupin': ['lupin', 'lupine', 'lupini'],
  'sulfites': ['sulfite', 'sulphite', 'sulfur dioxide', 'e220', 'e221', 'e222', 'e223', 'e224'],
};

function getAllergenSynonyms(allergen: string): string[] {
  const normalized = allergen.toLowerCase().trim();
  for (const [key, synonyms] of Object.entries(ALLERGEN_SYNONYMS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return synonyms;
    }
  }
  return [normalized];
}

function checkAllergenMatch(text: string, allergens: string[], customKeywords: string[]): { matched: boolean; reasons: string[] } {
  const normalizedText = text.toLowerCase();
  const reasons: string[] = [];

  for (const allergen of allergens) {
    const synonyms = getAllergenSynonyms(allergen);
    for (const synonym of synonyms) {
      if (normalizedText.includes(synonym.toLowerCase())) {
        reasons.push(`Contains ${allergen} (detected: ${synonym})`);
        break;
      }
    }
  }

  for (const keyword of customKeywords) {
    if (normalizedText.includes(keyword.toLowerCase())) {
      reasons.push(`Contains custom keyword: ${keyword}`);
    }
  }

  return { matched: reasons.length > 0, reasons };
}

async function lookupProduct(barcode: string) {
  console.log(`[Scan] Looking up product: ${barcode}`);
  
  const cached = await SupabaseService.getProduct(barcode);
  if (cached) {
    console.log(`[Scan] Found cached product: ${cached.product_name}`);
    await SupabaseService.incrementScanCount(barcode).catch(e => 
      console.error('[Scan] Error incrementing scan count:', e)
    );
    return cached;
  }

  const sources = [
    { url: `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, source: 'openfoodfacts' },
    { url: `https://world.openbeautyfacts.org/api/v2/product/${barcode}.json`, source: 'openbeautyfacts' },
    { url: `https://world.openproductsfacts.org/api/v2/product/${barcode}.json`, source: 'openproductsfacts' },
  ];

  for (const { url, source } of sources) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      
      const data = await response.json();
      if (data.status !== 1 || !data.product) continue;

      const p = data.product;
      const productData = {
        code: p.code || barcode,
        product_name: p.product_name || '',
        brands: p.brands,
        image_url: p.image_url,
        image_front_url: p.image_front_url,
        ingredients_text: p.ingredients_text,
        allergens: p.allergens,
        allergens_tags: p.allergens_tags || [],
        traces: p.traces,
        traces_tags: p.traces_tags || [],
        categories: p.categories,
        categories_tags: p.categories_tags || [],
        source,
        cached_at: new Date().toISOString(),
        last_fetched_at: new Date().toISOString(),
        scan_count: 1,
      };

      await SupabaseService.upsertProduct(productData).catch(e => 
        console.error('[Scan] Error caching product:', e)
      );

      console.log(`[Scan] Found product in ${source}: ${productData.product_name}`);
      return productData;
    } catch (error) {
      console.log(`[Scan] Error fetching from ${source}:`, error);
    }
  }

  console.log(`[Scan] Product not found: ${barcode}`);
  return null;
}

export const scanProductRoute = publicProcedure
  .input(scanInputSchema)
  .mutation(async ({ input }) => {
    const { barcode, profile } = input;
    const { allergens, customKeywords } = profile;

    console.log('[Scan] Processing barcode:', barcode);
    console.log('[Scan] Profile allergens:', allergens);
    console.log('[Scan] Custom keywords:', customKeywords);

    const product = await lookupProduct(barcode);

    if (!product) {
      return {
        result: 'CAUTION' as VerdictResult,
        reasons: ['Product not found in database - unable to verify safety'],
        product: null,
      };
    }

    const textToCheck: string[] = [];
    
    if (product.ingredients_text) {
      textToCheck.push(product.ingredients_text);
    }
    if (product.allergens) {
      textToCheck.push(product.allergens);
    }
    if (product.allergens_tags) {
      textToCheck.push(product.allergens_tags.join(' '));
    }
    if (product.traces) {
      textToCheck.push(product.traces);
    }
    if (product.traces_tags) {
      textToCheck.push(product.traces_tags.join(' '));
    }

    const combinedText = textToCheck.join(' ');
    
    if (!combinedText.trim()) {
      return {
        result: 'CAUTION' as VerdictResult,
        reasons: ['No ingredient data available - cannot verify safety'],
        product: {
          code: product.code,
          name: product.product_name || 'Unknown Product',
          brand: product.brands,
          imageUrl: product.image_url || product.image_front_url,
        },
      };
    }

    const ingredientCheck = checkAllergenMatch(combinedText, allergens, customKeywords);

    let tracesReasons: string[] = [];
    if (product.traces || product.traces_tags?.length) {
      const tracesText = [product.traces, ...(product.traces_tags || [])].join(' ');
      const tracesCheck = checkAllergenMatch(tracesText, allergens, customKeywords);
      if (tracesCheck.matched) {
        tracesReasons = tracesCheck.reasons.map(r => r.replace('Contains', 'May contain traces of'));
      }
    }

    let result: VerdictResult;
    let reasons: string[] = [];

    if (ingredientCheck.matched) {
      result = 'AVOID';
      reasons = ingredientCheck.reasons;
    } else if (tracesReasons.length > 0) {
      result = 'CAUTION';
      reasons = tracesReasons;
    } else {
      result = 'SAFE';
      reasons = ['No allergens detected for this profile'];
    }

    console.log('[Scan] Result:', result);
    console.log('[Scan] Reasons:', reasons);

    return {
      result,
      reasons,
      product: {
        code: product.code,
        name: product.product_name || 'Unknown Product',
        brand: product.brands,
        imageUrl: product.image_url || product.image_front_url,
        ingredients: product.ingredients_text,
        allergenTags: product.allergens_tags,
        tracesTags: product.traces_tags,
      },
    };
  });
