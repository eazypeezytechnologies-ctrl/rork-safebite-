import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Users, ChevronDown, ChevronUp, AlertCircle, CheckCircle, AlertTriangle, HelpCircle, ShieldAlert } from 'lucide-react-native';
import { HouseholdVerdict, VerdictLevel } from '@/types';
import { getVerdictColor, getVerdictLabel } from '@/utils/verdict';

interface HouseholdVerdictCardProps {
  householdVerdict: HouseholdVerdict;
  familyGroupName?: string;
  testID?: string;
}

function getVerdictIcon(level: VerdictLevel) {
  switch (level) {
    case 'danger': return AlertCircle;
    case 'caution': return AlertTriangle;
    case 'unknown': return HelpCircle;
    case 'safe': return CheckCircle;
  }
}

export const HouseholdVerdictCard = React.memo(function HouseholdVerdictCard({
  householdVerdict,
  familyGroupName,
  testID,
}: HouseholdVerdictCardProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  const { overallLevel, memberVerdicts, affectedMembers, message } = householdVerdict;
  const overallColor = getVerdictColor(overallLevel);
  const OverallIcon = getVerdictIcon(overallLevel);

  if (memberVerdicts.length === 0) return null;

  const sortedMembers = [...memberVerdicts].sort((a, b) => {
    const order: Record<VerdictLevel, number> = { danger: 0, caution: 1, unknown: 2, safe: 3 };
    return (order[a.verdict.level] ?? 3) - (order[b.verdict.level] ?? 3);
  });

  return (
    <View style={styles.container} testID={testID}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={[styles.iconCircle, { backgroundColor: overallColor + '18' }]}>
          <Users size={20} color={overallColor} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>
            {familyGroupName ? `${familyGroupName} Check` : 'Household Check'}
          </Text>
          <Text style={styles.subtitle}>
            {memberVerdicts.length} member{memberVerdicts.length !== 1 ? 's' : ''} checked
          </Text>
        </View>
        <View style={[styles.overallBadge, { backgroundColor: overallColor + '14', borderColor: overallColor }]}>
          <OverallIcon size={14} color={overallColor} />
          <Text style={[styles.overallBadgeText, { color: overallColor }]}>
            {getVerdictLabel(overallLevel)}
          </Text>
        </View>
        {expanded ? (
          <ChevronUp size={18} color="#6B7280" />
        ) : (
          <ChevronDown size={18} color="#6B7280" />
        )}
      </TouchableOpacity>

      <Text style={styles.message}>{message}</Text>

      {overallLevel === 'danger' && (
        <View style={styles.dangerBanner}>
          <ShieldAlert size={16} color="#991B1B" />
          <Text style={styles.dangerBannerText}>
            Do not use this product if any affected member is present.
          </Text>
        </View>
      )}

      {expanded && (
        <View style={styles.memberList}>
          {sortedMembers.map((mv) => {
            const color = getVerdictColor(mv.verdict.level);
            const Icon = getVerdictIcon(mv.verdict.level);
            const initials = mv.profileName
              .split(' ')
              .map(w => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <View key={mv.profileId} style={styles.memberRow}>
                <View style={[styles.avatar, { backgroundColor: mv.avatarColor || '#E2E8F0' }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{mv.profileName}</Text>
                    {mv.relationship && (
                      <Text style={styles.memberRelationship}>
                        {mv.relationship}
                      </Text>
                    )}
                  </View>
                  {mv.verdict.level !== 'safe' && mv.verdict.matches.length > 0 && (
                    <Text style={styles.memberTriggers} numberOfLines={2}>
                      {mv.verdict.matches.map(m => m.allergen).join(', ')}
                    </Text>
                  )}
                  {mv.hasAnaphylaxis && mv.verdict.level === 'danger' && (
                    <View style={styles.anaphylaxisTag}>
                      <AlertCircle size={10} color="#991B1B" />
                      <Text style={styles.anaphylaxisText}>Anaphylaxis risk</Text>
                    </View>
                  )}
                </View>
                <View style={[styles.memberBadge, { backgroundColor: color + '14', borderColor: color }]}>
                  <Icon size={12} color={color} />
                  <Text style={[styles.memberBadgeText, { color }]}>
                    {getVerdictLabel(mv.verdict.level)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {!expanded && affectedMembers.length > 0 && (
        <TouchableOpacity style={styles.expandHint} onPress={toggleExpanded}>
          <Text style={styles.expandHintText}>
            Tap to see individual results for each member
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#111827',
  },
  subtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  overallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  overallBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  message: {
    fontSize: 14,
    color: '#374151',
    marginTop: 12,
    lineHeight: 20,
  },
  dangerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dangerBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#991B1B',
    lineHeight: 17,
  },
  memberList: {
    marginTop: 14,
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#374151',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
  },
  memberRelationship: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'capitalize' as const,
  },
  memberTriggers: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  anaphylaxisTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start' as const,
  },
  anaphylaxisText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#991B1B',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  memberBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  expandHint: {
    marginTop: 10,
    alignItems: 'center',
    paddingVertical: 6,
  },
  expandHintText: {
    fontSize: 12,
    color: '#0891B2',
    fontWeight: '500' as const,
  },
});
