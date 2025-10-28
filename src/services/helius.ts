import { clusterApiUrl } from '@solana/web3.js';
import type { MeditationRecord } from '../types/meditation';

const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

interface RpcRequest {
  method: string;
  params: unknown[];
}

interface SignatureInfo {
  signature: string;
  blockTime?: number;
  err: unknown;
  memo?: string | null;
}

interface FetchParams {
  address: string;
  limit?: number;
  before?: string;
}

function getRpcEndpoint(): string {
  const customRpc = import.meta.env.VITE_SOLANA_RPC_ENDPOINT;
  if (customRpc) {
    return customRpc;
  }
  const heliusKey = import.meta.env.VITE_HELIUS_API_KEY;
  if (heliusKey) {
    return `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;
  }
  return clusterApiUrl('devnet');
}

async function callRpc<T>({ method, params }: RpcRequest): Promise<T> {
  const response = await fetch(getRpcEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `meditation-${method}`,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC ${method} failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message ?? 'RPC error');
  }

  return payload.result as T;
}

function decodeMemoData(instruction: any): string | null {
  if (!instruction) return null;

  // Try parsed memo field
  if (instruction.parsed?.info?.memo) {
    return instruction.parsed.info.memo as string;
  }

  // Try string parsed field
  if (typeof instruction.parsed === 'string') {
    return instruction.parsed;
  }

  // Try base64 data
  const base64Data =
    instruction.parsed?.data ?? instruction.data ?? instruction.parsed?.info?.data;
  if (typeof base64Data === 'string') {
    try {
      return atob(base64Data);
    } catch (err) {
      console.warn('Failed to decode memo data', err);
      return null;
    }
  }

  return null;
}

export async function fetchMeditationInscriptions({
  address,
  limit = 20,
  before,
}: FetchParams): Promise<MeditationRecord[]> {
  const options: Record<string, unknown> = { limit };
  if (before) {
    options.before = before;
  }

  const signatures = await callRpc<SignatureInfo[]>({
    method: 'getSignaturesForAddress',
    params: [address, options],
  });

  const memoRecords: MeditationRecord[] = [];

  for (const sigInfo of signatures) {
    // Try to parse memo from signature info first (faster)
    if (sigInfo.memo && typeof sigInfo.memo === 'string') {
      try {
        const parsedMemo = JSON.parse(sigInfo.memo.replace(/^\[\d+\]\s*/, ''));
        if (parsedMemo.protocol === 'meditation-inscription-v1') {
          memoRecords.push({
            ...parsedMemo,
            txSignature: sigInfo.signature,
            status: sigInfo.err ? 'failed' : 'confirmed',
            blockTime: sigInfo.blockTime,
          });
          continue;
        }
      } catch (err) {
        // fall through to fetch transaction if memo field was not parseable
      }
    }

    // Fetch full transaction to get memo data
    try {
      const tx = await callRpc<any>({
        method: 'getTransaction',
        params: [sigInfo.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }],
      });

      const instructions =
        tx?.transaction?.message?.instructions ??
        tx?.result?.transaction?.message?.instructions ??
        tx?.value?.transaction?.message?.instructions ??
        [];

      const memoInstruction = instructions.find(
        (ix: any) =>
          ix.programId === MEMO_PROGRAM_ID ||
          ix.program === 'spl-memo' ||
          ix.parsed?.type === 'memo',
      );

      const memoString = decodeMemoData(memoInstruction);
      if (!memoString) {
        continue;
      }

      const data = JSON.parse(memoString.replace(/^\[\d+\]\s*/, ''));
      if (data.protocol !== 'meditation-inscription-v1') {
        continue;
      }

      const record: MeditationRecord = {
        ...data,
        txSignature: sigInfo.signature,
        status: sigInfo.err ? 'failed' : 'confirmed',
        blockTime: sigInfo.blockTime,
      };

      memoRecords.push(record);
    } catch (err) {
      console.warn('Skipping transaction due to parse error', err);
    }
  }

  memoRecords.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
  return memoRecords;
}
