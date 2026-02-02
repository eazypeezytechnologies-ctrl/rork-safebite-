export interface EczemaTrigger {
  name: string;
  triggerGroup: 'fragrance' | 'preservative' | 'surfactant' | 'botanical' | 'alcohol' | 'dye' | 'metal' | 'rubber' | 'other';
  severityHint: 'low' | 'medium' | 'high';
  aliases: string[];
  notes?: string;
}

export const ECZEMA_TRIGGER_GROUPS = [
  { id: 'fragrance', label: 'Fragrances & Perfumes', icon: '🌸' },
  { id: 'preservative', label: 'Preservatives', icon: '🧪' },
  { id: 'surfactant', label: 'Surfactants & Detergents', icon: '🧴' },
  { id: 'botanical', label: 'Botanicals & Essential Oils', icon: '🌿' },
  { id: 'alcohol', label: 'Alcohols', icon: '💧' },
  { id: 'dye', label: 'Dyes & Colorants', icon: '🎨' },
  { id: 'metal', label: 'Metals', icon: '⚙️' },
  { id: 'rubber', label: 'Rubber & Latex', icon: '🧤' },
  { id: 'other', label: 'Other Irritants', icon: '⚠️' },
] as const;

export const ECZEMA_TRIGGERS: EczemaTrigger[] = [
  // Fragrances
  {
    name: 'Fragrance',
    triggerGroup: 'fragrance',
    severityHint: 'high',
    aliases: ['fragrance', 'parfum', 'perfume', 'aroma', 'scent', 'fragrance oil', 'synthetic fragrance'],
    notes: 'One of the most common eczema triggers',
  },
  {
    name: 'Linalool',
    triggerGroup: 'fragrance',
    severityHint: 'medium',
    aliases: ['linalool', 'linalyl alcohol'],
  },
  {
    name: 'Limonene',
    triggerGroup: 'fragrance',
    severityHint: 'medium',
    aliases: ['limonene', 'd-limonene', 'citrus terpene'],
  },
  {
    name: 'Citronellol',
    triggerGroup: 'fragrance',
    severityHint: 'medium',
    aliases: ['citronellol', 'dihydrogeraniol'],
  },
  {
    name: 'Geraniol',
    triggerGroup: 'fragrance',
    severityHint: 'medium',
    aliases: ['geraniol', 'geranyl alcohol'],
  },
  {
    name: 'Eugenol',
    triggerGroup: 'fragrance',
    severityHint: 'medium',
    aliases: ['eugenol', 'clove oil'],
  },
  {
    name: 'Cinnamal',
    triggerGroup: 'fragrance',
    severityHint: 'high',
    aliases: ['cinnamal', 'cinnamic aldehyde', 'cinnamaldehyde'],
  },
  {
    name: 'Coumarin',
    triggerGroup: 'fragrance',
    severityHint: 'medium',
    aliases: ['coumarin', 'tonka bean'],
  },

  // Preservatives
  {
    name: 'Methylisothiazolinone (MI)',
    triggerGroup: 'preservative',
    severityHint: 'high',
    aliases: ['methylisothiazolinone', 'mi', 'mit', '2-methyl-4-isothiazolin-3-one'],
    notes: 'Banned in leave-on products in EU due to high sensitization rates',
  },
  {
    name: 'Methylchloroisothiazolinone (MCI)',
    triggerGroup: 'preservative',
    severityHint: 'high',
    aliases: ['methylchloroisothiazolinone', 'mci', 'kathon cg', 'isothiazolinone'],
  },
  {
    name: 'Formaldehyde',
    triggerGroup: 'preservative',
    severityHint: 'high',
    aliases: ['formaldehyde', 'formalin', 'methyl aldehyde', 'methylene oxide'],
  },
  {
    name: 'Formaldehyde Releasers',
    triggerGroup: 'preservative',
    severityHint: 'high',
    aliases: [
      'dmdm hydantoin', 'imidazolidinyl urea', 'diazolidinyl urea',
      'quaternium-15', 'bronopol', '2-bromo-2-nitropropane-1,3-diol',
      'sodium hydroxymethylglycinate'
    ],
  },
  {
    name: 'Parabens',
    triggerGroup: 'preservative',
    severityHint: 'medium',
    aliases: [
      'paraben', 'methylparaben', 'ethylparaben', 'propylparaben',
      'butylparaben', 'isobutylparaben'
    ],
  },
  {
    name: 'Phenoxyethanol',
    triggerGroup: 'preservative',
    severityHint: 'low',
    aliases: ['phenoxyethanol', '2-phenoxyethanol', 'ethylene glycol monophenyl ether'],
  },

  // Surfactants
  {
    name: 'Sodium Lauryl Sulfate (SLS)',
    triggerGroup: 'surfactant',
    severityHint: 'high',
    aliases: ['sodium lauryl sulfate', 'sls', 'sodium dodecyl sulfate', 'sds'],
    notes: 'Strong irritant that strips natural oils',
  },
  {
    name: 'Sodium Laureth Sulfate (SLES)',
    triggerGroup: 'surfactant',
    severityHint: 'medium',
    aliases: ['sodium laureth sulfate', 'sles', 'sodium lauryl ether sulfate'],
  },
  {
    name: 'Ammonium Lauryl Sulfate',
    triggerGroup: 'surfactant',
    severityHint: 'medium',
    aliases: ['ammonium lauryl sulfate', 'als'],
  },
  {
    name: 'Cocamidopropyl Betaine',
    triggerGroup: 'surfactant',
    severityHint: 'medium',
    aliases: ['cocamidopropyl betaine', 'capb', 'coco betaine'],
    notes: '2004 Contact Allergen of the Year',
  },

  // Botanicals & Essential Oils
  {
    name: 'Tea Tree Oil',
    triggerGroup: 'botanical',
    severityHint: 'medium',
    aliases: ['tea tree oil', 'melaleuca alternifolia', 'melaleuca oil'],
  },
  {
    name: 'Lavender Oil',
    triggerGroup: 'botanical',
    severityHint: 'medium',
    aliases: ['lavender oil', 'lavandula angustifolia', 'lavandula officinalis'],
  },
  {
    name: 'Peppermint Oil',
    triggerGroup: 'botanical',
    severityHint: 'medium',
    aliases: ['peppermint oil', 'mentha piperita', 'menthol'],
  },
  {
    name: 'Eucalyptus Oil',
    triggerGroup: 'botanical',
    severityHint: 'medium',
    aliases: ['eucalyptus oil', 'eucalyptus globulus', 'eucalyptol'],
  },
  {
    name: 'Chamomile',
    triggerGroup: 'botanical',
    severityHint: 'low',
    aliases: ['chamomile', 'chamomilla recutita', 'matricaria chamomilla', 'anthemis nobilis'],
  },
  {
    name: 'Aloe Vera',
    triggerGroup: 'botanical',
    severityHint: 'low',
    aliases: ['aloe vera', 'aloe barbadensis', 'aloe'],
    notes: 'Generally safe but can cause reactions in some people',
  },
  {
    name: 'Lanolin',
    triggerGroup: 'botanical',
    severityHint: 'medium',
    aliases: ['lanolin', 'wool wax', 'wool fat', 'wool alcohol', 'lanolin alcohol'],
    notes: 'Common sensitizer derived from sheep wool',
  },
  {
    name: 'Propolis',
    triggerGroup: 'botanical',
    severityHint: 'medium',
    aliases: ['propolis', 'bee glue', 'bee propolis'],
  },

  // Alcohols
  {
    name: 'Denatured Alcohol',
    triggerGroup: 'alcohol',
    severityHint: 'high',
    aliases: ['alcohol denat', 'denatured alcohol', 'sd alcohol', 'ethanol', 'ethyl alcohol', 'isopropyl alcohol'],
    notes: 'Drying and irritating to skin barrier',
  },
  {
    name: 'Benzyl Alcohol',
    triggerGroup: 'alcohol',
    severityHint: 'medium',
    aliases: ['benzyl alcohol', 'phenylmethanol'],
  },

  // Dyes
  {
    name: 'PPD (Hair Dye)',
    triggerGroup: 'dye',
    severityHint: 'high',
    aliases: ['ppd', 'p-phenylenediamine', 'paraphenylenediamine', '1,4-benzenediamine'],
    notes: 'Common allergen in permanent hair dyes',
  },
  {
    name: 'FD&C Dyes',
    triggerGroup: 'dye',
    severityHint: 'medium',
    aliases: [
      'fd&c', 'fdc', 'yellow 5', 'yellow 6', 'red 40', 'blue 1',
      'tartrazine', 'sunset yellow', 'allura red', 'brilliant blue'
    ],
  },

  // Metals
  {
    name: 'Nickel',
    triggerGroup: 'metal',
    severityHint: 'high',
    aliases: ['nickel', 'nickel sulfate'],
    notes: 'Most common contact allergen',
  },
  {
    name: 'Cobalt',
    triggerGroup: 'metal',
    severityHint: 'medium',
    aliases: ['cobalt', 'cobalt chloride'],
  },
  {
    name: 'Chromium',
    triggerGroup: 'metal',
    severityHint: 'medium',
    aliases: ['chromium', 'potassium dichromate', 'chromate'],
  },

  // Rubber
  {
    name: 'Latex',
    triggerGroup: 'rubber',
    severityHint: 'high',
    aliases: ['latex', 'natural rubber latex', 'rubber', 'hevea brasiliensis'],
  },
  {
    name: 'Rubber Accelerators',
    triggerGroup: 'rubber',
    severityHint: 'medium',
    aliases: ['thiuram', 'mercaptobenzothiazole', 'carbamate', 'thiuram mix'],
  },

  // Other
  {
    name: 'Propylene Glycol',
    triggerGroup: 'other',
    severityHint: 'medium',
    aliases: ['propylene glycol', '1,2-propanediol', 'pg'],
  },
  {
    name: 'Urea',
    triggerGroup: 'other',
    severityHint: 'low',
    aliases: ['urea', 'carbamide', 'carbonyldiamide'],
    notes: 'Generally safe in low concentrations but can irritate broken skin',
  },
  {
    name: 'Salicylic Acid',
    triggerGroup: 'other',
    severityHint: 'medium',
    aliases: ['salicylic acid', 'bha', 'beta hydroxy acid'],
  },
  {
    name: 'Retinoids',
    triggerGroup: 'other',
    severityHint: 'medium',
    aliases: ['retinol', 'retinoid', 'retinoic acid', 'tretinoin', 'retinyl palmitate', 'vitamin a'],
  },
  {
    name: 'Alpha Hydroxy Acids',
    triggerGroup: 'other',
    severityHint: 'medium',
    aliases: ['aha', 'glycolic acid', 'lactic acid', 'citric acid', 'malic acid', 'tartaric acid'],
  },
];

export function findEczemaTriggerMatches(
  ingredientsText: string,
  enabledTriggerGroups: string[]
): { trigger: EczemaTrigger; matchedText: string }[] {
  if (!ingredientsText || enabledTriggerGroups.length === 0) return [];
  
  const normalizedText = ingredientsText.toLowerCase();
  const matches: { trigger: EczemaTrigger; matchedText: string }[] = [];
  const foundTriggers = new Set<string>();
  
  for (const trigger of ECZEMA_TRIGGERS) {
    if (!enabledTriggerGroups.includes(trigger.triggerGroup)) continue;
    if (foundTriggers.has(trigger.name)) continue;
    
    for (const alias of trigger.aliases) {
      const normalizedAlias = alias.toLowerCase();
      if (normalizedText.includes(normalizedAlias)) {
        foundTriggers.add(trigger.name);
        matches.push({ trigger, matchedText: alias });
        break;
      }
    }
  }
  
  return matches;
}

export function getDefaultEczemaTriggerGroups(): string[] {
  return ['fragrance', 'preservative', 'surfactant'];
}
