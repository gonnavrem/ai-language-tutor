import { db, type ExerciseRecord } from './db'

/** Writes are idempotent: the id is app-assigned, so re-saving the same
 *  exercise (e.g. a retried flush) overwrites its own row. */
export async function saveExercise(record: ExerciseRecord): Promise<void> {
  await db.exercises.put(record)
}

export async function deleteExercise(id: string): Promise<void> {
  await db.exercises.delete(id)
}

/** Deletes every exercise, or only those at `levelId` when given. */
export async function deleteExercises(levelId?: string): Promise<void> {
  if (levelId === undefined) {
    await db.exercises.clear()
  } else {
    await db.exercises.where('levelId').equals(levelId).delete()
  }
}
