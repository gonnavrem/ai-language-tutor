import { z } from 'zod'

export const ExerciseSentenceSchema = z.object({
  sentence: z.string().min(1),
  grammarPoints: z.array(z.string().min(1)).min(1),
})
export type ExerciseSentence = z.infer<typeof ExerciseSentenceSchema>

/**
 * 1-5 per category, not 1-10 — coarser bands are more consistent for an LLM
 * rater (see DECISIONS.md M5). The overall/weighted score is derived
 * client-side from these (evaluationScore.ts), never produced by the AI.
 */
export const EvaluationScoresSchema = z.object({
  meaning: z.number().int().min(1).max(5),
  grammar: z.number().int().min(1).max(5),
  naturalness: z.number().int().min(1).max(5),
  vocabulary: z.number().int().min(1).max(5),
})
export type EvaluationScores = z.infer<typeof EvaluationScoresSchema>

/** The AI's own output shape — provider/model are attached by the caller. */
export const EvaluationResultSchema = z.object({
  scores: EvaluationScoresSchema,
  issues: z.array(z.string()),
  alternatives: z.array(z.string()),
})
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>

/** An evaluation plus who produced it. */
const AttributedEvaluationSchema = EvaluationResultSchema.extend({
  aiProvider: z.string().min(1),
  aiModel: z.string().min(1),
})

/**
 * Fields shared by the on-screen exercise and its stored record — the single
 * source for both shapes (see DECISIONS.md M6, "one schema"). `id` is a UUID
 * assigned when the exercise is created, not by Dexie, so persisting it is
 * idempotent (`put`) and ids stay stable across devices for M7 import.
 */
const ExerciseBaseSchema = z.object({
  id: z.uuid(),
  sentence: z.string().min(1),
  levelId: z.string().min(1),
  grammarPoints: z.array(z.string()),
  aiProvider: z.string().min(1),
  aiModel: z.string().min(1),
})

/**
 * The exercise currently on screen. Persisted to localStorage, not Dexie,
 * until it's superseded by the next one (see DECISIONS.md M4). One shape
 * covers both pending and solved: `userTranslation` doubles as the
 * in-progress draft and the final submitted translation, and `evaluation` is
 * only ever set after a successful evaluation call — its presence is what
 * "solved" means (see DECISIONS.md M5). `solvedAt` (ISO string) travels
 * inside it and is hoisted to the Dexie record on flush (DECISIONS.md M6).
 */
export const CurrentExerciseSchema = ExerciseBaseSchema.extend({
  userTranslation: z.string().optional(),
  evaluation: AttributedEvaluationSchema.extend({
    solvedAt: z.iso.datetime(),
  }).optional(),
})
export type CurrentExercise = z.infer<typeof CurrentExerciseSchema>

/**
 * A solved exercise as stored in Dexie. `solvedAt` is a real `Date` here
 * (indexable). The JSON backup format is deliberately not derived from this
 * schema — see `src/lib/backup/format.ts` and DECISIONS.md M7.
 */
export const ExerciseRecordSchema = ExerciseBaseSchema.extend({
  userTranslation: z.string(),
  evaluation: AttributedEvaluationSchema,
  solvedAt: z.date(),
})
export type ExerciseRecord = z.infer<typeof ExerciseRecordSchema>

export class NoProviderConfiguredError extends Error {
  constructor() {
    super('No AI provider is configured yet.')
    this.name = 'NoProviderConfiguredError'
  }
}
