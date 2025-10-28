import type { MeditationRecord } from '../types/meditation';

const STORAGE_KEY = 'meditation_records_cache';

export function getCachedRecords(): MeditationRecord[] {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return [];
    return JSON.parse(cached) as MeditationRecord[];
  } catch (error) {
    console.warn('Failed to load cached records', error);
    return [];
  }
}

export function setCachedRecords(records: MeditationRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn('Failed to cache records', error);
  }
}

export function appendRecord(record: MeditationRecord): void {
  const records = getCachedRecords();
  // Add new record at the beginning
  const updated = [record, ...records];
  // Keep only the most recent 100 records
  const trimmed = updated.slice(0, 100);
  setCachedRecords(trimmed);
}

export function clearCachedRecords(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear cached records', error);
  }
}

export function mergeRecords(
  onChainRecords: MeditationRecord[],
  cachedRecords: MeditationRecord[],
): MeditationRecord[] {
  // Create a map of on-chain records by signature
  const onChainMap = new Map(
    onChainRecords.map(record => [record.txSignature, record])
  );

  // Start with on-chain records
  const merged = [...onChainRecords];

  // Add cached records that are not on-chain yet (pending)
  for (const cached of cachedRecords) {
    if (!onChainMap.has(cached.txSignature) && cached.status === 'pending') {
      merged.push(cached);
    }
  }

  // Sort by timestamp (most recent first)
  merged.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

  return merged;
}
