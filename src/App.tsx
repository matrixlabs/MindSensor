import { Outlet } from 'react-router-dom';
import { SolanaProvider } from './providers/SolanaProvider';

function App() {
  return (
    <SolanaProvider>
      <div className="min-h-screen bg-gray-50">
        <Outlet />
      </div>
    </SolanaProvider>
  );
}

export default App;
