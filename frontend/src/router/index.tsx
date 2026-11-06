import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { RoleGuard } from '../guards/RoleGuard';
import { LoginPage, RegisterPage } from '../pages/AuthPages';
import { HowItWorksPage, SafetyHelpPage } from '../pages/InformationPages';
import {
  AdminDashboardPage,
  BrowseItemsPage,
  GuardDashboardPage,
  ItemDetailPage,
  MyClaimsPage,
  ReportItemPage,
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
      { path: 'how-it-works', element: <HowItWorksPage /> },
      { path: 'safety-help', element: <SafetyHelpPage /> },
      { path: 'items/:itemId', element: <ItemDetailPage /> },
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
