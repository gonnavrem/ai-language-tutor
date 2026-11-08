import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appConfig } from '../config'
import { createProvider } from '../lib/ai/createProvider'
import { db } from '../lib/db/db'
import { computeOverallScore } from '../lib/exercise/evaluationScore'
import { secureStorage } from '../lib/secureStorage'
import { MockProvider } from './mockProvider'
import { buildSeedRecords, seedHistoryIfEmpty } from './seed'
import { setupMockMode } from './setup'

beforeEach(async () => {
  await db.exercises.clear()
  await db.secureConfig.clear()
})

describe('seed history', () => {
  it('covers every level, a spread of scores, and one level not in the config', () => {
    const records = buildSeedRecords()
    const configIds = appConfig.levelSystem.levels.map((l) => l.id)

    for (const id of configIds) {
      expect(records.some((r) => r.levelId === id)).toBe(true)
    }
    expect(records.some((r) => !configIds.includes(r.levelId))).toBe(true)

    const overall = new Set(
      records.map((r) => computeOverallScore(r.evaluation.scores)),
    )
    expect(overall.size).toBeGreaterThanOrEqual(4)
  })

  it('fills an empty table', async () => {
    await seedHistoryIfEmpty()

    expect(await db.exercises.count()).toBe(buildSeedRecords().length)
  })

  it('leaves a populated table alone', async () => {
    await seedHistoryIfEmpty()
    const before = await db.exercises.count()
    await db.exercises.limit(1).delete()

    await seedHistoryIfEmpty()

    expect(await db.exercises.count()).toBe(before - 1)
  })
})

describe('setupMockMode', () => {
  it('stores a placeholder provider config and seeds the history', async () => {
    await setupMockMode()

    expect(await secureStorage.getProviderConfig()).toMatchObject({
      apiKey: 'mock',
      model: 'mock',
    })
    expect(await db.exercises.count()).toBeGreaterThan(0)
    expect(document.title).toMatch(/^\[MOCK\]/)
  })
})

describe('createProvider', () => {
  it('only returns the mock provider in mock mode', async () => {
    const config = {
      providerId: 'anthropic' as const,
      apiKey: 'sk-test',
      model: 'm',
    }
    expect(createProvider(config)).not.toBeInstanceOf(MockProvider)

    vi.stubEnv('MODE', 'mock')
    vi.resetModules()
    try {
      const mocked = await import('../lib/ai/createProvider')
      const { MockProvider: FreshMock } = await import('./mockProvider')
      expect(mocked.createProvider(config)).toBeInstanceOf(FreshMock)
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })
})
