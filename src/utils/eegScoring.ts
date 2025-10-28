import dayjs from 'dayjs';
import type { MeditationEvaluation } from '../types/meditation';
import type { DataPoint, SeriesData } from '../types/bluetooth';

interface EvaluateParams {
  durationSec: number;
  deviceId: string;
  samples: DataPoint[];
  series: SeriesData;
}

/**
 * Calculate average of an array of numbers
 */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate meditation quality based on brain wave patterns
 * Alpha waves (relaxed awareness) should be elevated
 * Beta waves (active thinking) should be moderate to low
 */
function calculateBrainWaveScore(series: SeriesData): {
  alphaRatio: number;
  betaRatio: number;
  meditationScore: number;
} {
  // Calculate average values for each band
  const avgLowAlpha = average(series.lowAlpha);
  const avgHighAlpha = average(series.highAlpha);
  const avgLowBeta = average(series.lowBeta);
  const avgHighBeta = average(series.highBeta);
  const avgDelta = average(series.delta);
  const avgTheta = average(series.theta);

  // Calculate total power across all bands
  const totalPower = avgDelta + avgTheta + avgLowAlpha + avgHighAlpha + avgLowBeta + avgHighBeta;

  // Alpha ratio (good for meditation: higher is better)
  const alphaPower = avgLowAlpha + avgHighAlpha;
  const alphaRatio = totalPower > 0 ? (alphaPower / totalPower) * 100 : 0;

  // Beta ratio (should be moderate: too high indicates active thinking)
  const betaPower = avgLowBeta + avgHighBeta;
  const betaRatio = totalPower > 0 ? (betaPower / totalPower) * 100 : 0;

  // Meditation score calculation:
  // - Higher alpha ratio is good (up to 40 points)
  // - Lower beta ratio is good (up to 30 points)
  // - Balance between alpha and beta (up to 30 points)
  const alphaScore = Math.min(40, (alphaRatio / 40) * 40); // Max 40 points
  const betaScore = Math.max(0, 30 - (betaRatio / 40) * 30); // Inverse scoring, max 30 points
  const balanceScore = alphaRatio > betaRatio ? 30 : 15; // Reward alpha dominance

  const meditationScore = Math.round(alphaScore + betaScore + balanceScore);

  return {
    alphaRatio: Math.round(alphaRatio * 10) / 10,
    betaRatio: Math.round(betaRatio * 10) / 10,
    meditationScore: Math.min(100, meditationScore),
  };
}

/**
 * Evaluate EEG meditation session and generate AI-scored evaluation
 */
export function evaluateEEGSession({
  durationSec,
  deviceId,
  samples,
  series,
}: EvaluateParams): MeditationEvaluation {
  // Calculate average focus and relax from samples
  const focusValues = samples.map(s => s.focus);
  const relaxValues = samples.map(s => s.relax);
  const avgFocus = Math.round(average(focusValues));
  const avgRelax = Math.round(average(relaxValues));

  // Calculate brain wave metrics
  const { alphaRatio, betaRatio, meditationScore: brainWaveScore } = calculateBrainWaveScore(series);

  // Determine if meditation was achieved
  // Criteria:
  // 1. Duration >= 2 minutes
  // 2. Average focus >= 40 OR average relax >= 40
  // 3. Brain wave score >= 50
  const durationAchieved = durationSec >= 120;
  const focusRelaxAchieved = avgFocus >= 40 || avgRelax >= 40;
  const brainWaveAchieved = brainWaveScore >= 50;
  const meditationAchieved = durationAchieved && (focusRelaxAchieved || brainWaveAchieved);

  // Calculate final score (0-100)
  // Components:
  // - Duration component (up to 30 points): min(30, durationSec / 10)
  // - Focus/Relax component (up to 35 points): average of focus and relax * 0.35
  // - Brain wave component (up to 35 points): brainWaveScore * 0.35
  const durationPoints = Math.min(30, durationSec / 10);
  const focusRelaxPoints = ((avgFocus + avgRelax) / 2) * 0.35;
  const brainWavePoints = brainWaveScore * 0.35;

  const score = Math.min(
    100,
    Math.round(durationPoints + focusRelaxPoints + brainWavePoints),
  );

  // Generate notes based on performance
  let notes = '';
  if (meditationAchieved) {
    if (score >= 80) {
      notes = '优秀的冥想状态！脑波节奏稳定，专注和放松度保持良好平衡。';
    } else if (score >= 60) {
      notes = '良好的冥想状态。呼吸平稳，脑波进入冥想区间。';
    } else {
      notes = '基本达到冥想状态。建议继续保持练习以提高稳定性。';
    }
  } else {
    if (!durationAchieved) {
      notes = '建议延长冥想时长至2分钟以上。';
    } else if (!focusRelaxAchieved && !brainWaveAchieved) {
      notes = '建议调整呼吸节奏，放松身心，让专注度或放松度达到40以上。';
    } else {
      notes = '继续练习，尝试让脑波进入更深层的冥想状态。';
    }
  }

  return {
    protocol: 'meditation-inscription-v1',
    timestamp: dayjs().unix(),
    durationSec,
    score,
    meditationAchieved,
    deviceId,
    notes,
    avgFocus,
    avgRelax,
    alphaRatio,
    betaRatio,
  };
}
