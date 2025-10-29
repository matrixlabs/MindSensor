import type { SensorData, SensorData1, SensorData2 } from '../types/bluetooth';

// Helper function: extract integer from 3 bytes (big-endian)
const get3 = (arr: Uint8Array, idx: number): number => {
  return (arr[idx]! << 16) + (arr[idx + 1]! << 8) + arr[idx + 2]!;
};

// For debugging: print hexadecimal string
export const toPrint = (d: Uint8Array): string => {
  let a = '';
  for (let i = 0; i < d.length; i++) {
    a += ('00' + d[i]!.toString(16)).slice(-2);
  }
  return a;
};

// Parse sensor data
export function getSensorData(buf: ArrayBuffer): SensorData1 | SensorData2 | null {
  const d = new Uint8Array(buf);

  if (d.length < 4) {
    console.log('Insufficient data length', toPrint(d));
    return null;
  }

  // Extract first 4 bytes as prefix
  let prefix = '';
  for (let i = 0; i < 4; i++) {
    prefix += ('00' + d[i]!.toString(16)).slice(-2);
  }

  switch (prefix) {
    case 'aa01010f': {
      // First segment data: sq + focus/relax + first 4 bands
      if (d.length < 19) {
        console.log('Segment 1 insufficient data length', toPrint(d));
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
      // Second segment data: last 4 bands
      if (d.length < 16) {
        console.log('Segment 2 insufficient data length', toPrint(d));
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

// Calculate sum
export const total = (s: SensorData): number =>
  s.delta + s.theta + s.lowAlpha + s.highAlpha + s.lowBeta + s.highBeta + s.lowGamma + s.highGamma;

// Calculate ratio
export const rate = (v1: number, v2: number): number => {
  if (v2 === 0) return 0;
  return Math.round((v1 * 100) / v2);
};

// Normalize to 0-100
export const normalize = (n: number): number => {
  return Math.max(0, Math.min(100, Math.round(n)));
};

