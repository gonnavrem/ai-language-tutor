import { describe, expect, it, vi } from 'vitest'
import { evaluateTranslation } from './evaluateTranslation'
import type { AIProvider } from '../ai'

describe('evaluateTranslation', () => {
  it('requests the translation_evaluation schema with the sentence and translation', async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      scores: { meaning: 5, grammar: 5, naturalness: 5, vocabulary: 5 },
      issues: [],
      alternatives: [],
    })
    const provider: AIProvider = { id: 'anthropic', generateStructured }

    const result = await evaluateTranslation(
      'The cat sleeps.',
      'El gato duerme.',
      provider,
    )

    expect(result).toEqual({
      scores: { meaning: 5, grammar: 5, naturalness: 5, vocabulary: 5 },
      issues: [],
      alternatives: [],
    })
    expect(generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: 'translation_evaluation',
        prompt: expect.stringContaining('El gato duerme.'),
        systemPrompt: expect.stringContaining('1-5'),
      }),
    )
  })
})
