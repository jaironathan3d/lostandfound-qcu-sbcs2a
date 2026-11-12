import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { RoleGuard } from '../guards/RoleGuard';
import { LoginPage, RegisterPage } from '../pages/AuthPages';
import { SafetyHelpPage } from '../pages/InformationPages';
import { BrowseItemsPage } from '../pages/BrowseItemsPage';
import { MyClaimsPage, ReportItemPage, ThreadsPage } from '../pages/CommunityPages';
import {
  AdminDashboardPage,
  GuardDashboardPage,
} from '../pages/placeholders';

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <BrowseItemsPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'items', element: <BrowseItemsPage /> },
      { path: 'items/:itemId', element: <BrowseItemsPage /> },
      { path: 'threads', element: <ThreadsPage /> },
      { path: 'how-it-works', element: <Navigate to="/safety-help" replace /> },
      { path: 'safety-help', element: <SafetyHelpPage /> },
      {
        path: 'report-item',
        element: (
          <RoleGuard allowedRoles={['student', 'professor', 'staff']}>
            <ReportItemPage />
          </RoleGuard>
        ),
      },
      {
        path: 'my-claims',
        element: (
          <RoleGuard allowedRoles={['student', 'professor', 'staff']}>
            <MyClaimsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'guard-dashboard',
        element: (
          <RoleGuard allowedRoles={['security_guard']}>
            <GuardDashboardPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin-dashboard',
        element: (
          <RoleGuard allowedRoles={['admin', 'superadmin']}>
            <AdminDashboardPage />
          </RoleGuard>
        ),
      },
    ],
  },
]);
