import type { WalletAdapter } from '@solana/wallet-adapter-base';
import type { Connection } from '@solana/web3.js';
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { Buffer } from 'buffer';

import type { MeditationEvaluation, MeditationRecord } from '../types/meditation';

const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
);

interface PriorityConfig {
  microLamports: number;
  computeUnitLimit: number;
  confirmationTimeoutMs?: number;
}

const MIN_PRIORITY_FEE = 50_000;
const MAX_PRIORITY_FEE = 700_000;
const PRIORITY_PERCENTILE = 0.75;
const PRIORITY_CACHE_MS = 30_000;
const FALLBACK_CONFIGS: PriorityConfig[] = [
  {
    microLamports: 180_000,
    computeUnitLimit: 400_000,
    confirmationTimeoutMs: 60_000,
  },
  {
    microLamports: 260_000,
    computeUnitLimit: 600_000,
    confirmationTimeoutMs: 75_000,
  },
  {
    microLamports: MAX_PRIORITY_FEE,
    computeUnitLimit: 800_000,
    confirmationTimeoutMs: 90_000,
  },
];

let cachedPriorityFee: { value: number; timestamp: number } | null = null;

interface InscriptionParams {
  evaluation: MeditationEvaluation;
  publicKey: PublicKey;
  connection: Connection;
  wallet: Pick<WalletAdapter, 'sendTransaction'>;
}

const DEFAULT_CONFIRMATION_TIMEOUT_MS = 60_000; // Increased to 60 seconds

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

async function getDynamicPriorityFee(
  connection: Connection,
  publicKey: PublicKey,
): Promise<number | null> {
  const now = Date.now();
  if (cachedPriorityFee && now - cachedPriorityFee.timestamp < PRIORITY_CACHE_MS) {
    return cachedPriorityFee.value;
  }

  try {
    const samples = await connection.getRecentPrioritizationFees({
      lockedWritableAccounts: [publicKey],
    });
    const fees = samples
      .map((sample) => sample.prioritizationFee)
      .filter((fee): fee is number => typeof fee === 'number' && fee > 0)
      .sort((a, b) => a - b);

    if (fees.length === 0) {
      return null;
    }

    console.log('Recent prioritization fees:', fees);

    const index = Math.min(
      fees.length - 1,
      Math.floor(fees.length * PRIORITY_PERCENTILE),
    );
    const clamped = clamp(Math.round(fees[index]), MIN_PRIORITY_FEE, MAX_PRIORITY_FEE);
    cachedPriorityFee = { value: clamped, timestamp: now };
    return clamped;
  } catch (err) {
    console.warn('Failed to fetch dynamic priority fee', err);
    return null;
  }
}

async function buildPriorityConfigs(
  connection: Connection,
  publicKey: PublicKey,
): Promise<PriorityConfig[]> {
  const dynamicFee = await getDynamicPriorityFee(connection, publicKey);
  if (!dynamicFee) {
    return FALLBACK_CONFIGS;
  }

  console.log('Dynamic priority fee:', dynamicFee);

  const boosted = clamp(
    Math.max(Math.round(dynamicFee * 1.75), dynamicFee + 40_000),
    MIN_PRIORITY_FEE,
    MAX_PRIORITY_FEE,
  );

  const configs: PriorityConfig[] = [
    {
      microLamports: dynamicFee,
      computeUnitLimit: 400_000,
      confirmationTimeoutMs: 60_000,
    },
  ];

  if (boosted > dynamicFee) {
    configs.push({
      microLamports: boosted,
      computeUnitLimit: 600_000,
      confirmationTimeoutMs: 75_000,
    });
  }

  FALLBACK_CONFIGS.forEach((config) => {
    if (!configs.find((c) => c.microLamports === config.microLamports)) {
      configs.push(config);
    }
  });

  return configs;
}

