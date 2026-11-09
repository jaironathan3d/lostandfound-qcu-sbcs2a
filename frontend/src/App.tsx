import { RouterProvider } from 'react-router-dom';
import { appRouter } from './router';
import { AuthProvider } from './lib/AuthContext';

export const App = () => (
  <AuthProvider>
    <RouterProvider router={appRouter} />
  </AuthProvider>
);
