import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Search, AlertTriangle, X } from 'lucide-react-native';
import { searchRecalls } from '@/api/recalls';
import { RecallResult } from '@/types';
import { arcaneColors, arcaneShadows, arcaneRadius } from '@/constants/theme';

export default function RecallsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [recalls, setRecalls] = useState<RecallResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const result = await searchRecalls(searchQuery);
      setRecalls(result.results);
    } catch (error) {
      console.error('Recall search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Product Recalls</Text>
          <Text style={styles.subtitle}>Search FDA food & cosmetics recalls</Text>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Brand name or product"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.searchButtonText}>Search Recalls</Text>
            )}
          </TouchableOpacity>
        </View>

        {isSearching && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={arcaneColors.primary} />
            <Text style={styles.loadingText}>Searching FDA database...</Text>
          </View>
        )}

        {!isSearching && hasSearched && recalls.length === 0 && (
          <View style={styles.emptyState}>
            <AlertTriangle size={48} color="#10B981" />
            <Text style={styles.emptyText}>No recalls found</Text>
            <Text style={styles.emptySubtext}>
              No FDA recalls match your search. This is good news!
            </Text>
          </View>
        )}

        {recalls.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.resultsCount}>
              {recalls.length} recall{recalls.length !== 1 ? 's' : ''} found
            </Text>
            {recalls.map((recall, index) => (
              <View key={recall.recall_number || index} style={styles.recallCard}>
                <View style={styles.recallHeader}>
                  <AlertTriangle size={24} color="#DC2626" />
                  <Text style={styles.recallNumber}>{recall.recall_number}</Text>
                </View>

                <Text style={styles.recallProduct} numberOfLines={3}>
                  {recall.product_description}
                </Text>

                <View style={styles.recallDetail}>
                  <Text style={styles.recallLabel}>Reason:</Text>
                  <Text style={styles.recallValue} numberOfLines={4}>
                    {recall.reason_for_recall}
                  </Text>
                </View>

                {recall.recall_initiation_date && (
                  <View style={styles.recallDetail}>
                    <Text style={styles.recallLabel}>Date:</Text>
                    <Text style={styles.recallValue}>
                      {formatDate(recall.recall_initiation_date)}
                    </Text>
                  </View>
                )}

                {recall.status && (
                  <View style={styles.recallDetail}>
                    <Text style={styles.recallLabel}>Status:</Text>
                    <Text style={styles.recallValue}>{recall.status}</Text>
                  </View>
                )}

                {recall.classification && (
                  <View style={[styles.classificationBadge, getClassificationStyle(recall.classification)]}>
                    <Text style={styles.classificationText}>
                      Class {recall.classification}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.infoBox}>
          <AlertTriangle size={16} color="#0891B2" />
          <Text style={styles.infoText}>
            Data from openFDA. Class I = most serious, Class III = least serious.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function getClassificationStyle(classification: string) {
  switch (classification) {
    case 'I':
      return { backgroundColor: '#FEE2E2', borderColor: '#DC2626' };
    case 'II':
      return { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' };
    case 'III':
      return { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' };
    default:
      return { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: arcaneColors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: arcaneColors.text,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  searchSection: {
    marginBottom: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.lg,
    padding: 12,
    gap: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: arcaneColors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  searchButton: {
    backgroundColor: arcaneColors.primary,
    borderRadius: arcaneRadius.lg,
    padding: 16,
    alignItems: 'center',
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  resultsSection: {
    marginBottom: 24,
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 16,
  },
  recallCard: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.xl,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.20)',
    ...arcaneShadows.card,
  },
  recallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  recallNumber: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  recallProduct: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 12,
    lineHeight: 22,
  },
  recallDetail: {
    marginBottom: 8,
  },
  recallLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
    marginBottom: 2,
    textTransform: 'uppercase' as const,
  },
  recallValue: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  classificationBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  classificationText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#111827',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    backgroundColor: arcaneColors.primaryMuted,
    borderRadius: arcaneRadius.lg,
    borderWidth: 1,
    borderColor: arcaneColors.borderRune,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: arcaneColors.primary,
    lineHeight: 18,
  },
});
