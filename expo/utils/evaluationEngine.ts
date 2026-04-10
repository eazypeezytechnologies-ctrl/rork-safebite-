import { Product, Profile, AllergenMatch, EczemaTriggerMatch, VerdictLevel } from '@/types';
import { findEczemaTriggerMatches } from '@/constants/eczemaTriggers';
import { findFoodSensitivityMatches } from '@/constants/sensitivityTriggers';
import {
  getAllergenDefinition,
  isIngredientAllergen,
  getAllSynonymsForAllergen,
} from '@/constants/scientificAllergenDatabase';

export type EvalVerdict = 'Safe' | 'Caution' | 'Avoid' | 'Unknown';
export type EvalConfidence = 'High' | 'Medium' | 'Low';
export type ConcernType = 'allergy' | 'sensitivity' | 'eczema';

export interface MatchedConcern {
  ingredient: string;
  matchedText: string;
  profileAllergen: string;
  concernType: ConcernType;
  source: 'allergen_tag' | 'ingredient_text' | 'traces_tag' | 'custom_keyword' | 'eczema_trigger' | 'food_sensitivity';
  severityHint: 'critical' | 'high' | 'moderate' | 'low';
  notes?: string;
}

export interface AdvisoryMatch {
  type: 'may_contain' | 'facility_warning';
  allergen: string;
  rawText: string;
  affectsSevereAllergen: boolean;
}

export interface ConfidenceReason {
  factor: string;
  impact: 'positive' | 'negative';
  detail: string;
}

export interface ProfileImpact {
  profileId: string;
  profileName: string;
  relationship?: string;
  avatarColor?: string;
  verdict: EvalVerdict;
  concerns: MatchedConcern[];
  advisoryMatches: AdvisoryMatch[];
  hasAnaphylaxisRisk: boolean;
  explanation: string;
}

export interface EvaluationResult {
  verdict: EvalVerdict;
  confidence: EvalConfidence;
  confidenceScore: number;
  confidenceReasons: ConfidenceReason[];
  matchedConcerns: MatchedConcern[];
  advisoryMatches: AdvisoryMatch[];
  explanationSummary: string;
  explanationDetails: string[];
  householdSummary: ProfileImpact[] | null;
  overallHouseholdVerdict: EvalVerdict | null;
  trustFooter: string;
}

const TRUST_FOOTER = 'Not medical advice. For severe allergies, verify with the manufacturer.';

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s\-&/,;().]/g, ' ').replace(/\s+/g, ' ');
}

