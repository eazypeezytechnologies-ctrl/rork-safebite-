import { Product, Profile, Verdict } from '@/types';
import {
  getAllergenDefinition,
  isIngredientAllergen,
} from '@/constants/scientificAllergenDatabase';
import { generateText } from '@rork-ai/toolkit-sdk';

export interface DetectionResult {
  allergen: string;
  confidence: number;
  source: 'scientific_database' | 'ingredient_text' | 'allergen_tags' | 'traces_tags' | 'ai_verification' | 'custom_keyword';
  matchedText: string;
  reason: string;
  severity: 'critical' | 'high' | 'moderate';
}

export interface EnhancedVerdict extends Verdict {
  detectionResults: DetectionResult[];
  confidence: number;
  aiVerified?: boolean;
  detailedReason: string;
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
}

function analyzeIngredientText(
  ingredientsText: string,
  allergen: string
): DetectionResult[] {
  const results: DetectionResult[] = [];
  const normalizedText = normalizeText(ingredientsText);
  const allergenDef = getAllergenDefinition(allergen);
  
  console.log(`\n🔬 SCIENTIFIC ANALYSIS for ${allergen}:`);
  console.log(`Ingredient text: "${ingredientsText.substring(0, 200)}..."`);
  
  if (!allergenDef) {
    console.log(`❌ No definition found for allergen: ${allergen}`);
    return results;
  }
  
  const allSynonyms = [
    ...allergenDef.commonNames,
    ...allergenDef.hiddenSources,
    ...allergenDef.scientificNames.map(s => s.toLowerCase()),
    ...allergenDef.inci.map(i => i.toLowerCase()),
  ];
  
  console.log(`📚 Checking ${allSynonyms.length} possible synonyms...`);
  
  for (const synonym of allSynonyms) {
    const normalizedSynonym = normalizeText(synonym);
    
    const escapedSynonym = normalizedSynonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundaryRegex = new RegExp(`\\b${escapedSynonym}\\b`, 'i');
    const containsRegex = new RegExp(escapedSynonym, 'i');
    
    let matched = false;
    let confidence = 0;
    
    if (wordBoundaryRegex.test(normalizedText)) {
      matched = true;
      confidence = 100;
      console.log(`✅ EXACT MATCH: "${synonym}" (confidence: 100%)`);
    } else if (containsRegex.test(normalizedText)) {
      matched = true;
      confidence = 85;
      console.log(`✅ PARTIAL MATCH: "${synonym}" (confidence: 85%)`);
    }
    
    if (allergenDef.hiddenSources.includes(synonym)) {
      confidence = Math.max(confidence, 95);
    }
    
    if (allergenDef.scientificNames.some(s => s.toLowerCase() === synonym.toLowerCase())) {
      confidence = 100;
    }
    
    if (matched) {
      results.push({
        allergen,
        confidence,
        source: 'ingredient_text',
        matchedText: synonym,
        reason: allergenDef.hiddenSources.includes(synonym)
          ? `Hidden source detected: ${synonym}`
          : `Detected: ${synonym}`,
        severity: allergenDef.severity,
      });
      
      if (allergenDef.notes) {
        console.log(`📝 Note: ${allergenDef.notes}`);
      }
    }
  }
  
  console.log(`Found ${results.length} matches for ${allergen}`);
  
  return results;
}

function analyzeAllergenTags(
  tags: string[] | undefined,
  allergen: string
): DetectionResult[] {
  if (!tags || tags.length === 0) return [];
  
  const results: DetectionResult[] = [];
  const allergenDef = getAllergenDefinition(allergen);
  
  if (!allergenDef) return results;
  
  for (const tag of tags) {
    const normalizedTag = normalizeText(tag.replace(/^en:/, ''));
    
    if (isIngredientAllergen(normalizedTag, allergen)) {
      results.push({
        allergen,
        confidence: 100,
        source: 'allergen_tags',
        matchedText: tag,
        reason: `Listed in allergen tags: ${tag}`,
        severity: allergenDef.severity,
      });
      console.log(`✅ ALLERGEN TAG MATCH: ${tag} → ${allergen}`);
    }
  }
  
  return results;
}

