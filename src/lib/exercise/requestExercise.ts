import type { Level } from '../../config'
import { createProvider, type AIProvider } from '../ai'
import { secureStorage } from '../secureStorage'
import { saveExercise } from '../db/exercises'
import { loadCurrentExercise, saveCurrentExercise } from './currentExercise'
import { generateExerciseSentence } from './generateExercise'
import {
  NoProviderConfiguredError,
  type CurrentExercise,
  type ExerciseSentence,
} from './types'

interface PrefetchBuffer {
  levelId: string
  providerId: string
  model: string
  promise: Promise<ExerciseSentence>
}

/** One-slot prefetch buffer, keyed to the level of the exercise it was
 *  filled for — see DECISIONS.md M4. */
let prefetchBuffer: PrefetchBuffer | null = null

function fillPrefetchBuffer(
  level: Level,
  provider: AIProvider,
  providerId: string,
  model: string,
): void {
  const promise = generateExerciseSentence(level, provider)
  // Background fill failures are silent; a later consumer falls back to a
  // fresh call instead.
  promise.catch(() => {})
  prefetchBuffer = { levelId: level.id, providerId, model, promise }
}

/**
 * Persists the outgoing exercise to Dexie if it was solved (`evaluation` is
 * set) — an unevaluated one has no evaluative value and is simply replaced,
 * per DECISIONS.md M4/M5. Runs *before* generation and does not discard:
 * if the write fails, nothing has been spent or lost; if generation fails
 * after it, the exercise stays on screen and the retried write is a no-op
 * overwrite of its own row (see DECISIONS.md M6, "flush before generating").
 */
async function persistIfSolved(
  outgoing: CurrentExercise | null,
): Promise<void> {
  if (!outgoing?.evaluation) return

  const { solvedAt, ...evaluation } = outgoing.evaluation
  await saveExercise({
    id: outgoing.id,
    sentence: outgoing.sentence,
    levelId: outgoing.levelId,
    grammarPoints: outgoing.grammarPoints,
    aiProvider: outgoing.aiProvider,
    aiModel: outgoing.aiModel,
    userTranslation: outgoing.userTranslation ?? '',
    evaluation,
    solvedAt: new Date(solvedAt),
  })
}

async function requestExerciseInternal(level: Level): Promise<CurrentExercise> {
  const config = await secureStorage.getProviderConfig()
  if (!config) throw new NoProviderConfiguredError()
  const provider = createProvider(config)

  // Before touching the prefetch buffer, so a failed write leaves it intact.
  await persistIfSolved(loadCurrentExercise())

  const buffered = prefetchBuffer?.levelId === level.id ? prefetchBuffer : null
  prefetchBuffer = null

  let sentence: ExerciseSentence
  let providerId: string
  let model: string
  if (buffered) {
    try {
      sentence = await buffered.promise
      providerId = buffered.providerId
      model = buffered.model
    } catch {
      sentence = await generateExerciseSentence(level, provider)
      providerId = config.providerId
      model = config.model
    }
  } else {
    sentence = await generateExerciseSentence(level, provider)
    providerId = config.providerId
    model = config.model
  }

  // Saving the replacement overwrites the outgoing exercise in localStorage.
  const next: CurrentExercise = {
    id: crypto.randomUUID(),
    sentence: sentence.sentence,
    levelId: level.id,
    grammarPoints: sentence.grammarPoints,
    aiProvider: providerId,
    aiModel: model,
  }
  saveCurrentExercise(next)

  fillPrefetchBuffer(level, provider, config.providerId, config.model)

  return next
}

// Calls are serialized so overlapping requestExercise calls (e.g. an
// initial-load fetch racing a fast level change) can't interleave their
// reads/writes of the shared prefetch buffer, and results always resolve in
// call order.
let requestQueue: Promise<unknown> = Promise.resolve()

/**
 * Single generation entry point, used by both the regenerate button and the
 * level selector (see DECISIONS.md M4). Commits the replacement only once
 * it has actually arrived, consumes a matching prefetch buffer when
 * available, and refills the buffer for whatever comes next.
 */
export function requestExercise(level: Level): Promise<CurrentExercise> {
  const result = requestQueue.then(() => requestExerciseInternal(level))
  requestQueue = result.catch(() => {})
  return result
}
