import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Check, Clock, XCircle, ChevronDown, ChevronUp, Info } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ProfileHealthItem, HealthItemStatus, HealthItemCategory } from '@/types';
import { arcaneColors, arcaneRadius, arcaneShadows } from '@/constants/theme';

interface HealthItemManagerProps {
  healthItems: ProfileHealthItem[];
  onHealthItemsChange: (items: ProfileHealthItem[]) => void;
  category: HealthItemCategory;
  title: string;
}

const STATUS_CONFIG: Record<HealthItemStatus, { label: string; color: string; bg: string; icon: typeof Check }> = {
  confirmed: { label: 'Confirmed', color: arcaneColors.danger, bg: arcaneColors.dangerMuted, icon: Check },
  suspected: { label: 'Suspected', color: arcaneColors.caution, bg: arcaneColors.cautionMuted, icon: Clock },
  resolved: { label: 'Resolved', color: arcaneColors.safe, bg: arcaneColors.safeMuted, icon: XCircle },
};

const SEVERITY_CONFIG = {
  mild: { label: 'Mild', color: '#059669' },
  moderate: { label: 'Moderate', color: '#D97706' },
  severe: { label: 'Severe', color: '#DC2626' },
} as const;

export const HealthItemManager = React.memo(function HealthItemManager({
  healthItems,
  onHealthItemsChange,
  category,
  title,
}: HealthItemManagerProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const filteredItems = healthItems.filter(h => h.category === category);
  const activeItems = filteredItems.filter(h => h.status !== 'resolved');
  const resolvedItems = filteredItems.filter(h => h.status === 'resolved');

  const haptic = useCallback(() => {
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const updateItem = useCallback((itemName: string, updates: Partial<ProfileHealthItem>) => {
    haptic();
    const updated = healthItems.map(h => {
      if (h.name === itemName && h.category === category) {
        return { ...h, ...updates, lastReviewedAt: new Date().toISOString() };
      }
      return h;
    });
    onHealthItemsChange(updated);
  }, [healthItems, category, onHealthItemsChange, haptic]);

  const handleStatusChange = useCallback((itemName: string, newStatus: HealthItemStatus) => {
    if (newStatus === 'resolved') {
      Alert.alert(
        'Mark as Resolved',
        `Are you sure "${itemName}" is no longer an active concern? This means it won't affect product evaluations.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Resolved',
            onPress: () => {
              updateItem(itemName, { status: 'resolved' });
              console.log(`[HealthItemManager] Resolved: ${itemName} (${category})`);
            },
          },
        ],
      );
    } else {
      updateItem(itemName, { status: newStatus });
      console.log(`[HealthItemManager] Status changed: ${itemName} -> ${newStatus}`);
    }
  }, [updateItem, category]);

  const handleSeverityChange = useCallback((itemName: string, severity: 'mild' | 'moderate' | 'severe') => {
    updateItem(itemName, { severity });
  }, [updateItem]);

  const handleReactivate = useCallback((itemName: string) => {
    Alert.alert(
      'Reactivate',
      `Reactivate "${itemName}" as an active concern?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'As Confirmed',
          onPress: () => updateItem(itemName, { status: 'confirmed' }),
        },
        {
          text: 'As Suspected',
          onPress: () => updateItem(itemName, { status: 'suspected' }),
        },
      ],
    );
  }, [updateItem]);

  const renderItem = useCallback((item: ProfileHealthItem, isResolved: boolean) => {
    const statusCfg = STATUS_CONFIG[item.status];
    const severityCfg = SEVERITY_CONFIG[item.severity];
    const isExpanded = expandedItem === item.name;
    const daysSinceReview = Math.floor(
      (Date.now() - new Date(item.lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    const needsReview = daysSinceReview > 90;

    return (
      <View key={`${item.category}-${item.name}`} style={[styles.itemCard, isResolved && styles.itemCardResolved]}>
        <TouchableOpacity
          style={styles.itemHeader}
          onPress={() => {
            haptic();
            setExpandedItem(isExpanded ? null : item.name);
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
          <View style={styles.itemHeaderText}>
            <Text style={[styles.itemName, isResolved && styles.itemNameResolved]}>{item.name}</Text>
            <View style={styles.itemBadges}>
              <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
              </View>
              {!isResolved && (
                <View style={[styles.severityBadge, { backgroundColor: `${severityCfg.color}18` }]}>
                  <Text style={[styles.severityBadgeText, { color: severityCfg.color }]}>{severityCfg.label}</Text>
                </View>
              )}
              {needsReview && !isResolved && (
                <View style={styles.reviewBadge}>
                  <Clock size={10} color={arcaneColors.caution} />
                  <Text style={styles.reviewBadgeText}>Review</Text>
                </View>
              )}
            </View>
          </View>
          {isExpanded ? (
            <ChevronUp size={18} color={arcaneColors.textMuted} />
          ) : (
            <ChevronDown size={18} color={arcaneColors.textMuted} />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedSection}>
            <Text style={styles.expandedLabel}>Last reviewed</Text>
            <Text style={styles.expandedValue}>
              {new Date(item.lastReviewedAt).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric',
              })}
              {needsReview ? ' (overdue)' : ''}
            </Text>

            {item.notes && (
              <>
                <Text style={styles.expandedLabel}>Notes</Text>
                <Text style={styles.expandedValue}>{item.notes}</Text>
              </>
            )}

            {!isResolved ? (
              <>
                <Text style={styles.expandedLabel}>Status</Text>
                <View style={styles.statusRow}>
                  {(['confirmed', 'suspected', 'resolved'] as HealthItemStatus[]).map(s => {
                    const cfg = STATUS_CONFIG[s];
                    const isActive = item.status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.statusOption, isActive && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                        onPress={() => handleStatusChange(item.name, s)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.statusOptionText, isActive && { color: cfg.color, fontWeight: '700' as const }]}>
                          {cfg.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.expandedLabel}>Severity</Text>
                <View style={styles.statusRow}>
                  {(['mild', 'moderate', 'severe'] as const).map(s => {
                    const cfg = SEVERITY_CONFIG[s];
                    const isActive = item.severity === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        style={[styles.statusOption, isActive && { backgroundColor: `${cfg.color}18`, borderColor: cfg.color }]}
                        onPress={() => handleSeverityChange(item.name, s)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.statusOptionText, isActive && { color: cfg.color, fontWeight: '700' as const }]}>
                          {cfg.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : (
              <TouchableOpacity
                style={styles.reactivateButton}
                onPress={() => handleReactivate(item.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.reactivateText}>Reactivate</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }, [expandedItem, haptic, handleStatusChange, handleSeverityChange, handleReactivate]);

  if (filteredItems.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.countRow}>
          <Text style={styles.countText}>
            {activeItems.length} active
            {resolvedItems.length > 0 ? ` · ${resolvedItems.length} resolved` : ''}
          </Text>
        </View>
      </View>

      {activeItems.length > 0 && (
        <View style={styles.itemsList}>
          {activeItems.map(item => renderItem(item, false))}
        </View>
      )}

      {resolvedItems.length > 0 && (
        <View style={styles.resolvedSection}>
          <View style={styles.resolvedHeader}>
            <Info size={14} color={arcaneColors.textMuted} />
            <Text style={styles.resolvedHeaderText}>Resolved / Outgrown</Text>
          </View>
          <View style={styles.itemsList}>
            {resolvedItems.map(item => renderItem(item, true))}
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: arcaneColors.text,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    color: arcaneColors.textMuted,
    fontWeight: '600' as const,
  },
  itemsList: {
    gap: 8,
  },
  itemCard: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    overflow: 'hidden',
    ...arcaneShadows.card,
  },
  itemCardResolved: {
    opacity: 0.7,
    backgroundColor: arcaneColors.bgMist,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  itemHeaderText: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: arcaneColors.text,
    marginBottom: 4,
  },
  itemNameResolved: {
    textDecorationLine: 'line-through',
    color: arcaneColors.textSecondary,
  },
  itemBadges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: arcaneRadius.sm,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: arcaneRadius.sm,
  },
  severityBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  reviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: arcaneRadius.sm,
    backgroundColor: arcaneColors.cautionMuted,
  },
  reviewBadgeText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: arcaneColors.caution,
  },
  expandedSection: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: arcaneColors.borderLight,
    paddingTop: 12,
  },
  expandedLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: arcaneColors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  expandedValue: {
    fontSize: 14,
    color: arcaneColors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: arcaneRadius.md,
    backgroundColor: arcaneColors.bgMist,
    borderWidth: 1.5,
    borderColor: arcaneColors.border,
    alignItems: 'center',
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: arcaneColors.textSecondary,
  },
  resolvedSection: {
    marginTop: 12,
  },
  resolvedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  resolvedHeaderText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: arcaneColors.textMuted,
  },
  reactivateButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: arcaneRadius.md,
    backgroundColor: arcaneColors.primaryMuted,
    alignItems: 'center',
  },
  reactivateText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: arcaneColors.primary,
  },
});
