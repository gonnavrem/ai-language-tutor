import { beforeEach, describe, expect, it } from 'vitest'
import { sampleRecord } from '../../test/fixtures'
import { db } from './db'

beforeEach(async () => {
  await db.exercises.clear()
})

describe('exercises table', () => {
  it('stores a solved exercise with its embedded evaluation, newest first', async () => {
    const older = sampleRecord()
    await db.exercises.add(older)
    await db.exercises.add(
      sampleRecord({
        sentence: 'She has been living here for years.',
        solvedAt: new Date('2026-01-02'),
      }),
    )

    const all = await db.exercises.orderBy('solvedAt').reverse().toArray()

    expect(all).toHaveLength(2)
    expect(all[0].sentence).toBe('She has been living here for years.')
    expect(all[1].id).toBe(older.id)
    expect(all[1].evaluation.scores.naturalness).toBe(4)
    expect(all[1].solvedAt).toBeInstanceOf(Date)
  })
})