async function waitForConfirmation(
  connection: Connection,
  signature: string,
  commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed',
  timeoutMs = DEFAULT_CONFIRMATION_TIMEOUT_MS,
) {
  const start = Date.now();
  let interval = 500;
  let attempts = 0;

  console.log(`⏳ Waiting for confirmation of ${signature.slice(0, 16)}... (timeout: ${timeoutMs}ms)`);

  while (Date.now() - start <= timeoutMs) {
    attempts++;
    try {
      const statusResponse = await connection.getSignatureStatuses([signature]);
      const status = statusResponse.value[0];

      if (status) {
        console.log(`📊 Status check #${attempts}: ${status.confirmationStatus || 'pending'}`);

        if (status.err) {
          console.error('❌ Transaction failed on-chain:', status.err);
          throw new Error(
            `Transaction failed: ${JSON.stringify(status.err)}`,
          );
        }

        const reached =
          status.confirmationStatus === 'finalized' ||
          (commitment !== 'finalized' &&
            status.confirmationStatus === 'confirmed') ||
          (commitment === 'processed' &&
            (status.confirmationStatus === 'processed' ||
              status.confirmationStatus === 'confirmed'));

        if (reached || status.confirmations === null) {
          console.log(`✅ Transaction confirmed after ${Date.now() - start}ms (${attempts} attempts)`);
          return;
        }
      }
    } catch (error) {
      console.warn(`⚠️ Status check #${attempts} failed:`, error);
      // Continue trying unless it's a definitive error
      if (error instanceof Error && error.message.includes('Transaction failed')) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
    interval = Math.min(interval * 1.5, 2500);
  }

  const elapsed = Date.now() - start;
  console.error(`⏰ Transaction confirmation timed out after ${elapsed}ms (${attempts} attempts)`);
  throw new Error(
    `Transaction confirmation timed out after ${Math.round(elapsed / 1000)} seconds`,
  );
}

export async function submitMeditationInscription({
  evaluation,
  publicKey,
  connection,
  wallet,
}: InscriptionParams): Promise<MeditationRecord> {
  const payload = {
    ...evaluation,
    userWallet: publicKey.toBase58(),
  };

  const jsonString = JSON.stringify(payload);
  console.log('Inscription payload:', jsonString);

  const memoInstruction = new TransactionInstruction({
    keys: [{ pubkey: publicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(jsonString, 'utf8'),
  });

  let lastError: unknown = null;

  const priorityConfigs = await buildPriorityConfigs(connection, MEMO_PROGRAM_ID);

  for (let i = 0; i < priorityConfigs.length; i++) {
    const config = priorityConfigs[i];
    console.log(`\n🔄 Attempt ${i + 1}/${priorityConfigs.length}: Priority fee ${config.microLamports} µLamports, Compute limit ${config.computeUnitLimit}`);

    try {
      const computeLimitInstruction = ComputeBudgetProgram.setComputeUnitLimit({
        units: config.computeUnitLimit,
      });

      const priorityInstruction = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: config.microLamports,
      });

      const tx = new Transaction().add(
        computeLimitInstruction,
        priorityInstruction,
        memoInstruction,
      );
      tx.feePayer = publicKey;

      console.log('📤 Sending transaction to wallet for signature...');
      const signature = await wallet.sendTransaction(tx, connection, {
        skipPreflight: false,
      });

      console.log(`📝 Transaction sent: ${signature}`);

      await waitForConfirmation(
        connection,
        signature,
        'confirmed',
        config.confirmationTimeoutMs ?? DEFAULT_CONFIRMATION_TIMEOUT_MS,
      );

      console.log(`🎉 Inscription successful!`);
      return {
        ...payload,
        txSignature: signature,
        status: 'confirmed',
        blockTime: Math.floor(Date.now() / 1000),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error);
      console.error(`❌ Attempt ${i + 1} failed:`, error);

      // Immediately throw if user cancelled
      if (
        message.includes('user rejected') ||
        message.includes('declined') ||
        message.includes('cancelled')
      ) {
        console.log('🚫 User cancelled transaction');
        throw error;
      }

      lastError = error;

      // Don't retry if this was the last attempt
      if (i === priorityConfigs.length - 1) {
        console.error('❌ All retry attempts exhausted');
      } else {
        console.log(`⏭️  Retrying with higher priority fee...`);
      }
    }
  }

  const details =
    lastError instanceof Error ? lastError.message : JSON.stringify(lastError);
  console.error('💥 Final error:', details);
  throw new Error(
    `Failed to confirm memo inscription after ${priorityConfigs.length} attempts: ${details}`,
  );
}
