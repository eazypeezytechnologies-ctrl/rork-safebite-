import { Product, Profile, Verdict, VerdictLevel, AllergenMatch, EczemaTriggerMatch, ConfidenceBreakdown } from '@/types';
import {
  evaluateProduct,
  evaluateProductForHousehold,
  EvaluationResult,
  evalVerdictToLegacyLevel,
  MatchedConcern,
} from './evaluationEngine';
import { AIVerdictRecord } from '@/storage/aiVerdict';
import { TrustedProduct } from '@/storage/trustedProducts';

export type UnifiedVerdictSource =
  | 'engine'
  | 'ai_override'
  | 'ai_upgrade'
  | 'trusted_override'
  | 'ai_confirmed';

export interface UnifiedEvaluationResult {
  verdict: Verdict;
  evalResult: EvaluationResult;
  confidence: ConfidenceBreakdown;
  verdictSource: UnifiedVerdictSource;
  verdictLabel: string;
  aiAdjusted: boolean;
  aiConflict: boolean;
  trustedOverride: boolean;
  debugLog: string[];
}

function engineToLegacyVerdict(result: EvaluationResult): Verdict {
  const legacyLevel = evalVerdictToLegacyLevel(result.verdict);

  const matches: AllergenMatch[] = result.matchedConcerns
    .filter(c => c.concernType === 'allergy')
    .map(c => ({
      allergen: c.profileAllergen,
      source: c.source === 'allergen_tag' ? 'allergens_tags' as const
        : c.source === 'traces_tag' ? 'traces_tags' as const
        : c.source === 'ingredient_text' ? 'ingredients' as const
        : 'custom_keyword' as const,
      matchedText: c.matchedText,
    }));

  const eczemaTriggers: EczemaTriggerMatch[] = result.matchedConcerns
    .filter(c => c.concernType === 'eczema')
    .map(c => ({
      triggerName: c.ingredient,
      triggerGroup: c.profileAllergen,
      matchedText: c.matchedText,
      severityHint: c.severityHint === 'critical' ? 'high' as const
        : c.severityHint === 'low' ? 'low' as const
        : c.severityHint === 'high' ? 'high' as const
        : 'medium' as const,
    }));

  return {
    level: legacyLevel,
    matches,
    eczemaTriggers,
    message: result.explanationSummary,
    missingData: result.verdict === 'Unknown',
    explanation: result.explanationSummary,
  };
}

function engineToConfidence(result: EvaluationResult): ConfidenceBreakdown {
  const score = result.confidenceScore;
  const confidenceColor = score >= 65 ? '#059669'
    : score >= 50 ? '#10B981'
    : score >= 35 ? '#D97706'
    : score >= 20 ? '#F59E0B'
    : '#DC2626';
  const confidenceLabel: ConfidenceBreakdown['label'] = score >= 85 ? 'Very High'
    : score >= 70 ? 'High'
    : score >= 50 ? 'Moderate'
    : score >= 30 ? 'Low'
    : 'Very Low';

  return {
    score,
    label: confidenceLabel,
    color: confidenceColor,
    factors: result.confidenceReasons.map(r => ({
      name: r.factor,
      present: r.impact === 'positive',
      weight: 10,
      description: r.detail,
    })),
  };
}

function getVerdictLabel(level: VerdictLevel): string {
  switch (level) {
    case 'danger': return 'Not Safe';
    case 'caution': return 'Partially Verified';
    case 'safe': return 'Safe to Use';
    case 'unknown': return 'We Need More Info';
  }
}

