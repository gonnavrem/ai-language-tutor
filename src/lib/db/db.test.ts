import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'

beforeEach(async () => {
  await db.evaluations.clear()
  await db.exercises.clear()
})

describe('exercises table', () => {
  it('stores and retrieves an exercise, newest first', async () => {
    const olderId = await db.exercises.add({
      sentence: 'The cat is sleeping.',
      levelId: 'A1',
      grammarPoints: ['present continuous'],
      aiProvider: 'anthropic',
      aiModel: 'claude-sonnet-5',
      createdAt: new Date('2026-01-01'),
    })
    await db.exercises.add({
      sentence: 'She has been living here for years.',
      levelId: 'B2',
      grammarPoints: ['present perfect continuous'],
      aiProvider: 'anthropic',
      aiModel: 'claude-sonnet-5',
      createdAt: new Date('2026-01-02'),
    })

    const all = await db.exercises.orderBy('createdAt').reverse().toArray()

    expect(all).toHaveLength(2)
    expect(all[0].sentence).toBe('She has been living here for years.')
    expect(all[1].id).toBe(olderId)
  })
})

describe('evaluations table', () => {
  it('links back to its exercise via exerciseId', async () => {
    const exerciseId = await db.exercises.add({
      sentence: 'The cat is sleeping.',
      levelId: 'A1',
      grammarPoints: ['present continuous'],
      aiProvider: 'anthropic',
      aiModel: 'claude-sonnet-5',
      createdAt: new Date(),
    })

    await db.evaluations.add({
      exerciseId,
      userTranslation: 'El gato está durmiendo.',
      scores: { meaning: 10, grammar: 10, naturalness: 9, vocabulary: 10 },
      issues: [],
      alternatives: [],
      aiProvider: 'anthropic',
      aiModel: 'claude-sonnet-5',
      createdAt: new Date(),
    })

    const found = await db.evaluations
      .where('exerciseId')
      .equals(exerciseId)
      .toArray()

    expect(found).toHaveLength(1)
    expect(found[0].userTranslation).toBe('El gato está durmiendo.')
  })

  it('returns no evaluations for an exercise that has not been evaluated yet', async () => {
    const exerciseId = await db.exercises.add({
      sentence: 'The cat is sleeping.',
      levelId: 'A1',
      grammarPoints: ['present continuous'],
      aiProvider: 'anthropic',
      aiModel: 'claude-sonnet-5',
      createdAt: new Date(),
    })

    const found = await db.evaluations
      .where('exerciseId')
      .equals(exerciseId)
      .toArray()

    expect(found).toHaveLength(0)
  })
})
