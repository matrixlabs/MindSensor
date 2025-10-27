import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Bluetooth, AlertCircle, X, Trash2 } from 'lucide-react';
import { useMonitorStore } from '../store/monitorStore';
import { 
  setupDropCheckInterval,
  isBluetoothSupported,
  connectDevice,
  requestDevice
} from '../bluetooth/mindsensor';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import Layout from '../components/Layout';
import MetricCard from '../components/MetricCard';

// 脑波频段配置
const WAVE_BANDS = [
  { key: 'delta', label: 'δ波（Delta）| 睡眠脑波', color: '#fcd34d' },
  { key: 'theta', label: 'θ波（Theta）| 浅睡脑波', color: '#fca5a5' },
  { key: 'lowAlpha', label: 'α波低（Low Alpha）| 放松脑波', color: '#86efac' },
  { key: 'highAlpha', label: 'α波高（High Alpha）| 清醒放松', color: '#93c5fd' },
  { key: 'lowBeta', label: 'β波低（Low Beta）| 专注思考', color: '#cbd5e1' },
  { key: 'highBeta', label: 'β波高（High Beta）| 高度警觉', color: '#475569' },
  { key: 'lowGamma', label: 'γ波低（Low Gamma）| 认知处理', color: '#93c5fd' },
  { key: 'highGamma', label: 'γ波高（High Gamma）| 高级认知', color: '#cbd5e1' },
];

