import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { RoleGuard } from '../guards/RoleGuard';
import { LoginPage, RegisterPage } from '../pages/AuthPages';
import { SafetyHelpPage } from '../pages/InformationPages';
import { BrowseItemsPage } from '../pages/BrowseItemsPage';
import { MyClaimsPage, ReportItemPage, ThreadsPage } from '../pages/CommunityPages';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { AdminItemReportsPage } from '../pages/AdminItemReportsPage';
import { AdminItemMatchesPage } from '../pages/AdminItemMatchesPage';
import { MessagesPage } from '../pages/MessagesPage';
import { MyReportsPage } from '../pages/MyReportsPage';
import {
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
      {
        path: 'messages',
        element: (
          <RoleGuard allowedRoles={['student', 'professor', 'staff', 'security_guard', 'admin', 'superadmin']}>
            <MessagesPage />
          </RoleGuard>
        ),
      },
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
        path: 'my-reports',
        element: (
          <RoleGuard allowedRoles={['student', 'professor', 'staff']}>
            <MyReportsPage />
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
      {
        path: 'admin-dashboard/reports',
        element: (
          <RoleGuard allowedRoles={['admin', 'superadmin']}>
            <AdminItemReportsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin-dashboard/matches',
        element: (
          <RoleGuard allowedRoles={['admin', 'superadmin']}>
            <AdminItemMatchesPage />
          </RoleGuard>
        ),
      },
    ],
  },
]);
