export interface CosmeticKeywordSet {
  block: string[];
  verify: string[];
  strict_verify: string[];
}

export const COSMETIC_PORK_KEYWORDS: CosmeticKeywordSet = {
  block: [
    'porcine',
    'porcine collagen',
    'porcine gelatin',
    'porcine placenta',
    'porcine keratin',
    'porcine elastin',
    'pig',
    'pig fat',
    'swine',
    'hog',
    'lard',
    'pork fat',
    'pork',
    'pork extract',
    'sus scrofa',
    'sus domesticus',
    'animal placenta extract (porcine)',
    'hydrolyzed porcine collagen',
    'porcine skin extract',
  ],
  verify: [
    'glycerin',
    'glycerine',
    'glycerol',
    'stearic acid',
    'stearate',
    'sodium stearate',
    'magnesium stearate',
    'zinc stearate',
    'calcium stearate',
    'stearyl alcohol',
    'tallowate',
    'sodium tallowate',
    'tallow',
    'collagen',
    'hydrolyzed collagen',
    'marine collagen',
    'elastin',
    'keratin',
    'hydrolyzed keratin',
    'gelatin',
    'gelatine',
    'placenta extract',
    'placenta',
    'enzymes',
    'lipase',
    'pepsin',
    'pancreatin',
    'oleic acid',
    'oleyl alcohol',
    'palmitic acid',
    'myristic acid',
    'caprylic acid',
    'lauric acid',
    'animal fat',
    'animal-derived',
  ],
  strict_verify: [
    'parfum',
    'fragrance',
    'natural flavors',
    'natural flavours',
    'lecithin',
    'emulsifier',
    'e471',
    'e472',
    'e920',
    'l-cysteine',
    'mono and diglycerides',
    'mono- and diglycerides',
    'monoglycerides',
    'diglycerides',
    'arachidyl alcohol',
    'retinol',
    'biotin',
    'vitamin d3',
    'cholecalciferol',
    'squalene',
    'squalane',
    'lanolin',
    'beeswax',
  ],
};

export type CosmeticMatchGroup = 'block' | 'verify' | 'strict_verify';

export interface CosmeticPorkMatch {
  keyword: string;
  group: CosmeticMatchGroup;
}

export function findCosmeticPorkMatches(ingredientsText: string): CosmeticPorkMatch[] {
  if (!ingredientsText || ingredientsText.trim().length === 0) return [];

  const normalizedText = ingredientsText.toLowerCase();
  const matches: CosmeticPorkMatch[] = [];
  const found = new Set<string>();

  for (const group of ['block', 'verify', 'strict_verify'] as CosmeticMatchGroup[]) {
    const keywords = COSMETIC_PORK_KEYWORDS[group];
    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase();
      const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');

      if (regex.test(normalizedText) && !found.has(normalizedKeyword)) {
        found.add(normalizedKeyword);
        matches.push({ keyword, group });
      }
    }
  }

  return matches;
}
