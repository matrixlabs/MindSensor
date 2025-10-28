import { create } from 'zustand';
import type { BluetoothDevice, SensorData, DataPoint, SeriesData } from '../types/bluetooth';
import type { MeditationEvaluation, MeditationRecord } from '../types/meditation';

type ConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected';

interface MonitorState {
  // 连接状态
  connectionState: ConnectionState;
  scanning: boolean;
  devices: BluetoothDevice[];
  connectingId?: string;
  connected?: BluetoothDevice;

  // 数据状态
  lastDataTs?: number;
  possibleDrop: boolean;
  wearOk: boolean;
  focus: number;
  relax: number;
  currentSensor: SensorData | null;

  // 录制状态
  isRecording: boolean;
  recordStartTime?: number;
  samples: DataPoint[];
  series: SeriesData;

  // 区块链状态
  evaluation: MeditationEvaluation | null;
  isSubmitting: boolean;
  submissionError: string | null;
  lastSubmittedRecord: MeditationRecord | null;

  // 动作
  setScanning: (scanning: boolean) => void;
  addDevice: (device: BluetoothDevice) => void;
  clearDevices: () => void;
  setConnecting: (deviceId?: string) => void;
  setConnected: (device?: BluetoothDevice) => void;

  onSensorData1: (sq: number, focus: number, relax: number) => void;
  onFullSensorData: (data: SensorData) => void;
  checkDropConnection: () => void;

  startRecord: () => void;
  stopRecord: () => void;
  clearData: () => void;

  // 区块链动作
  setEvaluation: (evaluation: MeditationEvaluation | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setSubmissionError: (error: string | null) => void;
  setLastSubmittedRecord: (record: MeditationRecord | null) => void;

  disconnect: () => void;
  reset: () => void;
}

const initialSeriesData: SeriesData = {
  focus: [],
  relax: [],
  delta: [],
  theta: [],
  lowAlpha: [],
  highAlpha: [],
  lowBeta: [],
  highBeta: [],
  lowGamma: [],
  highGamma: [],
};

export const useMonitorStore = create<MonitorState>((set, get) => ({
  // 初始状态
  connectionState: 'idle',
  scanning: false,
  devices: [],
  possibleDrop: false,
  wearOk: false,
  focus: 0,
  relax: 0,
  currentSensor: null,
  isRecording: false,
  samples: [],
  series: { ...initialSeriesData },

  // 区块链初始状态
  evaluation: null,
  isSubmitting: false,
  submissionError: null,
  lastSubmittedRecord: null,
  
  // 扫描相关
  setScanning: (scanning) => {
    set({
      scanning,
      connectionState: scanning ? 'scanning' : get().connected ? 'connected' : 'idle',
    });
  },
  
  addDevice: (device) => {
    const { devices } = get();
    // 避免重复添加
    if (!devices.find(d => d.id === device.id)) {
      set({ devices: [...devices, device] });
    }
  },
  
  clearDevices: () => set({ devices: [] }),
  
  // 连接相关
  setConnecting: (deviceId) => {
    set({
      connectingId: deviceId,
      connectionState: deviceId ? 'connecting' : get().connectionState,
    });
  },
  
  setConnected: (device) => {
    set({
      connected: device,
      connectingId: undefined,
      connectionState: device ? 'connected' : 'idle',
      possibleDrop: false,
    });
  },
  
  // 数据处理
  onSensorData1: (sq, focus, relax) => {
    set({
      wearOk: sq === 0,
      focus,
      relax,
      lastDataTs: Date.now(),
      possibleDrop: false,
    });
  },
  
  onFullSensorData: (data) => {
    const { isRecording, samples, series } = get();
    const now = Date.now();
    
    // 控制台打印每秒的数据
    console.log('📊 传感器数据:', {
      时间: new Date(now).toLocaleTimeString(),
      佩戴状态: data.sq === 0 ? '✅ 正常' : '❌ 不正常',
      专注度: data.focus,
      放松度: data.relax,
      脑波频段: {
        Delta: data.delta,
        Theta: data.theta,
        '低α波': data.lowAlpha,
        '高α波': data.highAlpha,
        '低β波': data.lowBeta,
        '高β波': data.highBeta,
        '低γ波': data.lowGamma,
        '高γ波': data.highGamma,
      },
      录制中: isRecording ? '🔴 是' : '⚪️ 否',
    });
    
    set({
      currentSensor: data,
      lastDataTs: now,
      possibleDrop: false,
      focus: data.focus,
      relax: data.relax,
    });
    
    if (isRecording) {
      // 添加数据点
      set({
        samples: [...samples, { t: now, focus: data.focus, relax: data.relax }],
        series: {
          focus: [...series.focus, data.focus],
          relax: [...series.relax, data.relax],
          delta: [...series.delta, data.delta],
          theta: [...series.theta, data.theta],
          lowAlpha: [...series.lowAlpha, data.lowAlpha],
          highAlpha: [...series.highAlpha, data.highAlpha],
          lowBeta: [...series.lowBeta, data.lowBeta],
          highBeta: [...series.highBeta, data.highBeta],
          lowGamma: [...series.lowGamma, data.lowGamma],
          highGamma: [...series.highGamma, data.highGamma],
        },
      });
    }
  },
  
  checkDropConnection: () => {
    const { lastDataTs, connected } = get();
    if (connected && lastDataTs && Date.now() - lastDataTs > 3000) {
      set({ possibleDrop: true });
    }
  },
  
  // 录制控制
  startRecord: () => {
    set({
      isRecording: true,
      recordStartTime: Date.now(),
      // 清除之前的区块链状态，开始新的记录
      evaluation: null,
      submissionError: null,
      lastSubmittedRecord: null,
    });
  },
  
  stopRecord: () => {
    set({ isRecording: false });
  },
  
  clearData: () => {
    set({
      samples: [],
      series: { ...initialSeriesData },
      recordStartTime: undefined,
      currentSensor: null,
      evaluation: null,
      submissionError: null,
      lastSubmittedRecord: null,
    });
  },

  // 区块链动作
  setEvaluation: (evaluation) => {
    set({ evaluation });
  },

  setSubmitting: (isSubmitting) => {
    set({ isSubmitting });
  },

  setSubmissionError: (error) => {
    set({ submissionError: error });
  },

  setLastSubmittedRecord: (record) => {
    set({ lastSubmittedRecord: record });
  },

  // 断开连接
  disconnect: () => {
    set({
      connected: undefined,
      connectionState: 'idle',
      possibleDrop: false,
      isRecording: false,
    });
  },
  
  // 重置所有状态
  reset: () => {
    set({
      connectionState: 'idle',
      scanning: false,
      devices: [],
      connectingId: undefined,
      connected: undefined,
      lastDataTs: undefined,
      possibleDrop: false,
      wearOk: false,
      focus: 0,
      relax: 0,
      currentSensor: null,
      isRecording: false,
      recordStartTime: undefined,
      samples: [],
      series: { ...initialSeriesData },
      evaluation: null,
      isSubmitting: false,
      submissionError: null,
      lastSubmittedRecord: null,
    });
  },
}));

