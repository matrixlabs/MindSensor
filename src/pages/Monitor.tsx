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

// EEG frequency band configuration
const WAVE_BANDS = [
  { key: 'delta', label: 'δ Wave (Delta) | Sleep Wave', color: '#fcd34d' },
  { key: 'theta', label: 'θ Wave (Theta) | Light Sleep Wave', color: '#fca5a5' },
  { key: 'lowAlpha', label: 'Low α Wave (Low Alpha) | Relaxation Wave', color: '#86efac' },
  { key: 'highAlpha', label: 'High α Wave (High Alpha) | Alert Relaxation', color: '#93c5fd' },
  { key: 'lowBeta', label: 'Low β Wave (Low Beta) | Focused Thinking', color: '#cbd5e1' },
  { key: 'highBeta', label: 'High β Wave (High Beta) | High Alertness', color: '#475569' },
  { key: 'lowGamma', label: 'Low γ Wave (Low Gamma) | Cognitive Processing', color: '#93c5fd' },
  { key: 'highGamma', label: 'High γ Wave (High Gamma) | Advanced Cognition', color: '#cbd5e1' },
];

export default function Monitor() {
  const navigate = useNavigate();
  const [supported, setSupported] = useState<boolean>(true);
  const [tick, setTick] = useState(0); // Used to force test duration updates
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

  // Index for the last 1 minute window (for small charts)
  const windowStartIndex = useMemo(() => {
    if (samples.length === 0) return 0;
    const cutoff = Date.now() - 60000;
    const idx = samples.findIndex(s => s.t >= cutoff);
    return idx === -1 ? samples.length : idx;
  }, [samples, tick]);

  useEffect(() => {
    // Set up disconnection check timer
    const interval = setupDropCheckInterval();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // When entering the page, only check for support (no auto-scan, browser selection instead)
    const init = async () => {
      const sup = isBluetoothSupported();
      setSupported(sup);
    };
    init();
  }, []);

  // Update every second to refresh test duration
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

  // Calculate composite score (average of focus and relaxation values)
  const comprehensiveScore = useMemo(() => {
    if (samples.length === 0) return 0;
    const avgFocus = samples.reduce((sum, s) => sum + s.focus, 0) / samples.length;
    const avgRelax = samples.reduce((sum, s) => sum + s.relax, 0) / samples.length;
    return Math.round((avgFocus + avgRelax) / 2);
  }, [samples]);

  // Calculate test duration
  const testDuration = useMemo(() => {
    if (!recordStartTime) return '00:00';
    const duration = Math.floor((Date.now() - recordStartTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [recordStartTime, tick]);

  // Main chart configuration
  const mainChartOption: EChartsOption = useMemo(() => {
    const now = Date.now();
    const windowStart = now - 60000; // Only show last 1 minute
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

  // Small chart configuration generator
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

  // If device is not connected, display connection interface
  if (!connected) {
    return (
      <Layout showBackButton className="pt-36">
        {!supported ? (
          <Alert variant="destructive" className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 mt-0.5" />
            <div>
              <div className="font-semibold mb-1">Current browser does not support Bluetooth</div>
              <AlertDescription>
                Please use a browser that supports Web Bluetooth (e.g., Chrome with Bluetooth enabled).
              </AlertDescription>
            </div>
          </Alert>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-300 p-12 space-y-4 text-center">
            <h2 className="text-2xl font-semibold text-slate-700">Connect Device</h2>
            <p className="text-slate-600">Click the button below to select and connect device via browser popup.</p>
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
              Select Device and Connect
            </Button>
          </div>
        )}
      </Layout>
    );
  }

  return (
    <Layout showBackButton className="py-10 space-y-10">
        {/* Page title and control buttons */}
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-semibold text-gray-900">Real-time Monitoring</h1>
            
            {/* Device info card */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-2 h-12">
              <div className="w-12 h-8 bg-gray-300 rounded" />
              <span className="font-semibold text-blue-500">{connected.name || 'MindSensor'}</span>
              <span className={`font-semibold ${wearOk ? 'text-green-500' : 'text-red-500'}`}>
                {wearOk ? 'Wearing Normal' : 'Wearing Abnormal'}
              </span>
              <ChevronRight className="w-6 h-6 text-blue-500" />
            </div>
          </div>

          {/* Test control buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => clearData()}
              disabled={isRecording}
              className="h-12 px-5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="w-5 h-5" />
              Clear Data
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
              {isRecording ? 'End Test' : 'Start Test'}
            </Button>
          </div>
        </div>

        {/* Main data area */}
        <div className="flex gap-4">
          {/* Left: Y-axis scale + main chart */}
          <div className="flex gap-4 flex-1">
            {/* Y-axis scale */}
            <div className="flex flex-col justify-between text-slate-400 text-xl text-right pt-16 pb-7">
              <div>100</div>
              <div>80</div>
              <div>60</div>
              <div>40</div>
              <div>20</div>
              <div>0</div>
            </div>

            {/* Main chart area */}
            <div className="flex-1 flex flex-col gap-4">
              {/* Chart card */}
              <div className="border border-slate-300 rounded-2xl overflow-hidden bg-white h-[520px]">
                <div className="px-6 py-6 border-b border-slate-100">
                  <h3 className="text-xl font-semibold text-slate-600">EEG Data Curve</h3>
                </div>
                <div className="h-[428px] px-4">
                  {samples.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400">
                      {isRecording ? 'Waiting for data...' : 'Click "Start Test" button to begin recording data'}
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

              {/* Timeline */}
              <div className="flex items-center justify-between text-slate-400 text-xl font-semibold">
                <span>00:00</span>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span>{isRecording ? 'Testing' : 'Not Started'}</span>
                  <span>{testDuration}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Data cards */}
          <div className="flex flex-col gap-4">
            <MetricCard title="Composite Score" value={comprehensiveScore} valueColor="text-slate-900" />
            <MetricCard title="Focus" value={focus} valueColor="text-blue-500" />
            <MetricCard title="Relaxation" value={relax} valueColor="text-green-500" />
          </div>
        </div>

      {/* EEG frequency band charts */}
      <div className="grid grid-cols-3 gap-4">
        {WAVE_BANDS.map((band) => (
          <div key={band.key} className="border border-slate-300 rounded-2xl overflow-hidden bg-white">
            <div className="px-6 py-6 border-b border-slate-100">
              <h4 className="text-xl font-semibold text-slate-600">{band.label}</h4>
            </div>
            <div className="h-[171px] px-4 pb-4">
              {samples.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No Data Available
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