export function runUnifiedEvaluation(
  product: Product,
  profile: Profile,
  aiVerdictRecord: AIVerdictRecord | null,
  trustedProduct: TrustedProduct | null,
): UnifiedEvaluationResult {
  const log: string[] = [];

  log.push(`[UnifiedEval] Product: ${product.product_name ?? product.code}`);
  log.push(`[UnifiedEval] Profile: ${profile.name} (${profile.id})`);
  log.push(`[UnifiedEval] AI verdict record: ${aiVerdictRecord ? aiVerdictRecord.aiVerdict : 'none'}`);
  log.push(`[UnifiedEval] Trusted product: ${trustedProduct ? 'yes' : 'no'}`);

  const evalResult = evaluateProduct(product, profile);
  const baseVerdict = engineToLegacyVerdict(evalResult);
  const confidence = engineToConfidence(evalResult);
  const engineLevel = baseVerdict.level;

  log.push(`[UnifiedEval] Engine verdict: ${engineLevel}`);
  log.push(`[UnifiedEval] Engine confidence: ${confidence.score}/100 (${confidence.label})`);
  log.push(`[UnifiedEval] Engine concerns: ${evalResult.matchedConcerns.length}`);

  const hasDirectAllergenTagMatch = evalResult.matchedConcerns.some(
    c => c.concernType === 'allergy' && c.source === 'allergen_tag'
  );

  if (trustedProduct) {
    if (hasDirectAllergenTagMatch) {
      log.push(`[UnifiedEval] PRECEDENCE: Trusted product BUT direct allergen tag match found — trust does NOT override`);
      return {
        verdict: baseVerdict,
        evalResult,
        confidence,
        verdictSource: 'engine',
        verdictLabel: getVerdictLabel(engineLevel),
        aiAdjusted: false,
        aiConflict: true,
        trustedOverride: false,
        debugLog: log,
      };
    }

    log.push(`[UnifiedEval] PRECEDENCE: Trusted product overrides to SAFE`);
    const trustedVerdict: Verdict = {
      ...baseVerdict,
      level: 'safe',
      message: 'Trusted product — marked safe for this profile.',
      explanation: `This product was marked as trusted on ${new Date(trustedProduct.trustedAt).toLocaleDateString()}.${trustedProduct.reason ? ` Reason: ${trustedProduct.reason}` : ''}`,
    };
    return {
      verdict: trustedVerdict,
      evalResult,
      confidence,
      verdictSource: 'trusted_override',
      verdictLabel: 'TRUSTED',
      aiAdjusted: false,
      aiConflict: false,
      trustedOverride: true,
      debugLog: log,
    };
  }

  if (!aiVerdictRecord) {
    log.push(`[UnifiedEval] No AI verdict — using engine result as-is`);
    return {
      verdict: baseVerdict,
      evalResult,
      confidence,
      verdictSource: 'engine',
      verdictLabel: getVerdictLabel(engineLevel),
      aiAdjusted: false,
      aiConflict: false,
      trustedOverride: false,
      debugLog: log,
    };
  }

  const aiLevel = aiVerdictRecord.aiVerdict;
  log.push(`[UnifiedEval] AI verdict: ${aiLevel}, engine verdict: ${engineLevel}`);

  if (aiLevel === engineLevel) {
    log.push(`[UnifiedEval] AI confirms engine verdict`);
    return {
      verdict: baseVerdict,
      evalResult,
      confidence,
      verdictSource: 'ai_confirmed',
      verdictLabel: aiLevel === 'safe' ? 'AI-VERIFIED SAFE' : getVerdictLabel(engineLevel),
      aiAdjusted: true,
      aiConflict: false,
      trustedOverride: false,
      debugLog: log,
    };
  }

  if (aiLevel === 'safe' && engineLevel !== 'safe') {
    if (hasDirectAllergenTagMatch && aiVerdictRecord.aiConfidence !== 'high') {
      log.push(`[UnifiedEval] PRECEDENCE: AI says safe but direct allergen tag match + non-high AI confidence — engine wins, conflict flagged`);
      return {
        verdict: baseVerdict,
        evalResult,
        confidence,
        verdictSource: 'engine',
        verdictLabel: getVerdictLabel(engineLevel),
        aiAdjusted: false,
        aiConflict: true,
        trustedOverride: false,
        debugLog: log,
      };
    }

    const hasOnlyTextMatch = evalResult.matchedConcerns.length > 0 &&
      evalResult.matchedConcerns.every(c =>
        c.source === 'ingredient_text' || c.source === 'traces_tag' || c.source === 'food_sensitivity' || c.source === 'eczema_trigger'
      );

    log.push(`[UnifiedEval] PRECEDENCE: AI says safe, overriding engine ${engineLevel} (text-only match: ${hasOnlyTextMatch}, high-confidence AI: ${aiVerdictRecord.aiConfidence === 'high'})`);

    const aiOverrideVerdict: Verdict = {
      ...baseVerdict,
      level: 'safe',
      message: hasOnlyTextMatch
        ? `AI analysis confirms safe — preliminary match was a false positive. Original: ${baseVerdict.message}`
        : baseVerdict.missingData
          ? 'AI analysis found no allergen risks for your profile.'
          : `AI analysis confirms this product appears safe. Original: ${baseVerdict.message}`,
      explanation: hasOnlyTextMatch
        ? `AI analysis confirms safe — preliminary match was a false positive. Original: ${baseVerdict.message}`
        : `AI analysis confirms this product appears safe. Original: ${baseVerdict.message}`,
    };
    return {
      verdict: aiOverrideVerdict,
      evalResult,
      confidence,
      verdictSource: 'ai_override',
      verdictLabel: 'AI-VERIFIED SAFE',
      aiAdjusted: true,
      aiConflict: false,
      trustedOverride: false,
      debugLog: log,
    };
  }

  if ((aiLevel === 'danger' || aiLevel === 'caution') && engineLevel === 'safe') {
    log.push(`[UnifiedEval] PRECEDENCE: AI detected risk (${aiLevel}) that engine missed — upgrading to caution`);
    const aiUpgradeVerdict: Verdict = {
      ...baseVerdict,
      level: 'caution',
      message: `AI analysis detected potential risks not caught by rule-based check. ${baseVerdict.message}`,
      explanation: `AI analysis suggests caution. ${baseVerdict.explanation || baseVerdict.message}`,
    };
    return {
      verdict: aiUpgradeVerdict,
      evalResult,
      confidence,
      verdictSource: 'ai_upgrade',
      verdictLabel: 'AI: CAUTION',
      aiAdjusted: true,
      aiConflict: false,
      trustedOverride: false,
      debugLog: log,
    };
  }

  log.push(`[UnifiedEval] AI/engine mismatch (ai: ${aiLevel}, engine: ${engineLevel}) — using engine result`);
  return {
    verdict: baseVerdict,
    evalResult,
    confidence,
    verdictSource: 'engine',
    verdictLabel: getVerdictLabel(engineLevel),
    aiAdjusted: false,
    aiConflict: false,
    trustedOverride: false,
    debugLog: log,
  };
}

