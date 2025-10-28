export type DeviceStatus = 'disconnected' | 'connecting' | 'connected';

export type SessionStatus = 'idle' | 'running' | 'completed';

export interface MeditationEvaluation {
  protocol: 'meditation-inscription-v1';
  timestamp: number; // Unix seconds
  durationSec: number;
  score: number;
  meditationAchieved: boolean;
  deviceId: string;
  userWallet?: string;
  notes?: string;
  // EEG-specific metrics
  avgFocus?: number;
  avgRelax?: number;
  alphaRatio?: number;
  betaRatio?: number;
}

export interface MeditationRecord extends MeditationEvaluation {
  txSignature: string;
  status: 'pending' | 'confirmed' | 'failed';
  blockTime?: number;
}

export interface BlockchainState {
  evaluation: MeditationEvaluation | null;
  isSubmitting: boolean;
  submissionError: string | null;
  lastSubmittedRecord: MeditationRecord | null;
}
