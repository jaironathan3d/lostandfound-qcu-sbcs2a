import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { RoleGuard } from '../guards/RoleGuard';
import {
  AdminDashboardPage,
  BrowseItemsPage,
  GuardDashboardPage,
  HomePage,
  ItemDetailPage,
  LoginPage,
  MyClaimsPage,
  RegisterPage,
  ReportItemPage,
} from '../pages/placeholders';

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'items', element: <BrowseItemsPage /> },
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
