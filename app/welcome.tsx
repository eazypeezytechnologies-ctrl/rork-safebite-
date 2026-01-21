import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, UserPlus, LogIn, WifiOff, RefreshCw, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react-native';
import { useUser } from '@/contexts/UserContext';
import { categorizeAuthError } from '@/utils/authTimeout';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUILD_ID } from '@/constants/appVersion';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, completeOnboarding, connectionStatus, retryCount } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'welcome' | 'signin' | 'signup'>('welcome');
  const [statusMessage, setStatusMessage] = useState('');
  const [authPhase, setAuthPhase] = useState<'idle' | 'validating' | 'checking' | 'authenticating' | 'success' | 'error'>('idle');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (authPhase === 'validating') {
      setStatusMessage('Validating...');
    } else if (authPhase === 'checking') {
      setStatusMessage('Checking connection...');
    } else if (authPhase === 'authenticating') {
      if (connectionStatus === 'slow') {
        setStatusMessage(retryCount > 0 ? `Retrying... (attempt ${retryCount + 1})` : 'Still connecting...');
      } else {
        setStatusMessage('Signing in...');
      }
    } else if (authPhase === 'success') {
      setStatusMessage('Success!');
    } else if (authPhase === 'error' || connectionStatus === 'error') {
      setStatusMessage('Failed');
    } else {
      setStatusMessage('');
    }
  }, [connectionStatus, retryCount, authPhase]);

  const handleSignIn = async () => {
    console.log('Welcome: handleSignIn called, isLoading:', isLoading);
    
    // Dismiss keyboard to prevent touch issues
    Keyboard.dismiss();
    
    if (isLoading) {
      console.log('Welcome: Already processing, ignoring tap');
      return;
    }
    
    // Check if Supabase is configured
    if (!isSupabaseConfigured()) {
      console.error('Welcome: Supabase not configured');
      Alert.alert(
        'Configuration Error',
        'The app is not properly configured. Please contact support or check that Supabase environment variables are set.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Phase 1: Immediate validation
    setAuthPhase('validating');
    setIsLoading(true);
    console.log('Welcome: Starting sign-in process');
    
    if (!email.trim()) {
      setIsLoading(false);
      setAuthPhase('idle');
      Alert.alert('Missing Email', 'Please enter your email address to continue.');
      return;
    }

    if (!password.trim()) {
      setIsLoading(false);
      setAuthPhase('idle');
      Alert.alert('Missing Password', 'Please enter your password to continue.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setIsLoading(false);
      setAuthPhase('idle');
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (password.trim().length < 6) {
      setIsLoading(false);
      setAuthPhase('idle');
      Alert.alert('Password Too Short', 'Password must be at least 6 characters.');
      return;
    }

    // Skip connectivity pre-checks - go directly to authentication
    // The auth call itself will fail fast if there's no connection
    setAuthPhase('authenticating');
    try {
      console.log(`Welcome: ${mode === 'signup' ? 'Creating account' : 'Signing in'}`);
      await signIn(email.trim().toLowerCase(), password.trim(), mode === 'signup');
      
      setAuthPhase('success');
      console.log('Welcome: Sign in successful');
      await completeOnboarding();
      
      console.log('Welcome: Onboarding complete, navigation will be handled by _layout.tsx');
      
      // Brief delay to show success state, then let _layout.tsx handle navigation
      setTimeout(() => {
        setIsLoading(false);
        // Keep authPhase as 'success' - _layout.tsx will navigate us away
      }, 500);
      return;
    } catch (error) {
      console.error('Authentication error:', error);
      setIsLoading(false);
      setAuthPhase('error');
      
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed. Please try again.';
      const errorType = categorizeAuthError(error);
      
      // Reset phase after showing alert
      const resetPhase = () => setAuthPhase('idle');
      
      if (errorType === 'connection') {
        Alert.alert(
          'Connection Issue',
          'Unable to connect. This could be due to:\n\n• Slow or unstable internet\n• Server temporarily busy\n\nPlease try again.',
          [
            { text: 'Try Again', onPress: () => {
              resetPhase();
              setTimeout(() => handleSignIn(), 100);
            }},
            { text: 'Cancel', style: 'cancel', onPress: resetPhase }
          ]
        );
      } else if (errorMessage.includes('No account found')) {
        Alert.alert(
          'Account Not Found',
          'No account exists with this email. Would you like to create a new account?',
          [
            { text: 'Cancel', style: 'cancel', onPress: resetPhase },
            { 
              text: 'Create Account', 
              onPress: () => {
                resetPhase();
                setMode('signup');
              }
            }
          ]
        );
      } else if (errorMessage.includes('already exists')) {
        Alert.alert(
          'Account Exists',
          'An account with this email already exists. Please sign in instead.',
          [
            { text: 'Cancel', style: 'cancel', onPress: resetPhase },
            { 
              text: 'Sign In', 
              onPress: () => {
                resetPhase();
                setMode('signin');
              }
            }
          ]
        );
      } else if (errorMessage.includes('Invalid email or password') || errorMessage.includes('Incorrect password')) {
        Alert.alert(
          'Invalid Credentials',
          'The email or password you entered is incorrect. Please try again.',
          [{ text: 'OK', onPress: resetPhase }]
        );
      } else {
        Alert.alert('Error', errorMessage, [{ text: 'OK', onPress: resetPhase }]);
      }
    }
  };



  if (mode === 'welcome') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Shield size={80} color="#0891B2" strokeWidth={2} />
          </View>
          
          <Text style={styles.title}>Allergy Guardian</Text>
          <Text style={styles.subtitle}>
            Scan products and check for allergens to keep you and your loved ones safe
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setMode('signup')}
            >
              <UserPlus size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Create Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setMode('signin')}
            >
              <LogIn size={20} color="#0891B2" />
              <Text style={styles.secondaryButtonText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footer}>
          Your privacy matters. All data is stored securely on your device.
        </Text>
        <Text style={styles.buildId}>Build: {BUILD_ID}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setMode('welcome')}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.iconContainer}>
          <Shield size={60} color="#0891B2" strokeWidth={2} />
        </View>

        <Text style={styles.title}>
          {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
        </Text>
        <Text style={styles.subtitle}>
          {mode === 'signup'
            ? 'Your account will be created automatically'
            : 'Enter your credentials to continue'}
        </Text>

        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {showPassword ? (
                <EyeOff size={20} color="#6B7280" />
              ) : (
                <Eye size={20} color="#6B7280" />
              )}
            </TouchableOpacity>
          </View>

          {mode === 'signin' && (
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => router.push('/forgot-password')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              isLoading && styles.submitButtonDisabled,
              pressed && !isLoading && styles.submitButtonPressed,
            ]}
            onPress={() => {
              console.log('Welcome: Submit button pressed at', new Date().toISOString());
              handleSignIn();
            }}
            disabled={isLoading}
            testID="submit-button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                {authPhase === 'success' ? (
                  <CheckCircle size={20} color="#FFFFFF" />
                ) : authPhase === 'error' ? (
                  <AlertCircle size={20} color="#FFFFFF" />
                ) : (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                )}
                {statusMessage ? (
                  <Text style={styles.loadingText}>{statusMessage}</Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'signup' ? 'Create Account' : 'Sign In'}
              </Text>
            )}
          </Pressable>

          {isLoading && authPhase === 'checking' && (
            <View style={styles.connectionStatusInfo}>
              <RefreshCw size={16} color="#3B82F6" />
              <Text style={styles.connectionStatusInfoText}>
                Verifying connection...
              </Text>
            </View>
          )}

          {isLoading && connectionStatus === 'slow' && authPhase === 'authenticating' && (
            <View style={styles.connectionStatus}>
              <RefreshCw size={16} color="#F59E0B" />
              <Text style={styles.connectionStatusText}>
                Taking longer than expected...
              </Text>
            </View>
          )}

          {(authPhase === 'error' || connectionStatus === 'error') && (
            <View style={styles.connectionStatusError}>
              <WifiOff size={16} color="#EF4444" />
              <Text style={styles.connectionStatusErrorText}>
                Connection issue detected
              </Text>
            </View>
          )}

          {authPhase === 'success' && (
            <View style={styles.connectionStatusSuccess}>
              <CheckCircle size={16} color="#10B981" />
              <Text style={styles.connectionStatusSuccessText}>
                Signed in successfully!
              </Text>
            </View>
          )}

          <Text style={styles.infoText}>
            {mode === 'signup'
              ? "New here? No problem! We'll create your account when you continue."
              : "Returning user? Sign in with your email and password."}
          </Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 48,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#0891B2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#0891B2',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#0891B2',
  },

  footer: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    padding: 24,
    marginTop: 'auto' as const,
  },
  buildId: {
    fontSize: 10,
    color: '#D1D5DB',
    textAlign: 'center' as const,
    paddingBottom: 8,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  backButtonText: {
    fontSize: 16,
    color: '#0891B2',
    fontWeight: '600' as const,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  passwordContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
  },
  passwordToggle: {
    padding: 16,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#0891B2',
    fontWeight: '600' as const,
  },
  submitButton: {
    backgroundColor: '#0891B2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  infoText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500' as const,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
  },
  connectionStatusText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500' as const,
  },
  connectionStatusError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  connectionStatusErrorText: {
    fontSize: 13,
    color: '#991B1B',
    fontWeight: '500' as const,
  },
  connectionStatusInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#DBEAFE',
    borderRadius: 8,
  },
  connectionStatusInfoText: {
    fontSize: 13,
    color: '#1E40AF',
    fontWeight: '500' as const,
  },
  connectionStatusSuccess: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
  },
  connectionStatusSuccessText: {
    fontSize: 13,
    color: '#065F46',
    fontWeight: '500' as const,
  },
});
