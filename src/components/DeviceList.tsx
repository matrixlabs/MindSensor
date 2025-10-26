import { useState, useEffect } from 'react';
import type { BluetoothDevice } from '../types/bluetooth';
import { startScan, stopScan, requestDevice, connectDevice } from '../bluetooth/mindsensor';
import { useMonitorStore } from '../store/monitorStore';

interface DeviceListProps {
  onConnected?: () => void;
}

export default function DeviceList({ onConnected }: DeviceListProps) {
  const { scanning, devices, connectingId, connected } = useMonitorStore();
  const [scanCountdown, setScanCountdown] = useState(0);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (scanning && scanCountdown > 0) {
      timer = setInterval(() => {
        setScanCountdown(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [scanning, scanCountdown]);

  const handleStartScan = async () => {
    setError('');
    try {
      setScanCountdown(10);
      await startScan(10000);
    } catch (err: any) {
      setError(err.message || '扫描失败');
    }
  };

  const handleStopScan = () => {
    stopScan();
    setScanCountdown(0);
  };

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

  const handleConnect = async (device: BluetoothDevice) => {
    setError('');
    try {
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
        <h2 className="text-xl font-semibold text-gray-800">蓝牙设备</h2>
        <div className="flex gap-2">
          {!scanning ? (
            <>
              <button
                onClick={handleStartScan}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                扫描设备
              </button>
              <button
                onClick={handleRequestDevice}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                选择设备
              </button>
            </>
          ) : (
            <button
              onClick={handleStopScan}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              停止扫描 ({scanCountdown}s)
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {scanning && (
        <div className="text-sm text-gray-500 flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          正在扫描设备...
        </div>
      )}

      <div className="space-y-2">
        {devices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {scanning ? '扫描中，请稍候...' : '未发现设备，请点击扫描或选择设备'}
          </div>
        ) : (
          devices.map((device) => (
            <button
              key={device.id}
              onClick={() => handleConnect(device)}
              disabled={connectingId === device.id}
              className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">
                    {device.name || '未命名设备'}
                  </div>
                  <div className="text-sm text-gray-500">{device.id}</div>
                </div>
                {connectingId === device.id && (
                  <div className="text-blue-600 text-sm">连接中...</div>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

