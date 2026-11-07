import { createProvider } from '../ai'
import { secureStorage } from '../secureStorage'
import { evaluateTranslation } from './evaluateTranslation'
import { loadCurrentExercise, saveCurrentExercise } from './currentExercise'
import { NoProviderConfiguredError, type CurrentExercise } from './types'

/**
 * Evaluates the given translation against the currently pending exercise and
 * commits the result only on success (see DECISIONS.md M5) — on failure
 * nothing is saved, so the caller's own state (including the typed
 * translation) is untouched and a retry can just call this again.
 *
 * Unlike `requestExercise`, this has no shared mutable state to serialize
 * (no prefetch buffer), so callers are expected to prevent overlapping calls
 * via UI guard (disable submit/regenerate while a request is in flight)
 * rather than a queue.
 */
export async function submitEvaluation(
  translation: string,
): Promise<CurrentExercise> {
  const exercise = loadCurrentExercise()
  if (!exercise) {
    throw new Error('submitEvaluation called with no pending exercise.')
  }

  const config = await secureStorage.getProviderConfig()
  if (!config) throw new NoProviderConfiguredError()
  const provider = createProvider(config)

  const result = await evaluateTranslation(
    exercise.sentence,
    translation,
    provider,
  )

  const next: CurrentExercise = {
    ...exercise,
    userTranslation: translation,
    evaluation: {
      ...result,
      aiProvider: config.providerId,
      aiModel: config.model,
    },
  }
  saveCurrentExercise(next)

  return next
}
