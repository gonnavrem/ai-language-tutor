import { z } from 'zod'

export const ExerciseSentenceSchema = z.object({
  sentence: z.string().min(1),
  grammarPoints: z.array(z.string().min(1)).min(1),
})
export type ExerciseSentence = z.infer<typeof ExerciseSentenceSchema>

/**
 * The exercise currently on screen. Persisted to localStorage, not Dexie,
 * until it's superseded by the next one (see DECISIONS.md M4). One shape
 * covers both pending and solved — M5 adds an optional `evaluation` field
 * here rather than introducing a separate union.
 */
export const CurrentExerciseSchema = z.object({
  sentence: z.string().min(1),
  levelId: z.string().min(1),
  grammarPoints: z.array(z.string()),
  aiProvider: z.string().min(1),
  aiModel: z.string().min(1),
  createdAt: z.string(),
})
export type CurrentExercise = z.infer<typeof CurrentExerciseSchema>

export class NoProviderConfiguredError extends Error {
  constructor() {
    super('No AI provider is configured yet.')
    this.name = 'NoProviderConfiguredError'
  }
}
