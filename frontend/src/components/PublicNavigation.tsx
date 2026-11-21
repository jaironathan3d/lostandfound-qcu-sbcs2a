import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import './PublicNavigation.css';

export const PublicHeader = () => {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const isItemsPage = pathname === '/' || pathname === '/items' || pathname.startsWith('/items/');

  return (
    <header className="public-header">
      <Link className="public-brand" to="/" aria-label="QCU Lost and Found home">
        <img src="/qcu_logo.png" alt="" />
        <span className="public-brand__name">QCU <small>LOST &amp; FOUND</small></span>
      </Link>

      <nav className="public-nav" aria-label="Main navigation">
        <Link className={isItemsPage ? 'public-nav__active' : ''} to="/">
          Lost &amp; Found
        </Link>
        <Link className={pathname === '/threads' ? 'public-nav__active' : ''} to="/threads">
          Threads
        </Link>
        <Link className={pathname === '/safety-help' ? 'public-nav__active' : ''} to="/safety-help">
          Safety &amp; help
        </Link>
      </nav>

      <div className="public-header__actions">
        {user ? (
          <>
            <span className="public-user" title={user.fullName}>{user.fullName}</span>
            {['student', 'professor', 'staff'].includes(user.role) && (
              <>
                <Link className="public-login" to="/my-reports">My reports</Link>
                <Link className="public-login" to="/my-claims">My claims</Link>
              </>
            )}
            <Link className="public-login" to="/messages">Messages</Link>
            {(user.role === 'admin' || user.role === 'superadmin') && (
              <Link className="public-login" to="/admin-dashboard">Admin review</Link>
            )}
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
      <Link to="/threads">Threads</Link>
      <Link to="/safety-help">Safety &amp; help</Link>
      <Link to="/report-item">Report an item</Link>
    </div>
  </footer>
);
