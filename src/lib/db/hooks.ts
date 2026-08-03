import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

export function useExercises() {
  return useLiveQuery(
    () => db.exercises.orderBy('createdAt').reverse().toArray(),
    [],
  )
}

export function useEvaluationsForExercise(exerciseId: number | undefined) {
  return useLiveQuery(() => {
    if (exerciseId === undefined) return []
    return db.evaluations.where('exerciseId').equals(exerciseId).toArray()
  }, [exerciseId])
}
