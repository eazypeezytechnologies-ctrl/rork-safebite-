import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '@/contexts/UserContext';

type AuthMode = 'welcome' | 'signin' | 'signup';

function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Sign in timed out. Please try again.')), ms);
    }),
  ]);
}

export default function WelcomeWebFallback() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, completeOnboarding } = useUser();

  const [mode, setMode] = useState<AuthMode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (mode !== 'welcome') {
      console.log('[WebAuthFallback] mounted');
    }
  }, [mode]);

  const reset = () => {
    setErrorText('');
    setIsLoading(false);
  };

  const submit = async () => {
    if (isLoading) return;

    console.log('[WebAuthFallback] submit start');
    setErrorText('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorText('Please enter your email address.');
      return;
    }

    if (!cleanPassword) {
      setErrorText('Please enter your password.');
      return;
    }

    if (cleanPassword.length < 6) {
      setErrorText('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      await withTimeout(signIn(cleanEmail, cleanPassword, mode === 'signup'));
      await withTimeout(completeOnboarding());
      console.log('[WebAuthFallback] success');
    } catch (error) {
      console.error('[WebAuthFallback] error', error);
      setErrorText(error instanceof Error ? error.message : 'Sign in failed. Please try again.');
      setIsLoading(false);
    }
  };

  if (mode === 'welcome') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.card}>
          <Text style={styles.icon}>🛡️</Text>
          <Text style={styles.title}>Allergy Guardian</Text>
          <Text style={styles.subtitle}>
            Scan products and check for allergens to keep you and your loved ones safe
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => {
              reset();
              setMode('signup');
            }}
          >
            <Text style={styles.primaryText}>Create Account</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              reset();
              setMode('signin');
            }}
          >
            <Text style={styles.secondaryText}>Sign In</Text>
          </Pressable>

          <Text style={styles.footer}>Your privacy matters. All data is stored securely.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.authCard}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            reset();
            setMode('welcome');
          }}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <Text style={styles.authTitle}>{mode === 'signup' ? 'Create Account' : 'Welcome Back'}</Text>
        <Text style={styles.authSubtitle}>
          {mode === 'signup' ? 'Create your SafeBite account.' : 'Enter your email and password.'}
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="email@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!isLoading}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isLoading}
        />

        {errorText ? <Text style={styles.error}>{errorText}</Text> : null}

        <Pressable
          style={[styles.primaryButton, isLoading && styles.disabled]}
          onPress={submit}
          disabled={isLoading}
        >
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#FFFFFF" size="small" />
              <Text style={styles.primaryText}>Please wait...</Text>
            </View>
          ) : (
            <Text style={styles.primaryText}>{mode === 'signup' ? 'Create Account' : 'Sign In'}</Text>
          )}
        </Pressable>

        {mode === 'signin' ? (
          <Pressable style={styles.linkButton} onPress={() => router.push('/forgot-password' as any)}>
            <Text style={styles.linkText}>Forgot Password?</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7FBFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 16,
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#B8E1E6',
    padding: 24,
    gap: 12,
  },
  icon: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 28,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  authTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  authSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  input: {
    width: '100%',
    minHeight: 54,
    borderWidth: 1,
    borderColor: '#9CCFD6',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#111827',
    fontSize: 18,
    paddingHorizontal: 14,
  },
  primaryButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: '#007782',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#007782',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: '#007782',
    fontSize: 18,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.65,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  backText: {
    color: '#007782',
    fontSize: 17,
    fontWeight: '800',
  },
  linkButton: {
    alignSelf: 'center',
    paddingVertical: 12,
  },
  linkText: {
    color: '#007782',
    fontSize: 16,
    fontWeight: '700',
  },
  error: {
    color: '#B91C1C',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  footer: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
});
