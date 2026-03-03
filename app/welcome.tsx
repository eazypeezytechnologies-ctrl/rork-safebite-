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
  ScrollView,
} from 'react-native';
import { useRouter, Href } from 'expo-router';
import { Shield, UserPlus, LogIn, WifiOff, RefreshCw, CheckCircle, AlertCircle, Eye, EyeOff, Wifi } from 'lucide-react-native';
import { useUser } from '@/contexts/UserContext';
import { categorizeAuthError } from '@/utils/authTimeout';
import { isSupabaseConfigured, getSupabaseUrl, getSupabaseAnonKey } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BUILD_ID, APP_VERSION } from '@/constants/appVersion';
import { arcaneColors, arcaneShadows, arcaneRadius } from '@/constants/theme';
import { RuneCard } from '@/components/RuneCard';
import { SigilBadge } from '@/components/SigilBadge';
import { ArcaneDivider } from '@/components/ArcaneDivider';
import { AnimatedButton } from '@/components/AnimatedButton';

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
  const [connTestResult, setConnTestResult] = useState<string | null>(null);
  const [connTesting, setConnTesting] = useState(false);

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
    Keyboard.dismiss();
    
    if (isLoading) {
      console.log('Welcome: Already processing, ignoring tap');
      return;
    }
    
    if (!isSupabaseConfigured()) {
      console.error('Welcome: Supabase not configured');
      Alert.alert(
        'Configuration Error',
        'The app is not properly configured. Please contact support or check that Supabase environment variables are set.',
        [{ text: 'OK' }]
      );
      return;
    }
    
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

    setAuthPhase('authenticating');
    try {
      console.log(`Welcome: ${mode === 'signup' ? 'Creating account' : 'Signing in'}`);
      await signIn(email.trim().toLowerCase(), password.trim(), mode === 'signup');
      
      setAuthPhase('success');
      console.log('Welcome: Sign in successful');
      await completeOnboarding();
      
      console.log('Welcome: Onboarding complete, navigation will be handled by _layout.tsx');
      
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
      return;
    } catch (error) {
      console.error('Authentication error:', error);
      setIsLoading(false);
      setAuthPhase('error');
      
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed. Please try again.';
      const errLower = errorMessage.toLowerCase();

      let errorType: string;
      if (errLower.includes('key missing') || errLower.includes('key invalid') || errLower.includes('api key')) {
        errorType = 'config';
      } else if (errLower.includes('timeout') || errLower.includes('timed out')) {
        errorType = 'timeout';
      } else if (
        errLower.includes('load failed') ||
        errLower.includes('failed to fetch') ||
        errLower.includes('fetch failed') ||
        errLower.includes('network request failed') ||
        errLower.includes('networkerror')
      ) {
        errorType = 'network';
      } else if (
        errLower.includes('unable to reach') ||
        errLower.includes('connection')
      ) {
        errorType = 'connection';
      } else {
        errorType = categorizeAuthError(error);
      }
      
      const resetPhase = () => setAuthPhase('idle');
      
      if (errorType === 'config') {
        Alert.alert(
          'Configuration Error',
          'Supabase API key is missing or invalid. Please check your environment configuration.',
          [{ text: 'OK', onPress: resetPhase }]
        );
      } else if (errorType === 'timeout') {
        Alert.alert(
          'Network Timeout',
          'The request timed out. Please check your internet connection and try again.',
          [
            { text: 'Retry', onPress: () => { resetPhase(); setTimeout(() => handleSignIn(), 100); }},
            { text: 'Cancel', style: 'cancel', onPress: resetPhase }
          ]
        );
      } else if (errorType === 'network') {
        Alert.alert(
          'Network Unreachable',
          'Cannot reach the server. Please check your internet connection (Wi-Fi/cellular) and try again.',
          [
            { text: 'Retry', onPress: () => { resetPhase(); setTimeout(() => handleSignIn(), 100); }},
            { text: 'Cancel', style: 'cancel', onPress: resetPhase }
          ]
        );
      } else if (errorType === 'connection') {
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

  const testConnection = async () => {
    setConnTesting(true);
    setConnTestResult(null);
    try {
      const url = getSupabaseUrl();
      const anonKey = getSupabaseAnonKey();
      if (!url) {
        setConnTestResult('No Supabase URL configured');
        setConnTesting(false);
        return;
      }
      if (!anonKey) {
        setConnTestResult('No Supabase Anon Key configured');
        setConnTesting(false);
        return;
      }
      const start = Date.now();
      const res = await fetch(`${url}/auth/v1/health`, {
        method: 'GET',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`,
        },
      });
      const elapsed = Date.now() - start;
      if (res.ok) {
        setConnTestResult(`Connected (${elapsed}ms)`);
      } else {
        const body = await res.text().catch(() => '');
        setConnTestResult(`HTTP ${res.status} (${elapsed}ms) — ${body.substring(0, 60)}`);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('Load failed') || msg.includes('Failed to fetch')) {
        setConnTestResult('Network unreachable — check Wi-Fi/cellular');
      } else if (msg.includes('timeout') || msg.includes('aborted')) {
        setConnTestResult('Request timed out');
      } else {
        setConnTestResult(msg);
      }
    } finally {
      setConnTesting(false);
    }
  };

  const maskedHost = getSupabaseUrl()
    ? getSupabaseUrl()!.replace(/https?:\/\//, '').substring(0, 20) + '···'
    : null;

  const hasAnonKey = !!getSupabaseAnonKey();

  if (mode === 'welcome') {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView
          contentContainerStyle={styles.welcomeScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroSection}>
            <RuneCard variant="default" style={styles.heroCard}>
              <View style={styles.heroInner}>
                <View style={styles.shieldContainer}>
                  <Shield size={64} color={arcaneColors.primary} strokeWidth={1.8} />
                </View>
                <Text style={styles.title}>Allergy Guardian</Text>
                <Text style={styles.subtitle}>
                  Scan products and check for allergens to keep you and your loved ones safe
                </Text>
              </View>
            </RuneCard>
          </View>

          <View style={styles.buttonContainer}>
            <AnimatedButton
              label="Create Account"
              variant="primary"
              icon={<UserPlus size={20} color="#FFFFFF" />}
              onPress={() => setMode('signup')}
              testID="create-account-button"
              style={styles.ctaButton}
              textStyle={styles.ctaButtonText}
            />

            <Pressable
              style={({ pressed }) => [
                styles.outlinedButton,
                pressed && styles.outlinedButtonPressed,
              ]}
              onPress={() => setMode('signin')}
              testID="sign-in-button"
            >
              <LogIn size={20} color={arcaneColors.primary} />
              <Text style={styles.outlinedButtonText}>Sign In</Text>
            </Pressable>
          </View>

          <ArcaneDivider label="System" variant="default" style={styles.diagDivider} />

          <View style={styles.diagSection}>
            <RuneCard variant="accent" style={styles.diagCard}>
              <Text style={styles.diagTitle}>Supabase Diagnostics</Text>

              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Host</Text>
                <Text style={styles.diagValue} numberOfLines={1}>
                  {maskedHost ?? 'Not configured'}
                </Text>
              </View>

              <ArcaneDivider variant="accent" style={styles.diagInnerDivider} />

              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Anon Key</Text>
                <SigilBadge
                  label={hasAnonKey ? 'Loaded' : 'Missing'}
                  status={hasAnonKey ? 'safe' : 'danger'}
                  size="sm"
                />
              </View>

              <TouchableOpacity
                style={styles.testConnectionButton}
                onPress={testConnection}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Wifi size={13} color={arcaneColors.accent} />
                <Text style={styles.testConnectionText}>
                  {connTesting ? 'Testing...' : 'Test Connection'}
                </Text>
              </TouchableOpacity>

              {connTestResult ? (
                <Text style={styles.connResultText}>{connTestResult}</Text>
              ) : null}
            </RuneCard>
          </View>
        </ScrollView>

        <View style={styles.footerContainer}>
          <Text style={styles.footer}>
            Your privacy matters. All data is stored securely.
          </Text>
          <Text style={styles.buildId}>v{APP_VERSION} · {BUILD_ID}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.authScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setMode('welcome')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.authHero}>
          <View style={styles.shieldContainerSmall}>
            <Shield size={48} color={arcaneColors.primary} strokeWidth={1.8} />
          </View>

          <Text style={styles.authTitle}>
            {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={styles.authSubtitle}>
            {mode === 'signup'
              ? 'Your account will be created automatically'
              : 'Enter your credentials to continue'}
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={arcaneColors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor={arcaneColors.textMuted}
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
                <EyeOff size={20} color={arcaneColors.textMuted} />
              ) : (
                <Eye size={20} color={arcaneColors.textMuted} />
              )}
            </TouchableOpacity>
          </View>

          {mode === 'signin' && (
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={() => router.push('/forgot-password' as Href)}
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
            <View style={styles.statusBanner}>
              <RefreshCw size={16} color={arcaneColors.primary} />
              <Text style={[styles.statusBannerText, { color: arcaneColors.primaryDark }]}>
                Verifying connection...
              </Text>
            </View>
          )}

          {isLoading && connectionStatus === 'slow' && authPhase === 'authenticating' && (
            <View style={[styles.statusBanner, { backgroundColor: arcaneColors.cautionMuted }]}>
              <RefreshCw size={16} color={arcaneColors.caution} />
              <Text style={[styles.statusBannerText, { color: arcaneColors.caution }]}>
                Taking longer than expected...
              </Text>
            </View>
          )}

          {(authPhase === 'error' || connectionStatus === 'error') && (
            <View style={[styles.statusBanner, { backgroundColor: arcaneColors.dangerMuted }]}>
              <WifiOff size={16} color={arcaneColors.danger} />
              <Text style={[styles.statusBannerText, { color: arcaneColors.danger }]}>
                Connection issue detected
              </Text>
            </View>
          )}

          {authPhase === 'success' && (
            <View style={[styles.statusBanner, { backgroundColor: arcaneColors.safeMuted }]}>
              <CheckCircle size={16} color={arcaneColors.safe} />
              <Text style={[styles.statusBannerText, { color: arcaneColors.safe }]}>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: arcaneColors.bg,
  },
  welcomeScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroCard: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 0,
  },
  heroInner: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  shieldContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: arcaneColors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: arcaneColors.text,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: arcaneColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    gap: 14,
    marginBottom: 8,
  },
  ctaButton: {
    paddingVertical: 16,
    borderRadius: arcaneRadius.lg,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  outlinedButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 15,
    borderRadius: arcaneRadius.lg,
    borderWidth: 1.5,
    borderColor: arcaneColors.primary,
    backgroundColor: arcaneColors.bgCard,
    gap: 10,
  },
  outlinedButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  outlinedButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: arcaneColors.primary,
  },
  diagDivider: {
    marginTop: 24,
    marginBottom: 12,
  },
  diagSection: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  diagCard: {
    marginBottom: 0,
  },
  diagTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: arcaneColors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },
  diagRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  diagLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: arcaneColors.textSecondary,
  },
  diagValue: {
    fontSize: 12,
    color: arcaneColors.textMuted,
    flex: 1,
    textAlign: 'right' as const,
    marginLeft: 12,
  },
  diagInnerDivider: {
    marginVertical: 10,
  },
  testConnectionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
  },
  testConnectionText: {
    fontSize: 13,
    color: arcaneColors.accent,
    fontWeight: '600' as const,
  },
  connResultText: {
    fontSize: 11,
    color: arcaneColors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 4,
  },
  footerContainer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
    alignItems: 'center',
  },
  footer: {
    fontSize: 12,
    color: arcaneColors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  buildId: {
    fontSize: 10,
    color: arcaneColors.textMuted,
    textAlign: 'center' as const,
    opacity: 0.6,
  },

  authScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 20,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  backButtonText: {
    fontSize: 16,
    color: arcaneColors.primary,
    fontWeight: '600' as const,
  },
  authHero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  shieldContainerSmall: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: arcaneColors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  authTitle: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: arcaneColors.text,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  authSubtitle: {
    fontSize: 15,
    color: arcaneColors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  inputWrapper: {
    marginBottom: 14,
  },
  input: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.md,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    color: arcaneColors.text,
  },
  passwordContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.md,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    marginBottom: 14,
  },
  passwordInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: arcaneColors.text,
  },
  passwordToggle: {
    padding: 16,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -6,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: arcaneColors.accent,
    fontWeight: '600' as const,
  },
  submitButton: {
    backgroundColor: arcaneColors.primary,
    borderRadius: arcaneRadius.lg,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...arcaneShadows.card,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  infoText: {
    fontSize: 12,
    color: arcaneColors.textMuted,
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
  statusBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: arcaneColors.primaryMuted,
    borderRadius: arcaneRadius.md,
  },
  statusBannerText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
});
