import type { Level } from '../../config'
import { createProvider, type AIProvider } from '../ai'
import { secureStorage } from '../secureStorage'
import { db } from '../db/db'
import {
  discardCurrentExercise,
  loadCurrentExercise,
  saveCurrentExercise,
} from './currentExercise'
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
 * The outgoing exercise is persisted to Dexie only if it was solved
 * (`evaluation` is set) — an unevaluated exercise has no evaluative value
 * and is simply discarded, per DECISIONS.md M4/M5.
 */
async function flushOrDiscardCurrentExercise(): Promise<void> {
  const outgoing = loadCurrentExercise()
  const evaluation = outgoing?.evaluation

  if (outgoing && evaluation) {
    await db.transaction('rw', db.exercises, db.evaluations, async () => {
      const exerciseId = await db.exercises.add({
        sentence: outgoing.sentence,
        levelId: outgoing.levelId,
        grammarPoints: outgoing.grammarPoints,
        aiProvider: outgoing.aiProvider,
        aiModel: outgoing.aiModel,
        createdAt: new Date(outgoing.createdAt),
      })
      await db.evaluations.add({
        exerciseId,
        userTranslation: outgoing.userTranslation ?? '',
        scores: evaluation.scores,
        issues: evaluation.issues,
        alternatives: evaluation.alternatives,
        aiProvider: evaluation.aiProvider,
        aiModel: evaluation.aiModel,
        createdAt: new Date(),
      })
    })
  }

  discardCurrentExercise()
}

async function requestExerciseInternal(level: Level): Promise<CurrentExercise> {
  const config = await secureStorage.getProviderConfig()
  if (!config) throw new NoProviderConfiguredError()
  const provider = createProvider(config)

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

  await flushOrDiscardCurrentExercise()

  const next: CurrentExercise = {
    sentence: sentence.sentence,
    levelId: level.id,
    grammarPoints: sentence.grammarPoints,
    aiProvider: providerId,
    aiModel: model,
    createdAt: new Date().toISOString(),
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
