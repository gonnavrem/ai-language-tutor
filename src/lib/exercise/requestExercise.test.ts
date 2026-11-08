import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { secureStorage } from '../secureStorage'
import { appConfig } from '../../config'
import { loadCurrentExercise, saveCurrentExercise } from './currentExercise'

const generateStructured = vi.fn()

vi.mock('../ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ai')>()
  return {
    ...actual,
    createProvider: () => ({ id: 'anthropic', generateStructured }),
  }
})

const [levelA, levelB] = appConfig.levelSystem.levels

function sentenceResult(sentence: string) {
  return { sentence, grammarPoints: ['present simple'] }
}

const solvedEvaluation = {
  scores: { meaning: 5, grammar: 4, naturalness: 5, vocabulary: 5 },
  issues: [],
  alternatives: [],
  aiProvider: 'anthropic',
  aiModel: 'claude-test',
  solvedAt: '2026-01-01T10:00:00.000Z',
}

// requestExercise keeps its one-slot prefetch buffer as module state, so
// each test reloads the module fresh — otherwise a buffer left behind by
// one test's `it` block would silently answer the next test's first call.
let requestExercise: typeof import('./requestExercise').requestExercise

beforeEach(async () => {
  localStorage.clear()
  await db.secureConfig.clear()
  await db.exercises.clear()
  generateStructured.mockReset()
  await secureStorage.setProviderConfig({
    providerId: 'anthropic',
    apiKey: 'sk-test',
    model: 'claude-test',
  })

  vi.resetModules()
  ;({ requestExercise } = await import('./requestExercise'))
})

