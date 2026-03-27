import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ShieldAlert, ChevronDown, ChevronUp, Phone, BookOpen } from 'lucide-react-native';

interface LegalDisclaimerProps {
  hasAnaphylaxis?: boolean;
  variant?: 'compact' | 'full';
  testID?: string;
}

export const LegalDisclaimer = React.memo(function LegalDisclaimer({
  hasAnaphylaxis = false,
  variant = 'compact',
  testID,
}: LegalDisclaimerProps) {
  const [expanded, setExpanded] = useState(variant === 'full');

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  return (
    <View style={styles.container} testID={testID}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.iconCircle}>
          <ShieldAlert size={16} color="#92400E" />
        </View>
        <Text style={styles.headerText}>
          Important Safety Information
        </Text>
        {variant === 'compact' && (
          expanded ? (
            <ChevronUp size={16} color="#92400E" />
          ) : (
            <ChevronDown size={16} color="#92400E" />
          )
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <View style={styles.disclaimerRow}>
            <BookOpen size={14} color="#78350F" />
            <Text style={styles.disclaimerText}>
              This app provides informational guidance only and is{' '}
              <Text style={styles.bold}>not a substitute for medical advice</Text>.
              Product databases may be incomplete, outdated, or contain errors.
            </Text>
          </View>

          <View style={styles.disclaimerRow}>
            <ShieldAlert size={14} color="#78350F" />
            <Text style={styles.disclaimerText}>
              Always read the physical product label yourself. Ingredients and
              manufacturing processes can change without notice. When in doubt,
              do not use the product and consult your physician or allergist.
            </Text>
          </View>

          {hasAnaphylaxis && (
            <View style={styles.anaphylaxisBanner}>
              <Phone size={14} color="#991B1B" />
              <Text style={styles.anaphylaxisText}>
                For severe allergies: Always carry prescribed epinephrine.
                If accidentally exposed, use your auto-injector immediately
                and call emergency services (911).
              </Text>
            </View>
          )}

          <View style={styles.trustRow}>
            <Text style={styles.trustLabel}>Verify with:</Text>
            <View style={styles.trustChips}>
              <View style={styles.trustChip}>
                <Text style={styles.trustChipText}>Physical Label</Text>
              </View>
              <View style={styles.trustChip}>
                <Text style={styles.trustChipText}>Your Doctor</Text>
              </View>
              <View style={styles.trustChip}>
                <Text style={styles.trustChipText}>Manufacturer</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
  },
  disclaimerRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#78350F',
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700' as const,
  },
  anaphylaxisBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  anaphylaxisText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#991B1B',
    lineHeight: 18,
  },
  trustRow: {
    marginTop: 4,
  },
  trustLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#92400E',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  trustChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  trustChip: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  trustChipText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#92400E',
  },
});