export default function Monitor() {
  const navigate = useNavigate();
  const [supported, setSupported] = useState<boolean>(true);
  const [tick, setTick] = useState(0); // 用于强制更新测试时长
  const { 
    connected, 
    isRecording, 
    wearOk, 
    focus, 
    relax,
    samples,
    series,
    recordStartTime,
    startRecord,
    stopRecord,
    clearData,
  } = useMonitorStore();

  // 最近 1 分钟窗口的起始索引（用于小图）
  const windowStartIndex = useMemo(() => {
    if (samples.length === 0) return 0;
    const cutoff = Date.now() - 60000;
    const idx = samples.findIndex(s => s.t >= cutoff);
    return idx === -1 ? samples.length : idx;
  }, [samples, tick]);

  useEffect(() => {
    // 设置掉线检测定时器
    const interval = setupDropCheckInterval();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // 进入页面时仅检查是否支持（不自动扫描，改为浏览器选择）
    const init = async () => {
      const sup = isBluetoothSupported();
      setSupported(sup);
    };
    init();
  }, []);

  // 每秒更新一次，用于刷新测试时长
  useEffect(() => {
    if (isRecording) {
      const timer = setInterval(() => {
        setTick(t => t + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isRecording]);

  const handleStop = () => {
    stopRecord();
    navigate('/result');
  };

  // 计算综合分数（专注度和放松度的平均值）
  const comprehensiveScore = useMemo(() => {
    if (samples.length === 0) return 0;
    const avgFocus = samples.reduce((sum, s) => sum + s.focus, 0) / samples.length;
    const avgRelax = samples.reduce((sum, s) => sum + s.relax, 0) / samples.length;
    return Math.round((avgFocus + avgRelax) / 2);
  }, [samples]);

  // 计算测试时长
  const testDuration = useMemo(() => {
    if (!recordStartTime) return '00:00';
    const duration = Math.floor((Date.now() - recordStartTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [recordStartTime, tick]);

  // 主图表配置
  const mainChartOption: EChartsOption = useMemo(() => {
    const now = Date.now();
    const windowStart = now - 60000; // 仅展示最近 1 分钟
    const filteredSamples = samples.filter(s => s.t >= windowStart);

    return {
      animation: false,
      grid: {
        top: 24,
        left: 0,
        right: 0,
        bottom: 0,
        containLabel: false,
      },
      xAxis: {
        type: 'time',
        show: false,
        min: windowStart,
        max: now,
      } as any,
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        show: false,
      },
      series: [
        {
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 4,
          itemStyle: { color: '#fff', borderColor: '#3b82f6', borderWidth: 1.5 },
          data: filteredSamples.map(s => [s.t, s.focus]),
          lineStyle: { width: 2, color: '#3b82f6' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.05)' },
              ],
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { type: 'dashed', color: '#e5e7eb', width: 1 },
            label: { show: false },
            data: [
              { yAxis: 20 },
              { yAxis: 40 },
              { yAxis: 60 },
              { yAxis: 80 },
            ],
          },
        },
        {
          type: 'line',
          smooth: true,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: 4,
          itemStyle: { color: '#fff', borderColor: '#22c55e', borderWidth: 1.5 },
          data: filteredSamples.map(s => [s.t, s.relax]),
          lineStyle: { width: 2, color: '#22c55e' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(34, 197, 94, 0.3)' },
                { offset: 1, color: 'rgba(34, 197, 94, 0.05)' },
              ],
            },
          },
        },
      ],
    };
  }, [samples, recordStartTime, tick]);

  // 小图表配置生成器
  const createSmallChartOption = (dataKey: keyof typeof series, color: string): EChartsOption => {
    const data = (series[dataKey] || []).slice(windowStartIndex);
    
    return {
      animation: false,
      grid: {
        top: 10,
        left: 0,
        right: 0,
        bottom: 0,
        containLabel: false,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        show: false,
      },
      yAxis: {
        type: 'value',
        show: false,
      },
      series: [{
        type: 'line',
        showSymbol: false,
        data: data,
        lineStyle: { width: 2, color },
        smooth: 0.3,
      }],
    };
  };

  // 如果未连接设备，显示连接界面
  if (!connected) {
    return (
      <Layout showBackButton className="pt-36">
        {!supported ? (
          <Alert variant="destructive" className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-semibold mb-1">当前浏览器不支持蓝牙功能</div>
              <AlertDescription>
                请使用支持 Web Bluetooth 的浏览器（如 Chrome，需启用蓝牙）。
              </AlertDescription>
            </div>
          </Alert>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-300 p-12 space-y-4 text-center">
            <h2 className="text-2xl font-semibold text-slate-700">连接设备</h2>
            <p className="text-slate-600">点击下方按钮，通过浏览器弹窗选择设备并连接。</p>
            <Button
              onClick={async () => {
                try {
                  const device = await requestDevice();
                  await connectDevice(device);
                } catch {}
              }}
              className="h-12 px-8 bg-blue-500 hover:bg-blue-600 text-white font-semibold"
            >
              <Bluetooth className="w-5 h-5" />
              选择设备并连接
            </Button>
          </div>
        )}
      </Layout>
    );
  }

  return (
    <Layout showBackButton className="py-10 space-y-10">
        {/* 页面标题和控制按钮 */}
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-semibold text-gray-900">实时监测</h1>
            
            {/* 设备信息卡片 */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-2 h-12">
              <div className="w-12 h-8 bg-gray-300 rounded" />
              <span className="font-semibold text-blue-500">{connected.name || 'MindSensor'}</span>
              <span className={`font-semibold ${wearOk ? 'text-green-500' : 'text-red-500'}`}>
                {wearOk ? '佩戴正常' : '佩戴异常'}
              </span>
              <ChevronRight className="w-6 h-6 text-blue-500" />
            </div>
          </div>

          {/* 测试控制按钮 */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => clearData()}
              disabled={isRecording}
              className="h-12 px-5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              清空数据
            </Button>

            <Button
              onClick={() => {
                if (isRecording) {
                  handleStop();
                } else {
                  clearData();
                  startRecord();
                }
              }}
              disabled={!isRecording && !wearOk}
              className={`h-12 px-8 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'}`}
            >
              {isRecording && <X className="w-6 h-6" />}
              {isRecording ? '结束测试' : '开始测试'}
            </Button>
          </div>
        </div>

        {/* 主数据区域 */}
        <div className="flex gap-4">
          {/* 左侧：Y轴刻度 + 主图表 */}
          <div className="flex gap-4 flex-1">
            {/* Y轴刻度 */}
            <div className="flex flex-col justify-between text-slate-400 text-xl text-right pt-16 pb-7">
              <div>100</div>
              <div>80</div>
              <div>60</div>
              <div>40</div>
              <div>20</div>
              <div>0</div>
            </div>

            {/* 主图表区域 */}
            <div className="flex-1 flex flex-col gap-4">
              {/* 图表卡片 */}
              <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white h-[520px]">
                <div className="px-6 py-6 border-b border-slate-100">
                  <h3 className="text-xl font-semibold text-slate-600">脑波数据曲线</h3>
                </div>
                <div className="h-[428px] px-4">
                  {samples.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400">
                      {isRecording ? '等待数据...' : '点击"开始测试"按钮开始记录数据'}
                    </div>
                  ) : (
                    <ReactECharts
                      option={mainChartOption}
                      style={{ height: '100%', width: '100%' }}
                      notMerge={true}
                      lazyUpdate={true}
                    />
                  )}
                </div>
              </div>

              {/* 时间轴 */}
              <div className="flex items-center justify-between text-slate-400 text-xl font-semibold">
                <span>00:00</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>{isRecording ? '测试中' : '未开始'}</span>
                  <span>{testDuration}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：数据卡片 */}
          <div className="flex flex-col gap-4">
            <MetricCard title="综合分数" value={comprehensiveScore} valueColor="text-slate-900" />
            <MetricCard title="专注" value={focus} valueColor="text-blue-500" />
            <MetricCard title="放松" value={relax} valueColor="text-green-500" />
          </div>
        </div>

      {/* 脑波频段图表 */}
      <div className="grid grid-cols-3 gap-4">
        {WAVE_BANDS.map((band) => (
          <div key={band.key} className="border border-slate-300 rounded-2xl overflow-hidden bg-white">
            <div className="px-6 py-6 border-b border-slate-100">
              <h4 className="text-xl font-semibold text-slate-600">{band.label}</h4>
            </div>
            <div className="h-[171px] px-4 pb-4">
              {samples.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  暂无数据
                </div>
              ) : (
                <ReactECharts
                  option={createSmallChartOption(band.key as keyof typeof series, band.color)}
                  style={{ height: '100%', width: '100%' }}
                  notMerge={true}
                  lazyUpdate={true}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

