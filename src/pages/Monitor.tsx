import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMonitorStore } from '../store/monitorStore';
import { setupDropCheckInterval } from '../bluetooth/mindsensor';
import DeviceList from '../components/DeviceList';
import RealtimeChart from '../components/RealtimeChart';
import BluetoothStatus from '../components/BluetoothStatus';

export default function Monitor() {
  const navigate = useNavigate();
  const { 
    connected, 
    isRecording, 
    wearOk, 
    focus, 
    relax,
    samples,
    startRecord,
    stopRecord,
    clearData,
  } = useMonitorStore();

  useEffect(() => {
    // 设置掉线检测定时器
    const interval = setupDropCheckInterval();
    return () => clearInterval(interval);
  }, []);

  const handleStart = () => {
    clearData();
    startRecord();
  };

  const handleStop = () => {
    stopRecord();
    navigate('/result');
  };

  const handleClear = () => {
    if (window.confirm('确定要清空当前数据吗？')) {
      clearData();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 蓝牙状态指示器 */}
      <BluetoothStatus />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-800">实时监测</h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            返回首页
          </button>
        </div>

        {/* 设备连接区域 */}
        {!connected && <DeviceList />}

        {/* 已连接时显示的控制面板 */}
        {connected && (
          <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
            {/* 实时数据显示 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">专注度</div>
                <div className="text-3xl font-bold text-blue-600">{focus}</div>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">放松度</div>
                <div className="text-3xl font-bold text-green-600">{relax}</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">佩戴状态</div>
                <div className={`text-2xl font-bold ${wearOk ? 'text-green-600' : 'text-red-600'}`}>
                  {wearOk ? '正常' : '不正常'}
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">数据点数</div>
                <div className="text-3xl font-bold text-gray-700">{samples.length}</div>
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="flex items-center gap-4">
              {!isRecording ? (
                <button
                  onClick={handleStart}
                  disabled={!wearOk}
                  className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  开始记录
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                >
                  结束记录
                </button>
              )}

              <button
                onClick={handleClear}
                disabled={isRecording || samples.length === 0}
                className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                清空数据
              </button>

              {isRecording && (
                <div className="flex items-center gap-2 text-red-600">
                  <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                  <span className="font-medium">正在记录...</span>
                </div>
              )}
            </div>

            {!wearOk && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                ⚠️ 请正确佩戴设备后再开始记录
              </div>
            )}
          </div>
        )}

        {/* 实时图表 */}
        {connected && <RealtimeChart />}
      </div>
    </div>
  );
}