function detectAllergenMatches(
  product: Product,
  allergens: string[],
  customKeywords: string[],
  hasAnaphylaxis: boolean,
): { concerns: MatchedConcern[]; advisories: AdvisoryMatch[] } {
  const concerns: MatchedConcern[] = [];
  const advisories: AdvisoryMatch[] = [];
  const foundKeys = new Set<string>();

  console.log('[EvalEngine] Checking allergens:', allergens.join(', '));

  for (const allergen of allergens) {
    const allergenDef = getAllergenDefinition(allergen);
    const severity: 'critical' | 'high' | 'moderate' = allergenDef?.severity ?? 'high';

    if (product.allergens_tags && product.allergens_tags.length > 0) {
      for (const tag of product.allergens_tags) {
        const normalizedTag = tag.replace(/^en:/, '').toLowerCase().trim();
        if (isIngredientAllergen(normalizedTag, allergen) || normalizedTag.includes(allergen.toLowerCase()) || allergen.toLowerCase().includes(normalizedTag)) {
          const key = `allergy-allergen_tag-${allergen}-${tag}`;
          if (!foundKeys.has(key)) {
            foundKeys.add(key);
            concerns.push({
              ingredient: tag,
              matchedText: tag,
              profileAllergen: allergen,
              concernType: 'allergy',
              source: 'allergen_tag',
              severityHint: severity,
            });
            console.log(`[EvalEngine] ALLERGEN TAG MATCH: ${tag} -> ${allergen}`);
          }
        }
      }
    }

    if (product.traces_tags && product.traces_tags.length > 0) {
      for (const tag of product.traces_tags) {
        const normalizedTag = tag.replace(/^en:/, '').toLowerCase().trim();
        if (isIngredientAllergen(normalizedTag, allergen) || normalizedTag.includes(allergen.toLowerCase()) || allergen.toLowerCase().includes(normalizedTag)) {
          const key = `advisory-traces-${allergen}-${tag}`;
          if (!foundKeys.has(key)) {
            foundKeys.add(key);
            advisories.push({
              type: 'may_contain',
              allergen,
              rawText: tag,
              affectsSevereAllergen: hasAnaphylaxis,
            });
            console.log(`[EvalEngine] TRACES TAG MATCH: ${tag} -> ${allergen}`);
          }
        }
      }
    }

    if (product.ingredients_text && product.ingredients_text.trim().length > 0) {
      const normalizedIngredients = normalizeText(product.ingredients_text);

      const allSynonyms = getAllSynonymsForAllergen(allergen);
      const extraSynonyms = allergenDef
        ? [
            ...allergenDef.commonNames,
            ...allergenDef.hiddenSources,
            ...allergenDef.scientificNames.map(s => s.toLowerCase()),
            ...allergenDef.inci.map(i => i.toLowerCase()),
          ]
        : [];

      const combinedSynonyms = Array.from(new Set([...allSynonyms, ...extraSynonyms]));

      for (const synonym of combinedSynonyms) {
        const normalizedSynonym = normalizeText(synonym);
        if (normalizedSynonym.length < 2) continue;

        const escapedSynonym = normalizedSynonym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        let matched = false;
        try {
          const wordBoundaryRegex = new RegExp(`\\b${escapedSynonym}\\b`, 'i');
          matched = wordBoundaryRegex.test(normalizedIngredients);
        } catch {
          matched = normalizedIngredients.includes(normalizedSynonym);
        }

        if (matched) {
          const key = `allergy-ingredient_text-${allergen}-${synonym}`;
          if (!foundKeys.has(key)) {
            foundKeys.add(key);
            const isHidden = allergenDef?.hiddenSources.some(h => h.toLowerCase() === synonym.toLowerCase()) ?? false;
            concerns.push({
              ingredient: synonym,
              matchedText: synonym,
              profileAllergen: allergen,
              concernType: 'allergy',
              source: 'ingredient_text',
              severityHint: severity,
              notes: isHidden ? `Hidden source of ${allergen}` : undefined,
            });
            console.log(`[EvalEngine] INGREDIENT TEXT MATCH: "${synonym}" -> ${allergen}${isHidden ? ' (hidden source)' : ''}`);
            break;
          }
        }
      }
    }
  }

  if (product.ingredients_text && customKeywords.length > 0) {
    const normalizedIngredients = normalizeText(product.ingredients_text);
    for (const keyword of customKeywords) {
      const normalizedKeyword = normalizeText(keyword);
      const escapedKeyword = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
        if (regex.test(normalizedIngredients)) {
          const key = `allergy-custom_keyword-${keyword}`;
          if (!foundKeys.has(key)) {
            foundKeys.add(key);
            concerns.push({
              ingredient: keyword,
              matchedText: keyword,
              profileAllergen: keyword,
              concernType: 'allergy',
              source: 'custom_keyword',
              severityHint: 'high',
            });
            console.log(`[EvalEngine] CUSTOM KEYWORD MATCH: "${keyword}"`);
          }
        }
      } catch {
        if (normalizedIngredients.includes(normalizedKeyword)) {
          const key = `allergy-custom_keyword-${keyword}`;
          if (!foundKeys.has(key)) {
            foundKeys.add(key);
            concerns.push({
              ingredient: keyword,
              matchedText: keyword,
              profileAllergen: keyword,
              concernType: 'allergy',
              source: 'custom_keyword',
              severityHint: 'high',
            });
          }
        }
      }
    }
  }

  parseAdvisoryWarnings(product, allergens, hasAnaphylaxis, advisories, foundKeys);

  return { concerns, advisories };
}

