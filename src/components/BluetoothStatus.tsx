import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { useMonitorStore } from '../store/monitorStore';
import { disconnectDevice } from '../bluetooth/mindsensor';
import DeviceList from './DeviceList';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export default function BluetoothStatus() {
  const { connectionState, connected, lastDataTs, possibleDrop, wearOk, focus, relax } = useMonitorStore();
  const [showModal, setShowModal] = useState(false);
  const [showDeviceList, setShowDeviceList] = useState(false);

  const getStatusColor = () => {
    if (possibleDrop) return 'bg-red-500';
    if (connectionState === 'connected') return 'bg-green-500';
    if (connectionState === 'connecting' || connectionState === 'scanning') return 'bg-yellow-500';
    return 'bg-gray-400';
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
      <button
        onClick={() => setShowModal(true)}
        className="fixed top-4 right-4 flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow"
      >
        <div className={`w-3 h-3 rounded-full ${getStatusColor()} animate-pulse`}></div>
        <span className="font-medium text-gray-700">{getStatusText()}</span>
      </button>

      {/* 弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              {/* 标题 */}
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-800">蓝牙状态</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 状态信息 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${getStatusColor()}`}></div>
                  <span className="font-medium">{getStatusText()}</span>
                </div>

                {connected && (
                  <>
                    <div className="text-sm text-gray-600">
                      <div className="flex justify-between py-2 border-b">
                        <span>设备名称:</span>
                        <span className="font-medium">{connected.name || '未命名'}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span>设备 ID:</span>
                        <span className="font-mono text-xs">{connected.id.slice(0, 16)}...</span>
                      </div>
                      {lastDataTs && (
                        <div className="flex justify-between py-2 border-b">
                          <span>上次数据:</span>
                          <span className="font-medium">{dayjs(lastDataTs).fromNow()}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 border-b">
                        <span>佩戴状态:</span>
                        <span className={`font-medium ${wearOk ? 'text-green-600' : 'text-red-600'}`}>
                          {wearOk ? '正常' : '不正常'}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span>专注度:</span>
                        <span className="font-medium text-blue-600">{focus}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span>放松度:</span>
                        <span className="font-medium text-green-600">{relax}</span>
                      </div>
                    </div>

                    {possibleDrop && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                        ⚠️ 设备可能已掉线（超过 3 秒未收到数据）
                      </div>
                    )}
                  </>
                )}

                {!connected && (
                  <div className="text-sm text-gray-500 text-center py-4">
                    当前未连接设备
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-4">
                {connected && (
                  <>
                    <button
                      onClick={handleConnectAnother}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      连接其他
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                      断开连接
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  关闭
                </button>
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
          </div>
        </div>
      )}
    </>
  );
}

