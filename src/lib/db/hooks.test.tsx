import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { db } from './db'
import { useEvaluationsForExercise, useExercises } from './hooks'

beforeEach(async () => {
  await db.evaluations.clear()
  await db.exercises.clear()
})

describe('useExercises', () => {
  it('resolves from undefined (loading) to an empty list', async () => {
    const { result } = renderHook(() => useExercises())

    await waitFor(() => expect(result.current).toEqual([]))
  })

  it('picks up an exercise added after the hook has already rendered', async () => {
    const { result } = renderHook(() => useExercises())
    await waitFor(() => expect(result.current).toEqual([]))

    await db.exercises.add({
      sentence: 'The cat is sleeping.',
      levelId: 'A1',
      grammarPoints: ['present continuous'],
      aiProvider: 'anthropic',
      aiModel: 'claude-sonnet-5',
      createdAt: new Date(),
    })

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current?.[0].sentence).toBe('The cat is sleeping.')
  })
})

describe('useEvaluationsForExercise', () => {
  it('returns an empty array while no exercise id is given', async () => {
    const { result } = renderHook(() => useEvaluationsForExercise(undefined))

    await waitFor(() => expect(result.current).toEqual([]))
  })

  it('picks up an evaluation added after the hook has already rendered', async () => {
    const exerciseId = await db.exercises.add({
      sentence: 'The cat is sleeping.',
      levelId: 'A1',
      grammarPoints: ['present continuous'],
      aiProvider: 'anthropic',
      aiModel: 'claude-sonnet-5',
      createdAt: new Date(),
    })

    const { result } = renderHook(() => useEvaluationsForExercise(exerciseId))
    await waitFor(() => expect(result.current).toEqual([]))

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

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current?.[0].userTranslation).toBe('El gato está durmiendo.')
  })
})
