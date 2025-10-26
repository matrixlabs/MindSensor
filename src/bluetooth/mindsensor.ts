import type { BluetoothDevice, SensorData1 } from '../types/bluetooth';
import { getSensorData } from '../utils/sensorParser';
import { useMonitorStore } from '../store/monitorStore';

// BLE UUID 常量（转为小写）
const SERVICE_UUID = '039afff0-2c94-11e3-9e06-0002a5d5c51b';
const CHAR_WRITE_UUID = '039affa0-2c94-11e3-9e06-0002a5d5c51b';
const CHAR_NOTIFY_UUID = '039afff4-2c94-11e3-9e06-0002a5d5c51b';

const ENABLE_DATA = new Uint8Array([77, 71, 1]);

// 扫描相关变量
let scanAbortController: AbortController | null = null;
let scanTimeout: ReturnType<typeof setTimeout> | null = null;

// 连接状态
let part1: SensorData1 | undefined;
let isHalf = false;

// 检查浏览器是否支持 Web Bluetooth
export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

// 权限状态类型
export type BluetoothPermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

// 检查 Permissions API 是否可用
function isPermissionsApiAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof (navigator as any).permissions?.query === 'function';
}

// 获取蓝牙权限状态（尽力而为：某些浏览器/配置下不支持）
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

// 申请蓝牙权限（通过触发浏览器权限/选择框）。需要用户手势点击触发。
export async function requestBluetoothPermission(): Promise<BluetoothPermissionState> {
  if (!isBluetoothSupported()) {
    return 'unknown';
  }
  try {
    // 优先尝试使用 requestDevice 触发权限授予（最兼容）
    await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Mindsensor_' }],
      optionalServices: [SERVICE_UUID],
    } as any);
    // 用户成功选择设备，视为已授权
    return 'granted';
  } catch (error: any) {
    // 用户取消或未选择设备通常抛出 NotFoundError，将其视为尚未授权（prompt）
    const name = error?.name || '';
    if (name === 'NotFoundError') {
      return 'prompt';
    }
    return 'denied';
  }
}

// 扫描设备（10 秒超时）
export async function startScan(durationMs = 10000): Promise<void> {
  if (!isBluetoothSupported()) {
    throw new Error('当前浏览器不支持 Web Bluetooth API');
  }

  const store = useMonitorStore.getState();
  store.clearDevices();
  store.setScanning(true);

  // 检查是否支持 requestLEScan（Chrome 实验性 API）
  const bluetooth = navigator.bluetooth as any;
  
  try {
    if (bluetooth.requestLEScan) {
      // 使用实验性扫描 API
      scanAbortController = new AbortController();
      
      const scan = await bluetooth.requestLEScan({
        filters: [{ namePrefix: 'Mindsensor_' }],
        keepRepeatedDevices: false,
      });

      bluetooth.addEventListener('advertisementreceived', (event: any) => {
        const device = event.device as BluetoothDevice;
        if (device.name?.startsWith('Mindsensor_')) {
          store.addDevice(device);
        }
      }, { signal: scanAbortController.signal });

      // 10 秒后自动停止
      scanTimeout = setTimeout(() => {
        stopScan();
      }, durationMs);
    } else {
      // 退化方案：使用 requestDevice（会弹出浏览器选择框）
      console.log('requestLEScan 不可用，请使用 requestDevice 手动选择设备');
      store.setScanning(false);
    }
  } catch (error) {
    console.error('扫描失败:', error);
    store.setScanning(false);
    throw error;
  }
}

// 停止扫描
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

// 手动选择设备（requestDevice 方式）
export async function requestDevice(): Promise<BluetoothDevice> {
  if (!isBluetoothSupported()) {
    throw new Error('当前浏览器不支持 Web Bluetooth API');
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'Mindsensor_' }],
      optionalServices: [SERVICE_UUID],
    }) as BluetoothDevice;

    return device;
  } catch (error) {
    console.error('选择设备失败:', error);
    throw error;
  }
}

// 连接设备并启动数据传输
export async function connectDevice(device: BluetoothDevice): Promise<void> {
  const store = useMonitorStore.getState();
  
  // 如果正在扫描，先停止
  if (store.scanning) {
    stopScan();
  }

  store.setConnecting(device.id);

  try {
    // 连接 GATT 服务器
    const server = await device.gatt!.connect();
    console.log('已连接到 GATT 服务器');

    // 获取主服务
    const service = await server.getPrimaryService(SERVICE_UUID);
    console.log('已获取主服务');

    // 获取写入特征
    const writeChar = await service.getCharacteristic(CHAR_WRITE_UUID);
    
    // 写入启动命令
    await writeChar.writeValue(ENABLE_DATA);
    console.log('已写入启动命令');

    // 获取通知特征
    const notifyChar = await service.getCharacteristic(CHAR_NOTIFY_UUID);
    
    // 启动通知
    await notifyChar.startNotifications();
    console.log('已启动通知');

    // 监听数据
    notifyChar.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);

    // 监听断开连接
    device.addEventListener('gattserverdisconnected', handleDisconnect);

    // 更新状态
    store.setConnected(device);
    
    // 持久化连接信息（供后续页面展示或调试）
    try {
      const info = {
        id: device.id,
        name: device.name || '',
        connectedAt: Date.now(),
      };
      localStorage.setItem('lastConnectedDevice', JSON.stringify(info));
    } catch {}
    
    // 重置合包状态
    part1 = undefined;
    isHalf = false;

  } catch (error) {
    console.error('连接失败:', error);
    store.setConnecting(undefined);
    throw error;
  }
}

// 处理特征值变化（接收数据）
function handleCharacteristicValueChanged(event: Event): void {
  const target = event.target as any;
  const dv = target.value as DataView;
  const ab = dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength);
  
  const data = getSensorData(ab);
  if (!data) return;

  const store = useMonitorStore.getState();

  if ('sq' in data) {
    // 第一段数据：包含 sq、focus、relax 和前 4 个频段
    part1 = data;
    isHalf = true;
    store.onSensorData1(data.sq, data.focus, data.relax);
  } else if (isHalf && part1) {
    // 第二段数据：合并
    const fullData = { ...part1, ...data };
    isHalf = false;
    part1 = undefined;
    store.onFullSensorData(fullData);
  }
}

// 处理断开连接
function handleDisconnect(): void {
  console.log('设备已断开连接');
  const store = useMonitorStore.getState();
  store.disconnect();
  
  // 重置合包状态
  part1 = undefined;
  isHalf = false;
}

// 主动断开设备
export async function disconnectDevice(device?: BluetoothDevice): Promise<void> {
  const store = useMonitorStore.getState();
  const targetDevice = device || store.connected;
  
  if (!targetDevice || !targetDevice.gatt) {
    return;
  }

  try {
    // 移除事件监听
    targetDevice.removeEventListener('gattserverdisconnected', handleDisconnect);
    
    // 断开连接
    if (targetDevice.gatt.connected) {
      targetDevice.gatt.disconnect();
    }
    
    store.disconnect();
    
    // 重置合包状态
    part1 = undefined;
    isHalf = false;
  } catch (error) {
    console.error('断开连接失败:', error);
  }
}

// 定期检查掉线（可在组件中调用）
export function setupDropCheckInterval(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    const store = useMonitorStore.getState();
    store.checkDropConnection();
  }, 1000);
}