function parseAdvisoryWarnings(
  product: Product,
  allergens: string[],
  hasAnaphylaxis: boolean,
  advisories: AdvisoryMatch[],
  foundKeys: Set<string>,
): void {
  if (!product.ingredients_text) return;

  const text = product.ingredients_text.toLowerCase();

  const mayContainPatterns = [
    /may contain[:\s]+([^.]+)/gi,
    /may also contain[:\s]+([^.]+)/gi,
    /produced in a facility[^.]*(?:that also processes|with)[:\s]+([^.]+)/gi,
    /manufactured in[^.]*(?:that handles|with|processing)[:\s]+([^.]+)/gi,
    /made on[^.]*equipment[^.]*(?:that also processes|with)[:\s]+([^.]+)/gi,
    /shared equipment[^.]*(?:with|:)\s+([^.]+)/gi,
  ];

  for (const pattern of mayContainPatterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text)) !== null) {
      const warningText = match[1]?.trim() ?? '';
      if (!warningText) continue;

      const isFacility = /facility|equipment|manufactured|made on/i.test(match[0]);

      for (const allergen of allergens) {
        const normalizedAllergen = allergen.toLowerCase();
        if (warningText.includes(normalizedAllergen)) {
          const key = `advisory-${isFacility ? 'facility' : 'may_contain'}-${allergen}`;
          if (!foundKeys.has(key)) {
            foundKeys.add(key);
            advisories.push({
              type: isFacility ? 'facility_warning' : 'may_contain',
              allergen,
              rawText: match[0].trim(),
              affectsSevereAllergen: hasAnaphylaxis,
            });
            console.log(`[EvalEngine] ADVISORY WARNING: ${isFacility ? 'facility' : 'may_contain'} -> ${allergen}`);
          }
        }
      }
    }
  }
}

function detectEczemaAndSensitivityConcerns(
  product: Product,
  profile: Profile,
): MatchedConcern[] {
  const concerns: MatchedConcern[] = [];

  if (!product.ingredients_text) return concerns;
  if (!profile.trackEczemaTriggers || !profile.eczemaTriggerGroups || profile.eczemaTriggerGroups.length === 0) {
    return concerns;
  }

  console.log('[EvalEngine] Checking eczema triggers for groups:', profile.eczemaTriggerGroups.join(', '));

  const skincareTriggers = findEczemaTriggerMatches(
    product.ingredients_text,
    profile.eczemaTriggerGroups,
  );

  for (const match of skincareTriggers) {
    concerns.push({
      ingredient: match.trigger.name,
      matchedText: match.matchedText,
      profileAllergen: match.trigger.triggerGroup,
      concernType: 'eczema',
      source: 'eczema_trigger',
      severityHint: match.trigger.severityHint,
      notes: match.trigger.notes,
    });
    console.log(`[EvalEngine] ECZEMA TRIGGER: ${match.trigger.name} (${match.trigger.triggerGroup})`);
  }

  const foodSensitivities = findFoodSensitivityMatches(
    product.ingredients_text,
    profile.eczemaTriggerGroups,
  );

  const foundSensitivities = new Set(concerns.map(c => c.ingredient));
  for (const match of foodSensitivities) {
    if (!foundSensitivities.has(match.trigger.label)) {
      concerns.push({
        ingredient: match.trigger.label,
        matchedText: match.matchedKeyword,
        profileAllergen: match.trigger.id,
        concernType: 'sensitivity',
        source: 'food_sensitivity',
        severityHint: 'moderate',
      });
      console.log(`[EvalEngine] FOOD SENSITIVITY: ${match.trigger.label} (keyword: ${match.matchedKeyword})`);
    }
  }

  if (profile.avoidIngredients && profile.avoidIngredients.length > 0 && product.ingredients_text) {
    const normalizedText = normalizeText(product.ingredients_text);
    for (const avoid of profile.avoidIngredients) {
      const normalizedAvoid = normalizeText(avoid);
      if (normalizedText.includes(normalizedAvoid)) {
        concerns.push({
          ingredient: avoid,
          matchedText: avoid,
          profileAllergen: avoid,
          concernType: 'sensitivity',
          source: 'custom_keyword',
          severityHint: 'high',
          notes: 'Custom avoid ingredient',
        });
        console.log(`[EvalEngine] AVOID INGREDIENT: ${avoid}`);
      }
    }
  }

  return concerns;
}

