import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { AlertCircle, RefreshCw, Home, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    console.error('ErrorBoundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary - Error:', error);
    console.error('ErrorBoundary - Error Info:', errorInfo);
    import('@/utils/autoIssueLogger')
      .then(m => m.logAppCrash(error, errorInfo.componentStack ?? undefined))
      .catch(() => {});
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    try {
      if (Platform.OS === 'web') {
        window.location.reload();
      } else {
        this.setState({ hasError: false, error: null });
      }
    } catch (error) {
      console.error('Failed to reload:', error);
      this.setState({ hasError: false, error: null });
    }
  };

  handleClearCache = () => {
    Alert.alert(
      'Clear App Cache',
      'This will clear all cached data and may fix the issue. Your account and profiles will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            try {
              const keysToPreserve = [
                '@allergy_guardian_onboarding_complete',
                '@allergy_guardian_cached_auth',
              ];
              const allKeys = await AsyncStorage.getAllKeys();
              const keysToRemove = allKeys.filter(
                key => !keysToPreserve.some(preserve => key.includes(preserve))
              );
              await AsyncStorage.multiRemove(keysToRemove);
              
              if (Platform.OS === 'web') {
                window.location.reload();
              } else {
                this.setState({ hasError: false, error: null });
              }
            } catch (error) {
              console.error('Failed to clear cache:', error);
              Alert.alert('Error', 'Failed to clear cache. Please try again.');
            }
          },
        },
      ]
    );
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <AlertCircle size={64} color="#DC2626" />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            The app encountered an unexpected error. Please try again.
          </Text>
          {this.state.error && (
            <View style={styles.errorDetails}>
              <Text style={styles.errorLabel}>Error Details:</Text>
              <Text style={styles.errorText}>{this.state.error.toString()}</Text>
              {this.state.error.stack && (
                <Text style={styles.errorStack} numberOfLines={5}>
                  {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                </Text>
              )}
            </View>
          )}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={this.handleReset}>
              <RefreshCw size={20} color="#FFFFFF" />
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={this.handleReload}>
              <Home size={20} color="#0891B2" />
              <Text style={styles.secondaryButtonText}>Reload App</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerButton} onPress={this.handleClearCache}>
              <Trash2 size={20} color="#DC2626" />
              <Text style={styles.dangerButtonText}>Clear Cache & Restart</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  errorDetails: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
  },
  errorLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#991B1B',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontFamily: 'monospace' as const,
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 10,
    color: '#B91C1C',
    fontFamily: 'monospace' as const,
  },
  buttonContainer: {
    gap: 12,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    backgroundColor: '#0891B2',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
    minWidth: 160,
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
    minWidth: 160,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0891B2',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#0891B2',
  },
  dangerButton: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 8,
    minWidth: 160,
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  dangerButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
});
