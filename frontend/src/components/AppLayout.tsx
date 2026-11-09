import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export const AppLayout = () => {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const usesPublicHeader = [
    '/',
    '/items',
    '/login',
    '/register',
    '/how-it-works',
    '/safety-help',
  ].includes(pathname);

  return (
    <div className="app-layout">
      {!usesPublicHeader && (
        <nav>
          <ul>
            {user ? (
              <>
                <li><span>Hi, {user.fullName}</span></li>
                <li><button type="button" onClick={signOut}>Log out</button></li>
              </>
            ) : (
              <>
                <li><Link to="/login">Login</Link></li>
                <li><Link to="/register">Register</Link></li>
              </>
            )}
            <li><Link to="/items">Browse Items</Link></li>
            <li><Link to="/report-item">Report Item</Link></li>
            <li><Link to="/my-claims">My Claims</Link></li>
            <li><Link to="/guard-dashboard">Guard Dashboard</Link></li>
            <li><Link to="/admin-dashboard">Admin Dashboard</Link></li>
          </ul>
        </nav>
      )}
      <Outlet />
    </div>
  );
};
