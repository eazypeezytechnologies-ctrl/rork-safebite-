export type StrictnessLevel = 'relaxed' | 'standard' | 'strict';

export interface StrictnessRule {
  level: StrictnessLevel;
  label: string;
  description: string;
  matchGroups: ('block' | 'verify' | 'strict_verify')[];
}

export const STRICTNESS_RULES: Record<StrictnessLevel, StrictnessRule> = {
  relaxed: {
    level: 'relaxed',
    label: 'Relaxed',
    description: 'Flags only clear conflicts',
    matchGroups: ['block'],
  },
  standard: {
    level: 'standard',
    label: 'Standard',
    description: 'Flags clear + common ambiguous',
    matchGroups: ['block', 'verify'],
  },
  strict: {
    level: 'strict',
    label: 'Strict',
    description: 'Flags ambiguous/unknown-source',
    matchGroups: ['block', 'verify', 'strict_verify'],
  },
} as const;

export const STRICTNESS_OPTIONS: { value: StrictnessLevel; label: string; short: string }[] = [
  { value: 'relaxed', label: 'Relaxed', short: 'R' },
  { value: 'standard', label: 'Standard', short: 'S' },
  { value: 'strict', label: 'Strict', short: '!' },
];

export const DEFAULT_STRICTNESS: StrictnessLevel = 'standard';
