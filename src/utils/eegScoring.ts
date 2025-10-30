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
      notes = 'Excellent meditation state! Brainwave rhythm is stable, with a good balance between focus and relaxation.';
    } else if (score >= 60) {
      notes = 'Good meditation state. Breathing is steady, and brainwaves have entered the meditation range.';
    } else {
      notes = 'Basic meditation state achieved. Recommended to continue practicing to improve stability.';
    }
  } else {
    if (!durationAchieved) {
      notes = 'Recommended to extend meditation time to 2 minutes or more.';
    } else if (!focusRelaxAchieved && !brainWaveAchieved) {
      notes = 'Recommended to adjust breathing rhythm, relax the body and mind, and achieve a focus or relaxation score of 40 or above.';
    } else {
      notes = 'Continue practicing, try to get the brainwaves into a deeper meditation state.';
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
