import { useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/en';
import { Bluetooth, Activity, AlertCircle } from 'lucide-react';
import { useMonitorStore } from '../store/monitorStore';
import { disconnectDevice } from '../bluetooth/mindsensor';
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
dayjs.locale('en');

export default function BluetoothStatus() {
  const { connectionState, connected, lastDataTs, possibleDrop, wearOk, focus, relax } = useMonitorStore();
  const [showModal, setShowModal] = useState(false);

  const getStatusVariant = () => {
    if (possibleDrop) return 'destructive';
    if (connectionState === 'connected') return 'success';
    if (connectionState === 'connecting' || connectionState === 'scanning') return 'warning';
    return 'secondary';
  };

  const getStatusText = () => {
    if (possibleDrop) return 'Possible Disconnection';
    if (connectionState === 'connected') return 'Connected';
    if (connectionState === 'connecting') return 'Connecting';
    if (connectionState === 'scanning') return 'Scanning';
    return 'Disconnected';
  };

  const handleDisconnect = async () => {
    await disconnectDevice();
    setShowModal(false);
  };

  return (
    <>
      {/* Status indicator badge */}
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

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent onClose={() => setShowModal(false)}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bluetooth className="w-5 h-5" />
              Bluetooth Connection Status
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 space-y-4">
            {/* Status information */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <Badge variant={getStatusVariant()}>{getStatusText()}</Badge>
              </div>

              {connected && (
                <>
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-500">Device Name:</span>
                      <span className="font-medium text-gray-900">{connected.name || 'Unnamed'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-500">Device ID:</span>
                      <span className="font-mono text-xs text-gray-700">{connected.id.slice(0, 16)}...</span>
                    </div>
                    {lastDataTs && (
                      <div className="flex justify-between py-2 border-b">
                        <span className="text-gray-500">Last Data:</span>
                        <span className="font-medium text-gray-900">{dayjs(lastDataTs).fromNow()}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-500">Wearing Status:</span>
                      <Badge variant={wearOk ? 'success' : 'destructive'}>
                        {wearOk ? 'Normal' : 'Abnormal'}
                      </Badge>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-500">Focus:</span>
                      <span className="font-semibold text-blue-600">{focus}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500">Relaxation:</span>
                      <span className="font-semibold text-green-600">{relax}</span>
                    </div>
                  </div>

                  {possibleDrop && (
                    <Alert variant="destructive" className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Device may be disconnected (no data received for more than 3 seconds)
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}

              {!connected && (
                <div className="text-sm text-gray-500 text-center py-8">
                  Currently not connected to device
                </div>
              )}
            </div>


          </div>

          <DialogFooter>
            {connected && (
              <>
                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  className="w-full sm:w-auto"
                >
                  Disconnect
                </Button>
              </>
            )}
            <Button
              onClick={() => setShowModal(false)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

