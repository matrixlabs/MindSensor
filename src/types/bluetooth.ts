// Web Bluetooth API type extensions
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

// Mindsensor data types
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

// Recording data point
export interface DataPoint {
  t: number; // Timestamp
  focus: number;
  relax: number;
}

// Series data
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

