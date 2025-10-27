// Web Bluetooth API 类型扩展
export interface BluetoothDevice {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

export interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

export interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

export interface BluetoothRemoteGATTCharacteristic {
  writeValue(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

// Mindsensor 数据类型
export interface SensorData1 {
  sq: number;
  focus: number;
  relax: number;
  delta: number;
  theta: number;
  lowAlpha: number;
  highAlpha: number;
}

export interface SensorData2 {
  lowBeta: number;
  highBeta: number;
  lowGamma: number;
  highGamma: number;
}

export type SensorData = SensorData1 & SensorData2;

// 录制数据点
export interface DataPoint {
  t: number; // 时间戳
  focus: number;
  relax: number;
}

// 序列数据
export interface SeriesData {
  focus: number[];
  relax: number[];
  delta: number[];
  theta: number[];
  lowAlpha: number[];
  highAlpha: number[];
  lowBeta: number[];
  highBeta: number[];
  lowGamma: number[];
  highGamma: number[];
}


export {};

