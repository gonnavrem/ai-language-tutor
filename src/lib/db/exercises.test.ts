import { beforeEach, describe, expect, it } from 'vitest'
import { sampleRecord } from '../../test/fixtures'
import { db } from './db'
import { deleteExercise, deleteExercises, saveExercise } from './exercises'

beforeEach(async () => {
  await db.exercises.clear()
})

describe('exercise helpers', () => {
  it('saving the same exercise twice keeps a single row', async () => {
    const record = sampleRecord()

    await saveExercise(record)
    await saveExercise(record)

    expect(await db.exercises.count()).toBe(1)
  })

  it('deletes a single exercise by id', async () => {
    const keep = sampleRecord({ sentence: 'Keep.' })
    const remove = sampleRecord({ sentence: 'Remove.' })
    await db.exercises.bulkAdd([keep, remove])

    await deleteExercise(remove.id)

    expect(await db.exercises.toArray()).toEqual([keep])
  })

  it('deletes only the given level, or everything without one', async () => {
    await db.exercises.bulkAdd([
      sampleRecord({ levelId: 'A1' }),
      sampleRecord({ levelId: 'A1' }),
      sampleRecord({ levelId: 'B2' }),
    ])

    await deleteExercises('A1')
    expect((await db.exercises.toArray()).map((r) => r.levelId)).toEqual(['B2'])

    await deleteExercises()
    expect(await db.exercises.count()).toBe(0)
  })
})
