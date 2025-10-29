import { useNavigate } from 'react-router-dom';
import { Activity, History } from 'lucide-react';
import { Button } from '../components/ui/button';
import Layout from '../components/Layout';

export default function Home() {
  const navigate = useNavigate();

  return (
    <Layout className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
      <div className="text-center space-y-8 p-8">
        <div>
          <h1 className="text-5xl font-bold text-gray-800 mb-4">
            Mindsensor Monitoring
          </h1>
          <p className="text-xl text-gray-600">
            Real-time EEG Data Collection & Analysis + Blockchain Storage
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => navigate('/monitor')}
            size="lg"
            className="text-lg px-8 py-6 h-auto"
          >
            <Activity className="w-5 h-5" />
            Enter Monitoring Page
          </Button>

          <Button
            onClick={() => navigate('/records')}
            size="lg"
            variant="secondary"
            className="text-lg px-8 py-6 h-auto"
          >
            <History className="w-5 h-5" />
            View Training Records
          </Button>
        </div>

        <div className="text-sm text-gray-500 mt-8">
          <p>Please ensure your device supports Bluetooth and is turned on</p>
          <p>Recommend using desktop Chrome browser</p>
          <p className="mt-2 text-purple-600">Connect Solana wallet to permanently save training data on blockchain</p>
        </div>
      </div>
    </Layout>
  );
}

