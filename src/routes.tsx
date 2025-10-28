import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import Home from './pages/Home';
import Monitor from './pages/Monitor';
import Result from './pages/Result';
import Records from './pages/Records';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: 'monitor',
        element: <Monitor />,
      },
      {
        path: 'result',
        element: <Result />,
      },
      {
        path: 'records',
        element: <Records />,
      },
    ],
  },
]);

