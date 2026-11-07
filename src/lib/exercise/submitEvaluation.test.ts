import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { secureStorage } from '../secureStorage'
import { appConfig } from '../../config'
import { loadCurrentExercise, saveCurrentExercise } from './currentExercise'
import { submitEvaluation } from './submitEvaluation'
import type { CurrentExercise } from './types'

const generateStructured = vi.fn()

vi.mock('../ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ai')>()
  return {
    ...actual,
    createProvider: () => ({ id: 'anthropic', generateStructured }),
  }
})

const level = appConfig.levelSystem.levels[0]

const pendingExercise: CurrentExercise = {
  sentence: 'The cat sleeps.',
  levelId: level.id,
  grammarPoints: ['present simple'],
  aiProvider: 'anthropic',
  aiModel: 'claude-test',
  createdAt: '2026-01-01T00:00:00.000Z',
}

function evaluationResult() {
  return {
    scores: { meaning: 5, grammar: 4, naturalness: 5, vocabulary: 5 },
    issues: ['Minor article error.'],
    alternatives: [],
  }
}

beforeEach(async () => {
  localStorage.clear()
  await db.secureConfig.clear()
  generateStructured.mockReset()
  await secureStorage.setProviderConfig({
    providerId: 'anthropic',
    apiKey: 'sk-test',
    model: 'claude-test',
  })
  saveCurrentExercise(pendingExercise)
})

describe('submitEvaluation', () => {
  it('throws when no provider is configured', async () => {
    await db.secureConfig.clear()

    await expect(submitEvaluation('El gato duerme.')).rejects.toThrow(
      'No AI provider is configured yet.',
    )
  })

  it('evaluates, commits the translation and evaluation, and persists', async () => {
    generateStructured.mockResolvedValue(evaluationResult())

    const result = await submitEvaluation('El gato duerme.')

    expect(result.userTranslation).toBe('El gato duerme.')
    expect(result.evaluation).toEqual({
      ...evaluationResult(),
      aiProvider: 'anthropic',
      aiModel: 'claude-test',
    })
    expect(loadCurrentExercise()).toEqual(result)
  })

  it('leaves the current exercise untouched when evaluation fails', async () => {
    generateStructured.mockRejectedValue(new Error('boom'))

    await expect(submitEvaluation('El gato duerme.')).rejects.toThrow('boom')

    expect(loadCurrentExercise()).toEqual(pendingExercise)
  })
})