export function determineVerdict(
  allergyConcerns: MatchedConcern[],
  sensitivityConcerns: MatchedConcern[],
  advisoryMatches: AdvisoryMatch[],
  hasAnyData: boolean,
  hasAnaphylaxis: boolean,
): EvalVerdict {
  if (!hasAnyData) {
    return 'Unknown';
  }

  const directAllergyMatches = allergyConcerns.filter(
    c => c.concernType === 'allergy' && (c.source === 'allergen_tag' || c.source === 'ingredient_text' || c.source === 'custom_keyword'),
  );

  if (directAllergyMatches.length > 0) {
    console.log(`[EvalEngine] VERDICT: Avoid (${directAllergyMatches.length} direct allergen matches)`);
    return 'Avoid';
  }

  const highSeveritySensitivities = sensitivityConcerns.filter(
    c => c.severityHint === 'high' || c.severityHint === 'critical',
  );

  if (highSeveritySensitivities.length > 0 && hasAnaphylaxis) {
    console.log('[EvalEngine] VERDICT: Avoid (high-severity sensitivity + anaphylaxis risk)');
    return 'Avoid';
  }

  const severeAdvisories = advisoryMatches.filter(a => a.affectsSevereAllergen);
  if (severeAdvisories.length > 0) {
    console.log('[EvalEngine] VERDICT: Caution (advisory warnings affecting severe allergens)');
    return 'Caution';
  }

  if (sensitivityConcerns.length > 0) {
    console.log(`[EvalEngine] VERDICT: Caution (${sensitivityConcerns.length} sensitivity/eczema concerns)`);
    return 'Caution';
  }

  if (advisoryMatches.length > 0) {
    console.log(`[EvalEngine] VERDICT: Caution (${advisoryMatches.length} advisory warnings)`);
    return 'Caution';
  }

  console.log('[EvalEngine] VERDICT: Safe');
  return 'Safe';
}

export function scoreConfidence(
  product: Product,
): { score: number; confidence: EvalConfidence; reasons: ConfidenceReason[] } {
  const reasons: ConfidenceReason[] = [];
  let score = 0;
  const maxScore = 100;

  const hasIngredients = !!product.ingredients_text?.trim();
  const ingredientLength = (product.ingredients_text ?? '').trim().length;

  if (hasIngredients && ingredientLength > 100) {
    score += 35;
    reasons.push({ factor: 'Ingredient list', impact: 'positive', detail: 'Comprehensive ingredient data available' });
  } else if (hasIngredients) {
    score += 20;
    reasons.push({ factor: 'Ingredient list', impact: 'positive', detail: 'Limited ingredient data available' });
  } else {
    reasons.push({ factor: 'Ingredient list', impact: 'negative', detail: 'No ingredient data — cannot fully verify safety' });
  }

  const hasAllergenTags = (product.allergens_tags?.length ?? 0) > 0;
  if (hasAllergenTags) {
    score += 20;
    reasons.push({ factor: 'Allergen tags', impact: 'positive', detail: `${product.allergens_tags!.length} allergen tag(s) from database` });
  } else {
    reasons.push({ factor: 'Allergen tags', impact: 'negative', detail: 'No structured allergen tags available' });
  }

  const hasTracesTags = (product.traces_tags?.length ?? 0) > 0;
  if (hasTracesTags) {
    score += 10;
    reasons.push({ factor: 'Traces data', impact: 'positive', detail: 'Trace/cross-contamination data available' });
  }

  const reliableSources = ['openfoodfacts', 'openbeautyfacts', 'usda', 'nutritionix'];
  if (reliableSources.includes(product.source)) {
    score += 15;
    reasons.push({ factor: 'Data source', impact: 'positive', detail: `Verified database: ${product.source}` });
  } else if (product.source === 'manual_entry') {
    score += 5;
    reasons.push({ factor: 'Data source', impact: 'negative', detail: 'Manual entry — data not independently verified' });
  } else {
    score += 8;
    reasons.push({ factor: 'Data source', impact: 'negative', detail: `Source: ${product.source} (limited verification)` });
  }

  if (product.lastUpdated) {
    const ageMs = Date.now() - new Date(product.lastUpdated).getTime();
    const sixMonths = 180 * 24 * 60 * 60 * 1000;
    const oneYear = 365 * 24 * 60 * 60 * 1000;

    if (ageMs < sixMonths) {
      score += 10;
      reasons.push({ factor: 'Data freshness', impact: 'positive', detail: 'Recently updated product data' });
    } else if (ageMs < oneYear) {
      score += 5;
      reasons.push({ factor: 'Data freshness', impact: 'negative', detail: 'Product data is over 6 months old' });
    } else {
      reasons.push({ factor: 'Data freshness', impact: 'negative', detail: 'Stale product data — may be outdated' });
    }
  } else {
    reasons.push({ factor: 'Data freshness', impact: 'negative', detail: 'No update timestamp available' });
  }

  if (product.product_name?.trim()) {
    score += 5;
  }
  if (product.brands?.trim()) {
    score += 5;
  }

  const clampedScore = Math.min(maxScore, Math.max(0, score));

  let confidence: EvalConfidence;
  if (clampedScore >= 65) {
    confidence = 'High';
  } else if (clampedScore >= 35) {
    confidence = 'Medium';
  } else {
    confidence = 'Low';
  }

  console.log(`[EvalEngine] Confidence: ${clampedScore}/100 (${confidence})`);

  return { score: clampedScore, confidence, reasons };
}

