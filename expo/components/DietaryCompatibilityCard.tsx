import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle, XCircle, ChevronDown, ChevronUp, AlertTriangle, Info, Utensils } from 'lucide-react-native';
import { Product, Profile } from '@/types';
import { checkDietaryCompatibility, DietaryCompatibilityResult } from '@/utils/dietaryCompatibility';
import { TranslationCard } from '@/components/TranslationCard';

interface DietaryCompatibilityCardProps {
  product: Product;
  profile: Profile;
  testID?: string;
}

export const DietaryCompatibilityCard = React.memo(function DietaryCompatibilityCard({
  product,
  profile,
  testID,
}: DietaryCompatibilityCardProps) {
  const [showWhy, setShowWhy] = useState(false);

  const dietaryRules = profile.dietaryRules || [];
  const avoidIngredients = profile.avoidIngredients || [];

  if (dietaryRules.length === 0 && avoidIngredients.length === 0) {
    return null;
  }

  const result: DietaryCompatibilityResult = checkDietaryCompatibility(product, profile);

  const toggleWhy = useCallback(() => {
    setShowWhy(prev => !prev);
  }, []);

  const hasNonAscii = product.ingredients_text ? /[^\u0020-\u007E]/.test(product.ingredients_text) : false;

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, result.isCompatible ? styles.iconCircleSafe : styles.iconCircleDanger]}>
          <Utensils size={20} color={result.isCompatible ? '#059669' : '#DC2626'} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Dietary Compatibility</Text>
          <Text style={styles.profileHint}>For {profile.name}</Text>
        </View>
        <View style={[styles.statusBadge, result.isCompatible ? styles.statusSafe : styles.statusDanger]}>
          {result.isCompatible ? (
            <CheckCircle size={16} color="#059669" />
          ) : (
            <XCircle size={16} color="#DC2626" />
          )}
          <Text style={[styles.statusText, result.isCompatible ? styles.statusTextSafe : styles.statusTextDanger]}>
            {result.isCompatible ? 'Compatible' : 'Not Compatible'}
          </Text>
        </View>
      </View>

      {!result.hasIngredientData && (
        <View style={styles.noDataBanner}>
          <AlertTriangle size={14} color="#92400E" />
          <Text style={styles.noDataText}>
            No ingredient data available — cannot fully verify dietary compatibility.
          </Text>
        </View>
      )}

      {!result.isCompatible && result.matches.length > 0 && (
        <View style={styles.matchList}>
          {result.matches.map((match, index) => (
            <View key={`${match.rule}-${match.matchedIngredient}-${index}`} style={styles.matchItem}>
              <View style={styles.matchDot} />
              <View style={styles.matchContent}>
                <Text style={styles.matchRuleLabel}>{match.ruleLabel}</Text>
                <Text style={styles.matchIngredient}>
                  Contains: <Text style={styles.matchIngredientBold}>{match.matchedIngredient}</Text>
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {hasNonAscii && !result.isCompatible && (
        <View style={styles.translationSection}>
          <View style={styles.translationLabel}>
            <Info size={12} color="#6B7280" />
            <Text style={styles.translationLabelText}>Non-English ingredients detected</Text>
          </View>
          <TranslationCard
            label="Ingredients (translated)"
            text={product.ingredients_text || ''}
            compact
            autoTranslate
            testID="dietary-translation"
          />
        </View>
      )}

      <TouchableOpacity style={styles.whyToggle} onPress={toggleWhy} activeOpacity={0.7}>
        <Info size={14} color="#0891B2" />
        <Text style={styles.whyToggleText}>Why this result?</Text>
        {showWhy ? <ChevronUp size={16} color="#0891B2" /> : <ChevronDown size={16} color="#0891B2" />}
      </TouchableOpacity>

      {showWhy && (
        <View style={styles.whySection}>
          <Text style={styles.whySectionTitle}>Checked against your profile:</Text>

          {dietaryRules.length > 0 && (
            <View style={styles.whyGroup}>
              <Text style={styles.whyGroupLabel}>Dietary Rules</Text>
              <View style={styles.whyChipRow}>
                {dietaryRules.map(rule => {
                  const hasMatch = result.matches.some(m => m.rule === rule);
                  return (
                    <View
                      key={rule}
                      style={[styles.whyChip, hasMatch ? styles.whyChipFlagged : styles.whyChipClear]}
                    >
                      <Text style={[styles.whyChipText, hasMatch ? styles.whyChipTextFlagged : styles.whyChipTextClear]}>
                        {hasMatch ? '✗ ' : '✓ '}{rule.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {avoidIngredients.length > 0 && (
            <View style={styles.whyGroup}>
              <Text style={styles.whyGroupLabel}>Avoided Ingredients</Text>
              <View style={styles.whyChipRow}>
                {avoidIngredients.map(ingredient => {
                  const hasMatch = result.matches.some(m => m.rule === `avoid_${ingredient}`);
                  return (
                    <View
                      key={ingredient}
                      style={[styles.whyChip, hasMatch ? styles.whyChipFlagged : styles.whyChipClear]}
                    >
                      <Text style={[styles.whyChipText, hasMatch ? styles.whyChipTextFlagged : styles.whyChipTextClear]}>
                        {hasMatch ? '✗ ' : '✓ '}{ingredient.replace(/_/g, ' ')}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {result.isCompatible && result.hasIngredientData && (
            <Text style={styles.whyClearText}>
              No restricted ingredients found in this product based on your dietary profile.
            </Text>
          )}

          <View style={styles.whyDisclaimer}>
            <AlertTriangle size={12} color="#92400E" />
            <Text style={styles.whyDisclaimerText}>
              This check is based on available ingredient data. Always verify the physical label. Manufacturing processes may introduce unlisted ingredients.
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
  iconCircleSafe: {
    backgroundColor: '#D1FAE5',
  },
  iconCircleDanger: {
    backgroundColor: '#FEE2E2',
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
  statusSafe: {
    backgroundColor: '#D1FAE518',
    borderColor: '#059669',
  },
  statusDanger: {
    backgroundColor: '#FEE2E218',
    borderColor: '#DC2626',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  statusTextSafe: {
    color: '#059669',
  },
  statusTextDanger: {
    color: '#DC2626',
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
  matchList: {
    marginTop: 14,
    gap: 8,
  },
  matchItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  matchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    marginTop: 6,
  },
  matchContent: {
    flex: 1,
  },
  matchRuleLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#991B1B',
  },
  matchIngredient: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  matchIngredientBold: {
    fontWeight: '700' as const,
    color: '#DC2626',
  },
  translationSection: {
    marginTop: 12,
  },
  translationLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  translationLabelText: {
    fontSize: 11,
    color: '#6B7280',
  },
  whyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  whyToggleText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#0891B2',
    flex: 1,
  },
  whySection: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  whySectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 10,
  },
  whyGroup: {
    marginBottom: 10,
  },
  whyGroupLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#6B7280',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  whyChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  whyChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  whyChipFlagged: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  whyChipClear: {
    backgroundColor: '#D1FAE5',
    borderColor: '#A7F3D0',
  },
  whyChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    textTransform: 'capitalize' as const,
  },
  whyChipTextFlagged: {
    color: '#991B1B',
  },
  whyChipTextClear: {
    color: '#065F46',
  },
  whyClearText: {
    fontSize: 13,
    color: '#065F46',
    lineHeight: 19,
    marginBottom: 8,
  },
  whyDisclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  whyDisclaimerText: {
    flex: 1,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 16,
  },
});
