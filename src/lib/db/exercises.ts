import { db, type ExerciseRecord } from './db'

/** Writes are idempotent: the id is app-assigned, so re-saving the same
 *  exercise (e.g. a retried flush) overwrites its own row. */
export async function saveExercise(record: ExerciseRecord): Promise<void> {
  await db.exercises.put(record)
}

export async function deleteExercise(id: string): Promise<void> {
  await db.exercises.delete(id)
}

/** Import merge: inserts only ids not stored yet — local rows win on
 *  collision (DECISIONS.md M7). All or nothing, in one transaction. Returns
 *  how many were added. */
export function addMissingExercises(
  records: ExerciseRecord[],
): Promise<number> {
  return db.transaction('rw', db.exercises, async () => {
    const present = new Set(
      await db.exercises
        .where('id')
        .anyOf(records.map((r) => r.id))
        .primaryKeys(),
    )
    const missing = records.filter((r) => !present.has(r.id))
    await db.exercises.bulkAdd(missing)
    return missing.length
  })
}

/** Deletes every exercise, or only those at `levelId` when given. */
export async function deleteExercises(levelId?: string): Promise<void> {
  if (levelId === undefined) {
    await db.exercises.clear()
  } else {
    await db.exercises.where('levelId').equals(levelId).delete()
  }
}
