import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { apiRequest } from '../lib/apiClient';
import './AuthPages.css';


type AuthPageProps = {
  mode: 'login' | 'register';
};

const AuthPage = ({ mode }: AuthPageProps) => {
  const isRegister = mode === 'register';
  const { user, isLoading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedPath = (location.state as { from?: unknown } | null)?.from;
  const returnPath =
    typeof requestedPath === 'string' && requestedPath.startsWith('/') ? requestedPath : '/items';
  const [fullName, setFullName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [course, setCourse] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

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
    if (isRegister && !acceptedPrivacy) {
      setError('Please acknowledge the Privacy Notice to create an account.');
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setError('Password and confirm password must match.');
      return;
    }
    void completeSignIn(() =>
      isRegister
        ? signUp(fullName, email, password, confirmPassword, studentNumber, course, yearLevel, acceptedTerms, acceptedPrivacy)
        : signIn(email, password),
    );
  };


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
          {isRegister && (
            <label>
              CCS student number
              <input
                required
                minLength={3}
                maxLength={30}
                value={studentNumber}
                onChange={(event) => setStudentNumber(event.target.value)}
                placeholder="24-1234"
                pattern="[0-9]{2}-[0-9]{4}"
              />
            </label>
          )}
          {isRegister && (
            <label>
              Course / program
              <input
                required
                minLength={2}
                maxLength={100}
                value={course}
                onChange={(event) => setCourse(event.target.value)}
                placeholder="BSCS"
              />
            </label>
          )}
          {isRegister && (
            <label>
              Year level
              <select required value={yearLevel} onChange={(event) => setYearLevel(event.target.value)}>
                <option value="">Select year level</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </label>
          )}
          <label>
            {isRegister ? 'University email' : 'Email address'}
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
          {isRegister && (
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat your password"
              />
            </label>
          )}
          {isRegister && (
            <>
              <label className="auth-terms">
                <input type="checkbox" required checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} />
                <span>I accept the <Link to="/terms">Terms of Service</Link>.</span>
              </label>
              <label className="auth-terms">
                <input type="checkbox" required checked={acceptedPrivacy} onChange={(event) => setAcceptedPrivacy(event.target.checked)} />
                <span>I acknowledge the <Link to="/privacy">Privacy Notice</Link>.</span>
              </label>
            </>
          )}
          {!isRegister && <div className="auth-remember"><label><input type="checkbox" /> Remember me</label><Link to="/forgot-password">Forgot password?</Link></div>}
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

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Password recovery could not be requested.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-card__intro">
            <p className="auth-eyebrow">ACCOUNT RECOVERY</p>
            <h2 id="auth-title">Forgot password</h2>
            <p>Password recovery requires a configured email delivery service. This development setup does not send real email.</p>
          </div>
          <form className="auth-form" onSubmit={submitForm}>
            <label>Email address<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            {message && <p className="auth-error" role="status">{message}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : 'Request recovery'}</button>
          </form>
          <p className="auth-switch"><Link to="/login">Back to login</Link></p>
        </div>
      </section>
    </main>
  );
};

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: searchParams.get('token') ?? '', password, confirmPassword }),
      });
      setMessage(result.message);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Password could not be reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-main">
        <div className="auth-card">
          <div className="auth-card__intro">
            <p className="auth-eyebrow">ACCOUNT RECOVERY</p>
            <h2 id="auth-title">Reset password</h2>
          </div>
          <form className="auth-form" onSubmit={submit}>
            <label>New password<input type="password" required minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label>Confirm password<input type="password" required minLength={8} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
            {message && <p className="auth-error" role="status">{message}</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : 'Update password'}</button>
          </form>
          <p className="auth-switch"><Link to="/login">Back to login</Link></p>
        </div>
      </section>
    </main>
  );
};
