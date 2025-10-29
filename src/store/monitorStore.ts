import { create } from 'zustand';
import type { BluetoothDevice, SensorData, DataPoint, SeriesData } from '../types/bluetooth';
import type { MeditationEvaluation, MeditationRecord } from '../types/meditation';

type ConnectionState = 'idle' | 'scanning' | 'connecting' | 'connected';

interface MonitorState {
  // Connection state
  connectionState: ConnectionState;
  scanning: boolean;
  devices: BluetoothDevice[];
  connectingId?: string;
  connected?: BluetoothDevice;

  // Data state
  lastDataTs?: number;
  possibleDrop: boolean;
  wearOk: boolean;
  focus: number;
  relax: number;
  currentSensor: SensorData | null;

  // Recording state
  isRecording: boolean;
  recordStartTime?: number;
  samples: DataPoint[];
  series: SeriesData;

  // Blockchain state
  evaluation: MeditationEvaluation | null;
  isSubmitting: boolean;
  submissionError: string | null;
  lastSubmittedRecord: MeditationRecord | null;

  // Actions
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

  // Blockchain actions
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
  // Initial state
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

  // Blockchain initial state
  evaluation: null,
  isSubmitting: false,
  submissionError: null,
  lastSubmittedRecord: null,
  
  // Scanning related
  setScanning: (scanning) => {
    set({
      scanning,
      connectionState: scanning ? 'scanning' : get().connected ? 'connected' : 'idle',
    });
  },
  
  addDevice: (device) => {
    const { devices } = get();
    // Avoid duplicate additions
    if (!devices.find(d => d.id === device.id)) {
      set({ devices: [...devices, device] });
    }
  },
  
  clearDevices: () => set({ devices: [] }),
  
  // Connection related
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
  
  // Data processing
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
    
    // Console print data every second
    console.log('📊 Sensor data:', {
      Time: new Date(now).toLocaleTimeString(),
      'Wearing status': data.sq === 0 ? '✅ Normal' : '❌ Abnormal',
      Focus: data.focus,
      Relaxation: data.relax,
      'EEG bands': {
        Delta: data.delta,
        Theta: data.theta,
        'Low α wave': data.lowAlpha,
        'High α wave': data.highAlpha,
        'Low β wave': data.lowBeta,
        'High β wave': data.highBeta,
        'Low γ wave': data.lowGamma,
        'High γ wave': data.highGamma,
      },
      Recording: isRecording ? '🔴 Yes' : '⚪️ No',
    });
    
    set({
      currentSensor: data,
      lastDataTs: now,
      possibleDrop: false,
      focus: data.focus,
      relax: data.relax,
    });
    
    if (isRecording) {
      // Add data point
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
  
  // Recording control
  startRecord: () => {
    set({
      isRecording: true,
      recordStartTime: Date.now(),
      // Clear previous blockchain state, start new record
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

  // Blockchain actions
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

  // Disconnect
  disconnect: () => {
    set({
      connected: undefined,
      connectionState: 'idle',
      possibleDrop: false,
      isRecording: false,
    });
  },
  
  // Reset all state
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

