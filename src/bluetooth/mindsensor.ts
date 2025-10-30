import type { BluetoothDevice, SensorData1 } from '../types/bluetooth';
import { getSensorData } from '../utils/sensorParser';
import { useMonitorStore } from '../store/monitorStore';

// BLE UUID constants (lowercase)
const SERVICE_UUID = '039afff0-2c94-11e3-9e06-0002a5d5c51b';
const CHAR_WRITE_UUID = '039affa0-2c94-11e3-9e06-0002a5d5c51b';
const CHAR_NOTIFY_UUID = '039afff4-2c94-11e3-9e06-0002a5d5c51b';

const ENABLE_DATA = new Uint8Array([77, 71, 1]);

// Scanning related variables
let scanAbortController: AbortController | null = null;
let scanTimeout: ReturnType<typeof setTimeout> | null = null;

// Connection state
let part1: SensorData1 | undefined;
let isHalf = false;

// Check if browser supports Web Bluetooth
export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

// Permission state type
export type BluetoothPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

// Check if Permissions API is available
function isPermissionsApiAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as any).permissions?.query === 'function';
}

// Get Bluetooth permission state (best-effort: not supported in some browsers/configurations)
export async function getBluetoothPermissionState(): Promise<BluetoothPermissionState> {
  if (!isBluetoothSupported()) {
    return 'unknown';
  }
  try {
    if (!isPermissionsApiAvailable()) {
      return 'unknown';
    }
    const status = await (navigator as any).permissions.query({ name: 'bluetooth' } as any);
    const state: string = (status && (status.state || status.status)) || 'prompt';
    if (state === 'granted' || state === 'denied' || state === 'prompt') {
      return state as BluetoothPermissionState;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

// Request Bluetooth permission (by triggering browser permission/selection dialog). Requires user gesture click to trigger.
export async function requestBluetoothPermission(): Promise<BluetoothPermissionState> {
  if (!isBluetoothSupported()) {
    return 'unknown';
  }
  try {
    // Prefer using requestDevice to trigger permission grant (most compatible)
    await (navigator as any).bluetooth.requestDevice({
      filters: [{ namePrefix: 'Mindsensor_' }],
      optionalServices: [SERVICE_UUID],
    } as any);
    // User successfully selected device, consider it authorized
    return 'granted';
  } catch (error: any) {
    // User cancels or doesn't select device usually throws NotFoundError, consider it unauthorized (prompt)
    const name = error?.name || '';
    if (name === 'NotFoundError') {
      return 'prompt';
    }
    return 'denied';
  }
}

// Scan for devices (10 second timeout)
export async function startScan(durationMs = 10000): Promise<void> {
  if (!isBluetoothSupported()) {
    throw new Error('Current browser does not support Web Bluetooth API');
  }

  const store = useMonitorStore.getState();
  store.clearDevices();
  store.setScanning(true);

  // Check if requestLEScan is supported (Chrome experimental API)
  const bluetooth = (navigator as any).bluetooth as any;
  
  try {
    if (bluetooth.requestLEScan) {
      // Use experimental scan API
      scanAbortController = new AbortController();
      
      await bluetooth.requestLEScan({
        filters: [{ namePrefix: 'Mindsensor_' }],
        keepRepeatedDevices: false,
      });

      bluetooth.addEventListener('advertisementreceived', (event: any) => {
        const device = event.device as BluetoothDevice;
        if (device.name?.startsWith('Mindsensor_')) {
          store.addDevice(device);
        }
      }, { signal: scanAbortController.signal });

      // Automatically stop after 10 seconds
      scanTimeout = setTimeout(() => {
        stopScan();
      }, durationMs);
    } else {
      // Fallback: use requestDevice (will popup browser selection dialog)
      console.log('requestLEScan not available, please use requestDevice to manually select device');
      store.setScanning(false);
    }
  } catch (error) {
    console.error('Scan failed:', error);
    store.setScanning(false);
    throw error;
  }
}

// Stop scanning
export function stopScan(): void {
  if (scanAbortController) {
    scanAbortController.abort();
    scanAbortController = null;
  }
  
  if (scanTimeout) {
    clearTimeout(scanTimeout);
    scanTimeout = null;
  }
  
  const store = useMonitorStore.getState();
  store.setScanning(false);
}

// Manually select device (requestDevice method)
export async function requestDevice(): Promise<BluetoothDevice> {
  if (!isBluetoothSupported()) {
    throw new Error('Current browser does not support Web Bluetooth API');
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      filters: [{ namePrefix: 'Mindsensor_' }],
      optionalServices: [SERVICE_UUID],
    }) as BluetoothDevice;

    return device;
  } catch (error) {
    console.error('Failed to select device:', error);
    throw error;
  }
}

// Connect device and start data transmission
export async function connectDevice(device: BluetoothDevice): Promise<void> {
  const store = useMonitorStore.getState();
  
  // If currently scanning, stop first
  if (store.scanning) {
    stopScan();
  }

  store.setConnecting(device.id);

  try {
    // Connect to GATT server
    const server = await device.gatt!.connect();
    console.log('Connected to GATT server');

    // Get primary service
    const service = await server.getPrimaryService(SERVICE_UUID);
    console.log('Retrieved primary service');

    // Get write characteristic
    const writeChar = await service.getCharacteristic(CHAR_WRITE_UUID);
    
    // Write start command
    await writeChar.writeValue(ENABLE_DATA);
    console.log('Wrote start command');

    // Get notification characteristic
    const notifyChar = await service.getCharacteristic(CHAR_NOTIFY_UUID);
    
    // Start notifications
    await notifyChar.startNotifications();
    console.log('Started notifications');

    // Listen for data
    notifyChar.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);

    // Listen for disconnection
    device.addEventListener('gattserverdisconnected', handleDisconnect);

    // Update state
    store.setConnected(device);
    
    // Persist connection info (for subsequent page display or debugging)
    try {
      const info = {
        id: device.id,
        name: device.name || '',
        connectedAt: Date.now(),
      };
      localStorage.setItem('lastConnectedDevice', JSON.stringify(info));
    } catch {}
    
    // Reset packet state
    part1 = undefined;
    isHalf = false;

  } catch (error) {
    console.error('Connection failed:', error);
    store.setConnecting(undefined);
    throw error;
  }
}

