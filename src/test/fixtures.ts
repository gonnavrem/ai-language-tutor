import type { ExerciseRecord } from '../lib/db/db'

export function sampleRecord(
  overrides: Partial<ExerciseRecord> = {},
): ExerciseRecord {
  return {
    id: crypto.randomUUID(),
    sentence: 'The cat is sleeping.',
    levelId: 'A1',
    grammarPoints: ['present continuous'],
    aiProvider: 'anthropic',
    aiModel: 'claude-sonnet-5',
    userTranslation: 'El gato está durmiendo.',
    evaluation: {
      scores: { meaning: 5, grammar: 5, naturalness: 4, vocabulary: 5 },
      issues: [],
      alternatives: [],
      aiProvider: 'anthropic',
      aiModel: 'claude-sonnet-5',
    },
    solvedAt: new Date('2026-01-01'),
    ...overrides,
  }
}
