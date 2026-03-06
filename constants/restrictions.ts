export interface AllergenOption {
  id: string;
  label: string;
  icon: string;
}

export const TOP_ALLERGENS: AllergenOption[] = [
  { id: 'milk', label: 'Milk', icon: '🥛' },
  { id: 'eggs', label: 'Eggs', icon: '🥚' },
  { id: 'fish', label: 'Fish', icon: '🐟' },
  { id: 'shellfish', label: 'Shellfish', icon: '🦐' },
  { id: 'tree_nuts', label: 'Tree Nuts', icon: '🌰' },
  { id: 'peanuts', label: 'Peanuts', icon: '🥜' },
  { id: 'wheat', label: 'Wheat', icon: '🌾' },
  { id: 'soybeans', label: 'Soybeans', icon: '🫘' },
  { id: 'sesame', label: 'Sesame', icon: '🫙' },
  { id: 'mustard', label: 'Mustard', icon: '🟡' },
  { id: 'celery', label: 'Celery', icon: '🥬' },
  { id: 'lupin', label: 'Lupin', icon: '🌼' },
  { id: 'sulfites', label: 'Sulfites', icon: '🧪' },
  { id: 'corn', label: 'Corn', icon: '🌽' },
  { id: 'gluten', label: 'Gluten', icon: '🍞' },
  { id: 'buckwheat', label: 'Buckwheat', icon: '🌿' },
  { id: 'coconut', label: 'Coconut', icon: '🥥' },
  { id: 'kiwi', label: 'Kiwi', icon: '🥝' },
  { id: 'banana', label: 'Banana', icon: '🍌' },
  { id: 'latex_fruit', label: 'Latex-Fruit', icon: '🍈' },
];

export interface DietaryRule {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export const DIETARY_RULES: DietaryRule[] = [
  { id: 'halal', label: 'Halal', icon: '☪️', description: 'Permissible under Islamic law' },
  { id: 'kosher', label: 'Kosher', icon: '✡️', description: 'Conforms to Jewish dietary laws' },
  { id: 'vegan', label: 'Vegan', icon: '🌱', description: 'No animal products' },
  { id: 'vegetarian', label: 'Vegetarian', icon: '🥗', description: 'No meat or fish' },
  { id: 'no_pork', label: 'No Pork', icon: '🚫', description: 'Avoid all pork products' },
];

export interface AvoidIngredient {
  id: string;
  label: string;
  icon: string;
}

export const COMMON_AVOID_INGREDIENTS: AvoidIngredient[] = [
  { id: 'pork', label: 'Pork', icon: '🐷' },
  { id: 'gelatin', label: 'Gelatin', icon: '🍬' },
  { id: 'lard', label: 'Lard', icon: '🧈' },
  { id: 'alcohol', label: 'Alcohol', icon: '🍷' },
  { id: 'carmine', label: 'Carmine', icon: '🔴' },
  { id: 'rennet', label: 'Rennet', icon: '🧀' },
  { id: 'whey', label: 'Whey', icon: '💧' },
  { id: 'casein', label: 'Casein', icon: '🥛' },
  { id: 'shellac', label: 'Shellac', icon: '✨' },
  { id: 'bone_char', label: 'Bone Char', icon: '🦴' },
  { id: 'tallow', label: 'Tallow', icon: '🕯️' },
  { id: 'isinglass', label: 'Isinglass', icon: '🐠' },
  { id: 'l_cysteine', label: 'L-Cysteine', icon: '🧬' },
  { id: 'glycerin', label: 'Glycerin (animal)', icon: '💧' },
];
