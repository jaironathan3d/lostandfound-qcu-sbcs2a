import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { RoleGuard } from '../guards/RoleGuard';
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from '../pages/AuthPages';
import { PrivacyPage, SafetyHelpPage, TermsPage } from '../pages/InformationPages';
import { BrowseItemsPage } from '../pages/BrowseItemsPage';
import { MyClaimsPage, ReportItemPage, ThreadsPage } from '../pages/CommunityPages';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { AdminItemReportsPage } from '../pages/AdminItemReportsPage';
import { AdminItemMatchesPage } from '../pages/AdminItemMatchesPage';
import { AdminStudentRecordsPage } from '../pages/AdminStudentRecordsPage';
import { AdminCategoriesPage } from '../pages/AdminCategoriesPage';
import { AdminConversationReportsPage } from '../pages/AdminConversationReportsPage';
import { AdminVaultPage } from '../pages/AdminVaultPage';
import { MessagesPage } from '../pages/MessagesPage';
import { MyReportsPage } from '../pages/MyReportsPage';

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <BrowseItemsPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'items', element: <BrowseItemsPage /> },
      { path: 'items/:itemId', element: <BrowseItemsPage /> },
      { path: 'threads', element: <ThreadsPage /> },
      {
        path: 'messages',
        element: (
          <RoleGuard allowedRoles={['student', 'admin', 'super_admin']}>
            <MessagesPage />
          </RoleGuard>
        ),
      },
      { path: 'how-it-works', element: <Navigate to="/safety-help" replace /> },
      { path: 'safety-help', element: <SafetyHelpPage /> },
      { path: 'terms', element: <TermsPage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      {
        path: 'report-item',
        element: (
          <RoleGuard allowedRoles={['student']}>
            <ReportItemPage />
          </RoleGuard>
        ),
      },
      {
        path: 'my-claims',
        element: (
          <RoleGuard allowedRoles={['student']}>
            <MyClaimsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'my-reports',
        element: (
          <RoleGuard allowedRoles={['student']}>
            <MyReportsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin-dashboard',
        element: (
          <RoleGuard allowedRoles={['admin', 'super_admin']}>
            <AdminDashboardPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin-dashboard/reports',
        element: (
          <RoleGuard allowedRoles={['admin', 'super_admin']}>
            <AdminItemReportsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin-dashboard/matches',
        element: (
          <RoleGuard allowedRoles={['admin', 'super_admin']}>
            <AdminItemMatchesPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin-dashboard/conversations',
        element: (
          <RoleGuard allowedRoles={['admin', 'super_admin']}>
            <AdminConversationReportsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin-dashboard/vault',
        element: (
          <RoleGuard allowedRoles={['admin', 'super_admin']}>
            <AdminVaultPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin-dashboard/students',
        element: (
          <RoleGuard allowedRoles={['admin', 'super_admin']}>
            <AdminStudentRecordsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'admin-dashboard/categories',
        element: (
          <RoleGuard allowedRoles={['admin', 'super_admin']}>
            <AdminCategoriesPage />
          </RoleGuard>
        ),
      },
    ],
  },
]);