describe('requestExercise', () => {
  it('throws when no provider is configured', async () => {
    await db.secureConfig.clear()

    await expect(requestExercise(levelA)).rejects.toThrow(
      'No AI provider is configured yet.',
    )
  })

  it('generates, commits, and persists a new exercise', async () => {
    generateStructured.mockResolvedValue(sentenceResult('First.'))

    const result = await requestExercise(levelA)

    expect(result.sentence).toBe('First.')
    expect(result.levelId).toBe(levelA.id)
    expect(result.aiProvider).toBe('anthropic')
    expect(result.aiModel).toBe('claude-test')
    expect(loadCurrentExercise()).toEqual(result)
  })

  it('discards the previous exercise once the replacement commits', async () => {
    generateStructured.mockResolvedValue(sentenceResult('First.'))
    await requestExercise(levelA)

    generateStructured.mockResolvedValue(sentenceResult('Second.'))
    const result = await requestExercise(levelB)

    expect(result.sentence).toBe('Second.')
    expect(loadCurrentExercise()?.sentence).toBe('Second.')
  })

  it('discards an unevaluated exercise without persisting it to Dexie', async () => {
    generateStructured.mockResolvedValue(sentenceResult('First.'))
    await requestExercise(levelA)

    generateStructured.mockResolvedValue(sentenceResult('Second.'))
    await requestExercise(levelB)

    expect(await db.exercises.count()).toBe(0)
  })

  it('flushes an evaluated exercise as one record before replacing it', async () => {
    generateStructured.mockResolvedValue(sentenceResult('First.'))
    const first = await requestExercise(levelA)
    saveCurrentExercise({
      ...first,
      userTranslation: 'Primero.',
      evaluation: {
        scores: { meaning: 5, grammar: 4, naturalness: 5, vocabulary: 5 },
        issues: ['Minor article error.'],
        alternatives: [],
        aiProvider: 'anthropic',
        aiModel: 'claude-test',
        solvedAt: '2026-01-01T10:00:00.000Z',
      },
    })

    generateStructured.mockResolvedValue(sentenceResult('Second.'))
    await requestExercise(levelB)

    const exercises = await db.exercises.toArray()
    expect(exercises).toHaveLength(1)
    expect(exercises[0]).toMatchObject({
      sentence: 'First.',
      userTranslation: 'Primero.',
      evaluation: { scores: { grammar: 4 }, aiModel: 'claude-test' },
      solvedAt: new Date('2026-01-01T10:00:00.000Z'),
    })
    expect(exercises[0].evaluation).not.toHaveProperty('solvedAt')
  })

  it('gives each new exercise its own UUID', async () => {
    generateStructured.mockResolvedValue(sentenceResult('Same.'))

    const first = await requestExercise(levelA)
    const second = await requestExercise(levelA)

    expect(first.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(second.id).not.toBe(first.id)
  })

  it('does not spend a generation call when persisting the solved exercise fails', async () => {
    generateStructured.mockResolvedValue(sentenceResult('First.'))
    const first = await requestExercise(levelA)
    const solved = { ...first, evaluation: solvedEvaluation }
    saveCurrentExercise(solved)
    const callsBefore = generateStructured.mock.calls.length

    // The module reset in beforeEach gives requestExercise its own `db`
    // instance, so the spy must target that one.
    const { db: moduleDb } = await import('../db/db')
    const put = vi
      .spyOn(moduleDb.exercises, 'put')
      .mockRejectedValueOnce(new Error('quota'))
    await expect(requestExercise(levelB)).rejects.toThrow('quota')
    put.mockRestore()

    expect(generateStructured).toHaveBeenCalledTimes(callsBefore)
    expect(loadCurrentExercise()).toEqual(solved)
  })

  it('keeps the solved exercise on screen if generation fails after persisting it, without duplicating it on retry', async () => {
    generateStructured.mockResolvedValue(sentenceResult('First.'))
    const first = await requestExercise(levelA)
    const solved = { ...first, evaluation: solvedEvaluation }
    saveCurrentExercise(solved)

    generateStructured.mockRejectedValue(new Error('boom'))
    await expect(requestExercise(levelB)).rejects.toThrow('boom')
    expect(loadCurrentExercise()).toEqual(solved)
    expect(await db.exercises.count()).toBe(1)

    generateStructured.mockResolvedValue(sentenceResult('Second.'))
    await requestExercise(levelB)

    const stored = await db.exercises.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe(first.id)
  })

  it('leaves the current exercise untouched when generation fails', async () => {
    generateStructured.mockResolvedValue(sentenceResult('First.'))
    const first = await requestExercise(levelA)

    generateStructured.mockRejectedValue(new Error('boom'))
    await expect(requestExercise(levelB)).rejects.toThrow('boom')

    expect(loadCurrentExercise()).toEqual(first)
  })

  it('consumes a matching prefetch buffer instead of issuing a fresh call', async () => {
    generateStructured
      .mockResolvedValueOnce(sentenceResult('First.'))
      .mockResolvedValueOnce(sentenceResult('Buffered.'))
      .mockResolvedValue(sentenceResult('Later.'))

    await requestExercise(levelA)
    expect(generateStructured).toHaveBeenCalledTimes(2)

    const second = await requestExercise(levelA)

    expect(second.sentence).toBe('Buffered.')
    expect(generateStructured).toHaveBeenCalledTimes(3)
  })

  it('discards a prefetch buffer filled for a different level', async () => {
    generateStructured
      .mockResolvedValueOnce(sentenceResult('First.'))
      .mockResolvedValueOnce(sentenceResult('BufferedForA.'))
      .mockResolvedValueOnce(sentenceResult('FreshForB.'))
      .mockResolvedValue(sentenceResult('Later.'))

    await requestExercise(levelA)
    const result = await requestExercise(levelB)

    expect(result.sentence).toBe('FreshForB.')
  })

  it('serializes overlapping calls instead of letting a slower one overwrite a later one', async () => {
    // No await between the two requestExercise() calls below: this
    // reproduces two overlapping calls (e.g. the initial-load fetch racing
    // a fast level change) hitting the shared prefetch buffer at once.
    // Without the module-level request queue, whichever generateStructured
    // call happens to resolve first wins, so B could stomp A's commit even
    // though A was requested first.
    const pending: {
      levelId: string
      resolve: (v: ReturnType<typeof sentenceResult>) => void
    }[] = []
    generateStructured.mockImplementation(
      ({ prompt }: { prompt: string }) =>
        new Promise((resolve) => {
          const levelId = /level (\w+)/.exec(prompt)?.[1] ?? ''
          pending.push({ levelId, resolve })
        }),
    )

    async function waitForPendingCount(n: number) {
      for (let i = 0; i < 100 && pending.length < n; i++) {
        await new Promise((r) => setTimeout(r, 0))
      }
    }

    const p1 = requestExercise(levelA)
    const p2 = requestExercise(levelB)

    // Give both calls a chance to reach generateStructured if they were
    // (incorrectly) running concurrently.
    await waitForPendingCount(1)

    // Serialized: only A's own fresh generation call has been issued so
    // far. B's call is queued behind A and hasn't invoked
    // generateStructured yet — proving the calls didn't run concurrently.
    expect(pending.map((p) => p.levelId)).toEqual([levelA.id])

    pending[0].resolve(sentenceResult('First.'))
    await waitForPendingCount(2)

    // A's commit triggers a background prefetch fill (also for A) before B
    // is allowed to start — its call is issued second, i.e. before B's own
    // (index-based rather than a full-array snapshot, since flushing the
    // outgoing exercise now awaits a promise — see DECISIONS.md M5 — so B's
    // call may already be in flight by the time this poll observes count 2).
    expect(pending[1].levelId).toBe(levelA.id)

    pending[1].resolve(sentenceResult('BufferedForA.'))
    await waitForPendingCount(3)

    // Now B's own fresh generation call has finally been issued.
    expect(pending.map((p) => p.levelId)).toEqual([
      levelA.id,
      levelA.id,
      levelB.id,
    ])

    pending[2].resolve(sentenceResult('Second.'))

    const [result1, result2] = await Promise.all([p1, p2])

    expect(result1.sentence).toBe('First.')
    expect(result1.levelId).toBe(levelA.id)
    expect(result2.sentence).toBe('Second.')
    expect(result2.levelId).toBe(levelB.id)
    // The later call's result is what's actually persisted, not clobbered
    // by the earlier (but slower-to-resolve-in-a-broken-world) call.
    expect(loadCurrentExercise()).toEqual(result2)
  })

  it('silently falls back to a fresh call when the background fill failed', async () => {
    generateStructured
      .mockResolvedValueOnce(sentenceResult('First.'))
      .mockRejectedValueOnce(new Error('background failure'))
      .mockResolvedValue(sentenceResult('Recovered.'))

    await requestExercise(levelA)
    const second = await requestExercise(levelA)

    expect(second.sentence).toBe('Recovered.')
  })
})