export function generateExplanation(
  verdict: EvalVerdict,
  concerns: MatchedConcern[],
  advisories: AdvisoryMatch[],
  confidence: EvalConfidence,
  confidenceReasons: ConfidenceReason[],
  profileName: string,
): { summary: string; details: string[] } {
  const details: string[] = [];

  if (verdict === 'Unknown') {
    return {
      summary: `Cannot determine safety for ${profileName}. Ingredient data is missing or too incomplete to evaluate.`,
      details: [
        'This product has no ingredient information in any database.',
        'Read the physical label or contact the manufacturer for ingredient details.',
        ...confidenceReasons.filter(r => r.impact === 'negative').map(r => r.detail),
      ],
    };
  }

  if (verdict === 'Safe') {
    const negativeFactors = confidenceReasons.filter(r => r.impact === 'negative');
    const caveat = negativeFactors.length > 0
      ? ` However, confidence is ${confidence} due to: ${negativeFactors.map(r => r.detail.toLowerCase()).join('; ')}.`
      : '';
    return {
      summary: `No known concerns found for ${profileName}.${caveat}`,
      details: [
        'All available ingredient data was checked against the profile.',
        'No allergen, sensitivity, or eczema trigger matches found.',
        ...negativeFactors.map(r => `Note: ${r.detail}`),
      ],
    };
  }

  const allergyConcerns = concerns.filter(c => c.concernType === 'allergy');
  const eczemaConcerns = concerns.filter(c => c.concernType === 'eczema');
  const sensitivityConcerns = concerns.filter(c => c.concernType === 'sensitivity');

  const parts: string[] = [];

  if (allergyConcerns.length > 0) {
    const allergenNames = Array.from(new Set(allergyConcerns.map(c => c.profileAllergen)));
    parts.push(`Contains ${allergenNames.join(', ')}`);

    for (const c of allergyConcerns) {
      let detail = `"${c.matchedText}" matched your "${c.profileAllergen}" allergen`;
      if (c.source === 'allergen_tag') {
        detail += ' (listed allergen)';
      } else if (c.source === 'ingredient_text') {
        detail += ' (found in ingredients)';
      } else if (c.source === 'custom_keyword') {
        detail += ' (custom keyword)';
      }
      if (c.notes) {
        detail += `. ${c.notes}`;
      }
      details.push(detail);
    }
  }

  if (eczemaConcerns.length > 0) {
    const triggerNames = Array.from(new Set(eczemaConcerns.map(c => c.ingredient)));
    parts.push(`Contains eczema triggers: ${triggerNames.join(', ')}`);

    for (const c of eczemaConcerns) {
      let detail = `Eczema trigger "${c.ingredient}" detected (${c.profileAllergen} group)`;
      if (c.notes) {
        detail += `. ${c.notes}`;
      }
      details.push(detail);
    }
  }

  if (sensitivityConcerns.length > 0) {
    const sensitivityNames = Array.from(new Set(sensitivityConcerns.map(c => c.ingredient)));
    parts.push(`Contains sensitivities: ${sensitivityNames.join(', ')}`);

    for (const c of sensitivityConcerns) {
      details.push(`Sensitivity concern: "${c.matchedText}" (${c.profileAllergen})`);
    }
  }

  if (advisories.length > 0) {
    const advisoryAllergens = Array.from(new Set(advisories.map(a => a.allergen)));
    parts.push(`Advisory warnings for: ${advisoryAllergens.join(', ')}`);

    for (const a of advisories) {
      const label = a.type === 'facility_warning' ? 'Facility risk' : 'May contain';
      details.push(`${label}: ${a.rawText}${a.affectsSevereAllergen ? ' (severe allergen — extra caution)' : ''}`);
    }
  }

  const summary = `${verdict} for ${profileName}. ${parts.join('. ')}.`;

  return { summary, details };
}

