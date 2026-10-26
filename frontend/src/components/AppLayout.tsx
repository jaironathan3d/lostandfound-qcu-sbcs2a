import { Link, Outlet } from 'react-router-dom';

export const AppLayout = () => {
  return (
    <>
      <nav>
        <ul>
          <li>
            <Link to="/login">Login</Link>
          </li>
          <li>
            <Link to="/register">Register</Link>
          </li>
          <li>
            <Link to="/items">Browse Items</Link>
          </li>
          <li>
            <Link to="/report-item">Report Item</Link>
          </li>
          <li>
            <Link to="/my-claims">My Claims</Link>
          </li>
          <li>
            <Link to="/guard-dashboard">Guard Dashboard</Link>
          </li>
          <li>
            <Link to="/admin-dashboard">Admin Dashboard</Link>
          </li>
        </ul>
      </nav>
      <main>
        <Outlet />
      </main>
    </>
  );
};
