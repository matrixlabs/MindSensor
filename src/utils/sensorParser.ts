import type { SensorData, SensorData1, SensorData2 } from '../types/bluetooth';

// 辅助函数：从 3 字节提取整数（大端）
const get3 = (arr: Uint8Array, idx: number): number => {
  return (arr[idx]! << 16) + (arr[idx + 1]! << 8) + arr[idx + 2]!;
};

// 调试用：打印十六进制字符串
export const toPrint = (d: Uint8Array): string => {
  let a = '';
  for (let i = 0; i < d.length; i++) {
    a += ('00' + d[i]!.toString(16)).slice(-2);
  }
  return a;
};

// 解析传感器数据
export function getSensorData(buf: ArrayBuffer): SensorData1 | SensorData2 | null {
  const d = new Uint8Array(buf);

  if (d.length < 4) {
    console.log('数据长度不足', toPrint(d));
    return null;
  }

  // 提取前 4 字节作为前缀
  let prefix = '';
  for (let i = 0; i < 4; i++) {
    prefix += ('00' + d[i]!.toString(16)).slice(-2);
  }

  switch (prefix) {
    case 'aa01010f': {
      // 第一段数据：sq + focus/relax + 前 4 个频段
      if (d.length < 19) {
        console.log('数据1长度不足', toPrint(d));
        return null;
      }

      if (d[4] !== 0) {
        return null;
      }

      return {
        sq: d[4]!,
        focus: d[5]!,
        relax: d[6]!,
        delta: Math.round((get3(d, 7) / 50) * 3),
        theta: Math.round(get3(d, 10) / 3),
        lowAlpha: get3(d, 13),
        highAlpha: get3(d, 16),
      };
    }

    case 'aa01020c': {
      // 第二段数据：后 4 个频段
      if (d.length < 16) {
        console.log('数据2长度不足', toPrint(d));
        return null;
      }

      return {
        lowBeta: get3(d, 4),
        highBeta: get3(d, 7),
        lowGamma: get3(d, 10),
        highGamma: get3(d, 13),
      };
    }

    default:
      return null;
  }
}

// 计算总和
export const total = (s: SensorData): number =>
  s.delta + s.theta + s.lowAlpha + s.highAlpha + s.lowBeta + s.highBeta + s.lowGamma + s.highGamma;

// 计算比例
export const rate = (v1: number, v2: number): number => {
  if (v2 === 0) return 0;
  return Math.round((v1 * 100) / v2);
};

// 归一化到 0-100
export const normalize = (n: number): number => {
  return Math.max(0, Math.min(100, Math.round(n)));
};

