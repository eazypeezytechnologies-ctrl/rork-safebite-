import { useState, useEffect, useCallback, useRef } from 'react';
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
  Modal,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, Href } from 'expo-router';
import { Shield, UserPlus, LogIn, WifiOff, RefreshCw, CheckCircle, AlertCircle, Eye, EyeOff, Activity, Copy, RotateCcw, Server, Key, Lock } from 'lucide-react-native';
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
import { runSupabaseOperationalCheck, formatDiagnosticsForCopy } from '@/utils/supabaseHealth';

type OperationalResult = Awaited<ReturnType<typeof runSupabaseOperationalCheck>>;

const ADMIN_EMAILS = [
  'eazypeezytechnologies@gmail.com',
];

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

  const [opResult, setOpResult] = useState<OperationalResult | null>(null);
  const [opTesting, setOpTesting] = useState(false);
  const [copiedDiag, setCopiedDiag] = useState(false);

  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHiddenTap = useCallback(() => {
    tapCountRef.current += 1;
    console.log('[Welcome] Hidden tap count:', tapCountRef.current);

    if (tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
    }

    if (tapCountRef.current >= 7) {
      tapCountRef.current = 0;
      setShowAdminModal(true);
      return;
    }

    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
    }, 2000);
  }, []);

  const handleAdminUnlock = useCallback(() => {
    const trimmed = adminEmail.trim().toLowerCase();
    if (ADMIN_EMAILS.includes(trimmed)) {
      console.log('[Welcome] Admin diagnostics unlocked for:', trimmed);
      setAdminUnlocked(true);
      setShowAdminModal(false);
      setAdminEmail('');
    } else {
      Alert.alert('Not Authorized', 'This email is not recognized as an admin account.');
    }
  }, [adminEmail]);

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

  const runOperationalCheck = useCallback(async () => {
    setOpTesting(true);
    setOpResult(null);
    setCopiedDiag(false);
    console.log('[Welcome] Starting operational check...');
    try {
      const result = await runSupabaseOperationalCheck();
      setOpResult(result);
      console.log('[Welcome] Operational check result:', result.summary);
    } catch (err: any) {
      console.error('[Welcome] Operational check failed:', err);
      setOpResult({
        ok: false,
        checks: {
          authHealth: { ok: false, message: err?.message || 'Unknown error' },
          restHealth: { ok: false, message: 'Not checked' },
          keyValid: { ok: false, message: 'Not checked' },
        },
        summary: err?.message || 'Operational check failed',
        timestamp: new Date().toISOString(),
        buildInfo: { url: null, keyPresent: false },
      });
    } finally {
      setOpTesting(false);
    }
  }, []);

  const copyDiagnostics = useCallback(async () => {
    if (!opResult) return;
    try {
      const text = formatDiagnosticsForCopy(opResult);
      await Clipboard.setStringAsync(text);
      setCopiedDiag(true);
      setTimeout(() => setCopiedDiag(false), 3000);
      console.log('[Welcome] Diagnostics copied to clipboard');
    } catch (err) {
      console.error('[Welcome] Failed to copy diagnostics:', err);
      Alert.alert('Copy Failed', 'Could not copy diagnostics to clipboard.');
    }
  }, [opResult]);

  const rawHost = getSupabaseUrl()?.replace(/https?:\/\//, '') ?? null;
  const maskedHost = rawHost
    ? rawHost.length > 12
      ? rawHost.substring(0, 6) + '······' + rawHost.substring(rawHost.length - 6)
      : rawHost.substring(0, 6) + '···'
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
                <Pressable onPress={handleHiddenTap} style={styles.shieldContainer}>
                  <Shield size={64} color={arcaneColors.primary} strokeWidth={1.8} />
                </Pressable>
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

          {adminUnlocked && (
          <>
          <ArcaneDivider label="System" variant="default" style={styles.diagDivider} />

          <View style={styles.diagSection}>
            <RuneCard variant="accent" style={styles.diagCard}>
              <Text style={styles.diagTitle}>OPERATIONAL STATUS</Text>

              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Build</Text>
                <Text style={styles.diagValue} numberOfLines={1}>
                  v{APP_VERSION} · {BUILD_ID}
                </Text>
              </View>

              <ArcaneDivider variant="accent" style={styles.diagInnerDivider} />

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

              <ArcaneDivider variant="accent" style={styles.diagInnerDivider} />

              <View style={styles.diagRow}>
                <Text style={styles.diagLabel}>Overall</Text>
                {opResult ? (
                  <SigilBadge
                    label={opResult.ok ? 'PASS' : 'FAIL'}
                    status={opResult.ok ? 'safe' : 'danger'}
                    size="sm"
                  />
                ) : (
                  <Text style={styles.diagValueMuted}>Not tested</Text>
                )}
              </View>

              {opResult && (
                <>
                  <ArcaneDivider variant="accent" style={styles.diagInnerDivider} />

                  <View style={styles.checkRow}>
                    <Server size={12} color={opResult.checks.authHealth.ok ? arcaneColors.safe : arcaneColors.danger} />
                    <Text style={styles.checkLabel}>Auth Health</Text>
                    <SigilBadge
                      label={opResult.checks.authHealth.ok ? 'OK' : `${opResult.checks.authHealth.status ?? 'ERR'}`}
                      status={opResult.checks.authHealth.ok ? 'safe' : 'danger'}
                      size="sm"
                    />
                    {opResult.checks.authHealth.ms != null && (
                      <Text style={styles.msText}>{opResult.checks.authHealth.ms}ms</Text>
                    )}
                  </View>

                  <View style={styles.checkRow}>
                    <Activity size={12} color={opResult.checks.restHealth.ok ? arcaneColors.safe : arcaneColors.danger} />
                    <Text style={styles.checkLabel}>REST Health</Text>
                    <SigilBadge
                      label={opResult.checks.restHealth.ok ? 'OK' : `${opResult.checks.restHealth.status ?? 'ERR'}`}
                      status={opResult.checks.restHealth.ok ? 'safe' : 'danger'}
                      size="sm"
                    />
                    {opResult.checks.restHealth.ms != null && (
                      <Text style={styles.msText}>{opResult.checks.restHealth.ms}ms</Text>
                    )}
                  </View>

                  <View style={styles.checkRow}>
                    <Key size={12} color={opResult.checks.keyValid.ok ? arcaneColors.safe : arcaneColors.danger} />
                    <Text style={styles.checkLabel}>Key Valid</Text>
                    <SigilBadge
                      label={opResult.checks.keyValid.ok ? 'Valid' : 'Invalid'}
                      status={opResult.checks.keyValid.ok ? 'safe' : 'danger'}
                      size="sm"
                    />
                  </View>

                  <Text style={styles.summaryText}>{opResult.summary}</Text>

                  {!opResult.ok && (
                    <View style={styles.hintBox}>
                      <AlertCircle size={13} color={arcaneColors.caution} />
                      <Text style={styles.hintText}>
                        If you see 401: confirm SUPABASE_URL uses https:// and anon key matches this project.
                      </Text>
                    </View>
                  )}
                </>
              )}

              <View style={styles.opButtonRow}>
                <TouchableOpacity
                  style={styles.opButton}
                  onPress={runOperationalCheck}
                  disabled={opTesting}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <RotateCcw size={13} color={opTesting ? arcaneColors.textMuted : arcaneColors.accent} />
                  <Text style={[styles.opButtonText, opTesting && styles.opButtonTextDisabled]}>
                    {opTesting ? 'Checking...' : opResult ? 'Retry' : 'Run Check'}
                  </Text>
                </TouchableOpacity>

                {opResult && (
                  <TouchableOpacity
                    style={styles.opButton}
                    onPress={copyDiagnostics}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {copiedDiag ? (
                      <CheckCircle size={13} color={arcaneColors.safe} />
                    ) : (
                      <Copy size={13} color={arcaneColors.accent} />
                    )}
                    <Text style={styles.opButtonText}>
                      {copiedDiag ? 'Copied!' : 'Copy Diagnostics'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </RuneCard>
          </View>
          </>
          )}
        </ScrollView>

        <Modal
          visible={showAdminModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAdminModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Lock size={24} color={arcaneColors.accent} />
                <Text style={styles.modalTitle}>Admin Diagnostics</Text>
              </View>
              <Text style={styles.modalSubtitle}>
                Enter your admin email to unlock diagnostics on this screen.
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Admin email address"
                placeholderTextColor={arcaneColors.textMuted}
                value={adminEmail}
                onChangeText={setAdminEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setShowAdminModal(false);
                    setAdminEmail('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.modalUnlockBtn}
                  onPress={handleAdminUnlock}
                >
                  <Text style={styles.modalUnlockText}>Unlock</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

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
  diagValueMuted: {
    fontSize: 12,
    color: arcaneColors.textMuted,
  },
  checkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 5,
  },
  checkLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: arcaneColors.textSecondary,
    flex: 1,
  },
  msText: {
    fontSize: 10,
    color: arcaneColors.textMuted,
    marginLeft: 4,
    minWidth: 36,
    textAlign: 'right' as const,
  },
  summaryText: {
    fontSize: 11,
    color: arcaneColors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 10,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  hintBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 6,
    marginTop: 8,
    padding: 10,
    backgroundColor: arcaneColors.cautionMuted,
    borderRadius: arcaneRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(217, 119, 6, 0.2)',
  },
  hintText: {
    fontSize: 11,
    color: arcaneColors.caution,
    flex: 1,
    lineHeight: 16,
  },
  opButtonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 16,
    marginTop: 12,
    paddingTop: 4,
  },
  opButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  opButtonText: {
    fontSize: 12,
    color: arcaneColors.accent,
    fontWeight: '600' as const,
  },
  opButtonTextDisabled: {
    color: arcaneColors.textMuted,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: arcaneColors.bgCard,
    borderRadius: arcaneRadius.xl,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: arcaneColors.borderAccent,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: arcaneColors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: arcaneColors.textSecondary,
    lineHeight: 19,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: arcaneColors.bgElevated,
    borderRadius: arcaneRadius.md,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    color: arcaneColors.text,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 12,
    borderRadius: arcaneRadius.md,
    borderWidth: 1,
    borderColor: arcaneColors.border,
    backgroundColor: arcaneColors.bgElevated,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: arcaneColors.textSecondary,
  },
  modalUnlockBtn: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 12,
    borderRadius: arcaneRadius.md,
    backgroundColor: arcaneColors.accent,
  },
  modalUnlockText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
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
