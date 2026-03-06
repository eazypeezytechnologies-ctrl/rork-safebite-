import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, AlertTriangle, Info, Search } from 'lucide-react-native';
import { Product, Profile } from '@/types';
import { calculateDietaryRestrictionVerdict, type DietaryRestrictionVerdict, type DietaryRestrictionMatch } from '@/utils/dietaryRestrictionVerdict';
import { DIETARY_RESTRICTIONS_MASTER } from '@/constants/dietaryRestrictions';
import { arcaneColors } from '@/constants/theme';

interface DietaryRestrictionVerdictCardProps {
  product: Product;
  profile: Profile;
  testID?: string;
}

export const DietaryRestrictionVerdictCard = React.memo(function DietaryRestrictionVerdictCard({
  product,
  profile,
  testID,
}: DietaryRestrictionVerdictCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const restrictions = profile.dietaryRestrictions || {};
  const enabledCount = Object.values(restrictions).filter(Boolean).length;

  const verdict: DietaryRestrictionVerdict = useMemo(
    () => calculateDietaryRestrictionVerdict(product, profile),
    [product, profile],
  );

  if (enabledCount === 0) return null;

  const toggleDetails = useCallback(() => {
    setShowDetails(prev => !prev);
  }, []);

  const isCosmeticProduct = product.product_type === 'skin' || product.product_type === 'hair';

  const getLevelConfig = () => {
    switch (verdict.level) {
      case 'unsafe':
        return {
          icon: ShieldAlert,
          iconColor: '#DC2626',
          iconBg: '#FEE2E2',
          badgeBg: '#FEE2E218',
          badgeBorder: '#DC2626',
          badgeText: '#DC2626',
          label: 'Conflicts Found',
        };
      case 'verify':
        return {
          icon: Search,
          iconColor: '#D97706',
          iconBg: '#FEF3C7',
          badgeBg: '#FEF3C718',
          badgeBorder: '#D97706',
          badgeText: '#D97706',
          label: 'Verify Needed',
        };
      default:
        return {
          icon: ShieldCheck,
          iconColor: '#059669',
          iconBg: '#D1FAE5',
          badgeBg: '#D1FAE518',
          badgeBorder: '#059669',
          badgeText: '#059669',
          label: 'No Conflicts',
        };
    }
  };

  const config = getLevelConfig();
  const StatusIcon = config.icon;

  const groupedMatches = useMemo(() => {
    const groups: Record<string, DietaryRestrictionMatch[]> = {};
    for (const match of verdict.matches) {
      if (!groups[match.restrictionId]) {
        groups[match.restrictionId] = [];
      }
      groups[match.restrictionId].push(match);
    }
    return groups;
  }, [verdict.matches]);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
          <StatusIcon size={20} color={config.iconColor} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Dietary Restriction Check</Text>
          <Text style={styles.profileHint}>
            For {profile.name} {isCosmeticProduct ? '(cosmetic scan)' : ''}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: config.badgeBg, borderColor: config.badgeBorder }]}>
          <StatusIcon size={14} color={config.badgeText} />
          <Text style={[styles.statusText, { color: config.badgeText }]}>{config.label}</Text>
        </View>
      </View>

      {!verdict.hasData && (
        <View style={styles.noDataBanner}>
          <AlertTriangle size={14} color="#92400E" />
          <Text style={styles.noDataText}>
            No ingredient data available — cannot fully verify dietary restrictions.
          </Text>
        </View>
      )}

      {verdict.summary.length > 0 && (
        <Text style={[
          styles.summaryText,
          verdict.level === 'unsafe' && styles.summaryUnsafe,
          verdict.level === 'verify' && styles.summaryVerify,
        ]}>
          {verdict.summary}
        </Text>
      )}

      {verdict.level === 'verify' && (
        <View style={styles.recommendBanner}>
          <Info size={14} color="#92400E" />
          <Text style={styles.recommendText}>
            Look for certified labels (e.g. Halal, Kosher, Vegan certified) to confirm.
          </Text>
        </View>
      )}

      {isCosmeticProduct && verdict.cosmeticPorkMatches.length > 0 && (
        <View style={styles.cosmeticPorkBanner}>
          <ShieldAlert size={14} color="#991B1B" />
          <View style={styles.cosmeticPorkContent}>
            <Text style={styles.cosmeticPorkTitle}>
              {verdict.cosmeticPorkMatches.some(m => m.group === 'block')
                ? 'Contains pork-derived ingredient'
                : 'May contain pork-derived ingredient'}
            </Text>
            <Text style={styles.cosmeticPorkList}>
              Matched: {verdict.cosmeticPorkMatches.map(m => m.keyword).join(', ')}
            </Text>
          </View>
        </View>
      )}

      {verdict.matches.length > 0 && (
        <TouchableOpacity style={styles.detailsToggle} onPress={toggleDetails} activeOpacity={0.7}>
          <Info size={14} color={arcaneColors.primary} />
          <Text style={styles.detailsToggleText}>
            {showDetails ? 'Hide details' : `View ${verdict.matches.length} match${verdict.matches.length > 1 ? 'es' : ''}`}
          </Text>
          {showDetails ? <ChevronUp size={16} color={arcaneColors.primary} /> : <ChevronDown size={16} color={arcaneColors.primary} />}
        </TouchableOpacity>
      )}

      {showDetails && (
        <View style={styles.detailsSection}>
          {Object.entries(groupedMatches).map(([restrictionId, rMatches]) => {
            const def = DIETARY_RESTRICTIONS_MASTER.find(d => d.id === restrictionId);
            const label = def?.label || restrictionId;
            const strictness = rMatches[0]?.strictness || 'standard';

            return (
              <View key={restrictionId} style={styles.detailGroup}>
                <View style={styles.detailGroupHeader}>
                  <Text style={styles.detailGroupIcon}>{def?.icon || '🔍'}</Text>
                  <Text style={styles.detailGroupLabel}>{label}</Text>
                  <View style={styles.strictnessPill}>
                    <Text style={styles.strictnessPillText}>{strictness}</Text>
                  </View>
                </View>
                {rMatches.map((match, idx) => {
                  const groupColor = match.matchGroup === 'block' ? '#DC2626' :
                    match.matchGroup === 'verify' ? '#D97706' : '#9CA3AF';
                  const groupLabel = match.matchGroup === 'block' ? 'BLOCK' :
                    match.matchGroup === 'verify' ? 'VERIFY' : 'CHECK';

                  return (
                    <View key={`${match.matchedKeyword}-${idx}`} style={styles.detailMatch}>
                      <View style={[styles.detailMatchDot, { backgroundColor: groupColor }]} />
                      <Text style={styles.detailMatchKeyword}>{match.matchedKeyword}</Text>
                      <View style={[styles.groupPill, { backgroundColor: groupColor + '18', borderColor: groupColor }]}>
                        <Text style={[styles.groupPillText, { color: groupColor }]}>{groupLabel}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })}

          <View style={styles.disclaimer}>
            <AlertTriangle size={12} color="#92400E" />
            <Text style={styles.disclaimerText}>
              Always verify the physical label. This is educational only — not medical or religious authority.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111827',
  },
  profileHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  noDataBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noDataText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#374151',
    marginTop: 12,
    lineHeight: 19,
  },
  summaryUnsafe: {
    color: '#991B1B',
  },
  summaryVerify: {
    color: '#92400E',
  },
  recommendBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF9C3',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  recommendText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },
  cosmeticPorkBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cosmeticPorkContent: {
    flex: 1,
  },
  cosmeticPorkTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#991B1B',
  },
  cosmeticPorkList: {
    fontSize: 12,
    color: '#7F1D1D',
    marginTop: 3,
    lineHeight: 17,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  detailsToggleText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: arcaneColors.primary,
    flex: 1,
  },
  detailsSection: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
  },
  detailGroup: {
    gap: 6,
  },
  detailGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailGroupIcon: {
    fontSize: 15,
  },
  detailGroupLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#374151',
    flex: 1,
  },
  strictnessPill: {
    backgroundColor: arcaneColors.primaryMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  strictnessPillText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: arcaneColors.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  detailMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 22,
  },
  detailMatchDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  detailMatchKeyword: {
    fontSize: 12,
    color: '#4B5563',
    flex: 1,
  },
  groupPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  groupPillText: {
    fontSize: 9,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
});
