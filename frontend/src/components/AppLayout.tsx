import { Link, Outlet, useLocation } from 'react-router-dom';

export const AppLayout = () => {
  const { pathname } = useLocation();

  return (
    <div className="app-layout">
      {pathname !== '/' && (
        <nav>
          <ul>
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/register">Register</Link></li>
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
