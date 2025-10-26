import { useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { Bluetooth, Activity, AlertCircle } from 'lucide-react';
import { useMonitorStore } from '../store/monitorStore';
import { disconnectDevice } from '../bluetooth/mindsensor';
import DeviceList from './DeviceList';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export default function BluetoothStatus() {
  const { connectionState, connected, lastDataTs, possibleDrop, wearOk, focus, relax } = useMonitorStore();
  const [showModal, setShowModal] = useState(false);
  const [showDeviceList, setShowDeviceList] = useState(false);

  const getStatusVariant = () => {
    if (possibleDrop) return 'destructive';
    if (connectionState === 'connected') return 'success';
    if (connectionState === 'connecting' || connectionState === 'scanning') return 'warning';
    return 'secondary';
  };

  const getStatusText = () => {
    if (possibleDrop) return '可能掉线';
    if (connectionState === 'connected') return '已连接';
    if (connectionState === 'connecting') return '连接中';
    if (connectionState === 'scanning') return '扫描中';
    return '未连接';
  };

  const handleDisconnect = async () => {
    await disconnectDevice();
    setShowModal(false);
  };

  const handleConnectAnother = () => {
    setShowDeviceList(true);
  };

  return (
    <>
      {/* 状态指示徽章 */}
      <Button
        onClick={() => setShowModal(true)}
        variant="outline"
        className="fixed top-4 right-4 flex items-center gap-2 shadow-lg hover:shadow-xl z-40"
        size="default"
      >
        <Bluetooth className="w-4 h-4" />
        <Badge variant={getStatusVariant()} className="ml-1">
          {getStatusText()}
        </Badge>
      </Button>

      {/* 弹窗 */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent onClose={() => setShowModal(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bluetooth className="w-5 h-5" />
              蓝牙连接状态
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 space-y-4">
            {/* 状态信息 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <Badge variant={getStatusVariant()}>{getStatusText()}</Badge>
              </div>

              {connected && (
                <>
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-500">设备名称:</span>
                      <span className="font-medium text-gray-900">{connected.name || '未命名'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-500">设备 ID:</span>
                      <span className="font-mono text-xs text-gray-700">{connected.id.slice(0, 16)}...</span>
                    </div>
                    {lastDataTs && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-500">上次数据:</span>
                        <span className="font-medium text-gray-900">{dayjs(lastDataTs).fromNow()}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-500">佩戴状态:</span>
                      <Badge variant={wearOk ? 'success' : 'destructive'}>
                        {wearOk ? '正常' : '不正常'}
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-500">专注度:</span>
                      <span className="font-semibold text-blue-600">{focus}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500">放松度:</span>
                      <span className="font-semibold text-green-600">{relax}</span>
                    </div>
                  </div>

                  {possibleDrop && (
                    <Alert variant="destructive" className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        设备可能已掉线（超过 3 秒未收到数据）
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {!connected && (
                <div className="text-sm text-gray-500 text-center py-8">
                  当前未连接设备
                </div>
              )}
            </div>

            {/* 设备列表（连接其他时显示） */}
            {showDeviceList && (
              <div className="pt-4 border-t">
                <DeviceList onConnected={() => {
                  setShowDeviceList(false);
                  setShowModal(false);
                }} />
              </div>
            )}
          </div>

          <DialogFooter>
            {connected && (
              <>
                <Button
                  onClick={handleConnectAnother}
                  variant="default"
                  className="w-full sm:w-auto"
                >
                  连接其他设备
                </Button>
                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  className="w-full sm:w-auto"
                >
                  断开连接
                </Button>
              </>
            )}
            <Button
              onClick={() => setShowModal(false)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

