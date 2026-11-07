import type { EvaluationScores } from './types'

/** See DECISIONS.md M5 for how these weights and the meaning-cap were chosen. */
export const EVALUATION_WEIGHTS = {
  meaning: 0.4,
  grammar: 0.25,
  naturalness: 0.2,
  vocabulary: 0.15,
} as const

/**
 * Overall score, computed client-side rather than by the AI so the weighting
 * is guaranteed correct and the model never has to do arithmetic. Capped at
 * `meaning + 0.5` so a broken-meaning translation can't score well overall
 * just by being grammatically clean — see DECISIONS.md M5.
 */
export function computeOverallScore(scores: EvaluationScores): number {
  const weighted =
    scores.meaning * EVALUATION_WEIGHTS.meaning +
    scores.grammar * EVALUATION_WEIGHTS.grammar +
    scores.naturalness * EVALUATION_WEIGHTS.naturalness +
    scores.vocabulary * EVALUATION_WEIGHTS.vocabulary

  const capped = Math.min(weighted, scores.meaning + 0.5)
  return Math.round(capped * 2) / 2
}
