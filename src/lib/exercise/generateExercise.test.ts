import { describe, expect, it, vi } from 'vitest'
import { generateExerciseSentence } from './generateExercise'
import { appConfig } from '../../config'
import type { AIProvider } from '../ai'

describe('generateExerciseSentence', () => {
  it('requests the exercise_sentence schema for the given level', async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      sentence: 'The cat sleeps.',
      grammarPoints: ['present simple'],
    })
    const provider: AIProvider = { id: 'anthropic', generateStructured }
    const level = appConfig.levelSystem.levels[0]

    const result = await generateExerciseSentence(level, provider)

    expect(result).toEqual({
      sentence: 'The cat sleeps.',
      grammarPoints: ['present simple'],
    })
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: 'exercise_sentence',
        systemPrompt: expect.stringContaining(level.id),
      }),
    )
  })
})
