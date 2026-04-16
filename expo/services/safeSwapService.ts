import { Product, Profile, Verdict, ProductType } from '@/types';
import { generateText } from '@rork-ai/toolkit-sdk';
import Constants from 'expo-constants';
import { getUserCategoryOverride } from '@/storage/productCache';

export interface SafeSwap {
  productName: string;
  brand: string;
  reason: string;
  whereToFind: string;
  features?: string[];
  verified: boolean;
}

export interface SafeSwapRecommendation {
  type: 'unsafe' | 'no-data';
  unsafeProduct: Product;
  allergens: string[];
  alternatives: string;
  isLoading: boolean;
  error?: string;
}

function detectProductType(product: Product, overrideType?: ProductType | null): { type: string; isFood: boolean; isSkincare: boolean; isBeauty: boolean; category: string } {
  if (overrideType) {
    console.log('[SafeSwap] Using persisted category override:', overrideType);
    const isFood = overrideType === 'food';
    const isSkincare = overrideType === 'skin';
    const isHair = overrideType === 'hair';
    return {
      type: isFood ? 'food product' : isSkincare ? 'skincare/beauty product' : isHair ? 'hair product' : 'general product',
      isFood,
      isSkincare: isSkincare || isHair,
      isBeauty: isSkincare || isHair,
      category: product.categories || (isFood ? 'food product' : isSkincare ? 'skincare product' : isHair ? 'hair product' : 'product'),
    };
  }

  if (product.product_type) {
    console.log('[SafeSwap] Using product.product_type:', product.product_type);
    const isFood = product.product_type === 'food';
    const isSkincare = product.product_type === 'skin';
    const isHair = product.product_type === 'hair';
    return {
      type: isFood ? 'food product' : isSkincare ? 'skincare/beauty product' : isHair ? 'hair product' : 'general product',
      isFood,
      isSkincare: isSkincare || isHair,
      isBeauty: isSkincare || isHair,
      category: product.categories || (isFood ? 'food product' : isSkincare ? 'skincare product' : isHair ? 'hair product' : 'product'),
    };
  }

  const productName = (product.product_name || '').toLowerCase();
  const categories = (product.categories || '').toLowerCase();
  const source = product.source;
  
  const skincareKeywords = ['cream', 'lotion', 'serum', 'moisturizer', 'cleanser', 'mask', 'toner', 'face', 'skin', 'beauty', 'cosmetic', 'makeup', 'lipstick', 'foundation', 'hydrat'];
  const foodKeywords = ['cookie', 'food', 'snack', 'drink', 'beverage', 'meal', 'breakfast', 'lunch', 'dinner', 'eat', 'nutrition'];
  
  const isSkincare = source === 'openbeautyfacts' || 
    skincareKeywords.some(kw => productName.includes(kw) || categories.includes(kw));
  
  const isBeauty = isSkincare;
  
  const isFood = source === 'openfoodfacts' || source === 'usda' || 
    foodKeywords.some(kw => productName.includes(kw) || categories.includes(kw));
  
  let type = 'general product';
  let category = product.categories || 'product';
  
  if (isSkincare) {
    type = 'skincare/beauty product';
    if (productName.includes('mask')) category = 'face mask';
    else if (productName.includes('cream')) category = 'cream';
    else if (productName.includes('lotion')) category = 'lotion';
    else if (productName.includes('serum')) category = 'serum';
    else category = 'skincare product';
  } else if (isFood) {
    type = 'food product';
    if (productName.includes('cookie')) category = 'cookies';
    else if (productName.includes('snack')) category = 'snack';
    else category = product.categories || 'food product';
  }
  
  return { type, isFood, isSkincare, isBeauty, category };
}