// Handle characteristic value change (receive data)
function handleCharacteristicValueChanged(event: Event): void {
  const target = event.target as any;
  const dv = target.value as DataView;
  // Ensure standard ArrayBuffer to avoid SharedArrayBuffer type mismatch
  const bytes = new Uint8Array(dv.byteLength);
  bytes.set(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength));
  const ab = bytes.buffer;
  
  const data = getSensorData(ab);
  if (!data) return;

  const store = useMonitorStore.getState();

  if ('sq' in data) {
    // First segment data: contains sq, focus, relax and first 4 bands
    part1 = data;
    isHalf = true;
    store.onSensorData1(data.sq, data.focus, data.relax);
  } else if (isHalf && part1) {
    // Second segment data: merge
    const fullData = { ...part1, ...data };
    isHalf = false;
    part1 = undefined;
    store.onFullSensorData(fullData);
  }
}

// Handle disconnection
function handleDisconnect(): void {
  console.log('Device disconnected');
  const store = useMonitorStore.getState();
  store.disconnect();
  
  // Reset packet state
  part1 = undefined;
  isHalf = false;
}

// Actively disconnect device
export async function disconnectDevice(device?: BluetoothDevice): Promise<void> {
  const store = useMonitorStore.getState();
  const targetDevice = device || store.connected;
  
  if (!targetDevice || !targetDevice.gatt) {
    return;
  }

  try {
    // Remove event listener
    targetDevice.removeEventListener('gattserverdisconnected', handleDisconnect);
    
    // Disconnect
    if (targetDevice.gatt.connected) {
      targetDevice.gatt.disconnect();
    }
    
    store.disconnect();
    
    // Reset packet state
    part1 = undefined;
    isHalf = false;
  } catch (error) {
    console.error('Failed to disconnect:', error);
  }
}

// Periodic disconnection check (can be called in components)
export function setupDropCheckInterval(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    const store = useMonitorStore.getState();
    store.checkDropConnection();
  }, 1000);
}

