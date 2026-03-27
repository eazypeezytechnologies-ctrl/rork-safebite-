import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Check, ChevronDown, ChevronUp, Shield } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { arcaneColors, arcaneRadius, arcaneShadows } from '@/constants/theme';
import { COMMON_RESTRICTIONS, EXTENDED_RESTRICTIONS, DIETARY_RESTRICTIONS_MASTER } from '@/constants/dietaryRestrictions';
import { STRICTNESS_OPTIONS, DEFAULT_STRICTNESS, type StrictnessLevel } from '@/constants/restrictionStrictness';

interface DietaryRestrictionsSetupProps {
  dietaryRestrictions: Record<string, boolean>;
  onDietaryRestrictionsChange: (restrictions: Record<string, boolean>) => void;
  dietaryStrictness: Record<string, 'relaxed' | 'standard' | 'strict'>;
  onDietaryStrictnessChange: (strictness: Record<string, 'relaxed' | 'standard' | 'strict'>) => void;
}

export const DietaryRestrictionsSetup = React.memo(function DietaryRestrictionsSetup({
  dietaryRestrictions,
  onDietaryRestrictionsChange,
  dietaryStrictness,
  onDietaryStrictnessChange,
}: DietaryRestrictionsSetupProps) {
  const [showMore, setShowMore] = useState(false);

  const hapticFeedback = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const toggleRestriction = useCallback((id: string) => {
    hapticFeedback();
    const updated = { ...dietaryRestrictions };
    if (updated[id]) {
      delete updated[id];
      const updatedStrictness = { ...dietaryStrictness };
      delete updatedStrictness[id];
      onDietaryRestrictionsChange(updated);
      onDietaryStrictnessChange(updatedStrictness);
    } else {
      updated[id] = true;
      onDietaryRestrictionsChange(updated);
      if (!dietaryStrictness[id]) {
        onDietaryStrictnessChange({ ...dietaryStrictness, [id]: DEFAULT_STRICTNESS });
      }
    }
  }, [dietaryRestrictions, dietaryStrictness, onDietaryRestrictionsChange, onDietaryStrictnessChange, hapticFeedback]);

  const setStrictness = useCallback((id: string, level: StrictnessLevel) => {
    hapticFeedback();
    onDietaryStrictnessChange({ ...dietaryStrictness, [id]: level });
  }, [dietaryStrictness, onDietaryStrictnessChange, hapticFeedback]);

  const enabledCount = Object.values(dietaryRestrictions).filter(Boolean).length;

  const renderRestrictionItem = useCallback((item: typeof DIETARY_RESTRICTIONS_MASTER[0]) => {
    const isEnabled = !!dietaryRestrictions[item.id];
    const currentStrictness = dietaryStrictness[item.id] || DEFAULT_STRICTNESS;

    return (
      <View key={item.id} style={styles.restrictionItem}>
        <TouchableOpacity
          style={[styles.restrictionToggle, isEnabled && styles.restrictionToggleActive]}
          onPress={() => toggleRestriction(item.id)}
          activeOpacity={0.7}
          testID={`dietary-restriction-${item.id}`}
        >
          <Text style={styles.restrictionIcon}>{item.icon}</Text>
          <View style={styles.restrictionTextBlock}>
            <Text style={[styles.restrictionLabel, isEnabled && styles.restrictionLabelActive]}>
              {item.label}
            </Text>
            <Text style={[styles.restrictionDesc, isEnabled && styles.restrictionDescActive]} numberOfLines={1}>
              {item.description}
            </Text>
          </View>
          {isEnabled && (
            <View style={styles.checkCircle}>
              <Check size={12} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>

        {isEnabled && (
          <View style={styles.strictnessRow}>
            {STRICTNESS_OPTIONS.map(opt => {
              const isActive = currentStrictness === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.strictnessSegment,
                    isActive && styles.strictnessSegmentActive,
                    opt.value === 'relaxed' && styles.strictnessSegmentLeft,
                    opt.value === 'strict' && styles.strictnessSegmentRight,
                  ]}
                  onPress={() => setStrictness(item.id, opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.strictnessLabel, isActive && styles.strictnessLabelActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  }, [dietaryRestrictions, dietaryStrictness, toggleRestriction, setStrictness]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIconBg, { backgroundColor: 'rgba(14, 138, 153, 0.12)' }]}>
            <Shield size={20} color={arcaneColors.primary} />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.cardTitle}>Dietary Restrictions</Text>
            <Text style={styles.cardSubtitle}>
              {enabledCount > 0 ? `${enabledCount} active` : 'Optional — tap to enable'}
            </Text>
          </View>
        </View>
        <View style={styles.cardDivider} />

        <View style={styles.helperNote}>
          <Text style={styles.helperNoteText}>
            Set strictness per restriction. Relaxed flags only clear conflicts. Standard adds common ambiguous ingredients. Strict catches everything including unknown-source.
          </Text>
        </View>

        <View style={styles.restrictionsList}>
          {COMMON_RESTRICTIONS.map(renderRestrictionItem)}
        </View>

        {!showMore && EXTENDED_RESTRICTIONS.length > 0 && (
          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => setShowMore(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.showMoreText}>Show more restrictions</Text>
            <ChevronDown size={16} color={arcaneColors.primary} />
          </TouchableOpacity>
        )}

        {showMore && (
          <>
            <View style={styles.restrictionsList}>
              {EXTENDED_RESTRICTIONS.map(renderRestrictionItem)}
            </View>
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setShowMore(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.showMoreText}>Show fewer</Text>
              <ChevronUp size={16} color={arcaneColors.primary} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  card: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.xl,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    overflow: 'hidden',
    ...arcaneShadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  cardIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: arcaneColors.textSecondary,
    marginTop: 2,
  },
  cardDivider: {
    height: 2,
    backgroundColor: arcaneColors.primaryLight,
    marginHorizontal: 16,
    borderRadius: 1,
    opacity: 0.4,
  },
  helperNote: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: arcaneColors.primaryMuted,
    borderRadius: arcaneRadius.md,
    padding: 10,
  },
  helperNoteText: {
    fontSize: 12,
    color: arcaneColors.primaryDark,
    lineHeight: 17,
  },
  restrictionsList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  restrictionItem: {
    gap: 0,
  },
  restrictionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: arcaneRadius.lg,
    backgroundColor: arcaneColors.bgMist,
    borderWidth: 1.5,
    borderColor: arcaneColors.border,
  },
  restrictionToggleActive: {
    backgroundColor: arcaneColors.primary,
    borderColor: arcaneColors.primary,
  },
  restrictionIcon: {
    fontSize: 18,
  },
  restrictionTextBlock: {
    flex: 1,
  },
  restrictionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: arcaneColors.text,
  },
  restrictionLabelActive: {
    color: '#FFFFFF',
  },
  restrictionDesc: {
    fontSize: 11,
    color: arcaneColors.textMuted,
    marginTop: 1,
  },
  restrictionDescActive: {
    color: 'rgba(255,255,255,0.75)',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  strictnessRow: {
    flexDirection: 'row',
    marginTop: 6,
    marginHorizontal: 4,
    borderRadius: arcaneRadius.md,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    overflow: 'hidden',
  },
  strictnessSegment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: arcaneColors.bgMist,
    borderRightWidth: 1,
    borderRightColor: arcaneColors.border,
  },
  strictnessSegmentActive: {
    backgroundColor: arcaneColors.primaryLight,
  },
  strictnessSegmentLeft: {
    borderTopLeftRadius: arcaneRadius.md - 1,
    borderBottomLeftRadius: arcaneRadius.md - 1,
  },
  strictnessSegmentRight: {
    borderTopRightRadius: arcaneRadius.md - 1,
    borderBottomRightRadius: arcaneRadius.md - 1,
    borderRightWidth: 0,
  },
  strictnessLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: arcaneColors.textSecondary,
  },
  strictnessLabelActive: {
    color: '#FFFFFF',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 4,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: arcaneColors.primary,
  },
});
