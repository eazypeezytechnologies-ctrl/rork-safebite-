import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';

interface FamilyErrorBoundaryProps {
  children: React.ReactNode;
}

interface FamilyErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class FamilyErrorBoundary extends React.Component<FamilyErrorBoundaryProps, FamilyErrorBoundaryState> {
  constructor(props: FamilyErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): FamilyErrorBoundaryState {
    const msg = error?.message || '';
    const isFamilyError =
      msg.includes('Family') ||
      msg.includes('family') ||
      msg.includes('permission denied') ||
      msg.includes('42501') ||
      msg.includes('42P17') ||
      msg.includes('infinite recursion') ||
      msg.includes('useFamily');

    if (isFamilyError) {
      console.warn('[FamilyErrorBoundary] Caught family-related error:', msg);
      return { hasError: true, errorMessage: msg };
    }

    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[FamilyErrorBoundary] Error:', error.message);
    console.error('[FamilyErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconRow}>
              <AlertTriangle size={24} color="#F59E0B" />
              <Text style={styles.title}>Family Features Unavailable</Text>
            </View>
            <Text style={styles.message}>
              Family group features are temporarily unavailable. This does not affect scanning, profiles, or other app features.
            </Text>
            {this.state.errorMessage ? (
              <Text style={styles.detail} numberOfLines={2}>
                {this.state.errorMessage}
              </Text>
            ) : null}
            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.handleRetry}
              testID="family-error-retry"
            >
              <RefreshCw size={16} color="#FFFFFF" />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#92400E',
  },
  message: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
    marginBottom: 8,
  },
  detail: {
    fontSize: 12,
    color: '#A16207',
    fontFamily: 'monospace' as const,
    marginBottom: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
