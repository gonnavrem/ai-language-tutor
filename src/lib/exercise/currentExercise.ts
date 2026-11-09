import {
  CurrentExerciseSchema,
  type CurrentExercise,
  type ExerciseRecord,
} from './types'

const STORAGE_KEY = 'language-tutor:current-exercise'

/** A shape that fails to parse (stale template version, corruption) is
 *  treated as nothing pending, not an error — see DECISIONS.md M4. */
export function loadCurrentExercise(): CurrentExercise | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  const result = CurrentExerciseSchema.safeParse(parsed)
  return result.success ? result.data : null
}

export function saveCurrentExercise(exercise: CurrentExercise): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(exercise))
}

export function discardCurrentExercise(): void {
  localStorage.removeItem(STORAGE_KEY)
}

/** The record a solved exercise is stored as, with `solvedAt` hoisted out of
 *  its evaluation (DECISIONS.md M6). `null` while it's still unsolved. */
export function toExerciseRecord(
  exercise: CurrentExercise,
): ExerciseRecord | null {
  if (!exercise.evaluation) return null
  const { solvedAt, ...evaluation } = exercise.evaluation
  return {
    id: exercise.id,
    sentence: exercise.sentence,
    levelId: exercise.levelId,
    grammarPoints: exercise.grammarPoints,
    aiProvider: exercise.aiProvider,
    aiModel: exercise.aiModel,
    userTranslation: exercise.userTranslation ?? '',
    evaluation,
    solvedAt: new Date(solvedAt),
  }
}

/** The on-screen exercise as a record if it's solved — not in Dexie yet by
 *  M4's flush rule — else `null`. */
export function loadSolvedCurrentExercise(): ExerciseRecord | null {
  const current = loadCurrentExercise()
  return current && toExerciseRecord(current)
}
