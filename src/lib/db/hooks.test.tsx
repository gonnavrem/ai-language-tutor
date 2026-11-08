import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { sampleRecord } from '../../test/fixtures'
import { db } from './db'
import { useExercises } from './hooks'

beforeEach(async () => {
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

    await db.exercises.add(sampleRecord())

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current?.[0].sentence).toBe('The cat is sleeping.')
  })

  it('orders by solvedAt, newest first', async () => {
    await db.exercises.add(sampleRecord({ sentence: 'Old.' }))
    await db.exercises.add(
      sampleRecord({ sentence: 'New.', solvedAt: new Date('2026-02-01') }),
    )

    const { result } = renderHook(() => useExercises())

    await waitFor(() =>
      expect(result.current?.map((r) => r.sentence)).toEqual(['New.', 'Old.']),
    )
  })
})