function analyzeTracesTags(
  tags: string[] | undefined,
  allergen: string
): DetectionResult[] {
  if (!tags || tags.length === 0) return [];
  
  const results: DetectionResult[] = [];
  const allergenDef = getAllergenDefinition(allergen);
  
  if (!allergenDef) return results;
  
  for (const tag of tags) {
    const normalizedTag = normalizeText(tag.replace(/^en:/, ''));
    
    if (isIngredientAllergen(normalizedTag, allergen)) {
      results.push({
        allergen,
        confidence: 75,
        source: 'traces_tags',
        matchedText: tag,
        reason: `May contain traces: ${tag}`,
        severity: allergenDef.severity,
      });
      console.log(`⚠️ TRACE TAG MATCH: ${tag} → ${allergen}`);
    }
  }
  
  return results;
}

function analyzeCustomKeywords(
  ingredientsText: string,
  customKeywords: string[]
): DetectionResult[] {
  if (!ingredientsText || customKeywords.length === 0) return [];
  
  const results: DetectionResult[] = [];
  const normalizedText = normalizeText(ingredientsText);
  
  for (const keyword of customKeywords) {
    const normalizedKeyword = normalizeText(keyword);
    const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
    
    if (regex.test(normalizedText)) {
      results.push({
        allergen: keyword,
        confidence: 90,
        source: 'custom_keyword',
        matchedText: keyword,
        reason: `Custom keyword detected: ${keyword}`,
        severity: 'high',
      });
      console.log(`🎯 CUSTOM KEYWORD MATCH: ${keyword}`);
    }
  }
  
  return results;
}

async function verifyWithAI(
  product: Product,
  profile: Profile,
  detectedAllergens: DetectionResult[]
): Promise<{ verified: boolean; additionalFindings: DetectionResult[]; explanation: string }> {
  if (!product.ingredients_text || product.ingredients_text.trim().length === 0) {
    return {
      verified: false,
      additionalFindings: [],
      explanation: 'No ingredients text available for AI verification',
    };
  }
  
  console.log('\n🤖 AI VERIFICATION Starting...');
  
  try {
    const prompt = `You are a medical allergen detection expert with deep knowledge of food science and allergology.

TASK: Verify allergen detection and find hidden allergens.

PRODUCT INFORMATION:
Product: ${product.product_name || 'Unknown'}
Ingredients: ${product.ingredients_text}

USER'S ALLERGIES: ${profile.allergens.join(', ')}

PRELIMINARY DETECTION:
${detectedAllergens.length > 0
  ? detectedAllergens.map(d => `- ${d.allergen}: ${d.matchedText} (${d.reason})`).join('\n')
  : 'No allergens detected yet'
}

YOUR MISSION:
1. Verify each detected allergen is correct
2. Find ANY hidden or derivative allergens we may have missed
3. Check for cross-reactivity issues
4. Look for scientific names, INCI names, or hidden sources

CRITICAL ALLERGIES TO CHECK:
${profile.allergens.map(a => {
  const def = getAllergenDefinition(a);
  return `- ${a}: ${def?.hiddenSources.slice(0, 10).join(', ') || 'various forms'}`;
}).join('\n')}

RESPOND IN THIS EXACT FORMAT:
VERIFICATION: [CONFIRMED/ADDITIONAL_FOUND/SAFE]
ALLERGENS_DETECTED: [comma-separated list of allergens found, or NONE]
EXPLANATION: [detailed explanation of what you found and why]

Be extremely thorough. Lives depend on this.`;

    const response = await generateText({ messages: [{ role: 'user', content: prompt }] });
    
    console.log('🤖 AI Response:', response);
    
    const verificationMatch = response.match(/VERIFICATION:\s*(CONFIRMED|ADDITIONAL_FOUND|SAFE)/i);
    const allergensMatch = response.match(/ALLERGENS_DETECTED:\s*(.+?)(?:\n|$)/i);
    const explanationMatch = response.match(/EXPLANATION:\s*(.+)/is);
    
    const verification = verificationMatch?.[1]?.toUpperCase() || 'SAFE';
    const allergensText = allergensMatch?.[1]?.trim() || 'NONE';
    const explanation = explanationMatch?.[1]?.trim() || response;
    
    const additionalFindings: DetectionResult[] = [];
    
    if (verification === 'ADDITIONAL_FOUND' && allergensText !== 'NONE') {
      const allergens = allergensText.split(',').map(a => a.trim()).filter(a => a && a !== 'NONE');
      
      for (const allergen of allergens) {
        const alreadyDetected = detectedAllergens.some(d => 
          d.allergen.toLowerCase() === allergen.toLowerCase()
        );
        
        if (!alreadyDetected && profile.allergens.some(pa => 
          pa.toLowerCase().includes(allergen.toLowerCase()) || 
          allergen.toLowerCase().includes(pa.toLowerCase())
        )) {
          additionalFindings.push({
            allergen,
            confidence: 80,
            source: 'ai_verification',
            matchedText: 'AI-detected hidden allergen',
            reason: `AI identified potential allergen: ${allergen}`,
            severity: 'high',
          });
          console.log(`🤖 AI FOUND ADDITIONAL: ${allergen}`);
        }
      }
    }
    
    return {
      verified: verification !== 'SAFE',
      additionalFindings,
      explanation,
    };
    
  } catch (error) {
    console.error('❌ AI verification failed:', error);
    return {
      verified: false,
      additionalFindings: [],
      explanation: 'AI verification unavailable',
    };
  }
}

