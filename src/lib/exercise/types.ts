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

/**
 * The exercise currently on screen. Persisted to localStorage, not Dexie,
 * until it's superseded by the next one (see DECISIONS.md M4). One shape
 * covers both pending and solved: `userTranslation` doubles as the
 * in-progress draft and the final submitted translation, and `evaluation` is
 * only ever set after a successful evaluation call — its presence is what
 * "solved" means (see DECISIONS.md M5).
 */
export const CurrentExerciseSchema = z.object({
  sentence: z.string().min(1),
  levelId: z.string().min(1),
  grammarPoints: z.array(z.string()),
  aiProvider: z.string().min(1),
  aiModel: z.string().min(1),
  createdAt: z.string(),
  userTranslation: z.string().optional(),
  evaluation: EvaluationResultSchema.extend({
    aiProvider: z.string().min(1),
    aiModel: z.string().min(1),
  }).optional(),
})
export type CurrentExercise = z.infer<typeof CurrentExerciseSchema>

export class NoProviderConfiguredError extends Error {
  constructor() {
    super('No AI provider is configured yet.')
    this.name = 'NoProviderConfiguredError'
  }
}