export async function generateSafeSwaps(
  product: Product,
  verdict: Verdict,
  profile: Profile
): Promise<string> {
  console.log('Generating safe swap recommendations...');
  
  try {
    const toolkitUrl = Constants.expoConfig?.extra?.EXPO_PUBLIC_TOOLKIT_URL || 'https://toolkit.rork.com';
    console.log('Using Toolkit URL:', toolkitUrl);
    
    const categoryOverride = await getUserCategoryOverride(product.code).catch(() => null);
    const productInfo = detectProductType(product, categoryOverride);
    const allergenList = verdict.matches.map((m: any) => m.allergen).join(', ');
    
    const productContext = `
Product: ${product.product_name || 'Unknown'}
Brand: ${product.brands || 'Unknown'}
Product Type: ${productInfo.type}
Specific Category: ${productInfo.category}
IS THIS A FOOD PRODUCT: ${productInfo.isFood ? 'YES' : 'NO'}
IS THIS A SKINCARE/BEAUTY PRODUCT: ${productInfo.isSkincare ? 'YES' : 'NO'}
`;
    
    const categoryGuidance = productInfo.isSkincare 
      ? '\n\nIMPORTANT: This is a SKINCARE/BEAUTY product. Only recommend OTHER SKINCARE/BEAUTY products. DO NOT recommend food products.'
      : productInfo.isFood
      ? '\n\nIMPORTANT: This is a FOOD product. Only recommend OTHER FOOD products. DO NOT recommend skincare or beauty products.'
      : '\n\nIMPORTANT: Match the product type exactly. If it\'s a household product, recommend household products. If it\'s a personal care item, recommend personal care items.';
    
    const prompt = `You are a product recommendation expert specializing in allergen-free alternatives.

UNSAFE PRODUCT DETECTED:${productContext}Detected Allergens: ${allergenList}

User's Allergies: ${profile.allergens.join(', ')}${categoryGuidance}

Please recommend 4-6 specific SAFE ALTERNATIVE products that:
1. Are in the EXACT SAME CATEGORY as the unsafe product (${productInfo.category})
2. Are COMPLETELY FREE from: ${profile.allergens.join(', ')}
3. Are commonly available in major stores
4. Include SPECIFIC brand names AND full product names
5. Match the product type (${productInfo.type})

For each recommendation, provide in this format:
**[Number]. [Brand Name] - [Product Name]**
• Why it's safe: [Clear explanation of why it doesn't contain the allergens]
• Where to find: [Specific stores like ${productInfo.isSkincare ? 'Sephora, Ulta, Target Beauty, CVS, Walgreens' : 'Walmart, Target, Whole Foods, Amazon, local grocery stores'}]
• Special features: [Any certifications like allergen-free certified, hypoallergenic, fragrance-free, organic, vegan, etc.]

Format your response as a clear, numbered list with bullet points under each item.

CRITICAL REQUIREMENTS:
- MUST be same product type: ${productInfo.type}
- Only recommend products that are DEFINITELY and VERIFIED free from ${allergenList}
- Do NOT recommend products that "may contain traces" of these allergens
- Be specific with brand names and FULL product names
- When in doubt about safety, DO NOT recommend it
${productInfo.isSkincare ? '- For skincare: Consider hypoallergenic brands like Vanicream, CeraVe, Cetaphil, La Roche-Posay' : ''}
${productInfo.isFood ? '- For food: Consider allergen-free brands like Enjoy Life, Free2b, 88 Acres, Simple Mills' : ''}

Remember: People with severe allergies trust these recommendations with their lives. Be absolutely certain about safety AND product category match.`;

    const recommendations = await generateText({ 
      messages: [{ role: 'user', content: prompt }] 
    });
    
    console.log('Safe swap recommendations generated successfully');
    return recommendations;
  } catch (error: any) {
    console.error('Error generating safe swap recommendations:', error);
    const errorMessage = error?.message || 'Unknown error';
    
    if (errorMessage.includes('Network request failed') || errorMessage.includes('not configured')) {
      return generateFallbackRecommendations(product, profile);
    }
    
    throw error;
  }
}