function evaluateForProfile(
  product: Product,
  profile: Profile,
): ProfileImpact {
  console.log(`\n[EvalEngine] ===== Evaluating for profile: ${profile.name} =====`);

  const { concerns: allergyConcerns, advisories } = detectAllergenMatches(
    product,
    profile.allergens,
    profile.customKeywords,
    profile.hasAnaphylaxis,
  );

  const sensitivityConcerns = detectEczemaAndSensitivityConcerns(product, profile);

  const allConcerns = [...allergyConcerns, ...sensitivityConcerns];

  const hasAnyData = !!(
    product.ingredients_text?.trim() ||
    (product.allergens_tags && product.allergens_tags.length > 0) ||
    (product.traces_tags && product.traces_tags.length > 0)
  );

  const verdict = determineVerdict(
    allergyConcerns,
    sensitivityConcerns,
    advisories,
    hasAnyData,
    profile.hasAnaphylaxis,
  );

  const { confidence, reasons } = scoreConfidence(product);

  const { summary } = generateExplanation(
    verdict,
    allConcerns,
    advisories,
    confidence,
    reasons,
    profile.name,
  );

  return {
    profileId: profile.id,
    profileName: profile.name,
    relationship: profile.relationship,
    avatarColor: profile.avatarColor,
    verdict,
    concerns: allConcerns,
    advisoryMatches: advisories,
    hasAnaphylaxisRisk: profile.hasAnaphylaxis && allergyConcerns.length > 0,
    explanation: summary,
  };
}

function resolveHouseholdVerdict(impacts: ProfileImpact[]): EvalVerdict {
  if (impacts.some(i => i.verdict === 'Avoid')) return 'Avoid';
  if (impacts.some(i => i.verdict === 'Caution')) return 'Caution';
  if (impacts.some(i => i.verdict === 'Unknown')) return 'Unknown';
  return 'Safe';
}

