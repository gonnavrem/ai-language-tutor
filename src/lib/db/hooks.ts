import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

/** All solved exercises, newest first. `undefined` while loading. */
export function useExercises() {
  return useLiveQuery(
    () => db.exercises.orderBy('solvedAt').reverse().toArray(),
    [],
  )
}

/** How many solved exercises are stored. `undefined` while loading. */
export function useExerciseCount() {
  return useLiveQuery(() => db.exercises.count(), [])
}
