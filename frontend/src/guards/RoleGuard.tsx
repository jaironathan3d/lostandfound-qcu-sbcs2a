import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type AppRole } from '../lib/AuthContext';

type RoleGuardProps = {
  allowedRoles: AppRole[];
  children: ReactNode;
};

export const RoleGuard = ({ allowedRoles, children }: RoleGuardProps) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <main aria-label="Checking your sign-in">Loading…</main>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
