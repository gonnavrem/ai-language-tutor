import { CurrentExerciseSchema, type CurrentExercise } from './types'

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