export function runUnifiedHouseholdEvaluation(
  product: Product,
  members: Profile[],
): {
  evalResult: EvaluationResult;
  overallVerdict: Verdict;
  confidence: ConfidenceBreakdown;
  memberResults: Array<{
    profile: Profile;
    verdict: Verdict;
    evalResult: EvaluationResult;
    confidence: ConfidenceBreakdown;
  }>;
} {
  console.log(`[UnifiedEval] Household evaluation for ${members.length} members`);

  if (members.length === 0) {
    const householdResult = evaluateProductForHousehold(product, []);
    return {
      evalResult: householdResult,
      overallVerdict: engineToLegacyVerdict(householdResult),
      confidence: engineToConfidence(householdResult),
      memberResults: [],
    };
  }

  const memberResults = members.map(member => {
    const result = evaluateProduct(product, member);
    return {
      profile: member,
      verdict: engineToLegacyVerdict(result),
      evalResult: result,
      confidence: engineToConfidence(result),
    };
  });

  const householdResult = evaluateProductForHousehold(product, members);

  return {
    evalResult: householdResult,
    overallVerdict: engineToLegacyVerdict(householdResult),
    confidence: engineToConfidence(householdResult),
    memberResults,
  };
}

export { engineToLegacyVerdict, engineToConfidence };