export async function generateNoDataSwaps(
  product: Product,
  profile: Profile
): Promise<string> {
  console.log('Generating safe swaps for product with no ingredient data...');
  
  try {
    const categoryOverride = await getUserCategoryOverride(product.code).catch(() => null);
    const productInfo = detectProductType(product, categoryOverride);
    
    const productContext = `
Product: ${product.product_name || 'Unknown Product'}
Brand: ${product.brands || 'Unknown'}
Product Type: ${productInfo.type}
Specific Category: ${productInfo.category}
IS THIS A FOOD PRODUCT: ${productInfo.isFood ? 'YES' : 'NO'}
IS THIS A SKINCARE/BEAUTY PRODUCT: ${productInfo.isSkincare ? 'YES' : 'NO'}
Issue: This product has NO ingredient data available, making it unsafe for allergy sufferers.
`;
    
    const categoryGuidance = productInfo.isSkincare 
      ? '\n\nIMPORTANT: This is a SKINCARE/BEAUTY product. Only recommend OTHER SKINCARE/BEAUTY products with clear ingredient labels. DO NOT recommend food products.'
      : productInfo.isFood
      ? '\n\nIMPORTANT: This is a FOOD product. Only recommend OTHER FOOD products with clear ingredient labels. DO NOT recommend skincare or beauty products.'
      : '\n\nIMPORTANT: Match the product type exactly with products that have transparent ingredient labeling.';
    
    const prompt = `You are a product recommendation expert specializing in allergen-free alternatives.

PRODUCT WITHOUT INGREDIENT DATA:${productContext}
User's Allergies: ${profile.allergens.join(', ')}${categoryGuidance}

Please recommend 4-6 ALTERNATIVE products in the same category that:
1. Are in the EXACT SAME CATEGORY as this product (${productInfo.category})
2. Are COMPLETELY FREE from: ${profile.allergens.join(', ')}
3. HAVE CLEAR ingredient labels and allergen information
4. Are commonly available in major stores
5. Include SPECIFIC brand names AND full product names
6. Match the product type (${productInfo.type})

For each recommendation, provide in this format:
**[Number]. [Brand Name] - [Product Name]**
• Why it's safe: [Clear explanation of allergen-free status and transparency]
• Where to find: [Specific stores like ${productInfo.isSkincare ? 'Sephora, Ulta, Target Beauty, CVS, Walgreens, dermatologist offices' : 'Walmart, Target, Whole Foods, Amazon, local stores'}]
• Special features: [Certifications like allergen-free certified, hypoallergenic, clearly labeled, etc.]

Format your response as a clear, numbered list with bullet points under each item.

CRITICAL REQUIREMENTS:
- MUST be same product type: ${productInfo.type}
- Only recommend products that HAVE CLEAR INGREDIENT LISTINGS
- Products must be VERIFIED free from ${profile.allergens.join(', ')}
- Do NOT recommend obscure products or products that are hard to verify
- Prefer brands known for allergen transparency and clear labeling
- When in doubt about safety, DO NOT recommend it
${productInfo.isSkincare ? '- For skincare: Recommend brands like Vanicream, CeraVe (fragrance-free), Cetaphil, La Roche-Posay, which have clear ingredient lists' : ''}
${productInfo.isFood ? '- For food: Recommend brands like Enjoy Life, Free2b, 88 Acres, Simple Mills, which list all ingredients clearly' : ''}

Remember: This person needs products they can trust with clear labeling in the SAME CATEGORY. Transparency and category match are both key.`;

    const recommendations = await generateText({ 
      messages: [{ role: 'user', content: prompt }] 
    });
    
    console.log('No-data safe swap recommendations generated successfully');
    return recommendations;
  } catch (error: any) {
    console.error('Error generating no-data safe swap recommendations:', error);
    return generateFallbackRecommendations(product, profile);
  }
}

