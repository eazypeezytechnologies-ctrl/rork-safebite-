import { useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { useRouter } from 'expo-router';
import { useUser } from '@/contexts/UserContext';

type AuthMode = 'welcome' | 'signin' | 'signup';

function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error('Sign in timed out. Please try again.'));
      }, ms);
    }),
  ]);
}

export default function WelcomeWebFallback() {
  const router = useRouter();
  const { signIn, completeOnboarding } = useUser();

  const [mode, setMode] = useState<AuthMode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    console.log('[WebAuthFallback] mounted');
  }, [mode]);

  const reset = () => {
    setErrorText('');
    setIsLoading(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
      <main style={s.screen}>
        <section style={s.card}>
          <div style={s.badge}>WEB FALLBACK ACTIVE</div>
          <div style={s.icon}>🛡️</div>

          <h1 style={s.title}>Allergy Guardian</h1>

          <p style={s.subtitle}>
            Scan products and check for allergens to keep you and your loved ones safe
          </p>

          <button
            type="button"
            style={s.primaryButton}
            onClick={() => {
              reset();
              setMode('signup');
            }}
          >
            Create Account
          </button>

          <button
            type="button"
            style={s.secondaryButton}
            onClick={() => {
              reset();
              setMode('signin');
            }}
          >
            Sign In
          </button>

          <p style={s.footer}>Your privacy matters. All data is stored securely.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={s.screen}>
      <form style={s.authCard} onSubmit={submit}>
        <div style={s.badge}>WEB FALLBACK ACTIVE</div>

        <button
          type="button"
          style={s.backButton}
          onClick={() => {
            reset();
            setMode('welcome');
          }}
        >
          ← Back
        </button>

        <h1 style={s.authTitle}>{mode === 'signup' ? 'Create Account' : 'Welcome Back'}</h1>

        <p style={s.authSubtitle}>
          {mode === 'signup' ? 'Create your SafeBite account.' : 'Enter your email and password.'}
        </p>

        <label style={s.label} htmlFor="safebite-email">
          Email
        </label>
        <input
          id="safebite-email"
          style={s.input}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.currentTarget.value)}
          placeholder="email@example.com"
          autoCapitalize="none"
          autoCorrect="off"
          disabled={isLoading}
        />

        <label style={s.label} htmlFor="safebite-password">
          Password
        </label>
        <input
          id="safebite-password"
          style={s.input}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          placeholder="Password"
          autoCapitalize="none"
          autoCorrect="off"
          disabled={isLoading}
        />

        {errorText ? <p style={s.error}>{errorText}</p> : null}

        <button
          type="submit"
          style={{
            ...s.primaryButton,
            ...(isLoading ? s.disabled : {}),
          }}
          disabled={isLoading}
        >
          {isLoading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
        </button>

        {mode === 'signin' ? (
          <button
            type="button"
            style={s.linkButton}
            onClick={() => router.push('/forgot-password' as any)}
          >
            Forgot Password?
          </button>
        ) : null}
      </form>
    </main>
  );
}

const s: Record<string, CSSProperties> = {
  screen: {
    minHeight: '100vh',
    width: '100%',
    backgroundColor: '#F7FBFC',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    boxSizing: 'border-box',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  authCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    border: '1px solid #B8E1E6',
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    boxSizing: 'border-box',
  },
  badge: {
    alignSelf: 'center',
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.5,
  },
  icon: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: 800,
    color: '#111827',
    textAlign: 'center',
    margin: 0,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: '28px',
    color: '#4B5563',
    textAlign: 'center',
    margin: '0 0 20px',
  },
  authTitle: {
    fontSize: 30,
    fontWeight: 800,
    color: '#111827',
    textAlign: 'center',
    margin: 0,
  },
  authSubtitle: {
    fontSize: 16,
    lineHeight: '24px',
    color: '#4B5563',
    textAlign: 'center',
    margin: '0 0 12px',
  },
  label: {
    fontSize: 15,
    fontWeight: 700,
    color: '#111827',
    marginTop: 4,
  },
  input: {
    width: '100%',
    minHeight: 54,
    border: '1px solid #9CCFD6',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    color: '#111827',
    fontSize: 18,
    padding: '0 14px',
    boxSizing: 'border-box',
  },
  primaryButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 14,
    border: 'none',
    backgroundColor: '#007782',
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 14,
    border: '2px solid #007782',
    backgroundColor: '#FFFFFF',
    color: '#007782',
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
  },
  disabled: {
    opacity: 0.65,
    cursor: 'not-allowed',
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: '8px 0',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#007782',
    fontSize: 17,
    fontWeight: 800,
    cursor: 'pointer',
  },
  linkButton: {
    alignSelf: 'center',
    padding: '12px 0',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#007782',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
  },
  error: {
    color: '#B91C1C',
    fontSize: 15,
    lineHeight: '22px',
    fontWeight: 700,
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 10,
    margin: 0,
  },
  footer: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
};
