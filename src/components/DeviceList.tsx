import { useState } from 'react';
import { Bluetooth, AlertCircle } from 'lucide-react';
import { requestDevice, connectDevice } from '../bluetooth/mindsensor';
import { useMonitorStore } from '../store/monitorStore';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';

interface DeviceListProps {
  onConnected?: () => void;
}

export default function DeviceList({ onConnected }: DeviceListProps) {
  const { connected } = useMonitorStore();
  const [error, setError] = useState<string>('');

  const handleRequestDevice = async () => {
    setError('');
    try {
      const device = await requestDevice();
      await connectDevice(device);
      if (onConnected) {
        onConnected();
      }
    } catch (err: any) {
      setError(err.message || '连接失败');
    }
  };

  if (connected) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">连接设备</h2>
      </div>

      {error && (
        <Alert variant="destructive" className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleRequestDevice}
        variant="default"
        size="lg"
        className="w-full"
      >
        <Bluetooth className="w-4 h-4" />
        选择设备并连接
      </Button>
    </div>
  );
}

