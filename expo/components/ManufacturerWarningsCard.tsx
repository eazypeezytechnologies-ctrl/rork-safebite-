import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Factory, ChevronDown, ChevronUp, AlertTriangle, Info } from 'lucide-react-native';
import { Product } from '@/types';
import {
  detectManufacturerWarnings,
  ManufacturerWarning,
  getWarningColor,
  getWarningBgColor,
  getWarningBorderColor,
  getWarningTypeLabel,
} from '@/utils/manufacturerWarnings';

interface ManufacturerWarningsCardProps {
  product: Product;
  testID?: string;
}

export const ManufacturerWarningsCard = React.memo(function ManufacturerWarningsCard({
  product,
  testID,
}: ManufacturerWarningsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const warnings = detectManufacturerWarnings(product);

  if (warnings.length === 0) return null;

  const highSeverity = warnings.filter(w => w.severity === 'high');
  const otherWarnings = warnings.filter(w => w.severity !== 'high');
  const sortedWarnings = [...highSeverity, ...otherWarnings];
  const topWarning = sortedWarnings[0];
  const hasMultiple = sortedWarnings.length > 1;

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.headerRow}>
        <View style={[styles.iconCircle, { backgroundColor: getWarningColor(topWarning.severity) + '18' }]}>
          <Factory size={18} color={getWarningColor(topWarning.severity)} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Manufacturer Warnings</Text>
          <Text style={styles.countText}>
            {sortedWarnings.length} warning{sortedWarnings.length !== 1 ? 's' : ''} detected
          </Text>
        </View>
        {hasMultiple && (
          <TouchableOpacity
            style={styles.expandButton}
            onPress={() => setExpanded(prev => !prev)}
            activeOpacity={0.7}
          >
            {expanded ? (
              <ChevronUp size={18} color="#6B7280" />
            ) : (
              <ChevronDown size={18} color="#6B7280" />
            )}
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.warningsList}>
        {(expanded ? sortedWarnings : [topWarning]).map((warning, index) => (
          <WarningItem key={`${warning.type}_${index}`} warning={warning} />
        ))}
      </View>

      {!expanded && hasMultiple && (
        <TouchableOpacity
          style={styles.showMoreButton}
          onPress={() => setExpanded(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.showMoreText}>
            +{sortedWarnings.length - 1} more warning{sortedWarnings.length - 1 !== 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.disclaimer}>
        <Info size={12} color="#6B7280" />
        <Text style={styles.disclaimerText}>
          Manufacturer warnings are voluntary disclosures. Always read the physical label for the most accurate information.
        </Text>
      </View>
    </View>
  );
});

const WarningItem = React.memo(function WarningItem({ warning }: { warning: ManufacturerWarning }) {
  const color = getWarningColor(warning.severity);
  const bgColor = getWarningBgColor(warning.severity);
  const borderColor = getWarningBorderColor(warning.severity);

  return (
    <View style={[styles.warningItem, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.warningHeader}>
        <AlertTriangle size={14} color={color} />
        <Text style={[styles.warningType, { color }]}>
          {getWarningTypeLabel(warning.type)}
        </Text>
        <View style={[styles.severityBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
          <Text style={[styles.severityText, { color }]}>
            {warning.severity.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.warningMatchedText} numberOfLines={2}>
        &ldquo;{warning.matchedText}&rdquo;
      </Text>
      <Text style={styles.warningExplanation}>{warning.explanation}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  countText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningsList: {
    gap: 10,
  },
  warningItem: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  warningType: {
    fontSize: 13,
    fontWeight: '700' as const,
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  severityText: {
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  warningMatchedText: {
    fontSize: 12,
    color: '#374151',
    fontStyle: 'italic' as const,
    marginBottom: 6,
    lineHeight: 17,
  },
  warningExplanation: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },
  showMoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#0891B2',
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 16,
  },
});
