import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import Home from './pages/Home';
import Monitor from './pages/Monitor';
import Result from './pages/Result';

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
    ],
  },
]);

