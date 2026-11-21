import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import './AuthPages.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: { theme: string; size: string; text: string; shape: string; width: number },
          ) => void;
        };
      };
    };
  }
}

type GoogleSignInProps = {
  onCredential: (credential: string) => Promise<void>;
  onError: (message: string) => void;
  disabled: boolean;
};

const GoogleSignIn = ({ onCredential, onError, disabled }: GoogleSignInProps) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  onCredentialRef.current = onCredential;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!googleClientId || !buttonRef.current) return;

    const renderGoogleButton = () => {
      if (!buttonRef.current || !window.google?.accounts.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (!response.credential) {
            onErrorRef.current('Google did not return a sign-in credential. Please try again.');
            return;
          }
          void onCredentialRef.current(response.credential).catch((error: unknown) => {
            onErrorRef.current(error instanceof Error ? error.message : 'Google sign-in failed.');
          });
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: Math.min(buttonRef.current.clientWidth, 380),
      });
    };

    const script = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    if (window.google?.accounts.id) {
      renderGoogleButton();
    } else if (script) {
      script.addEventListener('load', renderGoogleButton, { once: true });
      return () => script.removeEventListener('load', renderGoogleButton);
    } else {
      const googleScript = document.createElement('script');
      googleScript.src = 'https://accounts.google.com/gsi/client';
      googleScript.async = true;
      googleScript.defer = true;
      googleScript.dataset.googleIdentity = 'true';
      googleScript.addEventListener('load', renderGoogleButton, { once: true });
      googleScript.addEventListener(
        'error',
        () => onErrorRef.current('Google sign-in could not load. Check your internet connection.'),
        { once: true },
      );
      document.head.appendChild(googleScript);
      return () => googleScript.removeEventListener('load', renderGoogleButton);
    }
  }, []);

  if (!googleClientId) {
    return (
      <button className="auth-google auth-google--unavailable" type="button" disabled>
        <span aria-hidden="true">G</span>
        Google sign-in needs setup
      </button>
    );
  }

  return (
    <div className={disabled ? 'auth-google-wrap auth-google-wrap--disabled' : 'auth-google-wrap'}>
      <div className="auth-google" ref={buttonRef} />
      {disabled && <span className="auth-google-wrap__overlay" aria-hidden="true" />}
    </div>
  );
};

type AuthPageProps = {
  mode: 'login' | 'register';
};

const AuthPage = ({ mode }: AuthPageProps) => {
  const isRegister = mode === 'register';
  const { user, isLoading, signIn, signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedPath = (location.state as { from?: unknown } | null)?.from;
  const returnPath =
    typeof requestedPath === 'string' && requestedPath.startsWith('/') ? requestedPath : '/items';
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  if (isLoading) {
    return <main className="auth-loading" aria-label="Checking your sign-in">Loading…</main>;
  }
  if (user) return <Navigate to={returnPath} replace />;

  const completeSignIn = async (action: () => Promise<void>) => {
    setError('');
    setIsSubmitting(true);
    try {
      await action();
      navigate(returnPath, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign-in failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isRegister && !acceptedTerms) {
      setError('Please agree to the terms and privacy policy to create an account.');
      return;
    }
    void completeSignIn(() =>
      isRegister
        ? signUp(fullName, email, password)
        : signIn(email, password),
    );
  };

  const handleGoogleCredential = (credential: string) =>
    completeSignIn(() => signInWithGoogle(credential));

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About QCU Lost and Found">
        <Link className="auth-brand" to="/" aria-label="QCU Lost and Found home">
          <img src="/qcu_logo.png" alt="" />
          <span>QCU <small>LOST &amp; FOUND</small></span>
        </Link>
        <div className="auth-story__copy">
          <p className="auth-eyebrow">A LITTLE HELP. A HAPPY REUNION.</p>
          <h1>Good things find their way back.</h1>
          <p>A familiar face. A helpful student. A place to bring lost belongings and their people back together.</p>
        </div>
        <div className="auth-story__image">
          <img src="/green_image.png" alt="A water bottle and personal belongings waiting to be reunited with their owner" />
        </div>
        <p className="auth-story__made"><span aria-hidden="true">♡</span> Made for QCU (CCS). Free for everyone.</p>
      </section>
      <section className="auth-main">
        <Link className="auth-browse-link" to="/items">Browse lost &amp; found ↗</Link>
        <div className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card__intro">
            <p className="auth-eyebrow">{isRegister ? 'A GOOD PLACE TO START' : 'YOUR CAMPUS, CONNECTED'}</p>
            <h2 id="auth-title">{isRegister ? 'A little closer to home.' : 'Welcome back.'}</h2>
            <p>{isRegister ? 'Join your neighbors in bringing belongings back. Creating an account is free and takes a moment.' : 'Log in to keep looking, lend a hand, or pick up where you left off.'}</p>
          </div>
          <GoogleSignIn onCredential={handleGoogleCredential} onError={setError} disabled={isSubmitting} />
          <div className="auth-divider"><span>or continue with email</span></div>
          <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister && (
            <label>
              Full name
              <input
                autoComplete="name"
                required
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your name"
              />
            </label>
          )}
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              maxLength={254}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={isRegister ? 8 : undefined}
              maxLength={72}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
            />
          </label>
          {isRegister && <label className="auth-terms"><input type="checkbox" required checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} /><span>I agree to the <Link to="/safety-help">Terms of service</Link> and <Link to="/safety-help">Privacy policy</Link>.</span></label>}
          {!isRegister && <div className="auth-remember"><label><input type="checkbox" /> Remember me</label><Link to="/safety-help">Need help?</Link></div>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Please wait…' : isRegister ? '→　Create account' : '→　Log in'}
          </button>
          </form>
          <p className="auth-switch">{isRegister ? <>Already part of the community? <Link to="/login">Log in</Link></> : <>New to Belong? <Link to="/register">Create an account</Link></>}</p>
          <p className="auth-privacy">♧　Your details stay safe. Your kindness goes further.</p>
        </div>
        <footer className="auth-main__footer"><span>© 2026 QCU</span><Link to="/safety-help">Need help?</Link><Link to="/safety-help">Privacy</Link></footer>
      </section>
    </main>
  );
};

export const LoginPage = () => <AuthPage mode="login" />;
export const RegisterPage = () => <AuthPage mode="register" />;
