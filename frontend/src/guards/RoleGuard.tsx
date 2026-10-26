import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

export type AppRole = 'student' | 'professor' | 'staff' | 'security_guard' | 'admin' | 'superadmin';

type RoleGuardProps = {
  allowedRoles: AppRole[];
  children: ReactNode;
};

const getCurrentRole = (): AppRole | null => {
  // TODO: Replace with auth state lookup.
  return null;
};

export const RoleGuard = ({ allowedRoles, children }: RoleGuardProps)=> {
  const currentRole = getCurrentRole();

  if (!currentRole) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(currentRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
