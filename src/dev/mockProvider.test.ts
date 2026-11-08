import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { appConfig } from '../config'
import { AIProviderError } from '../lib/ai/types'
import { evaluateTranslation } from '../lib/exercise/evaluateTranslation'
import { generateExerciseSentence } from '../lib/exercise/generateExercise'
import { MOCK_EVALUATIONS, MOCK_SENTENCES } from './mockData'
import { MockProvider } from './mockProvider'

const provider = new MockProvider(0)

describe('MockProvider', () => {
  it.each(appConfig.levelSystem.levels)(
    'serves a sentence for level $id through the real generator',
    async (level) => {
      // Goes through generateExerciseSentence so a change to its prompt
      // wording (which the mock parses the level from) fails here.
      const result = await generateExerciseSentence(level, provider)

      const pool = MOCK_SENTENCES.filter((s) => s.levelId === level.id)
      expect(pool.map((s) => s.sentence)).toContain(result.sentence)
    },
  )

  it('rotates sentences within a level instead of repeating one', async () => {
    const level = appConfig.levelSystem.levels[0]

    const seen = new Set<string>()
    for (let i = 0; i < 2; i++) {
      seen.add((await generateExerciseSentence(level, provider)).sentence)
    }

    expect(seen.size).toBe(2)
  })

  it('cycles through the full range of canned evaluations', async () => {
    const seen = new Set<string>()
    for (let i = 0; i < MOCK_EVALUATIONS.length; i++) {
      const result = await evaluateTranslation(
        'Any sentence.',
        'Cualquiera.',
        provider,
      )
      seen.add(JSON.stringify(result.scores))
    }

    expect(seen.size).toBe(MOCK_EVALUATIONS.length)
  })

  it('still validates against the caller schema', async () => {
    await expect(
      provider.generateStructured({
        systemPrompt: '',
        prompt: '',
        schema: z.object({ sentence: z.string(), nope: z.number() }),
        schemaName: 'exercise_sentence',
      }),
    ).rejects.toThrow()
  })

  it("answers Settings' connection test", async () => {
    await expect(
      provider.generateStructured({
        systemPrompt: '',
        prompt: '',
        schema: z.object({ ok: z.boolean() }),
        schemaName: 'connection_test',
      }),
    ).resolves.toEqual({ ok: true })
  })

  it('rejects shapes it has no canned response for', async () => {
    await expect(
      provider.generateStructured({
        systemPrompt: '',
        prompt: '',
        schema: z.unknown(),
        schemaName: 'something_else',
      }),
    ).rejects.toBeInstanceOf(AIProviderError)
  })

  it('waits for the configured latency', async () => {
    vi.useFakeTimers()
    try {
      let settled = false
      const pending = new MockProvider(600)
        .generateStructured({
          systemPrompt: '',
          prompt: 'for level A1',
          schema: z.unknown(),
          schemaName: 'exercise_sentence',
        })
        .then(() => (settled = true))

      await vi.advanceTimersByTimeAsync(599)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await pending
      expect(settled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