function generateFallbackRecommendations(product: Product, profile: Profile): string {
  const allergens = profile.allergens.join(', ');
  const productCategory = product.categories || 'this type of product';
  
  return `⚠️ AI Recommendations Currently Unavailable

While we work to restore this feature, here are comprehensive tips for finding safe alternatives to ${product.product_name || 'this product'}:

**1. Look for "Free-From" Brands**
Search for brands that specialize in ${allergens}-free products. Popular options include:
• Enjoy Life Foods (free from top 14 allergens)
• Free2b Foods (nut and gluten-free)
• 88 Acres (seed-based, free from common allergens)
• Simple Mills (allergen-friendly baking mixes)
• Divvies (allergy-friendly snacks)

**2. Shop Specialty Sections**
• Health food stores often have dedicated allergen-free aisles
• Look for "Free From" sections in major supermarkets
• Try Whole Foods, Sprouts, or Natural Grocers
• Online: Thrive Market, Amazon's allergen-free section

**3. Use Allergy-Specific Apps**
Download these apps to find safe alternatives:
• Spokin - Community-driven allergen-free product reviews
• Fig - Scans products for your specific allergens
• Yummly - Filter recipes by allergens

**4. Contact Manufacturers**
• Call or email brands directly to verify allergen safety
• Ask about manufacturing facilities and cross-contamination
• Request allergen statements for specific products

**5. Join Support Communities**
• Food Allergy Research & Education (FARE) community
• AllergyEats app and reviews
• Facebook groups for specific allergies
• Reddit communities (r/FoodAllergies, r/Allergies)

**6. Check These Certifications**
Look for products with:
• "Certified Gluten-Free" (if applicable)
• "Peanut Free" or "Tree Nut Free" facility
• GFCO (Gluten-Free Certification Organization)
• Safe Quality Food (SQF) certification

**7. Smart Shopping Tips**
• Always read ingredient labels, even on "safe" brands
• Check for "manufactured in a facility that processes..."
• Look for products with clear allergen statements
• Avoid products with vague ingredients like "natural flavors"
• When in doubt, choose whole foods over processed

**Allergens to Avoid**: ${allergens}

**Category**: Looking for ${productCategory} alternatives

${profile.hasAnaphylaxis ? '**⚡ IMPORTANT**: You have marked anaphylaxis risk. Always verify with manufacturers and your allergist before trying new products. Keep your epinephrine auto-injector with you at all times.' : ''}

**Remember**: 
✅ Verify all ingredients on the physical product label
✅ Be aware that formulations can change
✅ If a product doesn't list ingredients clearly, avoid it
✅ Consult your allergist for personalized recommendations
✅ Report any reactions to your healthcare provider

**Store Recommendations by Allergen**:
${generateStoreRecommendations(profile.allergens)}`;
}

function generateStoreRecommendations(allergens: string[]): string {
  const recommendations: string[] = [];
  
  for (const allergen of allergens) {
    const normalized = allergen.toLowerCase();
    
    if (normalized.includes('nut') || normalized.includes('peanut')) {
      recommendations.push('• Nut allergies: Sunbutter products (sunflower seed butter), WowButter (soy butter)');
    }
    if (normalized.includes('dairy') || normalized.includes('milk')) {
      recommendations.push('• Dairy-free: Oatly, Ripple, Kite Hill, Miyoko\'s, Daiya');
    }
    if (normalized.includes('gluten') || normalized.includes('wheat')) {
      recommendations.push('• Gluten-free: King Arthur GF flour, Bob\'s Red Mill, Canyon Bakehouse bread');
    }
    if (normalized.includes('egg')) {
      recommendations.push('• Egg-free: JUST Egg, Bob\'s Red Mill Egg Replacer, Follow Your Heart VeganEgg');
    }
    if (normalized.includes('soy')) {
      recommendations.push('• Soy-free: Coconut aminos (soy sauce alternative), soy-free Earth Balance butter');
    }
  }
  
  return recommendations.length > 0 ? recommendations.join('\n') : '• Check store allergen-free sections for alternatives';
}
