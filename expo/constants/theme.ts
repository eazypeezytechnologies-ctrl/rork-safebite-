export const arcaneColors = {
  primary: '#0B6E7A',
  primaryLight: '#0E8A99',
  primaryDark: '#084F58',
  primaryMuted: 'rgba(11, 110, 122, 0.12)',

  accent: '#6D28D9',
  accentLight: '#8B5CF6',
  accentMuted: 'rgba(109, 40, 217, 0.10)',
  accentGlow: 'rgba(109, 40, 217, 0.25)',

  gold: '#F5C542',
  goldMuted: 'rgba(245, 197, 66, 0.15)',
  goldDark: '#D4A017',

  safe: '#059669',
  safeMuted: 'rgba(5, 150, 105, 0.12)',
  safeLight: '#10B981',

  caution: '#D97706',
  cautionMuted: 'rgba(217, 119, 6, 0.12)',
  cautionLight: '#F59E0B',

  danger: '#DC2626',
  dangerMuted: 'rgba(220, 38, 38, 0.10)',
  dangerLight: '#EF4444',

  bg: '#F7FAFC',
  bgCard: '#FFFFFF',
  bgElevated: '#F0F4F8',
  bgMist: '#EDF2F7',
  bgDark: '#0B0F14',
  bgDarkCard: '#151B23',
  bgDarkElevated: '#1A2332',

  text: '#1A202C',
  textSecondary: '#4A5568',
  textMuted: '#A0AEC0',
  textOnPrimary: '#FFFFFF',
  textGold: '#92700C',

  border: '#E2E8F0',
  borderLight: '#EDF2F7',
  borderAccent: 'rgba(109, 40, 217, 0.20)',
  borderRune: 'rgba(11, 110, 122, 0.25)',
  borderGold: 'rgba(245, 197, 66, 0.35)',

  shadow: 'rgba(11, 110, 122, 0.08)',
  shadowAccent: 'rgba(109, 40, 217, 0.12)',

  tabBar: '#FAFCFF',
  tabBarBorder: '#E2E8F0',
  tabBarActive: '#0B6E7A',
  tabBarInactive: '#A0AEC0',

  headerBg: '#FFFFFF',
  headerText: '#1A202C',
  headerBorder: '#E2E8F0',
} as const;

export const arcaneShadows = {
  card: {
    shadowColor: arcaneColors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: arcaneColors.shadowAccent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 5,
  },
  glow: {
    shadowColor: arcaneColors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  goldGlow: {
    shadowColor: arcaneColors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

export const arcaneSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const arcaneRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
} as const;
