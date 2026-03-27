import { Product } from '@/types';

export type WarningType = 'facility' | 'may_contain' | 'cross_contact' | 'shared_equipment' | 'advisory';

export interface ManufacturerWarning {
  type: WarningType;
  severity: 'high' | 'medium' | 'low';
  matchedText: string;
  explanation: string;
}

const FACILITY_PATTERNS = [
  /manufactured\s+in\s+a\s+facility\s+that\s+(?:also\s+)?process(?:es)?\s+(.+?)(?:\.|$)/i,
  /produced\s+in\s+a\s+facility\s+that\s+(?:also\s+)?(?:handles?|process(?:es)?|uses?)\s+(.+?)(?:\.|$)/i,
  /made\s+in\s+a\s+(?:plant|facility)\s+(?:that\s+)?(?:also\s+)?(?:processes?|handles?|uses?)\s+(.+?)(?:\.|$)/i,
  /(?:shared|common)\s+(?:facility|equipment|production\s+line)\s+(?:with|for)\s+(.+?)(?:\.|$)/i,
  /produced\s+on\s+(?:shared|the\s+same)\s+(?:equipment|line|machinery)\s+(?:as|that\s+processes?)\s+(.+?)(?:\.|$)/i,
  /packaged\s+in\s+a\s+facility\s+(?:that\s+)?(?:also\s+)?(?:packages?|process(?:es)?|handles?)\s+(.+?)(?:\.|$)/i,
];

const MAY_CONTAIN_PATTERNS = [
  /may\s+contain\s+(?:traces?\s+of\s+)?(.+?)(?:\.|$)/i,
  /(?:possible|potential)\s+(?:traces?\s+of|presence\s+of)\s+(.+?)(?:\.|$)/i,
  /(?:traces?\s+of)\s+(.+?)(?:\s+may\s+be\s+present)?(?:\.|$)/i,
  /(?:could|might)\s+contain\s+(.+?)(?:\.|$)/i,
];

const CROSS_CONTACT_PATTERNS = [
  /cross[\s-]?contaminat(?:ion|ed)\s+(?:with|risk\s+(?:of|for|from))\s+(.+?)(?:\.|$)/i,
  /risk\s+of\s+cross[\s-]?contact\s+(?:with|from)\s+(.+?)(?:\.|$)/i,
  /not\s+suitable\s+for\s+(?:people|individuals|those)\s+with\s+(.+?)\s+allerg(?:y|ies)/i,
];

const SHARED_EQUIPMENT_PATTERNS = [
  /(?:on|using)\s+(?:shared|the\s+same)\s+(?:equipment|line|machinery)(?:\s+as\s+(.+?))?(?:\.|$)/i,
  /equipment\s+(?:also\s+)?(?:used|shared)\s+(?:for|with)\s+(.+?)(?:\.|$)/i,
  /processed\s+on\s+(?:equipment|lines?)\s+that\s+(?:also\s+)?(?:processes?|handles?)\s+(.+?)(?:\.|$)/i,
];

const ADVISORY_PATTERNS = [
  /allergy\s+(?:advice|warning|information|notice)/i,
  /allergen\s+(?:warning|information|notice|statement)/i,
  /contains?\s+allergens?/i,
  /for\s+allergens?\s*[,:]?\s*(?:see|including)/i,
  /allergens?\s+(?:are\s+)?(?:highlighted|shown|listed|indicated)\s+in\s+bold/i,
];

function getWarningTypeLabel(type: WarningType): string {
  switch (type) {
    case 'facility': return 'Facility Risk';
    case 'may_contain': return 'May Contain';
    case 'cross_contact': return 'Cross-Contact Risk';
    case 'shared_equipment': return 'Shared Equipment';
    case 'advisory': return 'Allergen Advisory';
  }
}

function getWarningSeverity(type: WarningType): 'high' | 'medium' | 'low' {
  switch (type) {
    case 'may_contain': return 'high';
    case 'cross_contact': return 'high';
    case 'facility': return 'medium';
    case 'shared_equipment': return 'medium';
    case 'advisory': return 'low';
  }
}

function getWarningExplanation(type: WarningType, matchedAllergens?: string): string {
  const allergenStr = matchedAllergens ? ` (${matchedAllergens.trim()})` : '';
  switch (type) {
    case 'facility':
      return `This product is manufactured in a facility that also processes other allergens${allergenStr}. Cross-contamination is possible even with cleaning procedures.`;
    case 'may_contain':
      return `The manufacturer warns this product may contain traces of allergens${allergenStr}. This is a voluntary disclosure — treat it seriously.`;
    case 'cross_contact':
      return `There is a stated risk of cross-contact with allergens${allergenStr}. This product may not be safe for sensitive individuals.`;
    case 'shared_equipment':
      return `This product is made on shared equipment${allergenStr}. Trace amounts of allergens may be present despite cleaning protocols.`;
    case 'advisory':
      return 'This product has a general allergen advisory. Check the full label for specific allergen information.';
  }
}

export function detectManufacturerWarnings(product: Product): ManufacturerWarning[] {
  const warnings: ManufacturerWarning[] = [];
  const seenTypes = new Set<string>();

  const textsToCheck: string[] = [];
  if (product.ingredients_text) textsToCheck.push(product.ingredients_text);
  if (product.allergens) textsToCheck.push(product.allergens);

  const fullText = textsToCheck.join(' ');
  if (!fullText.trim()) return warnings;

  console.log('[ManufacturerWarnings] Scanning product:', product.product_name);

  const patternSets: { patterns: RegExp[]; type: WarningType }[] = [
    { patterns: MAY_CONTAIN_PATTERNS, type: 'may_contain' },
    { patterns: FACILITY_PATTERNS, type: 'facility' },
    { patterns: CROSS_CONTACT_PATTERNS, type: 'cross_contact' },
    { patterns: SHARED_EQUIPMENT_PATTERNS, type: 'shared_equipment' },
    { patterns: ADVISORY_PATTERNS, type: 'advisory' },
  ];

  for (const { patterns, type } of patternSets) {
    for (const pattern of patterns) {
      const match = fullText.match(pattern);
      if (match) {
        const key = `${type}_${match[0].substring(0, 40)}`;
        if (seenTypes.has(key)) continue;
        seenTypes.add(key);

        const matchedAllergens = match[1] || undefined;
        const severity = getWarningSeverity(type);

        warnings.push({
          type,
          severity,
          matchedText: match[0].trim(),
          explanation: getWarningExplanation(type, matchedAllergens),
        });

        console.log(`[ManufacturerWarnings] Found ${type}: "${match[0].substring(0, 80)}"`);
        break;
      }
    }
  }

  console.log(`[ManufacturerWarnings] Total warnings found: ${warnings.length}`);
  return warnings;
}

export function getWarningColor(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high': return '#DC2626';
    case 'medium': return '#D97706';
    case 'low': return '#6B7280';
  }
}

export function getWarningBgColor(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high': return '#FEF2F2';
    case 'medium': return '#FFFBEB';
    case 'low': return '#F9FAFB';
  }
}

export function getWarningBorderColor(severity: 'high' | 'medium' | 'low'): string {
  switch (severity) {
    case 'high': return '#FECACA';
    case 'medium': return '#FDE68A';
    case 'low': return '#E5E7EB';
  }
}

export { getWarningTypeLabel };