export async function calculateEnhancedVerdict(
  product: Product,
  profile: Profile,
  useAI: boolean = true
): Promise<EnhancedVerdict> {
  console.log('\n═══════════════════════════════════════════════');
  console.log('🛡️ ADVANCED ALLERGEN DETECTION SYSTEM');
  console.log('═══════════════════════════════════════════════');
  console.log(`Product: ${product.product_name}`);
  console.log(`Profile: ${profile.name}`);
  console.log(`Allergens to check: ${profile.allergens.join(', ')}`);
  console.log(`Custom keywords: ${profile.customKeywords.join(', ')}`);
  console.log('═══════════════════════════════════════════════\n');
  
  const allDetectionResults: DetectionResult[] = [];
  
  console.log('📋 PHASE 1: Allergen Tags Analysis');
  for (const allergen of profile.allergens) {
    const tagResults = analyzeAllergenTags(product.allergens_tags, allergen);
    allDetectionResults.push(...tagResults);
  }
  
  console.log('\n📋 PHASE 2: Traces Tags Analysis');
  for (const allergen of profile.allergens) {
    const traceResults = analyzeTracesTags(product.traces_tags, allergen);
    allDetectionResults.push(...traceResults);
  }
  
  console.log('\n📋 PHASE 3: Ingredient Text Analysis');
  if (product.ingredients_text) {
    for (const allergen of profile.allergens) {
      const ingredientResults = analyzeIngredientText(product.ingredients_text, allergen);
      allDetectionResults.push(...ingredientResults);
    }
  }
  
  console.log('\n📋 PHASE 4: Custom Keywords Analysis');
  if (product.ingredients_text && profile.customKeywords.length > 0) {
    const keywordResults = analyzeCustomKeywords(product.ingredients_text, profile.customKeywords);
    allDetectionResults.push(...keywordResults);
  }
  
  let aiVerified = false;
  let aiExplanation = '';
  
  if (useAI && product.ingredients_text && product.ingredients_text.trim().length > 0) {
    console.log('\n📋 PHASE 5: AI Verification (Deep Analysis)');
    const aiResult = await verifyWithAI(product, profile, allDetectionResults);
    aiVerified = aiResult.verified;
    aiExplanation = aiResult.explanation;
    
    if (aiResult.additionalFindings.length > 0) {
      allDetectionResults.push(...aiResult.additionalFindings);
      console.log(`🤖 AI found ${aiResult.additionalFindings.length} additional allergen(s)`);
    }
  }
  
  const uniqueResults = Array.from(
    new Map(allDetectionResults.map(r => [`${r.allergen}-${r.matchedText}`, r])).values()
  );
  
  console.log('\n═══════════════════════════════════════════════');
  console.log(`📊 DETECTION SUMMARY: ${uniqueResults.length} matches found`);
  uniqueResults.forEach(r => {
    console.log(`  • ${r.allergen}: ${r.matchedText} [${r.confidence}%] (${r.source})`);
  });
  console.log('═══════════════════════════════════════════════\n');
  
  const hasData = product.ingredients_text || product.allergens_tags?.length || product.traces_tags?.length;
  
  if (uniqueResults.length === 0) {
    const overallConfidence = hasData ? 95 : 40;
    
    return {
      level: 'safe',
      matches: [],
      message: hasData
        ? 'No listed allergens found for this profile.'
        : 'No ingredient data available - cannot verify safety.',
      missingData: !hasData,
      detectionResults: [],
      confidence: overallConfidence,
      aiVerified,
      detailedReason: hasData
        ? `Thorough analysis found no allergens matching your profile. ${aiVerified ? 'AI verification confirms safety.' : ''}`
        : 'Cannot verify due to missing ingredient information.',
    };
  }
  
  const directDetections = uniqueResults.filter(
    r => r.source === 'allergen_tags' || 
         r.source === 'ingredient_text' || 
         r.source === 'custom_keyword' ||
         r.source === 'ai_verification'
  );
  
  const maxConfidence = Math.max(...uniqueResults.map(r => r.confidence));
  
  if (directDetections.length > 0) {
    const allergenList = Array.from(new Set(directDetections.map(r => r.allergen))).join(', ');
    
    const detailedReason = directDetections.map(r => 
      `${r.allergen}: ${r.reason} (confidence: ${r.confidence}%)`
    ).join('\n');
    
    return {
      level: 'danger',
      matches: uniqueResults.map(r => ({
        allergen: r.allergen,
        source: r.source === 'allergen_tags' ? 'allergens_tags' : 
                r.source === 'traces_tags' ? 'traces_tags' :
                r.source === 'custom_keyword' ? 'custom_keyword' : 'ingredients',
        matchedText: r.matchedText,
      })),
      message: `⚠️ CONTAINS: ${allergenList}`,
      missingData: false,
      detectionResults: uniqueResults,
      confidence: maxConfidence,
      aiVerified,
      detailedReason: `DANGER - Direct allergen detected:\n${detailedReason}${aiVerified ? '\n\nAI verification: ' + aiExplanation : ''}`,
    };
  }
  
  const traceAllergens = Array.from(new Set(uniqueResults.map(r => r.allergen))).join(', ');
  const detailedReason = uniqueResults.map(r => 
    `${r.allergen}: ${r.reason} (confidence: ${r.confidence}%)`
  ).join('\n');
  
  return {
    level: 'caution',
    matches: uniqueResults.map(r => ({
      allergen: r.allergen,
      source: 'traces_tags',
      matchedText: r.matchedText,
    })),
    message: `May contain traces: ${traceAllergens}`,
    missingData: false,
    detectionResults: uniqueResults,
    confidence: maxConfidence,
    aiVerified,
    detailedReason: `CAUTION - Possible cross-contamination:\n${detailedReason}${aiVerified ? '\n\nAI verification: ' + aiExplanation : ''}`,
  };
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return '#DC2626';
  if (confidence >= 75) return '#F59E0B';
  if (confidence >= 60) return '#FCD34D';
  return '#9CA3AF';
}

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 90) return 'Very High';
  if (confidence >= 75) return 'High';
  if (confidence >= 60) return 'Moderate';
  if (confidence >= 40) return 'Low';
  return 'Very Low';
}