export function evaluateProduct(
  product: Product,
  profile: Profile,
): EvaluationResult {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║       SAFEBITE EVALUATION ENGINE v2             ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Product: ${product.product_name ?? product.code}`);
  console.log(`Profile: ${profile.name}`);

  const { concerns: allergyConcerns, advisories } = detectAllergenMatches(
    product,
    profile.allergens,
    profile.customKeywords,
    profile.hasAnaphylaxis,
  );

  const sensitivityConcerns = detectEczemaAndSensitivityConcerns(product, profile);
  const allConcerns = [...allergyConcerns, ...sensitivityConcerns];

  const hasAnyData = !!(
    product.ingredients_text?.trim() ||
    (product.allergens_tags && product.allergens_tags.length > 0) ||
    (product.traces_tags && product.traces_tags.length > 0)
  );

  const verdict = determineVerdict(
    allergyConcerns,
    sensitivityConcerns,
    advisories,
    hasAnyData,
    profile.hasAnaphylaxis,
  );

  const { score, confidence, reasons } = scoreConfidence(product);

  const { summary, details } = generateExplanation(
    verdict,
    allConcerns,
    advisories,
    confidence,
    reasons,
    profile.name,
  );

  console.log(`[EvalEngine] FINAL VERDICT: ${verdict} | Confidence: ${confidence} (${score}/100)`);
  console.log(`[EvalEngine] Concerns: ${allConcerns.length} | Advisories: ${advisories.length}`);

  return {
    verdict,
    confidence,
    confidenceScore: score,
    confidenceReasons: reasons,
    matchedConcerns: allConcerns,
    advisoryMatches: advisories,
    explanationSummary: summary,
    explanationDetails: details,
    householdSummary: null,
    overallHouseholdVerdict: null,
    trustFooter: TRUST_FOOTER,
  };
}

export function evaluateProductForHousehold(
  product: Product,
  profiles: Profile[],
): EvaluationResult {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   SAFEBITE HOUSEHOLD EVALUATION ENGINE v2       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Product: ${product.product_name ?? product.code}`);
  console.log(`Profiles: ${profiles.map(p => p.name).join(', ')}`);

  if (profiles.length === 0) {
    const { score, confidence, reasons } = scoreConfidence(product);
    return {
      verdict: 'Unknown',
      confidence,
      confidenceScore: score,
      confidenceReasons: reasons,
      matchedConcerns: [],
      advisoryMatches: [],
      explanationSummary: 'No profiles selected for evaluation.',
      explanationDetails: ['Add at least one profile with allergens to evaluate this product.'],
      householdSummary: [],
      overallHouseholdVerdict: 'Unknown',
      trustFooter: TRUST_FOOTER,
    };
  }

  const impacts: ProfileImpact[] = profiles.map(p => evaluateForProfile(product, p));
  const overallVerdict = resolveHouseholdVerdict(impacts);

  const allConcerns = impacts.flatMap(i => i.concerns);
  const allAdvisories = impacts.flatMap(i => i.advisoryMatches);

  const uniqueConcerns = Array.from(
    new Map(allConcerns.map(c => [`${c.profileAllergen}-${c.matchedText}-${c.source}`, c])).values(),
  );
  const uniqueAdvisories = Array.from(
    new Map(allAdvisories.map(a => [`${a.type}-${a.allergen}`, a])).values(),
  );

  const { score, confidence, reasons } = scoreConfidence(product);

  const affectedNames = impacts.filter(i => i.verdict === 'Avoid' || i.verdict === 'Caution').map(i => i.profileName);
  const safeNames = impacts.filter(i => i.verdict === 'Safe').map(i => i.profileName);
  const anaphylaxisNames = impacts.filter(i => i.hasAnaphylaxisRisk).map(i => i.profileName);

  let householdSummaryText: string;
  const details: string[] = [];

  if (overallVerdict === 'Safe') {
    householdSummaryText = `Safe for all ${profiles.length} household member${profiles.length > 1 ? 's' : ''}.`;
  } else if (overallVerdict === 'Unknown') {
    householdSummaryText = 'Cannot verify safety — missing ingredient data.';
  } else {
    const parts: string[] = [];
    if (affectedNames.length > 0) {
      parts.push(`Concerns for: ${affectedNames.join(', ')}`);
    }
    if (safeNames.length > 0) {
      parts.push(`Safe for: ${safeNames.join(', ')}`);
    }
    if (anaphylaxisNames.length > 0) {
      parts.push(`Anaphylaxis risk: ${anaphylaxisNames.join(', ')}`);
    }
    householdSummaryText = parts.join('. ') + '.';
  }

  for (const impact of impacts) {
    details.push(`${impact.profileName}: ${impact.verdict} — ${impact.explanation}`);
  }

  console.log(`[EvalEngine] HOUSEHOLD VERDICT: ${overallVerdict} | Confidence: ${confidence} (${score}/100)`);

  return {
    verdict: overallVerdict,
    confidence,
    confidenceScore: score,
    confidenceReasons: reasons,
    matchedConcerns: uniqueConcerns,
    advisoryMatches: uniqueAdvisories,
    explanationSummary: householdSummaryText,
    explanationDetails: details,
    householdSummary: impacts,
    overallHouseholdVerdict: overallVerdict,
    trustFooter: TRUST_FOOTER,
  };
}

export function evalVerdictToLegacyLevel(verdict: EvalVerdict): VerdictLevel {
  switch (verdict) {
    case 'Avoid': return 'danger';
    case 'Caution': return 'caution';
    case 'Safe': return 'safe';
    case 'Unknown': return 'unknown';
  }
}

export function legacyLevelToEvalVerdict(level: VerdictLevel): EvalVerdict {
  switch (level) {
    case 'danger': return 'Avoid';
    case 'caution': return 'Caution';
    case 'safe': return 'Safe';
    case 'unknown': return 'Unknown';
  }
}
