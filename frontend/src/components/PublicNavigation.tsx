import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import './PublicNavigation.css';

export const PublicHeader = () => {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();

  return (
    <header className="public-header">
      <Link className="public-brand" to="/" aria-label="QCU Lost and Found home">
        <img src="/qcu_logo.png" alt="" />
        <span className="public-brand__name">QCU <small>LOST &amp; FOUND</small></span>
      </Link>

      <nav className="public-nav" aria-label="Main navigation">
        <Link className={pathname === '/' || pathname === '/items' ? 'public-nav__active' : ''} to="/">
          Lost &amp; Found
        </Link>
        <Link className={pathname === '/how-it-works' ? 'public-nav__active' : ''} to="/how-it-works">
          How it works
        </Link>
        <Link className={pathname === '/safety-help' ? 'public-nav__active' : ''} to="/safety-help">
          Safety &amp; help
        </Link>
      </nav>

      <div className="public-header__actions">
        {user ? (
          <>
            <span className="public-user" title={user.fullName}>{user.fullName}</span>
            <button type="button" className="public-signup public-signup--logout" onClick={signOut}>
              Log out
            </button>
          </>
        ) : (
          <>
            <Link className="public-login" to="/login">Log in</Link>
            <Link className="public-signup" to="/register">Sign up</Link>
          </>
        )}
      </div>
    </header>
  );
};

export const PublicFooter = () => (
  <footer className="public-footer">
    <Link className="public-brand" to="/" aria-label="QCU Lost and Found home">
      <img src="/qcu_logo.png" alt="" />
      <span className="public-brand__name">QCU <small>LOST &amp; FOUND</small></span>
    </Link>
    <span>A campus community that looks out for each other.</span>
    <div className="public-footer__links">
      <Link to="/how-it-works">How it works</Link>
      <Link to="/safety-help">Safety &amp; help</Link>
    </div>
  </footer>
);
