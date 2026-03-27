export const PROFILE_AVATAR_COLORS = [
  '#0891B2',
  '#8B5CF6',
  '#EC4899',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#3B82F6',
  '#14B8A6',
  '#F97316',
  '#A855F7',
  '#06B6D4',
  '#84CC16',
];

export const PROFILE_RELATIONSHIPS = [
  { value: 'self' as const, label: 'Myself', icon: '👤' },
  { value: 'spouse' as const, label: 'Spouse', icon: '💑' },
  { value: 'partner' as const, label: 'Partner', icon: '💑' },
  { value: 'son' as const, label: 'Son', icon: '👦' },
  { value: 'daughter' as const, label: 'Daughter', icon: '👧' },
  { value: 'child' as const, label: 'Child', icon: '🧒' },
  { value: 'mother' as const, label: 'Mother', icon: '👩' },
  { value: 'father' as const, label: 'Father', icon: '👨' },
  { value: 'parent' as const, label: 'Parent', icon: '👪' },
  { value: 'grandmother' as const, label: 'Grandmother', icon: '👵' },
  { value: 'grandfather' as const, label: 'Grandfather', icon: '👴' },
  { value: 'grandparent' as const, label: 'Grandparent', icon: '👴' },
  { value: 'sibling' as const, label: 'Sibling', icon: '👫' },
  { value: 'other' as const, label: 'Other', icon: '👥' },
];

export function getRandomAvatarColor(): string {
  return PROFILE_AVATAR_COLORS[Math.floor(Math.random() * PROFILE_AVATAR_COLORS.length)];
}

export function getRelationshipLabel(relationship?: string): string {
  const rel = PROFILE_RELATIONSHIPS.find(r => r.value === relationship);
  return rel?.label || 'Family Member';
}

export function getRelationshipIcon(relationship?: string): string {
  const rel = PROFILE_RELATIONSHIPS.find(r => r.value === relationship);
  return rel?.icon || '👤';
}
