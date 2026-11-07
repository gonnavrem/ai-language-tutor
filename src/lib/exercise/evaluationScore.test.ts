import { describe, expect, it } from 'vitest'
import { computeOverallScore } from './evaluationScore'
import type { EvaluationScores } from './types'

function scores(overrides: Partial<EvaluationScores>): EvaluationScores {
  return {
    meaning: 5,
    grammar: 5,
    naturalness: 5,
    vocabulary: 5,
    ...overrides,
  }
}

describe('computeOverallScore', () => {
  it('returns 5 when every category is perfect', () => {
    expect(computeOverallScore(scores({}))).toBe(5)
  })

  it('applies the weighted formula when no cap is triggered', () => {
    // 4*0.4 + 4*0.25 + 4*0.2 + 4*0.15 = 4
    expect(computeOverallScore(scores({ meaning: 4, grammar: 4, naturalness: 4, vocabulary: 4 }))).toBe(4)
  })

  it('caps the overall score at meaning + 0.5 when meaning is low', () => {
    // Weighted would be 1*0.4 + 5*0.25 + 5*0.2 + 5*0.15 = 3.4, capped to 1.5
    expect(computeOverallScore(scores({ meaning: 1 }))).toBe(1.5)
    // Weighted would be 2*0.4 + 5*0.25 + 5*0.2 + 5*0.15 = 3.8, capped to 2.5
    expect(computeOverallScore(scores({ meaning: 2 }))).toBe(2.5)
    // Weighted would be 3*0.4 + 5*0.25 + 5*0.2 + 5*0.15 = 4.2, capped to 3.5
    expect(computeOverallScore(scores({ meaning: 3 }))).toBe(3.5)
  })

  it('does not trigger the cap once meaning is 4 or higher', () => {
    // 4*0.4 + 5*0.25 + 5*0.2 + 5*0.15 = 4.6, cap would be 4.5 -> min is the cap
    expect(computeOverallScore(scores({ meaning: 4 }))).toBe(4.5)
  })

  it('rounds to the nearest half point', () => {
    // 5*0.4 + 1*0.25 + 1*0.2 + 1*0.15 = 2.6 -> rounds to 2.5
    expect(
      computeOverallScore(
        scores({ meaning: 5, grammar: 1, naturalness: 1, vocabulary: 1 }),
      ),
    ).toBe(2.5)
  })
})
