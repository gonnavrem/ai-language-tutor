import Dexie, { type EntityTable } from 'dexie'

export interface ExerciseRecord {
  id: number
  sentence: string
  levelId: string
  grammarPoints: string[]
  aiProvider: string
  aiModel: string
  createdAt: Date
}

export interface EvaluationScores {
  meaning: number
  grammar: number
  naturalness: number
  vocabulary: number
}

export interface EvaluationRecord {
  id: number
  exerciseId: number
  userTranslation: string
  scores: EvaluationScores
  issues: string[]
  alternatives: string[]
  aiProvider: string
  aiModel: string
  createdAt: Date
}

/** Always stored as the single row with id 1 — one provider config at a time. */
export interface SecureConfigRecord {
  id: number
  ciphertext: string
  iv: string
}

class AppDatabase extends Dexie {
  exercises!: EntityTable<ExerciseRecord, 'id'>
  evaluations!: EntityTable<EvaluationRecord, 'id'>
  secureConfig!: EntityTable<SecureConfigRecord, 'id'>

  constructor() {
    super('language-tutor')
    this.version(1).stores({
      exercises: '++id, levelId, createdAt',
      evaluations: '++id, exerciseId, createdAt',
    })
    this.version(2).stores({
      secureConfig: 'id',
    })
  }
}

export const db = new AppDatabase()
