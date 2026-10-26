import { RouterProvider } from 'react-router-dom';
import { appRouter } from './router';

export const App = () => <RouterProvider router={appRouter} />;
