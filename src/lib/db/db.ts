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

class AppDatabase extends Dexie {
  exercises!: EntityTable<ExerciseRecord, 'id'>
  evaluations!: EntityTable<EvaluationRecord, 'id'>

  constructor() {
    super('language-tutor')
    this.version(1).stores({
      exercises: '++id, levelId, createdAt',
      evaluations: '++id, exerciseId, createdAt',
    })
  }
}

export const db = new AppDatabase()
