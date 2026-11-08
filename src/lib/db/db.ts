import Dexie, { type Table } from 'dexie'
import type { ExerciseRecord } from '../exercise/types'

// The record shape is defined once, as a Zod schema, next to the shapes it
// derives from — see DECISIONS.md M6.
export type { ExerciseRecord }

/** Always stored as the single row with id 1 — one provider config at a time. */
export interface SecureConfigRecord {
  id: number
  ciphertext: string
  iv: string
}

class AppDatabase extends Dexie {
  // Plain `Table` rather than `EntityTable`: the id is assigned by the app,
  // not auto-incremented, so inserts must always carry it.
  exercises!: Table<ExerciseRecord, string>
  secureConfig!: Table<SecureConfigRecord, number>

  constructor() {
    super('language-tutor')
    // Rewritten in place during development (dev data is disposable). Once
    // real data exists, versions become append-only — see DECISIONS.md M6.
    this.version(1).stores({
      exercises: 'id, levelId, solvedAt',
      secureConfig: 'id',
    })
  }
}

export const db = new AppDatabase()
