import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';

const DashboardNotice = ({ title, role }: { title: string; role: string }) => (
  <div className="info-page">
    <PublicHeader />
    <main className="info-content">
      <header className="info-intro">
        <p className="info-eyebrow">{role.toUpperCase()} WORKSPACE</p>
        <h1>{title}</h1>
        <p>The role-based dashboard and server workflows are not part of this browser-only UI demo.</p>
        <Link className="info-button" to="/items">Return to lost &amp; found</Link>
      </header>
    </main>
    <PublicFooter />
  </div>
);

export const GuardDashboardPage = () => <DashboardNotice title="Item custody" role="Campus security" />;

export const AdminDashboardPage = () => <DashboardNotice title="Administrator dashboard" role="Administrator" />;
