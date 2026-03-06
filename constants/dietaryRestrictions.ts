export interface DietaryRestrictionDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  category: 'common' | 'extended';
}

export const DIETARY_RESTRICTIONS_MASTER: DietaryRestrictionDef[] = [
  { id: 'no_pork', label: 'No Pork', icon: '🚫', description: 'Avoid all pork and pork-derived products', category: 'common' },
  { id: 'halal', label: 'Halal', icon: '☪️', description: 'Permissible under Islamic dietary law', category: 'common' },
  { id: 'kosher', label: 'Kosher', icon: '✡️', description: 'Conforms to Jewish dietary laws', category: 'common' },
  { id: 'vegan', label: 'Vegan', icon: '🌱', description: 'No animal-derived products at all', category: 'common' },
  { id: 'dairy_free', label: 'Dairy-Free', icon: '🥛', description: 'No milk, cheese, butter, or dairy derivatives', category: 'common' },
  { id: 'gluten_free', label: 'Gluten-Free', icon: '🌾', description: 'No wheat, barley, rye, or gluten sources', category: 'common' },
  { id: 'vegetarian', label: 'Vegetarian', icon: '🥗', description: 'No meat or fish products', category: 'extended' },
  { id: 'pescatarian', label: 'Pescatarian', icon: '🐟', description: 'No meat except fish and seafood', category: 'extended' },
  { id: 'egg_free', label: 'Egg-Free', icon: '🥚', description: 'No eggs or egg derivatives', category: 'extended' },
  { id: 'soy_free', label: 'Soy-Free', icon: '🫘', description: 'No soy or soy-derived ingredients', category: 'extended' },
  { id: 'nut_free', label: 'Nut-Free', icon: '🥜', description: 'No tree nuts or peanuts', category: 'extended' },
  { id: 'shellfish_free', label: 'Shellfish-Free', icon: '🦐', description: 'No shrimp, crab, lobster, or mollusks', category: 'extended' },
  { id: 'sesame_free', label: 'Sesame-Free', icon: '🫙', description: 'No sesame seeds or sesame oil', category: 'extended' },
  { id: 'alcohol_free', label: 'Alcohol-Free', icon: '🍷', description: 'No alcohol or alcohol-derived ingredients', category: 'extended' },
  { id: 'caffeine_free', label: 'Caffeine-Free', icon: '☕', description: 'No coffee, tea extracts, or caffeine sources', category: 'extended' },
  { id: 'low_sodium', label: 'Low Sodium', icon: '🧂', description: 'Restrict high-sodium ingredients', category: 'extended' },
  { id: 'low_sugar', label: 'Low Sugar', icon: '🍬', description: 'Restrict added sugars and syrups', category: 'extended' },
];

export const COMMON_RESTRICTIONS = DIETARY_RESTRICTIONS_MASTER.filter(r => r.category === 'common');
export const EXTENDED_RESTRICTIONS = DIETARY_RESTRICTIONS_MASTER.filter(r => r.category === 'extended');
